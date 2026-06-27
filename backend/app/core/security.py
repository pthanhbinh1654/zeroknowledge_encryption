"""
Security Module - Anti-Attack Measures
======================================
Module chứa các biện pháp bảo mật chống tấn công:
- Rate limiting
- hCaptcha integration
- Session management
- Input validation
- Audit logging
"""

import time
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from functools import wraps
import logging
from enum import Enum
from bson import ObjectId

from fastapi import HTTPException, status, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import re

from app.core.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT Bearer
security = HTTPBearer()

class SecurityLevel(str, Enum):
    """Mức độ bảo mật"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AttackType(str, Enum):
    """Các loại tấn công"""
    BRUTE_FORCE = "brute_force"
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    CSRF = "csrf"
    RATE_LIMIT = "rate_limit"
    INVALID_TOKEN = "invalid_token"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"

class SecurityService:
    """Service quản lý bảo mật"""
    
    def __init__(self):
        self.db = get_database()
        self.rate_limit_window = 300  # 5 minutes
        self.max_requests_per_window = {
            "login": 5,
            "register": 3,
            "password_reset": 3,
            "otp": 3,
            "api": 100
        }
        self.block_duration = 1800  # 30 minutes
        self.suspicious_patterns = [
            r"(\b(union|select|insert|update|delete|drop|create|alter)\b)",
            r"(\b(script|javascript|onload|onerror)\b)",
            r"(\b(admin|root|test|guest)\b)",
            r"(\b(password|passwd|pwd)\b)",
            r"(\b(union|select|insert|update|delete|drop|create|alter)\b)",
        ]
    
    def hash_password(self, password: str) -> str:
        """Hash password với bcrypt"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Xác thực password"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Tạo JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Tạo JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Xác thực JWT token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            return None
    
    def check_rate_limit(self, identifier: str, action: str) -> bool:
        """Kiểm tra rate limit"""
        try:
            window_start = datetime.utcnow() - timedelta(seconds=self.rate_limit_window)
            max_requests = self.max_requests_per_window.get(action, 100)
            
            # Kiểm tra block status
            block_doc = self.db.security_blocks.find_one({
                "identifier": identifier,
                "action": action,
                "blocked_until": {"$gt": datetime.utcnow()}
            })
            
            if block_doc:
                logger.warning(f"Rate limit blocked: {identifier} for {action}")
                return False
            
            # Đếm requests trong window
            count = self.db.rate_limits.count_documents({
                "identifier": identifier,
                "action": action,
                "timestamp": {"$gte": window_start}
            })
            
            if count >= max_requests:
                # Block user
                self._block_user(identifier, action)
                return False
            
            # Log request
            self.db.rate_limits.insert_one({
                "identifier": identifier,
                "action": action,
                "timestamp": datetime.utcnow(),
                "ip_address": identifier if self._is_ip(identifier) else None
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return True  # Allow if error
    
    def _block_user(self, identifier: str, action: str):
        """Block user do vi phạm rate limit"""
        try:
            block_until = datetime.utcnow() + timedelta(seconds=self.block_duration)
            
            self.db.security_blocks.insert_one({
                "identifier": identifier,
                "action": action,
                "blocked_at": datetime.utcnow(),
                "blocked_until": block_until,
                "reason": "rate_limit_exceeded"
            })
            
            logger.warning(f"User blocked: {identifier} for {action} until {block_until}")
            
        except Exception as e:
            logger.error(f"Error blocking user: {e}")
    
    def _is_ip(self, identifier: str) -> bool:
        """Kiểm tra identifier có phải IP address không"""
        ip_pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
        return bool(re.match(ip_pattern, identifier))
    
    def validate_input(self, data: str, security_level: SecurityLevel = SecurityLevel.MEDIUM) -> bool:
        """Validate input để chống SQL injection, XSS"""
        try:
            data_lower = data.lower()
            
            # Kiểm tra patterns đáng ngờ
            for pattern in self.suspicious_patterns:
                if re.search(pattern, data_lower):
                    self._log_suspicious_activity("input_validation", f"Pattern matched: {pattern}")
                    return False
            
            # Kiểm tra độ dài
            if len(data) > 10000:  # Max 10KB
                return False
            
            # Kiểm tra ký tự đặc biệt
            if security_level in [SecurityLevel.HIGH, SecurityLevel.CRITICAL]:
                dangerous_chars = ['<', '>', '"', "'", '&', ';', '(', ')', '{', '}']
                if any(char in data for char in dangerous_chars):
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating input: {e}")
            return False
    
    def verify_hcaptcha(self, hcaptcha_token: str) -> bool:
        """Xác thực hCaptcha token"""
        try:
            # TODO: Implement hCaptcha verification
            # For now, return True in development
            if settings.ENVIRONMENT == "development":
                return True
            
            # Production implementation
            # import requests
            # response = requests.post('https://hcaptcha.com/siteverify', data={
            #     'secret': settings.HCAPTCHA_SECRET_KEY,
            #     'response': hcaptcha_token
            # })
            # return response.json().get('success', False)
            
            return True
            
        except Exception as e:
            logger.error(f"Error verifying hCaptcha: {e}")
            return False
    
    def log_security_event(
        self,
        event_type: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: SecurityLevel = SecurityLevel.MEDIUM
    ):
        """Log security event"""
        try:
            event = {
                "event_type": event_type,
                "user_id": user_id,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow(),
                "severity": severity.value,
                "details": details or {},
                "user_agent": details.get("user_agent") if details else None
            }
            
            self.db.security_logs.insert_one(event)
            
            # Alert for critical events
            if severity == SecurityLevel.CRITICAL:
                self._send_security_alert(event)
                
        except Exception as e:
            logger.error(f"Error logging security event: {e}")
    
    def _log_suspicious_activity(self, activity_type: str, details: str):
        """Log suspicious activity"""
        self.log_security_event(
            event_type="suspicious_activity",
            details={"activity_type": activity_type, "details": details},
            severity=SecurityLevel.HIGH
        )
    
    def _send_security_alert(self, event: Dict[str, Any]):
        """Gửi cảnh báo bảo mật"""
        # TODO: Implement security alert (email, SMS, Slack, etc.)
        logger.critical(f"SECURITY ALERT: {event}")
    
    def get_security_stats(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Lấy thống kê bảo mật"""
        try:
            stats = {}
            
            # Rate limit violations
            if user_id:
                rate_limit_violations = self.db.security_blocks.count_documents({
                    "identifier": user_id
                })
                stats["rate_limit_violations"] = rate_limit_violations
            
            # Recent security events
            recent_events = list(self.db.security_logs.find(
                {"user_id": user_id} if user_id else {},
                {"_id": 0}
            ).sort("timestamp", -1).limit(10))
            
            stats["recent_events"] = recent_events
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting security stats: {e}")
            return {}
    
    def cleanup_old_logs(self):
        """Dọn dẹp logs cũ"""
        try:
            # Xóa logs cũ hơn 30 ngày
            cutoff_time = datetime.utcnow() - timedelta(days=30)
            
            result = self.db.security_logs.delete_many({
                "timestamp": {"$lt": cutoff_time}
            })
            
            if result.deleted_count > 0:
                logger.info(f"Cleaned up {result.deleted_count} old security logs")
                
        except Exception as e:
            logger.error(f"Error cleaning up old logs: {e}")
    
    def get_recent_security_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Lấy các sự kiện bảo mật gần đây"""
        try:
            events = list(self.db.security_logs.find(
                {},
                {"_id": 0}
            ).sort("timestamp", -1).limit(limit))
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting recent security events: {e}")
            return []
    
    def get_blocked_ips(self) -> List[Dict[str, Any]]:
        """Lấy danh sách IP bị block"""
        try:
            blocked_ips = list(self.db.security_blocks.find({
                "blocked_until": {"$gt": datetime.utcnow()}
            }).sort("blocked_at", -1))
            
            # Convert ObjectId to string
            for ip in blocked_ips:
                ip["_id"] = str(ip["_id"])
            
            return blocked_ips
            
        except Exception as e:
            logger.error(f"Error getting blocked IPs: {e}")
            return []
    
    def unblock_ip(self, ip_address: str) -> bool:
        """Unblock IP address"""
        try:
            result = self.db.security_blocks.delete_one({
                "identifier": ip_address
            })
            
            if result.deleted_count > 0:
                logger.info(f"IP {ip_address} unblocked")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error unblocking IP: {e}")
            return False
    
    def analyze_ip_behavior(self, ip_address: str) -> Dict[str, Any]:
        """Phân tích hành vi của IP"""
        try:
            # Lấy tất cả sự kiện của IP trong 24h qua
            one_day_ago = datetime.utcnow() - timedelta(hours=24)
            events = list(self.db.security_logs.find({
                "ip_address": ip_address,
                "timestamp": {"$gte": one_day_ago}
            }).sort("timestamp", -1))
            
            # Phân tích patterns
            event_types = [e["event_type"] for e in events]
            event_count = len(events)
            
            # Tính risk score
            risk_score = 0
            risk_factors = []
            
            if event_count > 50:
                risk_score += 30
                risk_factors.append("High request volume")
            
            if event_types.count("failed_login") > 5:
                risk_score += 25
                risk_factors.append("Multiple login failures")
            
            if event_types.count("suspicious_activity") > 3:
                risk_score += 20
                risk_factors.append("Multiple suspicious activities")
            
            if "suspicious_activity" in event_types:
                risk_score += 15
                risk_factors.append("Suspicious activity detected")
            
            # Kiểm tra block status
            is_blocked = self.db.security_blocks.find_one({
                "identifier": ip_address,
                "blocked_until": {"$gt": datetime.utcnow()}
            }) is not None
            
            return {
                "ip_address": ip_address,
                "total_events_24h": event_count,
                "event_types": list(set(event_types)),
                "risk_score": min(risk_score, 100),
                "risk_factors": risk_factors,
                "is_blocked": is_blocked,
                "last_event": events[0]["timestamp"] if events else None
            }
            
        except Exception as e:
            logger.error(f"Error analyzing IP behavior: {e}")
            return {}

    def get_user_recent_activity(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Lấy hoạt động gần đây của user

        Args:
            user_id: ID của user
            limit: Số lượng hoạt động tối đa

        Returns:
            List[Dict]: Danh sách hoạt động gần đây
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return []

            # Query recent security events for user
            events_cursor = self.db.security_events.find(
                {"user_id": object_id}
            ).sort("timestamp", -1).limit(limit)

            recent_activity = []
            for event in events_cursor:
                recent_activity.append({
                    "timestamp": event.get("timestamp"),
                    "action": event.get("event_type", "Unknown"),
                    "details": event.get("details", {}),
                    "ip_address": event.get("ip_address")
                })

            return recent_activity

        except Exception as e:
            logger.error(f"Error getting recent activity for user {user_id}: {e}")
            return []

# Global instance
security_service = SecurityService()

# Decorators
def rate_limit(action: str):
    """Decorator để áp dụng rate limiting"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract identifier (IP or user ID)
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                return await func(*args, **kwargs)
            
            # Get identifier
            identifier = request.client.host  # IP address
            user_id = getattr(request.state, 'user_id', None)
            if user_id:
                identifier = user_id
            
            # Check rate limit
            if not security_service.check_rate_limit(identifier, action):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {action}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_hcaptcha():
    """Decorator để yêu cầu hCaptcha"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # TODO: Implement hCaptcha requirement
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def validate_input(security_level: SecurityLevel = SecurityLevel.MEDIUM):
    """Decorator để validate input"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # TODO: Implement input validation
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[Dict[str, Any]]:
    """Get current user from JWT token"""
    try:
        payload = security_service.verify_token(credentials.credentials)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
    
 