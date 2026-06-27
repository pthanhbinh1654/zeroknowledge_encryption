"""
Activity Service - Quản lý hoạt động người dùng
==============================================
Service để lưu trữ và truy vấn hoạt động của người dùng.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from app.models.activity import (
    UserActivity, 
    ActivityCreateRequest, 
    ActivityListResponse, 
    ActivityStatsResponse,
    ActivityType,
    ActivityStatus,
    ACTIVITY_COLLECTION
)
from app.database import get_database

logger = logging.getLogger(__name__)


class ActivityService:
    """Service quản lý hoạt động người dùng"""
    
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None
        self.collection = None
    
    async def _get_collection(self):
        """Lấy collection, khởi tạo nếu chưa có"""
        if self.collection is None:
            self.db = await get_database()
            self.collection = self.db[ACTIVITY_COLLECTION]
            
            # Tạo index cho performance
            await self.collection.create_index([("user_id", 1), ("timestamp", -1)])
            await self.collection.create_index([("activity_type", 1)])
            await self.collection.create_index([("status", 1)])
            
        return self.collection
    
    async def log_activity(
        self, 
        user_id: str, 
        request: ActivityCreateRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> UserActivity:
        """
        Ghi log hoạt động mới
        """
        try:
            collection = await self._get_collection()
            
            # Tạo activity object
            activity = UserActivity(
                user_id=user_id,
                activity_type=request.activity_type,
                status=request.status,
                description=request.description,
                details=request.details,
                file_name=request.file_name,
                file_size=request.file_size,
                algorithm=request.algorithm,
                encryption_mode=request.encryption_mode,
                ip_address=ip_address,
                user_agent=user_agent,
                error_message=request.error_message,
                error_code=request.error_code,
                timestamp=datetime.utcnow()
            )
            
            # Lưu vào database
            activity_dict = activity.dict()
            result = await collection.insert_one(activity_dict)
            
            logger.info(f"Logged activity {request.activity_type} for user {user_id}")
            return activity
            
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
            raise
    
    async def get_user_activities(
        self, 
        user_id: str, 
        page: int = 1, 
        limit: int = 20,
        activity_type: Optional[ActivityType] = None,
        status: Optional[ActivityStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> ActivityListResponse:
        """
        Lấy danh sách hoạt động của user
        """
        try:
            collection = await self._get_collection()
            
            # Build filter
            filter_query = {"user_id": user_id}
            
            if activity_type:
                filter_query["activity_type"] = activity_type
            
            if status:
                filter_query["status"] = status
            
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                filter_query["timestamp"] = date_filter
            
            # Get total count
            total = await collection.count_documents(filter_query)
            
            # Get paginated results
            skip = (page - 1) * limit
            cursor = collection.find(filter_query).sort("timestamp", DESCENDING).skip(skip).limit(limit)
            
            activities = []
            async for doc in cursor:
                # Remove MongoDB _id field
                doc.pop("_id", None)
                activities.append(UserActivity(**doc))
            
            total_pages = (total + limit - 1) // limit
            
            return ActivityListResponse(
                activities=activities,
                total=total,
                page=page,
                limit=limit,
                total_pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error getting user activities: {e}")
            raise
    
    async def get_activity_stats(self, user_id: str) -> ActivityStatsResponse:
        """
        Lấy thống kê hoạt động của user
        """
        try:
            collection = await self._get_collection()
            
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=now.weekday())
            month_start = today_start.replace(day=1)
            
            # Aggregate statistics
            pipeline = [
                {"$match": {"user_id": user_id}},
                {
                    "$facet": {
                        "total": [{"$count": "count"}],
                        "today": [
                            {"$match": {"timestamp": {"$gte": today_start}}},
                            {"$count": "count"}
                        ],
                        "this_week": [
                            {"$match": {"timestamp": {"$gte": week_start}}},
                            {"$count": "count"}
                        ],
                        "this_month": [
                            {"$match": {"timestamp": {"$gte": month_start}}},
                            {"$count": "count"}
                        ],
                        "by_type": [
                            {"$group": {"_id": "$activity_type", "count": {"$sum": 1}}}
                        ],
                        "by_status": [
                            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                        ],
                        "by_algorithm": [
                            {"$match": {"algorithm": {"$ne": None}}},
                            {"$group": {"_id": "$algorithm", "count": {"$sum": 1}}}
                        ],
                        "recent": [
                            {"$sort": {"timestamp": -1}},
                            {"$limit": 10}
                        ]
                    }
                }
            ]
            
            result = await collection.aggregate(pipeline).to_list(1)
            stats = result[0] if result else {}
            
            # Process results
            total_activities = stats.get("total", [{}])[0].get("count", 0)
            activities_today = stats.get("today", [{}])[0].get("count", 0)
            activities_this_week = stats.get("this_week", [{}])[0].get("count", 0)
            activities_this_month = stats.get("this_month", [{}])[0].get("count", 0)
            
            by_type = {item["_id"]: item["count"] for item in stats.get("by_type", [])}
            by_status = {item["_id"]: item["count"] for item in stats.get("by_status", [])}
            by_algorithm = {item["_id"]: item["count"] for item in stats.get("by_algorithm", [])}
            
            # Recent activities
            recent_docs = stats.get("recent", [])
            recent_activities = []
            for doc in recent_docs:
                doc.pop("_id", None)
                recent_activities.append(UserActivity(**doc))
            
            return ActivityStatsResponse(
                total_activities=total_activities,
                activities_today=activities_today,
                activities_this_week=activities_this_week,
                activities_this_month=activities_this_month,
                by_type=by_type,
                by_status=by_status,
                by_algorithm=by_algorithm,
                recent_activities=recent_activities
            )
            
        except Exception as e:
            logger.error(f"Error getting activity stats: {e}")
            raise
    
    async def delete_user_activities(self, user_id: str) -> int:
        """
        Xóa tất cả hoạt động của user (khi xóa tài khoản)
        """
        try:
            collection = await self._get_collection()
            result = await collection.delete_many({"user_id": user_id})
            logger.info(f"Deleted {result.deleted_count} activities for user {user_id}")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error deleting user activities: {e}")
            raise


# Global instance
activity_service = ActivityService()
