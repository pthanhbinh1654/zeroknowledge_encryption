"""
Analytics API - Security Dashboard & Reports
==========================================
API endpoints cho dashboard bảo mật và báo cáo analytics.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging

from app.core.security import get_current_user
from app.services.analytics_service import analytics_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Models
class DashboardRequest(BaseModel):
    user_id: Optional[str] = None
    include_details: bool = False

class ReportRequest(BaseModel):
    user_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    report_type: str = "comprehensive"  # comprehensive, summary, detailed

class SecurityEvent(BaseModel):
    event_type: str
    timestamp: datetime
    severity: str
    ip_address: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

# Analytics endpoints
@router.get("/dashboard")
async def get_security_dashboard(
    user_id: Optional[str] = Query(None, description="User ID (None for admin dashboard)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy dữ liệu dashboard bảo mật
    """
    try:
        # Admin can view any user's dashboard, regular users can only view their own
        if current_user.get("role") != "admin" and user_id and user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view other user's dashboard"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = user_id or current_user["sub"]
        
        dashboard_data = analytics_service.get_security_dashboard(target_user_id)
        
        return {
            "success": True,
            "dashboard": dashboard_data,
            "user_id": target_user_id,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/report")
async def generate_security_report(
    request: ReportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Tạo báo cáo bảo mật
    """
    try:
        # Admin can generate reports for any user, regular users can only generate their own
        if current_user.get("role") != "admin" and request.user_id and request.user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to generate reports for other users"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = request.user_id or current_user["sub"]
        
        report = analytics_service.generate_security_report(
            user_id=target_user_id,
            start_date=request.start_date,
            end_date=request.end_date,
            report_type=request.report_type
        )
        
        return {
            "success": True,
            "report": report
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating security report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/events")
async def get_security_events(
    user_id: Optional[str] = Query(None, description="User ID"),
    event_type: Optional[str] = Query(None, description="Event type filter"),
    severity: Optional[str] = Query(None, description="Severity filter"),
    limit: int = Query(50, description="Number of events to return", ge=1, le=1000),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy danh sách sự kiện bảo mật
    """
    try:
        # Admin can view any user's events, regular users can only view their own
        if current_user.get("role") != "admin" and user_id and user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view other user's events"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = user_id or current_user["sub"]
        
        # Build filter
        filter_query = {}
        if target_user_id:
            filter_query["user_id"] = target_user_id
        if event_type:
            filter_query["event_type"] = event_type
        if severity:
            filter_query["severity"] = severity
        
        # Get events from database
        from app.database import get_database
        db = get_database()
        
        events = list(db.security_logs.find(
            filter_query,
            {"_id": 0}
        ).sort("timestamp", -1).skip(offset).limit(limit))
        
        # Get total count
        total_count = db.security_logs.count_documents(filter_query)
        
        return {
            "success": True,
            "events": events,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/statistics")
async def get_security_statistics(
    user_id: Optional[str] = Query(None, description="User ID"),
    period: str = Query("7d", description="Time period: 24h, 7d, 30d"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy thống kê bảo mật
    """
    try:
        # Admin can view any user's statistics, regular users can only view their own
        if current_user.get("role") != "admin" and user_id and user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view other user's statistics"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = user_id or current_user["sub"]
        
        # Calculate time period
        now = datetime.utcnow()
        if period == "24h":
            start_date = now - timedelta(hours=24)
        elif period == "7d":
            start_date = now - timedelta(days=7)
        elif period == "30d":
            start_date = now - timedelta(days=30)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid period. Use: 24h, 7d, 30d"
            )
        
        # Generate report for statistics
        report = analytics_service.generate_security_report(
            user_id=target_user_id,
            start_date=start_date,
            end_date=now,
            report_type="summary"
        )
        
        return {
            "success": True,
            "statistics": report,
            "period": period,
            "user_id": target_user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/risk-assessment")
async def get_risk_assessment(
    user_id: Optional[str] = Query(None, description="User ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy đánh giá rủi ro bảo mật
    """
    try:
        # Admin can view any user's risk assessment, regular users can only view their own
        if current_user.get("role") != "admin" and user_id and user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view other user's risk assessment"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = user_id or current_user["sub"]
        
        # Get dashboard data which includes risk assessment
        dashboard_data = analytics_service.get_security_dashboard(target_user_id)
        
        return {
            "success": True,
            "risk_assessment": {
                "risk_level": dashboard_data.get("risk_level", "unknown"),
                "overview": dashboard_data.get("overview", {}),
                "recommendations": dashboard_data.get("recommendations", [])
            },
            "user_id": target_user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting risk assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/export/csv")
async def export_security_data_csv(
    user_id: Optional[str] = Query(None, description="User ID"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    data_type: str = Query("events", description="Data type: events, otp, sessions"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Export dữ liệu bảo mật dưới dạng CSV
    """
    try:
        # Admin can export any user's data, regular users can only export their own
        if current_user.get("role") != "admin" and user_id and user_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to export other user's data"
            )
        
        # Use current user's ID if no specific user_id provided
        target_user_id = user_id or current_user["sub"]
        
        # Default date range: last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Get data from database
        from app.database import get_database
        db = get_database()
        
        # Build filter
        filter_query = {
            "created_at" if data_type in ["otp", "sessions"] else "timestamp": {
                "$gte": start_date,
                "$lte": end_date
            }
        }
        if target_user_id:
            filter_query["user_id"] = target_user_id
        
        # Get data based on type
        if data_type == "events":
            data = list(db.security_logs.find(filter_query, {"_id": 0}))
        elif data_type == "otp":
            data = list(db.otps.find(filter_query, {"_id": 0}))
        elif data_type == "sessions":
            data = list(db.sessions.find(filter_query, {"_id": 0}))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data_type. Use: events, otp, sessions"
            )
        
        # Convert to CSV format (simplified)
        csv_data = []
        if data:
            # Headers
            headers = list(data[0].keys())
            csv_data.append(",".join(headers))
            
            # Data rows
            for item in data:
                row = []
                for header in headers:
                    value = item.get(header, "")
                    if isinstance(value, (dict, list)):
                        value = str(value)
                    row.append(str(value))
                csv_data.append(",".join(row))
        
        csv_content = "\n".join(csv_data)
        
        return {
            "success": True,
            "csv_data": csv_content,
            "filename": f"security_{data_type}_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv",
            "record_count": len(data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting security data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/advanced")
async def get_advanced_analytics(
    time_range: str = Query("30d", description="Time range: 7d, 30d, 90d, 1y"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy dữ liệu analytics nâng cao cho dashboard

    Args:
        time_range: Khoảng thời gian phân tích

    Returns:
        Dữ liệu analytics chi tiết
    """
    try:
        # Parse time range
        now = datetime.utcnow()
        if time_range == "7d":
            start_date = now - timedelta(days=7)
        elif time_range == "30d":
            start_date = now - timedelta(days=30)
        elif time_range == "90d":
            start_date = now - timedelta(days=90)
        elif time_range == "1y":
            start_date = now - timedelta(days=365)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time range. Use: 7d, 30d, 90d, 1y"
            )

        # Get advanced analytics data
        analytics_data = analytics_service.get_advanced_analytics(
            user_id=current_user["sub"],
            start_date=start_date,
            end_date=now
        )

        return analytics_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting advanced analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get advanced analytics"
        )