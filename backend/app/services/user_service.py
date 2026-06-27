"""
User Service
===========
Service xử lý các thao tác liên quan đến user.
"""

from typing import Optional, Dict, Any
from datetime import datetime
import logging
from bson import ObjectId

from app.database import db
from app.models.user import UserUpdate, UserInDB

logger = logging.getLogger(__name__)


class UserService:
    """
    Service quản lý user operations
    """
    
    def __init__(self):
        self.collection = db.get_collection("users")
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Lấy user theo email
        
        Args:
            email: Email của user
            
        Returns:
            Dict: Thông tin user, None nếu không tìm thấy
        """
        try:
            user = self.collection.find_one({"email": email})
            
            if user:
                # Convert ObjectId to string
                user["_id"] = str(user["_id"])
                return user
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error getting user by email {email}: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Lấy user theo ID
        
        Args:
            user_id: ID của user
            
        Returns:
            Dict: Thông tin user, None nếu không tìm thấy
        """
        try:
            object_id = ObjectId(user_id)
            user = self.collection.find_one({"_id": object_id})
            
            if user:
                # Convert ObjectId to string
                user["_id"] = str(user["_id"])
                return user
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error getting user by id {user_id}: {e}")
            return None
    
    def create_user(self, user_data: Dict[str, Any]) -> Optional[str]:
        """
        Tạo user mới
        
        Args:
            user_data: Dữ liệu user
            
        Returns:
            str: ID của user được tạo, None nếu thất bại
        """
        try:
            # Thêm timestamp
            user_data["created_at"] = datetime.utcnow()
            user_data["updated_at"] = datetime.utcnow()
            
            result = self.collection.insert_one(user_data)
            
            if result.inserted_id:
                logger.info(f"Successfully created user with id {result.inserted_id}")
                return str(result.inserted_id)
            else:
                logger.error("Failed to create user")
                return None
                
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None
    
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Lấy user theo username
        
        Args:
            username: Username của user
            
        Returns:
            Dict: Thông tin user, None nếu không tìm thấy
        """
        try:
            user = self.collection.find_one({"username": username})
            
            if user:
                # Convert ObjectId to string
                user["_id"] = str(user["_id"])
                return user
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error getting user by username {username}: {e}")
            return None
    
    def verify_user(self, user_id: str) -> bool:
        """
        Xác thực user (đánh dấu email đã verify)
        
        Args:
            user_id: ID của user
            
        Returns:
            bool: True nếu thành công
        """
        try:
            object_id = ObjectId(user_id)
            
            result = self.collection.update_one(
                {"_id": object_id},
                {"$set": {"is_verified": True, "updated_at": datetime.utcnow()}}
            )
            
            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully verified user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error verifying user {user_id}: {e}")
            return False
    
    def update_last_login(self, user_id: str) -> bool:
        """
        Cập nhật thời gian đăng nhập cuối
        
        Args:
            user_id: ID của user
            
        Returns:
            bool: True nếu thành công
        """
        try:
            object_id = ObjectId(user_id)
            
            result = self.collection.update_one(
                {"_id": object_id},
                {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}}
            )
            
            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully updated last login for user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating last login for user {user_id}: {e}")
            return False
    
    def update_password(self, user_id: str, new_password: str) -> bool:
        """
        Cập nhật mật khẩu user
        
        Args:
            user_id: ID của user
            new_password: Mật khẩu mới (đã hash)
            
        Returns:
            bool: True nếu thành công
        """
        try:
            object_id = ObjectId(user_id)
            
            result = self.collection.update_one(
                {"_id": object_id},
                {"$set": {"hashed_password": new_password, "updated_at": datetime.utcnow()}}
            )
            
            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully updated password for user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating password for user {user_id}: {e}")
            return False
    
    def update_user(self, user_id: str, user_update: UserUpdate) -> bool:
        """
        Cập nhật thông tin user
        
        Args:
            user_id: ID của user (string)
            user_update: Thông tin cần cập nhật
            
        Returns:
            bool: True nếu thành công
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return False
            
            update_data = {}
            
            # Only update non-None values
            if user_update.username is not None:
                update_data["username"] = user_update.username
            
            if not update_data:
                logger.info(f"No fields to update for user {user_id}")
                return True  # Nothing to update, but not an error
            
            # Add updated timestamp
            update_data["updated_at"] = datetime.utcnow()
            
            # Use ObjectId for MongoDB query
            result = self.collection.update_one(
                {"_id": object_id},
                {"$set": update_data}
            )
            
            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully updated user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id} or no changes made")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {e}")
            return False
    
    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy thống kê hoạt động của user
        
        Args:
            user_id: ID của user
            
        Returns:
            Dict chứa thống kê
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return {"error": "Invalid user ID format"}
            
            # Get user info
            user = self.collection.find_one({"_id": object_id})
            if not user:
                return {"error": "User not found"}
            
            # Get file statistics (từ encrypted_files collection)
            files_collection = db.get_collection("encrypted_files")
            
            # Count total files
            total_files = files_collection.count_documents({"user_id": user_id})
            
            # Calculate total size
            pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
            ]
            
            size_result = list(files_collection.aggregate(pipeline))
            total_size = size_result[0]["total_size"] if size_result else 0
            
            # Get recent activity (last 5 files)
            recent_files = list(files_collection.find(
                {"user_id": user_id}
            ).sort("uploaded_at", -1).limit(5))
            
            recent_activity = [
                {
                    "file_name": f["original_name"],
                    "uploaded_at": f["uploaded_at"].isoformat() if f.get("uploaded_at") else None,
                    "file_size": f["file_size"]
                }
                for f in recent_files
            ]
            
            return {
                "user_info": {
                    "email": user["email"],
                    "username": user["username"],
                    "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
                    "last_login": user["last_login"].isoformat() if user.get("last_login") else None,
                    "is_verified": user.get("is_verified", False),
                    "twofa_enabled": user.get("twofa_enabled", False)
                },
                "file_stats": {
                    "total_files": total_files,
                    "total_size": total_size,
                    "total_size_mb": round(total_size / 1024 / 1024, 2)
                },
                "recent_activity": recent_activity
            }
            
        except Exception as e:
            logger.error(f"Error getting user stats for {user_id}: {e}")
            return {"error": "Failed to retrieve statistics"}

    def update_user_settings(self, user_id: str, settings: Dict[str, Any]) -> bool:
        """
        Cập nhật cài đặt user

        Args:
            user_id: ID của user
            settings: Cài đặt mới

        Returns:
            bool: True nếu thành công
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return False

            # Update user settings
            result = self.collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "settings": settings,
                        "updated_at": datetime.utcnow()
                    }
                }
            )

            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully updated settings for user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id}")

            return success

        except Exception as e:
            logger.error(f"Error updating user settings for {user_id}: {e}")
            return False

    def update_password(self, user_id: str, hashed_password: str) -> bool:
        """
        Cập nhật mật khẩu user

        Args:
            user_id: ID của user
            hashed_password: Mật khẩu đã hash

        Returns:
            bool: True nếu thành công
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return False

            # Update password
            result = self.collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "hashed_password": hashed_password,
                        "updated_at": datetime.utcnow()
                    }
                }
            )

            success = result.modified_count > 0
            if success:
                logger.info(f"Successfully updated password for user {user_id}")
            else:
                logger.warning(f"No user found with id {user_id}")

            return success

        except Exception as e:
            logger.error(f"Error updating password for {user_id}: {e}")
            return False

# Create instance
user_service = UserService()