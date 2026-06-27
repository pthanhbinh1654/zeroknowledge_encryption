"""
Analytics Service - Security Reports & Analytics
==============================================
Service tạo báo cáo bảo mật, thống kê, và analytics.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
from collections import defaultdict
from bson import ObjectId

from app.database import get_database
from app.core.config import settings

logger = logging.getLogger(__name__)

class AnalyticsService:
    """Service phân tích và báo cáo"""
    
    def __init__(self):
        self.db = get_database()

    async def get_system_health(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Trả về trạng thái cơ bản của hệ thống để hiển thị ở dashboard.
        Nếu có user_id thì chỉ trả về thống kê của user đó.
        """
        try:
            # MongoDB ping
            db_ok = True
            try:
                self.db.command("ping")
            except Exception:
                db_ok = False

            # Base filter cho user-specific data
            base_filter = {"user_id": user_id} if user_id else {}

            # Các số liệu - nếu có user_id thì chỉ đếm của user đó
            if user_id:
                # User-specific statistics
                users = 1  # Chỉ user hiện tại
                files = self.db.encrypted_files.count_documents(base_filter) if hasattr(self.db, "encrypted_files") else 0
                sessions = self.db.sessions.count_documents(base_filter) if hasattr(self.db, "sessions") else 0
            else:
                # System-wide statistics (chỉ dành cho admin)
                users = self.db.users.count_documents({}) if hasattr(self.db, "users") else 0
                files = self.db.encrypted_files.count_documents({}) if hasattr(self.db, "encrypted_files") else 0
                sessions = self.db.sessions.count_documents({}) if hasattr(self.db, "sessions") else 0

            # Thời điểm gần nhất có sự kiện bảo mật (filtered by user if provided)
            last_security_event = None
            try:
                evt = self.db.security_logs.find(base_filter, {"timestamp": 1}).sort("timestamp", -1).limit(1)
                for e in evt:
                    last_security_event = e.get("timestamp")
                    break
            except Exception:
                last_security_event = None

            return {
                "database": db_ok,
                "totals": {
                    "users": int(users),
                    "files": int(files),
                    "sessions": int(sessions),
                },
                "last_security_event": last_security_event,
            }
        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {"database": False, "totals": {"users": 0, "files": 0, "sessions": 0}}

    async def get_user_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy thống kê sử dụng của user

        Args:
            user_id: ID của user

        Returns:
            Usage statistics
        """
        try:
            # Thống kê file
            total_files = self.db.encrypted_files.count_documents({"user_id": user_id})
            total_size = 0

            # Tính tổng dung lượng
            files_cursor = self.db.encrypted_files.find({"user_id": user_id}, {"encrypted_size": 1})
            for file_doc in files_cursor:
                total_size += file_doc.get("encrypted_size", 0)

            # Thống kê theo thuật toán
            algorithm_stats = {}
            algorithm_cursor = self.db.encrypted_files.aggregate([
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": "$algorithm", "count": {"$sum": 1}}}
            ])
            for item in algorithm_cursor:
                algorithm_stats[item["_id"]] = item["count"]

            # Thống kê hoạt động gần đây
            now = datetime.utcnow()
            last_30d = now - timedelta(days=30)

            recent_activity = self.db.encrypted_files.count_documents({
                "user_id": user_id,
                "created_at": {"$gte": last_30d}
            })

            return {
                "total_files": total_files,
                "total_size": total_size,
                "algorithm_distribution": algorithm_stats,
                "recent_activity_30d": recent_activity,
                "storage_used_mb": round(total_size / (1024 * 1024), 2)
            }

        except Exception as e:
            logger.error(f"Error getting user usage stats: {e}")
            return {
                "total_files": 0,
                "total_size": 0,
                "algorithm_distribution": {},
                "recent_activity_30d": 0,
                "storage_used_mb": 0
            }
    
    def get_security_dashboard(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Lấy dữ liệu dashboard bảo mật
        
        Args:
            user_id: ID user (None cho admin dashboard)
            
        Returns:
            Dashboard data
        """
        try:
            # Thời gian
            now = datetime.utcnow()
            last_24h = now - timedelta(hours=24)
            last_7d = now - timedelta(days=7)
            last_30d = now - timedelta(days=30)
            
            # Base filter
            base_filter = {"user_id": user_id} if user_id else {}
            
            # Security events
            security_events_24h = self.db.security_logs.count_documents({
                **base_filter,
                "timestamp": {"$gte": last_24h}
            })
            
            security_events_7d = self.db.security_logs.count_documents({
                **base_filter,
                "timestamp": {"$gte": last_7d}
            })
            
            # Failed login attempts
            failed_logins_24h = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "failed_login",
                "timestamp": {"$gte": last_24h}
            })
            
            # Suspicious activities
            suspicious_activities_24h = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "suspicious_activity",
                "timestamp": {"$gte": last_24h}
            })
            
            # Rate limit violations
            rate_limit_violations_24h = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "rate_limit_violation",
                "timestamp": {"$gte": last_24h}
            })
            
            # OTP statistics
            otp_stats = self._get_otp_statistics(base_filter, last_24h, last_7d)
            
            # Session statistics
            session_stats = self._get_session_statistics(base_filter, last_24h, last_7d)
            
            # Recent security events
            recent_events = self._get_recent_security_events(base_filter, 10)
            
            # Security trends
            security_trends = self._get_security_trends(base_filter, last_7d)
            
            return {
                "overview": {
                    "security_events_24h": security_events_24h,
                    "security_events_7d": security_events_7d,
                    "failed_logins_24h": failed_logins_24h,
                    "suspicious_activities_24h": suspicious_activities_24h,
                    "rate_limit_violations_24h": rate_limit_violations_24h
                },
                "otp_statistics": otp_stats,
                "session_statistics": session_stats,
                "recent_events": recent_events,
                "security_trends": security_trends,
                "risk_level": self._calculate_risk_level(
                    failed_logins_24h,
                    suspicious_activities_24h,
                    rate_limit_violations_24h
                )
            }
            
        except Exception as e:
            logger.error(f"Error getting security dashboard: {e}")
            return {}
    
    def _get_otp_statistics(self, base_filter: Dict[str, Any], last_24h: datetime, last_7d: datetime) -> Dict[str, Any]:
        """Lấy thống kê OTP"""
        try:
            # OTP trong 24h
            otps_24h = self.db.otps.count_documents({
                **base_filter,
                "created_at": {"$gte": last_24h}
            })
            
            # OTP thành công trong 24h
            successful_otps_24h = self.db.otps.count_documents({
                **base_filter,
                "created_at": {"$gte": last_24h},
                "is_used": True
            })
            
            # OTP hết hạn trong 24h
            expired_otps_24h = self.db.otps.count_documents({
                **base_filter,
                "created_at": {"$gte": last_24h},
                "is_expired": True
            })
            
            # OTP theo loại
            otp_by_type = list(self.db.otps.aggregate([
                {"$match": {**base_filter, "created_at": {"$gte": last_7d}}},
                {"$group": {"_id": "$purpose", "count": {"$sum": 1}}}
            ]))
            
            return {
                "total_24h": otps_24h,
                "successful_24h": successful_otps_24h,
                "expired_24h": expired_otps_24h,
                "success_rate_24h": (successful_otps_24h / otps_24h * 100) if otps_24h > 0 else 0,
                "by_type": {item["_id"]: item["count"] for item in otp_by_type}
            }
            
        except Exception as e:
            logger.error(f"Error getting OTP statistics: {e}")
            return {}
    
    def _get_session_statistics(self, base_filter: Dict[str, Any], last_24h: datetime, last_7d: datetime) -> Dict[str, Any]:
        """Lấy thống kê session"""
        try:
            # Session trong 24h
            sessions_24h = self.db.sessions.count_documents({
                **base_filter,
                "created_at": {"$gte": last_24h}
            })
            
            # Session đang hoạt động
            active_sessions = self.db.sessions.count_documents({
                **base_filter,
                "status": "active",
                "expires_at": {"$gt": datetime.utcnow()}
            })
            
            # Session bị revoke trong 24h
            revoked_sessions_24h = self.db.sessions.count_documents({
                **base_filter,
                "status": "revoked",
                "revoked_at": {"$gte": last_24h}
            })
            
            # Session đáng ngờ
            suspicious_sessions = self.db.sessions.count_documents({
                **base_filter,
                "status": "suspicious"
            })
            
            return {
                "created_24h": sessions_24h,
                "active_now": active_sessions,
                "revoked_24h": revoked_sessions_24h,
                "suspicious": suspicious_sessions
            }
            
        except Exception as e:
            logger.error(f"Error getting session statistics: {e}")
            return {}
    
    def _get_recent_security_events(self, base_filter: Dict[str, Any], limit: int = 10) -> List[Dict[str, Any]]:
        """Lấy các sự kiện bảo mật gần đây"""
        try:
            events = list(self.db.security_logs.find(
                base_filter,
                {
                    "_id": 0,
                    "event_type": 1,
                    "timestamp": 1,
                    "severity": 1,
                    "ip_address": 1,
                    "details": 1
                }
            ).sort("timestamp", -1).limit(limit))
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting recent security events: {e}")
            return []
    
    def _get_security_trends(self, base_filter: Dict[str, Any], last_7d: datetime) -> Dict[str, Any]:
        """Lấy xu hướng bảo mật 7 ngày qua"""
        try:
            # Tạo buckets cho 7 ngày
            buckets = []
            for i in range(7):
                start = last_7d + timedelta(days=i)
                end = start + timedelta(days=1)
                buckets.append({
                    "date": start.strftime("%Y-%m-%d"),
                    "start": start,
                    "end": end
                })
            
            # Thống kê theo ngày
            daily_stats = []
            for bucket in buckets:
                day_filter = {
                    **base_filter,
                    "timestamp": {"$gte": bucket["start"], "$lt": bucket["end"]}
                }
                
                total_events = self.db.security_logs.count_documents(day_filter)
                failed_logins = self.db.security_logs.count_documents({
                    **day_filter,
                    "event_type": "failed_login"
                })
                suspicious_activities = self.db.security_logs.count_documents({
                    **day_filter,
                    "event_type": "suspicious_activity"
                })
                
                daily_stats.append({
                    "date": bucket["date"],
                    "total_events": total_events,
                    "failed_logins": failed_logins,
                    "suspicious_activities": suspicious_activities
                })
            
            return {
                "daily_stats": daily_stats,
                "total_events_7d": sum(day["total_events"] for day in daily_stats),
                "total_failed_logins_7d": sum(day["failed_logins"] for day in daily_stats),
                "total_suspicious_7d": sum(day["suspicious_activities"] for day in daily_stats)
            }
            
        except Exception as e:
            logger.error(f"Error getting security trends: {e}")
            return {}
    
    def _calculate_risk_level(self, failed_logins: int, suspicious_activities: int, rate_limit_violations: int) -> str:
        """Tính toán mức độ rủi ro"""
        try:
            risk_score = 0
            
            # Failed logins
            if failed_logins > 10:
                risk_score += 3
            elif failed_logins > 5:
                risk_score += 2
            elif failed_logins > 0:
                risk_score += 1
            
            # Suspicious activities
            if suspicious_activities > 5:
                risk_score += 3
            elif suspicious_activities > 2:
                risk_score += 2
            elif suspicious_activities > 0:
                risk_score += 1
            
            # Rate limit violations
            if rate_limit_violations > 3:
                risk_score += 3
            elif rate_limit_violations > 1:
                risk_score += 2
            elif rate_limit_violations > 0:
                risk_score += 1
            
            # Determine risk level
            if risk_score >= 7:
                return "critical"
            elif risk_score >= 4:
                return "high"
            elif risk_score >= 2:
                return "medium"
            else:
                return "low"
                
        except Exception as e:
            logger.error(f"Error calculating risk level: {e}")
            return "unknown"
    
    def generate_security_report(
        self,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        report_type: str = "comprehensive"
    ) -> Dict[str, Any]:
        """
        Tạo báo cáo bảo mật
        
        Args:
            user_id: ID user (None cho tất cả users)
            start_date: Ngày bắt đầu
            end_date: Ngày kết thúc
            report_type: Loại báo cáo (comprehensive, summary, detailed)
            
        Returns:
            Báo cáo bảo mật
        """
        try:
            # Default date range: last 30 days
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Base filter
            base_filter = {
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }
            if user_id:
                base_filter["user_id"] = user_id
            
            # Security events summary
            total_events = self.db.security_logs.count_documents(base_filter)
            
            # Events by type
            events_by_type = list(self.db.security_logs.aggregate([
                {"$match": base_filter},
                {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}
            ]))
            
            # Events by severity
            events_by_severity = list(self.db.security_logs.aggregate([
                {"$match": base_filter},
                {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
            ]))
            
            # Top IP addresses
            top_ips = list(self.db.security_logs.aggregate([
                {"$match": base_filter},
                {"$group": {"_id": "$ip_address", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]))
            
            # OTP statistics
            otp_filter = {
                "created_at": {"$gte": start_date, "$lte": end_date}
            }
            if user_id:
                otp_filter["user_id"] = user_id
            
            otp_stats = {
                "total_otps": self.db.otps.count_documents(otp_filter),
                "successful_otps": self.db.otps.count_documents({**otp_filter, "is_used": True}),
                "expired_otps": self.db.otps.count_documents({**otp_filter, "is_expired": True})
            }
            
            # Session statistics
            session_filter = {
                "created_at": {"$gte": start_date, "$lte": end_date}
            }
            if user_id:
                session_filter["user_id"] = user_id
            
            session_stats = {
                "total_sessions": self.db.sessions.count_documents(session_filter),
                "active_sessions": self.db.sessions.count_documents({**session_filter, "status": "active"}),
                "revoked_sessions": self.db.sessions.count_documents({**session_filter, "status": "revoked"}),
                "suspicious_sessions": self.db.sessions.count_documents({**session_filter, "status": "suspicious"})
            }
            
            # Risk assessment
            risk_assessment = self._assess_security_risk(base_filter)
            
            # Recommendations
            recommendations = self._generate_security_recommendations(
                events_by_type,
                events_by_severity,
                risk_assessment
            )
            
            report = {
                "report_info": {
                    "type": report_type,
                    "user_id": user_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "generated_at": datetime.utcnow().isoformat()
                },
                "summary": {
                    "total_events": total_events,
                    "events_by_type": {item["_id"]: item["count"] for item in events_by_type},
                    "events_by_severity": {item["_id"]: item["count"] for item in events_by_severity},
                    "top_ips": [{"ip": item["_id"], "count": item["count"]} for item in top_ips]
                },
                "otp_statistics": otp_stats,
                "session_statistics": session_stats,
                "risk_assessment": risk_assessment,
                "recommendations": recommendations
            }
            
            # Add detailed events if requested
            if report_type == "detailed":
                detailed_events = list(self.db.security_logs.find(
                    base_filter,
                    {"_id": 0}
                ).sort("timestamp", -1).limit(100))
                report["detailed_events"] = detailed_events
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating security report: {e}")
            return {}
    
    def _assess_security_risk(self, base_filter: Dict[str, Any]) -> Dict[str, Any]:
        """Đánh giá rủi ro bảo mật"""
        try:
            # Count critical events
            critical_events = self.db.security_logs.count_documents({
                **base_filter,
                "severity": "critical"
            })
            
            # Count high severity events
            high_events = self.db.security_logs.count_documents({
                **base_filter,
                "severity": "high"
            })
            
            # Count failed logins
            failed_logins = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "failed_login"
            })
            
            # Count suspicious activities
            suspicious_activities = self.db.security_logs.count_documents({
                **base_filter,
                "event_type": "suspicious_activity"
            })
            
            # Calculate risk score
            risk_score = (critical_events * 10) + (high_events * 5) + (failed_logins * 2) + (suspicious_activities * 3)
            
            # Determine risk level
            if risk_score >= 50:
                risk_level = "critical"
            elif risk_score >= 25:
                risk_level = "high"
            elif risk_score >= 10:
                risk_level = "medium"
            else:
                risk_level = "low"
            
            return {
                "risk_score": risk_score,
                "risk_level": risk_level,
                "critical_events": critical_events,
                "high_events": high_events,
                "failed_logins": failed_logins,
                "suspicious_activities": suspicious_activities
            }
            
        except Exception as e:
            logger.error(f"Error assessing security risk: {e}")
            return {}
    
    def _generate_security_recommendations(
        self,
        events_by_type: List[Dict[str, Any]],
        events_by_severity: List[Dict[str, Any]],
        risk_assessment: Dict[str, Any]
    ) -> List[str]:
        """Tạo khuyến nghị bảo mật"""
        try:
            recommendations = []
            
            # Check failed logins
            failed_logins = next((item["count"] for item in events_by_type if item["_id"] == "failed_login"), 0)
            if failed_logins > 10:
                recommendations.append("Có nhiều lần đăng nhập thất bại. Cần kiểm tra và có thể thay đổi mật khẩu.")
            
            # Check suspicious activities
            suspicious_activities = next((item["count"] for item in events_by_type if item["_id"] == "suspicious_activity"), 0)
            if suspicious_activities > 5:
                recommendations.append("Phát hiện nhiều hoạt động đáng ngờ. Cần kiểm tra bảo mật tài khoản.")
            
            # Check critical events
            if risk_assessment.get("critical_events", 0) > 0:
                recommendations.append("Có sự kiện bảo mật nghiêm trọng. Cần hành động ngay lập tức.")
            
            # Check high severity events
            if risk_assessment.get("high_events", 0) > 5:
                recommendations.append("Có nhiều sự kiện bảo mật mức cao. Cần tăng cường bảo mật.")
            
            # General recommendations
            if not recommendations:
                recommendations.append("Tài khoản có mức độ bảo mật tốt. Tiếp tục duy trì.")
            
            recommendations.append("Bật xác thực 2 yếu tố để tăng cường bảo mật.")
            recommendations.append("Thay đổi mật khẩu định kỳ và sử dụng mật khẩu mạnh.")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return ["Không thể tạo khuyến nghị do lỗi hệ thống."]

    def get_advanced_analytics(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Lấy dữ liệu analytics nâng cao cho dashboard

        Args:
            user_id: ID của user
            start_date: Ngày bắt đầu
            end_date: Ngày kết thúc

        Returns:
            Dict chứa dữ liệu analytics chi tiết
        """
        try:
            user_oid = ObjectId(user_id)

            # Overview statistics
            overview = self._get_overview_stats(user_oid, start_date, end_date)

            # Trends data
            trends = self._get_trends_data(user_oid, start_date, end_date)

            # Security data
            security = self._get_security_data(user_oid, start_date, end_date)

            # Performance data
            performance = self._get_performance_data(user_oid, start_date, end_date)

            return {
                "overview": overview,
                "trends": trends,
                "security": security,
                "performance": performance
            }

        except Exception as e:
            logger.error(f"Error getting advanced analytics: {e}")
            return {
                "overview": {},
                "trends": {},
                "security": {},
                "performance": {}
            }

    def _get_overview_stats(self, user_id: ObjectId, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Lấy thống kê tổng quan"""
        try:
            # File statistics
            total_files = self.db.encrypted_files.count_documents({"user_id": user_id})

            # Size statistics
            size_pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {
                    "_id": None,
                    "total_size": {"$sum": "$original_size"},
                    "avg_size": {"$avg": "$original_size"}
                }}
            ]
            size_result = list(self.db.encrypted_files.aggregate(size_pipeline))
            total_size = size_result[0]["total_size"] if size_result else 0
            avg_file_size = size_result[0]["avg_size"] if size_result else 0

            # Activity statistics
            activity_filter = {
                "user_id": user_id,
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }

            total_encryptions = self.db.security_events.count_documents({
                **activity_filter,
                "event_type": "file_upload"
            })

            total_decryptions = self.db.security_events.count_documents({
                **activity_filter,
                "event_type": "file_download"
            })

            # Success rate calculation
            total_operations = total_encryptions + total_decryptions
            failed_operations = self.db.security_events.count_documents({
                **activity_filter,
                "event_type": {"$in": ["file_upload", "file_download"]},
                "status": "failed"
            })

            success_rate = ((total_operations - failed_operations) / total_operations * 100) if total_operations > 0 else 100

            return {
                "total_files": total_files,
                "total_size": total_size,
                "total_encryptions": total_encryptions,
                "total_decryptions": total_decryptions,
                "success_rate": success_rate,
                "avg_file_size": avg_file_size
            }

        except Exception as e:
            logger.error(f"Error getting overview stats: {e}")
            return {}

    def _get_trends_data(self, user_id: ObjectId, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Lấy dữ liệu xu hướng"""
        try:
            # Daily activity
            daily_pipeline = [
                {"$match": {
                    "user_id": user_id,
                    "timestamp": {"$gte": start_date, "$lte": end_date}
                }},
                {"$group": {
                    "_id": {
                        "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                        "event_type": "$event_type"
                    },
                    "count": {"$sum": 1}
                }},
                {"$sort": {"_id.date": 1}}
            ]

            daily_results = list(self.db.security_events.aggregate(daily_pipeline))

            # Process daily activity
            daily_activity = {}
            for result in daily_results:
                date = result["_id"]["date"]
                event_type = result["_id"]["event_type"]
                count = result["count"]

                if date not in daily_activity:
                    daily_activity[date] = {"date": date, "encryptions": 0, "decryptions": 0, "file_uploads": 0}

                if event_type == "file_upload":
                    daily_activity[date]["encryptions"] = count
                    daily_activity[date]["file_uploads"] = count
                elif event_type == "file_download":
                    daily_activity[date]["decryptions"] = count

            # Algorithm usage
            algorithm_pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {
                    "_id": "$algorithm",
                    "count": {"$sum": 1}
                }}
            ]

            algorithm_results = list(self.db.encrypted_files.aggregate(algorithm_pipeline))
            total_files = sum(result["count"] for result in algorithm_results)

            algorithm_usage = []
            for result in algorithm_results:
                algorithm_usage.append({
                    "algorithm": result["_id"],
                    "count": result["count"],
                    "percentage": (result["count"] / total_files * 100) if total_files > 0 else 0
                })

            # File types
            file_type_pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {
                    "_id": "$file_type",
                    "count": {"$sum": 1},
                    "size": {"$sum": "$original_size"}
                }}
            ]

            file_type_results = list(self.db.encrypted_files.aggregate(file_type_pipeline))
            file_types = []
            for result in file_type_results:
                file_types.append({
                    "type": result["_id"] or "unknown",
                    "count": result["count"],
                    "size": result["size"]
                })

            return {
                "daily_activity": list(daily_activity.values()),
                "algorithm_usage": algorithm_usage,
                "file_types": file_types
            }

        except Exception as e:
            logger.error(f"Error getting trends data: {e}")
            return {}

    def _get_security_data(self, user_id: ObjectId, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Lấy dữ liệu bảo mật"""
        try:
            # Login attempts
            login_pipeline = [
                {"$match": {
                    "user_id": user_id,
                    "event_type": {"$in": ["login", "failed_login"]},
                    "timestamp": {"$gte": start_date, "$lte": end_date}
                }},
                {"$group": {
                    "_id": {
                        "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                        "status": "$status"
                    },
                    "count": {"$sum": 1}
                }},
                {"$sort": {"_id.date": 1}}
            ]

            login_results = list(self.db.security_events.aggregate(login_pipeline))

            # Process login attempts
            login_attempts = {}
            for result in login_results:
                date = result["_id"]["date"]
                status = result["_id"]["status"]
                count = result["count"]

                if date not in login_attempts:
                    login_attempts[date] = {"date": date, "successful": 0, "failed": 0}

                if status == "success":
                    login_attempts[date]["successful"] = count
                else:
                    login_attempts[date]["failed"] = count

            # Security events
            security_pipeline = [
                {"$match": {
                    "user_id": user_id,
                    "timestamp": {"$gte": start_date, "$lte": end_date}
                }},
                {"$group": {
                    "_id": {
                        "event_type": "$event_type",
                        "severity": "$severity"
                    },
                    "count": {"$sum": 1}
                }}
            ]

            security_results = list(self.db.security_events.aggregate(security_pipeline))
            security_events = []
            for result in security_results:
                security_events.append({
                    "event_type": result["_id"]["event_type"],
                    "count": result["count"],
                    "severity": result["_id"]["severity"]
                })

            return {
                "login_attempts": list(login_attempts.values()),
                "security_events": security_events
            }

        except Exception as e:
            logger.error(f"Error getting security data: {e}")
            return {}

    def _get_performance_data(self, user_id: ObjectId, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Lấy dữ liệu hiệu suất"""
        try:
            # Mock performance data (in real implementation, this would come from actual metrics)
            return {
                "avg_encryption_time": 2.5,
                "avg_decryption_time": 1.8,
                "peak_usage_hours": [
                    {"hour": 9, "activity_count": 45},
                    {"hour": 14, "activity_count": 38},
                    {"hour": 16, "activity_count": 52},
                    {"hour": 20, "activity_count": 29}
                ]
            }

        except Exception as e:
            logger.error(f"Error getting performance data: {e}")
            return {}

# Global instance
analytics_service = AnalyticsService()