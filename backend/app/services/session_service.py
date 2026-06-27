"""
Session Service - Session Management
===================================
Service quản lý session, refresh token, và session security.
Hỗ trợ session rotation, concurrent session limits, và session monitoring.
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging
from enum import Enum

from app.core.config import settings
from app.database import get_database
from app.core.security import security_service

logger = logging.getLogger(__name__)

class SessionStatus(str, Enum):
    """Trạng thái session"""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    SUSPICIOUS = "suspicious"

class SessionService:
    """Service quản lý session"""
    
    def __init__(self):
        self.db = get_database()
        self.max_concurrent_sessions = 5
        self.session_timeout_minutes = 30
        self.refresh_token_timeout_days = 7
        self.suspicious_activity_threshold = 10
    
    def create_session(
        self,
        user_id: str,
        ip_address: str,
        user_agent: str,
        device_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Tạo session mới
        
        Args:
            user_id: ID người dùng
            ip_address: IP address
            user_agent: User agent string
            device_info: Thông tin thiết bị
            
        Returns:
            Session data với access và refresh token
        """
        try:
            # Kiểm tra số session hiện tại
            active_sessions = self.get_active_sessions(user_id)
            if len(active_sessions) >= self.max_concurrent_sessions:
                # Revoke session cũ nhất
                oldest_session = min(active_sessions, key=lambda x: x["created_at"])
                self.revoke_session(oldest_session["session_id"])
            
            # Tạo session ID
            session_id = secrets.token_urlsafe(32)
            
            # Tạo tokens
            access_token_data = {
                "sub": user_id,
                "session_id": session_id,
                "type": "access"
            }
            
            refresh_token_data = {
                "sub": user_id,
                "session_id": session_id,
                "type": "refresh"
            }
            
            access_token = security_service.create_access_token(access_token_data)
            refresh_token = security_service.create_refresh_token(refresh_token_data)
            
            # Lưu session vào database
            session_doc = {
                "session_id": session_id,
                "user_id": user_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "device_info": device_info or {},
                "access_token_hash": self._hash_token(access_token),
                "refresh_token_hash": self._hash_token(refresh_token),
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=self.session_timeout_minutes),
                "refresh_expires_at": datetime.utcnow() + timedelta(days=self.refresh_token_timeout_days),
                "status": SessionStatus.ACTIVE.value,
                "login_count": 1,
                "suspicious_activity_count": 0
            }
            
            result = self.db.sessions.insert_one(session_doc)
            
            if result.inserted_id:
                logger.info(f"Session created for user {user_id}, session_id: {session_id}")
                
                # Log security event
                security_service.log_security_event(
                    event_type="session_created",
                    user_id=user_id,
                    ip_address=ip_address,
                    details={
                        "session_id": session_id,
                        "user_agent": user_agent,
                        "device_info": device_info
                    }
                )
                
                return {
                    "session_id": session_id,
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_at": session_doc["expires_at"],
                    "refresh_expires_at": session_doc["refresh_expires_at"]
                }
            else:
                logger.error(f"Failed to create session for user {user_id}")
                return {}
                
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return {}
    
    def refresh_session(self, refresh_token: str, ip_address: str) -> Optional[Dict[str, Any]]:
        """
        Refresh session với refresh token
        
        Args:
            refresh_token: Refresh token
            ip_address: IP address hiện tại
            
        Returns:
            Session data mới hoặc None nếu lỗi
        """
        try:
            # Verify refresh token
            payload = security_service.verify_token(refresh_token)
            if not payload or payload.get("type") != "refresh":
                logger.warning("Invalid refresh token")
                return None
            
            user_id = payload.get("sub")
            session_id = payload.get("session_id")
            
            if not user_id or not session_id:
                logger.warning("Invalid refresh token payload")
                return None
            
            # Tìm session
            session_doc = self.db.sessions.find_one({
                "session_id": session_id,
                "user_id": user_id,
                "status": SessionStatus.ACTIVE.value,
                "refresh_expires_at": {"$gt": datetime.utcnow()}
            })
            
            if not session_doc:
                logger.warning(f"Session not found or expired: {session_id}")
                return None
            
            # Kiểm tra IP address (có thể thay đổi)
            if session_doc["ip_address"] != ip_address:
                self._mark_suspicious_activity(session_id, "ip_address_change", ip_address)
            
            # Tạo tokens mới
            access_token_data = {
                "sub": user_id,
                "session_id": session_id,
                "type": "access"
            }
            
            new_access_token = security_service.create_access_token(access_token_data)
            
            # Cập nhật session
            self.db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "access_token_hash": self._hash_token(new_access_token),
                        "last_activity": datetime.utcnow(),
                        "expires_at": datetime.utcnow() + timedelta(minutes=self.session_timeout_minutes)
                    },
                    "$inc": {"login_count": 1}
                }
            )
            
            logger.info(f"Session refreshed for user {user_id}, session_id: {session_id}")
            
            return {
                "session_id": session_id,
                "access_token": new_access_token,
                "expires_at": datetime.utcnow() + timedelta(minutes=self.session_timeout_minutes)
            }
            
        except Exception as e:
            logger.error(f"Error refreshing session: {e}")
            return None
    
    def revoke_session(self, session_id: str, reason: str = "user_logout") -> bool:
        """
        Revoke session
        
        Args:
            session_id: Session ID
            reason: Lý do revoke
            
        Returns:
            True nếu thành công
        """
        try:
            result = self.db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "status": SessionStatus.REVOKED.value,
                        "revoked_at": datetime.utcnow(),
                        "revoke_reason": reason
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Session revoked: {session_id}, reason: {reason}")
                
                # Log security event
                session_doc = self.db.sessions.find_one({"session_id": session_id})
                if session_doc:
                    security_service.log_security_event(
                        event_type="session_revoked",
                        user_id=session_doc["user_id"],
                        ip_address=session_doc["ip_address"],
                        details={"reason": reason, "session_id": session_id}
                    )
                
                return True
            else:
                logger.warning(f"Session not found for revocation: {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error revoking session: {e}")
            return False
    
    def revoke_all_user_sessions(self, user_id: str, reason: str = "security_measure") -> int:
        """
        Revoke tất cả session của user
        
        Args:
            user_id: User ID
            reason: Lý do revoke
            
        Returns:
            Số session đã revoke
        """
        try:
            result = self.db.sessions.update_many(
                {
                    "user_id": user_id,
                    "status": SessionStatus.ACTIVE.value
                },
                {
                    "$set": {
                        "status": SessionStatus.REVOKED.value,
                        "revoked_at": datetime.utcnow(),
                        "revoke_reason": reason
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Revoked {result.modified_count} sessions for user {user_id}")
                
                # Log security event
                security_service.log_security_event(
                    event_type="all_sessions_revoked",
                    user_id=user_id,
                    details={"reason": reason, "count": result.modified_count},
                    severity="high"
                )
            
            return result.modified_count
            
        except Exception as e:
            logger.error(f"Error revoking all user sessions: {e}")
            return 0
    
    def get_active_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Lấy danh sách session đang hoạt động của user"""
        try:
            sessions = list(self.db.sessions.find({
                "user_id": user_id,
                "status": SessionStatus.ACTIVE.value,
                "expires_at": {"$gt": datetime.utcnow()}
            }, {"_id": 0}))
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting active sessions: {e}")
            return []
    
    def update_session_activity(self, session_id: str, ip_address: str):
        """Cập nhật hoạt động session"""
        try:
            # Cập nhật last_activity
            self.db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "last_activity": datetime.utcnow(),
                        "expires_at": datetime.utcnow() + timedelta(minutes=self.session_timeout_minutes)
                    }
                }
            )
            
            # Kiểm tra IP address change
            session_doc = self.db.sessions.find_one({"session_id": session_id})
            if session_doc and session_doc["ip_address"] != ip_address:
                self._mark_suspicious_activity(session_id, "ip_address_change", ip_address)
                
        except Exception as e:
            logger.error(f"Error updating session activity: {e}")
    
    def _mark_suspicious_activity(self, session_id: str, activity_type: str, details: str):
        """Đánh dấu hoạt động đáng ngờ"""
        try:
            # Tăng suspicious activity count
            result = self.db.sessions.update_one(
                {"session_id": session_id},
                {"$inc": {"suspicious_activity_count": 1}}
            )
            
            if result.modified_count > 0:
                # Kiểm tra threshold
                session_doc = self.db.sessions.find_one({"session_id": session_id})
                if session_doc and session_doc["suspicious_activity_count"] >= self.suspicious_activity_threshold:
                    # Mark session as suspicious
                    self.db.sessions.update_one(
                        {"session_id": session_id},
                        {"$set": {"status": SessionStatus.SUSPICIOUS.value}}
                    )
                    
                    logger.warning(f"Session marked as suspicious: {session_id}")
                    
                    # Log security event
                    security_service.log_security_event(
                        event_type="suspicious_session",
                        user_id=session_doc["user_id"],
                        ip_address=session_doc["ip_address"],
                        details={
                            "session_id": session_id,
                            "activity_type": activity_type,
                            "details": details,
                            "count": session_doc["suspicious_activity_count"]
                        },
                        severity="high"
                    )
            
        except Exception as e:
            logger.error(f"Error marking suspicious activity: {e}")
    
    def _hash_token(self, token: str) -> str:
        """Hash token để lưu trữ an toàn"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def cleanup_expired_sessions(self):
        """Dọn dẹp session hết hạn"""
        try:
            # Đánh dấu session hết hạn
            result = self.db.sessions.update_many(
                {
                    "status": SessionStatus.ACTIVE.value,
                    "expires_at": {"$lt": datetime.utcnow()}
                },
                {"$set": {"status": SessionStatus.EXPIRED.value}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Marked {result.modified_count} sessions as expired")
            
            # Xóa session cũ (sau 30 ngày)
            cutoff_time = datetime.utcnow() - timedelta(days=30)
            delete_result = self.db.sessions.delete_many({
                "created_at": {"$lt": cutoff_time}
            })
            
            if delete_result.deleted_count > 0:
                logger.info(f"Deleted {delete_result.deleted_count} old sessions")
                
        except Exception as e:
            logger.error(f"Error cleaning up expired sessions: {e}")
    
    def get_session_stats(self, user_id: str) -> Dict[str, Any]:
        """Lấy thống kê session của user"""
        try:
            total_sessions = self.db.sessions.count_documents({"user_id": user_id})
            active_sessions = self.db.sessions.count_documents({
                "user_id": user_id,
                "status": SessionStatus.ACTIVE.value
            })
            revoked_sessions = self.db.sessions.count_documents({
                "user_id": user_id,
                "status": SessionStatus.REVOKED.value
            })
            suspicious_sessions = self.db.sessions.count_documents({
                "user_id": user_id,
                "status": SessionStatus.SUSPICIOUS.value
            })
            
            return {
                "total_sessions": total_sessions,
                "active_sessions": active_sessions,
                "revoked_sessions": revoked_sessions,
                "suspicious_sessions": suspicious_sessions,
                "current_sessions": self.get_active_sessions(user_id)
            }
            
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}

# Global instance
session_service = SessionService() 