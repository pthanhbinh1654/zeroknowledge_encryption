"""
OTP Service - One-Time Password Management
========================================
Service quản lý OTP cho xác thực 2FA và email verification.
Hỗ trợ TOTP, HOTP, và email OTP.
"""

import secrets
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging
from dataclasses import dataclass

from app.database import get_database
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

@dataclass
class OTPRecord:
    """Record lưu trữ thông tin OTP"""
    user_id: str
    otp_code: str
    purpose: str  # 'registration', 'login', 'password_reset', 'email_change'
    expires_at: datetime
    attempts: int = 0
    max_attempts: int = 5
    is_used: bool = False
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()

class OTPService:
    """Service quản lý OTP"""
    
    def __init__(self):
        self.db = get_database()
        self.email_service = EmailService()
        self.otp_collection = self.db.otp_codes
        
        # Cấu hình OTP
        self.otp_length = 6
        self.otp_expiry_minutes = 10
        self.max_attempts = 3
        
    def generate_otp(self) -> str:
        """Tạo mã OTP ngẫu nhiên"""
        return ''.join(secrets.choice('0123456789') for _ in range(self.otp_length))
    
    def create_otp(
        self,
        user_id: str,
        purpose: str,
        email: str = None,
        username: str = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> Optional[str]:
        """Tạo và lưu OTP cho user"""
        try:
            # Tạo OTP code
            otp_code = self.generate_otp()
            expires_at = datetime.utcnow() + timedelta(minutes=self.otp_expiry_minutes)
            
            # Tạo OTP record
            otp_record = OTPRecord(
                user_id=user_id,
                otp_code=otp_code,
                purpose=purpose,
                expires_at=expires_at
            )
            
            # Lưu vào database
            otp_doc = {
                "user_id": otp_record.user_id,
                "otp_code": otp_record.otp_code,
                "purpose": otp_record.purpose,
                "expires_at": otp_record.expires_at,
                "attempts": otp_record.attempts,
                "max_attempts": otp_record.max_attempts,
                "is_used": otp_record.is_used,
                "created_at": otp_record.created_at
            }
            
            # Xóa OTP cũ của user này cho cùng purpose
            self.otp_collection.delete_many({
                "user_id": user_id,
                "purpose": purpose,
                "is_used": False
            })
            
            # Lưu OTP mới
            result = self.otp_collection.insert_one(otp_doc)
            
            if result.inserted_id:
                logger.info(f"OTP created for user {user_id}, purpose: {purpose}")
                
                # Gửi email OTP nếu có email
                if email:
                    try:
                        self.email_service.send_otp_email(
                            to_email=email,
                            username=username or "",
                            otp_code=otp_code,
                            purpose=purpose
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send email OTP: {e}")
                        # Không fail registration nếu email không gửi được
                
                return otp_code
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating OTP: {e}")
            return None
    
    def verify_otp(
        self,
        user_id: str,
        otp_code: str,
        purpose: str
    ) -> Dict[str, Any]:
        """Xác thực OTP code"""
        try:
            # Tìm OTP record
            otp_doc = self.otp_collection.find_one({
                "user_id": user_id,
                "purpose": purpose,
                "is_used": False,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            
            if not otp_doc:
                return {
                    "valid": False,
                    "message": "OTP không tồn tại hoặc đã hết hạn"
                }
            
            # Kiểm tra số lần thử
            if otp_doc["attempts"] >= otp_doc["max_attempts"]:
                return {
                    "valid": False,
                    "message": "Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới."
                }
            
            # Kiểm tra OTP code trước
            if otp_doc["otp_code"] != otp_code:
                # Tăng số lần thử chỉ khi OTP sai
                self.otp_collection.update_one(
                    {"_id": otp_doc["_id"]},
                    {"$inc": {"attempts": 1}}
                )
                return {
                    "valid": False,
                    "message": "OTP bị sai vui lòng nhập lại"
                }
            
            # Đánh dấu OTP đã sử dụng
            self.otp_collection.update_one(
                {"_id": otp_doc["_id"]},
                {"$set": {"is_used": True}}
            )
            
            logger.info(f"OTP verified successfully for user {user_id}, purpose: {purpose}")
            
            return {
                "valid": True,
                "message": "Xác thực OTP thành công"
            }
            
        except Exception as e:
            logger.error(f"Error verifying OTP: {e}")
            return {
                "valid": False,
                "message": "Lỗi xác thực OTP"
            }
    
    def resend_otp(
        self,
        user_id: str,
        purpose: str,
        email: str = None,
        username: str = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> bool:
        """Gửi lại OTP"""
        try:
            # Xóa OTP cũ
            self.otp_collection.delete_many({
                "user_id": user_id,
                "purpose": purpose,
                "is_used": False
            })
            
            # Tạo OTP mới
            otp_code = self.create_otp(
                user_id=user_id,
                purpose=purpose,
                email=email,
                username=username,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            return otp_code is not None
            
        except Exception as e:
            logger.error(f"Error resending OTP: {e}")
            return False
    
    def cleanup_expired_otp(self):
        """Dọn dẹp OTP đã hết hạn"""
        try:
            result = self.otp_collection.delete_many({
                "$or": [
                    {"expires_at": {"$lt": datetime.utcnow()}},
                    {"is_used": True}
                ]
            })
            
            logger.info(f"Cleaned up {result.deleted_count} expired OTP records")
            
        except Exception as e:
            logger.error(f"Error cleaning up expired OTP: {e}")
    
    def get_otp_status(
        self,
        user_id: str,
        purpose: str
    ) -> Dict[str, Any]:
        """Lấy trạng thái OTP hiện tại"""
        try:
            otp_doc = self.otp_collection.find_one({
                "user_id": user_id,
                "purpose": purpose,
                "is_used": False,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            
            if not otp_doc:
                return {
                    "exists": False,
                    "expires_in": 0
                }
            
            expires_in = (otp_doc["expires_at"] - datetime.utcnow()).total_seconds()
            
            return {
                "exists": True,
                "expires_in": int(expires_in),
                "attempts": otp_doc["attempts"],
                "max_attempts": otp_doc["max_attempts"]
            }
            
        except Exception as e:
            logger.error(f"Error getting OTP status: {e}")
            return {
                "exists": False,
                "expires_in": 0
            }
    
    def get_otp_attempts(self, user_id: str, purpose: str) -> int:
        """Lấy số lần thử OTP của user"""
        try:
            otp_doc = self.otp_collection.find_one({
                "user_id": user_id,
                "purpose": purpose,
                "is_used": False,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            
            if not otp_doc:
                return 0
            
            return otp_doc.get("attempts", 0)
            
        except Exception as e:
            logger.error(f"Error getting OTP attempts: {e}")
            return 0
    
    def increment_otp_attempts(self, user_id: str, purpose: str) -> bool:
        """Tăng số lần thử OTP"""
        try:
            result = self.otp_collection.update_one(
                {
                    "user_id": user_id,
                    "purpose": purpose,
                    "is_used": False,
                    "expires_at": {"$gt": datetime.utcnow()}
                },
                {"$inc": {"attempts": 1}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error incrementing OTP attempts: {e}")
            return False
    
    def reset_otp_attempts(self, user_id: str, purpose: str) -> bool:
        """Reset số lần thử OTP về 0"""
        try:
            result = self.otp_collection.update_one(
                {
                    "user_id": user_id,
                    "purpose": purpose,
                    "is_used": False,
                    "expires_at": {"$gt": datetime.utcnow()}
                },
                {"$set": {"attempts": 0}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error resetting OTP attempts: {e}")
            return False

# Create instance
otp_service = OTPService()