"""
Activity API - Endpoints cho quản lý hoạt động
=============================================
API endpoints để log và truy vấn hoạt động người dùng.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from app.core.security import get_current_user
from app.models.activity import (
    ActivityCreateRequest, 
    ActivityListResponse, 
    ActivityStatsResponse,
    ActivityType,
    ActivityStatus
)
from app.services.activity_service import activity_service

logger = logging.getLogger(__name__)
router = APIRouter()


def get_client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract client IP and User-Agent from request"""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent


@router.post("/log")
async def log_activity(
    activity_request: ActivityCreateRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Log hoạt động mới của user
    """
    try:
        user_id = current_user["sub"]
        ip_address, user_agent = get_client_info(request)
        
        activity = await activity_service.log_activity(
            user_id=user_id,
            request=activity_request,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "success": True,
            "message": "Activity logged successfully",
            "activity_id": str(activity.timestamp)
        }
        
    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log activity"
        )


@router.get("/list", response_model=ActivityListResponse)
async def get_activities(
    page: int = 1,
    limit: int = 20,
    activity_type: Optional[ActivityType] = None,
    status: Optional[ActivityStatus] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy danh sách hoạt động của user
    """
    try:
        user_id = current_user["sub"]
        
        # Parse dates if provided
        start_datetime = None
        end_datetime = None
        
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid start_date format. Use ISO format."
                )
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid end_date format. Use ISO format."
                )
        
        activities = await activity_service.get_user_activities(
            user_id=user_id,
            page=page,
            limit=limit,
            activity_type=activity_type,
            status=status,
            start_date=start_datetime,
            end_date=end_datetime
        )
        
        return activities
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get activities"
        )


@router.get("/stats", response_model=ActivityStatsResponse)
async def get_activity_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy thống kê hoạt động của user
    """
    try:
        user_id = current_user["sub"]
        
        stats = await activity_service.get_activity_stats(user_id)
        return stats
        
    except Exception as e:
        logger.error(f"Error getting activity stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get activity statistics"
        )


@router.delete("/clear")
async def clear_activities(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Xóa tất cả hoạt động của user
    """
    try:
        user_id = current_user["sub"]
        
        deleted_count = await activity_service.delete_user_activities(user_id)
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} activities",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        logger.error(f"Error clearing activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear activities"
        )


# Helper endpoints for quick logging common activities

@router.post("/log/encryption")
async def log_encryption_activity(
    file_name: str,
    algorithm: str,
    encryption_mode: str = "single",
    file_size: Optional[int] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    request: Request = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Quick log cho hoạt động mã hóa"""
    activity_request = ActivityCreateRequest(
        activity_type=ActivityType.ENCRYPTION,
        description=f"Mã hóa file {file_name} bằng {algorithm}",
        status=ActivityStatus.SUCCESS if success else ActivityStatus.FAILED,
        file_name=file_name,
        file_size=file_size,
        algorithm=algorithm,
        encryption_mode=encryption_mode,
        error_message=error_message
    )
    
    return await log_activity(activity_request, request, current_user)


@router.post("/log/signature")
async def log_signature_activity(
    file_name: str,
    algorithm: str,
    success: bool = True,
    error_message: Optional[str] = None,
    request: Request = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Quick log cho hoạt động ký số"""
    activity_request = ActivityCreateRequest(
        activity_type=ActivityType.DIGITAL_SIGNATURE,
        description=f"Ký số file {file_name} bằng {algorithm}",
        status=ActivityStatus.SUCCESS if success else ActivityStatus.FAILED,
        file_name=file_name,
        algorithm=algorithm,
        error_message=error_message
    )
    
    return await log_activity(activity_request, request, current_user)


@router.post("/log/decryption")
async def log_decryption_activity(
    file_name: str,
    algorithm: str,
    success: bool = True,
    error_message: Optional[str] = None,
    request: Request = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Quick log cho hoạt động giải mã"""
    activity_request = ActivityCreateRequest(
        activity_type=ActivityType.DECRYPTION,
        description=f"Giải mã file {file_name} (thuật toán {algorithm})",
        status=ActivityStatus.SUCCESS if success else ActivityStatus.FAILED,
        file_name=file_name,
        algorithm=algorithm,
        error_message=error_message
    )
    
    return await log_activity(activity_request, request, current_user)
