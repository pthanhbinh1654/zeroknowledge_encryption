"""
Security API Endpoints
======================
API endpoints cho quản lý bảo mật, audit logs, và monitoring.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timedelta
import csv
import io
import logging

from app.core.security import get_current_user
from app.models.user import UserInDB
from app.services.security_service import security_service
from app.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter()

# ==================================================
# AUDIT LOGS ENDPOINTS
# ==================================================

@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search in IP, username, details"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy danh sách audit logs với filtering và pagination
    
    Args:
        page: Số trang
        per_page: Số items mỗi trang
        event_type: Lọc theo loại sự kiện
        severity: Lọc theo mức độ nghiêm trọng
        status: Lọc theo trạng thái
        date_from: Lọc từ ngày
        date_to: Lọc đến ngày
        search: Tìm kiếm trong IP, username, details
        
    Returns:
        Danh sách audit logs với pagination info
    """
    try:
        # Build filters
        filters = {}
        
        if event_type:
            filters["event_type"] = event_type
            
        if severity:
            filters["severity"] = severity
            
        if status:
            filters["status"] = status
            
        if date_from:
            try:
                filters["date_from"] = datetime.fromisoformat(date_from)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date_from format. Use YYYY-MM-DD"
                )
                
        if date_to:
            try:
                # Add 23:59:59 to include the entire day
                date_to_dt = datetime.fromisoformat(date_to)
                filters["date_to"] = date_to_dt.replace(hour=23, minute=59, second=59)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date_to format. Use YYYY-MM-DD"
                )
                
        if search:
            filters["search"] = search
        
        # Get audit logs
        # Extract user id from JWT payload or model
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = security_service.get_audit_logs(
            user_id=user_id,
            page=page,
            per_page=per_page,
            filters=filters
        )
        
        return {
            "events": result["events"],
            "total": result["total"],
            "page": page,
            "per_page": per_page,
            "total_pages": (result["total"] + per_page - 1) // per_page
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audit logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get audit logs"
        )


@router.get("/audit-logs/export")
async def export_audit_logs(
    request: Request,
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search in IP, username, details"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Export audit logs to CSV
    
    Args:
        Same filters as get_audit_logs
        
    Returns:
        CSV file stream
    """
    try:
        # Build filters (same as get_audit_logs)
        filters = {}
        
        if event_type:
            filters["event_type"] = event_type
            
        if severity:
            filters["severity"] = severity
            
        if status:
            filters["status"] = status
            
        if date_from:
            try:
                filters["date_from"] = datetime.fromisoformat(date_from)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date_from format. Use YYYY-MM-DD"
                )
                
        if date_to:
            try:
                date_to_dt = datetime.fromisoformat(date_to)
                filters["date_to"] = date_to_dt.replace(hour=23, minute=59, second=59)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date_to format. Use YYYY-MM-DD"
                )
                
        if search:
            filters["search"] = search
        
        # Get all matching audit logs (no pagination for export)
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = security_service.get_audit_logs(
            user_id=user_id,
            page=1,
            per_page=10000,  # Large number to get all results
            filters=filters
        )
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Timestamp',
            'Event Type',
            'Username',
            'IP Address',
            'User Agent',
            'Severity',
            'Status',
            'Details'
        ])
        
        # Write data
        for event in result["events"]:
            writer.writerow([
                event.get("timestamp", ""),
                event.get("event_type", ""),
                event.get("username", ""),
                event.get("ip_address", ""),
                event.get("user_agent", ""),
                event.get("severity", ""),
                event.get("status", ""),
                str(event.get("details", {}))
            ])
        
        # Create response
        output.seek(0)
        
        def generate():
            yield output.getvalue()
        
        filename = f"security_audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting audit logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export audit logs"
        )


@router.get("/audit-logs/stats")
async def get_audit_log_stats(
    request: Request,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy thống kê audit logs
    
    Args:
        days: Số ngày để phân tích (mặc định 30 ngày)
        
    Returns:
        Thống kê audit logs
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        stats = security_service.get_audit_log_stats(
            user_id=user_id,
            days=days
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting audit log stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get audit log stats"
        )


# ==================================================
# SECURITY SETTINGS ENDPOINTS
# ==================================================

@router.get("/settings")
async def get_security_settings(
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy cài đặt bảo mật của user
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        settings = security_service.get_user_security_settings(user_id)
        return settings
        
    except Exception as e:
        logger.error(f"Error getting security settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get security settings"
        )


@router.put("/settings")
async def update_security_settings(
    request: Request,
    settings: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Cập nhật cài đặt bảo mật của user
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = security_service.update_user_security_settings(
            user_id=user_id,
            settings=settings,
            ip_address=request.client.host
        )
        
        if result:
            return {"success": True, "message": "Security settings updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update security settings"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating security settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update security settings"
        )


# ==================================================
# SECURITY ALERTS ENDPOINTS
# ==================================================

@router.get("/alerts")
async def get_security_alerts(
    current_user: UserInDB = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50, description="Number of recent alerts")
):
    """
    Lấy danh sách cảnh báo bảo mật gần đây
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        alerts = security_service.get_recent_security_alerts(
            user_id=user_id,
            limit=limit
        )
        
        return {"alerts": alerts}
        
    except Exception as e:
        logger.error(f"Error getting security alerts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get security alerts"
        )


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_security_alert(
    alert_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Xác nhận đã xem cảnh báo bảo mật
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = security_service.acknowledge_security_alert(
            alert_id=alert_id,
            user_id=user_id
        )
        
        if result:
            return {"success": True, "message": "Alert acknowledged"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging security alert: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to acknowledge security alert"
        )
