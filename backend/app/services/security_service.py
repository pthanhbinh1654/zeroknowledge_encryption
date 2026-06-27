"""
Security Service
================
Service quản lý bảo mật, audit logs, và monitoring.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import DESCENDING

from app.database import get_database
from app.core.config import settings

logger = logging.getLogger(__name__)

class SecurityService:
    """Service quản lý bảo mật và audit logs"""
    
    def __init__(self):
        self.db = get_database()
        
    def log_security_event(
        self,
        event_type: str,
        user_id: str,
        ip_address: str = "",
        user_agent: str = "",
        details: Dict[str, Any] = None,
        severity: str = "medium",
        status: str = "success"
    ) -> bool:
        """
        Ghi log sự kiện bảo mật
        
        Args:
            event_type: Loại sự kiện (login, logout, file_upload, etc.)
            user_id: ID của user
            ip_address: IP address
            user_agent: User agent string
            details: Chi tiết bổ sung
            severity: Mức độ nghiêm trọng (low, medium, high, critical)
            status: Trạng thái (success, failed, blocked)
            
        Returns:
            bool: True nếu ghi log thành công
        """
        try:
            # Get username
            user = self.db.users.find_one({"_id": ObjectId(user_id)})
            username = user.get("username", "unknown") if user else "unknown"
            
            # Create security event document
            event_doc = {
                "event_type": event_type,
                "user_id": ObjectId(user_id),
                "username": username,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "timestamp": datetime.utcnow(),
                "details": details or {},
                "severity": severity,
                "status": status
            }
            
            # Insert into security_events collection
            result = self.db.security_events.insert_one(event_doc)
            
            # Check for suspicious activity
            self._check_suspicious_activity(user_id, event_type, ip_address)
            
            logger.info(f"Security event logged: {event_type} for user {username}")
            return bool(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error logging security event: {e}")
            return False
    
    def get_audit_logs(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 20,
        filters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Lấy audit logs với filtering và pagination
        
        Args:
            user_id: ID của user (chỉ lấy logs của user này)
            page: Số trang
            per_page: Số items mỗi trang
            filters: Bộ lọc
            
        Returns:
            Dict chứa events và pagination info
        """
        try:
            # Build query
            query = {"user_id": ObjectId(user_id)}
            
            if filters:
                if "event_type" in filters:
                    query["event_type"] = filters["event_type"]
                    
                if "severity" in filters:
                    query["severity"] = filters["severity"]
                    
                if "status" in filters:
                    query["status"] = filters["status"]
                    
                if "date_from" in filters or "date_to" in filters:
                    date_query = {}
                    if "date_from" in filters:
                        date_query["$gte"] = filters["date_from"]
                    if "date_to" in filters:
                        date_query["$lte"] = filters["date_to"]
                    query["timestamp"] = date_query
                    
                if "search" in filters:
                    search_term = filters["search"]
                    query["$or"] = [
                        {"ip_address": {"$regex": search_term, "$options": "i"}},
                        {"username": {"$regex": search_term, "$options": "i"}},
                        {"user_agent": {"$regex": search_term, "$options": "i"}},
                        {"details": {"$regex": search_term, "$options": "i"}}
                    ]
            
            # Get total count
            total = self.db.security_events.count_documents(query)
            
            # Get paginated results
            skip = (page - 1) * per_page
            cursor = self.db.security_events.find(query).sort("timestamp", DESCENDING).skip(skip).limit(per_page)
            
            events = []
            for doc in cursor:
                event = {
                    "id": str(doc["_id"]),
                    "event_type": doc["event_type"],
                    "user_id": str(doc["user_id"]),
                    "username": doc["username"],
                    "ip_address": doc["ip_address"],
                    "user_agent": doc["user_agent"],
                    "timestamp": doc["timestamp"].isoformat(),
                    "details": doc["details"],
                    "severity": doc["severity"],
                    "status": doc["status"]
                }
                events.append(event)
            
            return {
                "events": events,
                "total": total
            }
            
        except Exception as e:
            logger.error(f"Error getting audit logs: {e}")
            return {"events": [], "total": 0}
    
    def get_audit_log_stats(
        self,
        user_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Lấy thống kê audit logs
        
        Args:
            user_id: ID của user
            days: Số ngày để phân tích
            
        Returns:
            Dict chứa thống kê
        """
        try:
            # Calculate date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            query = {
                "user_id": ObjectId(user_id),
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }
            
            # Aggregate statistics
            pipeline = [
                {"$match": query},
                {"$group": {
                    "_id": {
                        "event_type": "$event_type",
                        "severity": "$severity",
                        "status": "$status"
                    },
                    "count": {"$sum": 1}
                }}
            ]
            
            results = list(self.db.security_events.aggregate(pipeline))
            
            # Process results
            stats = {
                "total_events": 0,
                "by_event_type": {},
                "by_severity": {},
                "by_status": {},
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": days
                }
            }
            
            for result in results:
                count = result["count"]
                event_type = result["_id"]["event_type"]
                severity = result["_id"]["severity"]
                status = result["_id"]["status"]
                
                stats["total_events"] += count
                
                if event_type not in stats["by_event_type"]:
                    stats["by_event_type"][event_type] = 0
                stats["by_event_type"][event_type] += count
                
                if severity not in stats["by_severity"]:
                    stats["by_severity"][severity] = 0
                stats["by_severity"][severity] += count
                
                if status not in stats["by_status"]:
                    stats["by_status"][status] = 0
                stats["by_status"][status] += count
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting audit log stats: {e}")
            return {
                "total_events": 0,
                "by_event_type": {},
                "by_severity": {},
                "by_status": {},
                "date_range": {
                    "start": "",
                    "end": "",
                    "days": days
                }
            }
    
    def get_user_security_settings(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy cài đặt bảo mật của user
        """
        try:
            user = self.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return {}
            
            return user.get("security_settings", {
                "email_notifications": True,
                "login_alerts": True,
                "failed_login_threshold": 5,
                "session_timeout": 3600,
                "require_2fa": False
            })
            
        except Exception as e:
            logger.error(f"Error getting user security settings: {e}")
            return {}
    
    def update_user_security_settings(
        self,
        user_id: str,
        settings: Dict[str, Any],
        ip_address: str = ""
    ) -> bool:
        """
        Cập nhật cài đặt bảo mật của user
        """
        try:
            result = self.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"security_settings": settings}}
            )
            
            if result.modified_count > 0:
                # Log security event
                self.log_security_event(
                    event_type="security_settings_updated",
                    user_id=user_id,
                    ip_address=ip_address,
                    details={"updated_settings": list(settings.keys())},
                    severity="medium"
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error updating user security settings: {e}")
            return False
    
    def get_recent_security_alerts(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Lấy danh sách cảnh báo bảo mật gần đây
        """
        try:
            query = {
                "user_id": ObjectId(user_id),
                "severity": {"$in": ["high", "critical"]},
                "timestamp": {"$gte": datetime.utcnow() - timedelta(days=7)}
            }
            
            cursor = self.db.security_events.find(query).sort("timestamp", DESCENDING).limit(limit)
            
            alerts = []
            for doc in cursor:
                alert = {
                    "id": str(doc["_id"]),
                    "event_type": doc["event_type"],
                    "severity": doc["severity"],
                    "timestamp": doc["timestamp"].isoformat(),
                    "message": self._generate_alert_message(doc),
                    "acknowledged": doc.get("acknowledged", False)
                }
                alerts.append(alert)
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error getting recent security alerts: {e}")
            return []
    
    def acknowledge_security_alert(
        self,
        alert_id: str,
        user_id: str
    ) -> bool:
        """
        Xác nhận đã xem cảnh báo bảo mật
        """
        try:
            result = self.db.security_events.update_one(
                {
                    "_id": ObjectId(alert_id),
                    "user_id": ObjectId(user_id)
                },
                {"$set": {"acknowledged": True, "acknowledged_at": datetime.utcnow()}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error acknowledging security alert: {e}")
            return False
    
    def _check_suspicious_activity(
        self,
        user_id: str,
        event_type: str,
        ip_address: str
    ):
        """
        Kiểm tra hoạt động đáng ngờ và tạo cảnh báo nếu cần
        """
        try:
            # Check for multiple failed logins
            if event_type == "failed_login":
                recent_failures = self.db.security_events.count_documents({
                    "user_id": ObjectId(user_id),
                    "event_type": "failed_login",
                    "timestamp": {"$gte": datetime.utcnow() - timedelta(minutes=15)}
                })
                
                if recent_failures >= 5:
                    self.log_security_event(
                        event_type="security_alert",
                        user_id=user_id,
                        ip_address=ip_address,
                        details={
                            "alert_type": "multiple_failed_logins",
                            "failed_attempts": recent_failures
                        },
                        severity="high",
                        status="blocked"
                    )
            
            # Check for login from new IP
            if event_type == "successful_login":
                previous_ips = self.db.security_events.distinct(
                    "ip_address",
                    {
                        "user_id": ObjectId(user_id),
                        "event_type": "successful_login",
                        "timestamp": {"$gte": datetime.utcnow() - timedelta(days=30)}
                    }
                )
                
                if ip_address not in previous_ips:
                    self.log_security_event(
                        event_type="security_alert",
                        user_id=user_id,
                        ip_address=ip_address,
                        details={
                            "alert_type": "login_from_new_ip",
                            "new_ip": ip_address
                        },
                        severity="medium"
                    )
                    
        except Exception as e:
            logger.error(f"Error checking suspicious activity: {e}")
    
    def _generate_alert_message(self, event_doc: Dict[str, Any]) -> str:
        """
        Tạo message cho cảnh báo bảo mật
        """
        event_type = event_doc.get("event_type", "")
        details = event_doc.get("details", {})
        
        if event_type == "security_alert":
            alert_type = details.get("alert_type", "")
            if alert_type == "multiple_failed_logins":
                return f"Phát hiện {details.get('failed_attempts', 0)} lần đăng nhập thất bại liên tiếp"
            elif alert_type == "login_from_new_ip":
                return f"Đăng nhập từ IP mới: {details.get('new_ip', 'unknown')}"
        
        return f"Cảnh báo bảo mật: {event_type}"

    def get_security_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy thống kê bảo mật cho user

        Args:
            user_id: ID của user

        Returns:
            Dict chứa thống kê bảo mật
        """
        try:
            # Thời gian
            now = datetime.utcnow()
            last_24h = now - timedelta(hours=24)
            last_7d = now - timedelta(days=7)
            last_30d = now - timedelta(days=30)

            # Base filter cho user
            base_filter = {"user_id": user_id}

            # Đếm các sự kiện bảo mật
            total_events = self.db.security_logs.count_documents(base_filter)
            events_24h = self.db.security_logs.count_documents({
                **base_filter,
                "timestamp": {"$gte": last_24h}
            })
            events_7d = self.db.security_logs.count_documents({
                **base_filter,
                "timestamp": {"$gte": last_7d}
            })

            # Đếm failed login attempts
            failed_logins = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "login",
                "status": "failed"
            })

            failed_logins_24h = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "login",
                "status": "failed",
                "timestamp": {"$gte": last_24h}
            })

            # Đếm successful logins
            successful_logins = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "login",
                "status": "success"
            })

            # Lấy sự kiện gần nhất
            recent_events = list(self.db.security_logs.find(
                base_filter,
                {"event_type": 1, "timestamp": 1, "status": 1, "severity": 1}
            ).sort("timestamp", DESCENDING).limit(5))

            # Convert ObjectId to string
            for event in recent_events:
                if "_id" in event:
                    event["_id"] = str(event["_id"])

            return {
                "total_events": total_events,
                "events_24h": events_24h,
                "events_7d": events_7d,
                "failed_logins_total": failed_logins,
                "failed_logins_24h": failed_logins_24h,
                "successful_logins": successful_logins,
                "recent_events": recent_events,
                "last_updated": now.isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting security stats for user {user_id}: {e}")
            return {
                "total_events": 0,
                "events_24h": 0,
                "events_7d": 0,
                "failed_logins_total": 0,
                "failed_logins_24h": 0,
                "successful_logins": 0,
                "recent_events": [],
                "last_updated": datetime.utcnow().isoformat()
            }

# Global instance
security_service = SecurityService()
