"""
User API Endpoints
=================
API endpoints cho quản lý thông tin user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
import logging

from app.core.security import get_current_user
from app.models.user import UserInDB, UserUpdate
from app.services.user_service import UserService

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
user_service = UserService()


@router.get("/me", response_model=Dict[str, Any])
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy thông tin user hiện tại

    Returns:
        Thông tin user (không có password)
    """
    try:
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user token"
            )

        user = user_service.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return {
            "id": str(user["_id"]),
            "email": user["email"],
            "is_active": user.get("is_active", True),
            "username": user["username"],
            "is_verified": user.get("is_verified", False),
            "has_2fa": user.get("twofa_enabled", False),
            "created_at": user.get("created_at").isoformat() if user.get("created_at") else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user information"
        )


@router.put("/me", response_model=Dict[str, str])
async def update_user_info(
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Cập nhật thông tin user

    Args:
        user_update: Thông tin cần cập nhật

    Returns:
        Thông báo kết quả hoặc lý do lỗi
    """
    try:
        user_id = current_user.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user token"
            )

        result = user_service.update_user(
            user_id,
            user_update
        )

        if not result:
            # Có thể do không có trường nào được cập nhật, hoặc user không tồn tại
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể cập nhật thông tin: user không tồn tại hoặc không có trường nào thay đổi"
            )

        return {"message": "Cập nhật thông tin thành công"}

    except HTTPException:
        # Re-raise HTTPException without wrapping
        raise
    except ValueError as ve:
        logger.error(f"Value error updating user info: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi dữ liệu: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi hệ thống khi cập nhật thông tin user"
        )

@router.get("/stats", response_model=Dict[str, Any])
async def get_user_stats(
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy thống kê hoạt động của user
    
    Returns:
        Thống kê: số file, dung lượng, hoạt động gần đây
    """
    try:
        stats = user_service.get_user_stats(str(current_user.id))
        return stats
        
    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user statistics"
        )


@router.get("/settings", response_model=Dict[str, Any])
async def get_user_settings(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy cài đặt user

    Returns:
        Cài đặt user: notifications, security, preferences
    """
    try:
        # Try different ways to get user_id from token
        user_id = current_user.get("sub") or current_user.get("id") or current_user.get("user_id")
        if not user_id:
            logger.error(f"No user ID found in token: {current_user}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user token"
            )

        logger.info(f"Getting settings for user_id: {user_id}")

        # Test database connection
        try:
            user = user_service.get_user_by_id(user_id)
        except Exception as db_error:
            logger.error(f"Database error when getting user: {db_error}")
            # Return default settings if database fails
            user = {"settings": {}}

        if not user:
            logger.warning(f"User not found for ID: {user_id}")
            # Return default settings instead of failing
            user = {"settings": {}}

        # Get user settings with defaults
        settings = user.get("settings", {})

        default_settings = {
            "notifications": {
                "email_enabled": True,
                "security_alerts": True,
                "activity_summary": False
            },
            "security": {
                "session_timeout": 30,
                "require_2fa": False,
                "login_notifications": True
            },
            "preferences": {
                "theme": "dark",
                "language": "vi",
                "timezone": "Asia/Ho_Chi_Minh"
            }
        }

        # Merge with defaults
        for category, defaults in default_settings.items():
            if category not in settings:
                settings[category] = defaults
            else:
                for key, default_value in defaults.items():
                    if key not in settings[category]:
                        settings[category][key] = default_value

        return {
            "success": True,
            "data": settings
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user settings"
        )


@router.put("/settings", response_model=Dict[str, str])
async def update_user_settings(
    settings: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Cập nhật cài đặt user

    Args:
        settings: Cài đặt mới

    Returns:
        Thông báo kết quả
    """
    try:
        result = user_service.update_user_settings(
            str(current_user.id),
            settings
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update user settings"
            )

        return {
            "success": True,
            "message": "Cập nhật cài đặt thành công"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user settings"
        )