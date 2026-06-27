"""
Dashboard API - Analytics and Statistics
======================================
API endpoints cho dashboard với thống kê, analytics, và báo cáo.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
import logging
from datetime import datetime, timedelta

from app.core.security import get_current_user, SecurityService
from app.services.analytics_service import AnalyticsService
from app.services.encrypted_file_service import EncryptedFileService
from app.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
analytics_service = AnalyticsService()
security_service = SecurityService()
file_service = EncryptedFileService()

@router.get("/stats")
async def get_dashboard_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy thống kê tổng quan cho dashboard
    """
    try:
        user_id = current_user["sub"]
        
        # Thống kê file
        file_stats = await file_service.get_user_file_stats(user_id)
        
        # Thống kê bảo mật cho user hiện tại để tránh trả về dữ liệu có ObjectId
        security_stats = security_service.get_security_stats(user_id)
        
        # Thống kê sử dụng
        usage_stats = await analytics_service.get_user_usage_stats(user_id)
        
        return {
            "success": True,
            "data": {
                "files": file_stats,
                "security": security_stats,
                "usage": usage_stats
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/files/analytics")
async def get_file_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    period: str = "7d"  # 1d, 7d, 30d, 90d
):
    """
    Lấy analytics về file upload/download
    """
    try:
        user_id = current_user["sub"]
        
        # Xác định khoảng thời gian
        end_date = datetime.utcnow()
        if period == "1d":
            start_date = end_date - timedelta(days=1)
        elif period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)
        
        analytics = await analytics_service.get_file_analytics(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "data": analytics
        }
        
    except Exception as e:
        logger.error(f"Error getting file analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/security/events")
async def get_security_events(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = 50
):
    """
    Lấy danh sách sự kiện bảo mật gần đây
    """
    try:
        user_id = current_user["sub"]
        
        # Kiểm tra quyền admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        events = security_service.get_recent_security_events(limit=limit)
        
        return {
            "success": True,
            "data": events
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/security/blocked-ips")
async def get_blocked_ips(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy danh sách IP bị block
    """
    try:
        # Kiểm tra quyền admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        blocked_ips = security_service.get_blocked_ips()
        
        return {
            "success": True,
            "data": blocked_ips
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting blocked IPs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/security/unblock-ip/{ip_address}")
async def unblock_ip(
    ip_address: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Unblock IP address
    """
    try:
        # Kiểm tra quyền admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        success = security_service.unblock_ip(ip_address)
        
        if success:
            return {
                "success": True,
                "message": f"IP {ip_address} unblocked successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="IP not found or already unblocked"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking IP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/security/ip-analysis/{ip_address}")
async def analyze_ip(
    ip_address: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Phân tích hành vi của IP
    """
    try:
        # Kiểm tra quyền admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        analysis = security_service.analyze_ip_behavior(ip_address)
        
        return {
            "success": True,
            "data": analysis
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing IP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/usage/trends")
async def get_usage_trends(
    current_user: Dict[str, Any] = Depends(get_current_user),
    metric: str = "storage",  # storage, uploads, downloads
    period: str = "30d"
):
    """
    Lấy xu hướng sử dụng theo thời gian
    """
    try:
        user_id = current_user["sub"]
        
        # Xác định khoảng thời gian
        end_date = datetime.utcnow()
        if period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
        
        trends = await analytics_service.get_usage_trends(
            user_id=user_id,
            metric=metric,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "data": trends
        }
        
    except Exception as e:
        logger.error(f"Error getting usage trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/reports/summary")
async def get_summary_report(
    current_user: Dict[str, Any] = Depends(get_current_user),
    report_type: str = "monthly"  # daily, weekly, monthly
):
    """
    Lấy báo cáo tổng hợp
    """
    try:
        user_id = current_user["sub"]
        
        report = await analytics_service.generate_summary_report(
            user_id=user_id,
            report_type=report_type
        )
        
        return {
            "success": True,
            "data": report
        }
        
    except Exception as e:
        logger.error(f"Error generating summary report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/system/health")
async def get_system_health(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy trạng thái sức khỏe hệ thống
    """
    try:
        # Cho phép tất cả user xem health ở dashboard (không cần admin)
        
        health_status = await analytics_service.get_system_health()
        
        return {
            "success": True,
            "data": health_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting system health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/files/recent")
async def get_recent_files(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = 10
):
    """
    Lấy danh sách file gần đây của user
    """
    try:
        user_id = current_user["sub"]

        # Get recent files from file service
        recent_files = await file_service.get_recent_files(user_id, limit)

        return {
            "success": True,
            "data": recent_files
        }

    except Exception as e:
        logger.error(f"Error getting recent files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/activity/recent")
async def get_recent_activity(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = 20
):
    """
    Lấy hoạt động gần đây của user
    """
    try:
        user_id = current_user["sub"]

        # Get recent activity from security service
        recent_activity = security_service.get_user_recent_activity(user_id, limit)

        return {
            "success": True,
            "data": recent_activity
        }

    except Exception as e:
        logger.error(f"Error getting recent activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )