"""
Authentication API - Enhanced Security
=====================================
API endpoints cho authentication với OTP, rate limiting, và session management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
import logging
from datetime import datetime

from app.core.security import SecurityService
from app.services.otp_service import OTPService
from app.services.session_service import session_service
from app.services.user_service import user_service
from app.services.captcha_service import captcha_service
from app.core.security import get_current_user
from app.database import get_database
from app.core.config import settings
from app.models.user import OTPType

logger = logging.getLogger(__name__)
router = APIRouter()

# Models
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    require_otp: bool = True
    captcha_token: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str
    otp_code: Optional[str] = None
    require_otp: bool = False
    captcha_token: Optional[str] = None

class OTPRequest(BaseModel):
    email: EmailStr
    purpose: str  # 'registration', 'login', 'password_reset', 'email_change'

class OTPVerify(BaseModel):
    email: EmailStr
    otp_code: str
    purpose: str  # 'registration', 'login', 'password_reset', 'email_change'

class PasswordReset(BaseModel):
    email: EmailStr
    new_password: str

class RefreshToken(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    session_id: Optional[str] = None
    logout_all: bool = False

# Initialize services
security_service = SecurityService()
otp_service = OTPService()

# Authentication endpoints
@router.post("/register")
async def register_user(
    user_data: UserRegister,
    request: Request
):
    """
    Đăng ký user mới với OTP verification
    """
    try:
        # Verify captcha if enabled
        if captcha_service.is_enabled() and user_data.captcha_token:
            captcha_result = await captcha_service.verify_captcha(
                token=user_data.captcha_token,
                remote_ip=request.client.host
            )

            if not captcha_result["success"]:
                error_message = captcha_service.get_error_message(
                    captcha_result.get("error_codes", [])
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message
                )
        elif captcha_service.is_enabled():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng hoàn thành xác thực captcha"
            )

        # Check if user exists (chỉ kiểm tra email)
        if user_service.get_user_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                #detail="Email đã được đăng ký"
            )
        
        # Hash password
        hashed_password = security_service.hash_password(user_data.password)
        
        # Create user
        user_id = user_service.create_user({
            "username": user_data.username,
            "email": user_data.email,
            "hashed_password": hashed_password,
            "is_verified": False,
            "is_active": True,
            "twofa_enabled": False
        })
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        # Send OTP for email verification
        if user_data.require_otp:
            otp_code = otp_service.create_otp(
                user_id=user_id,
                purpose="registration",
                email=user_data.email,
                username=user_data.username,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent")
            )
            
            if not otp_code:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send OTP"
                )
            
            # Log security event (tạm thời bỏ qua để test)
            # security_service.record_security_event(
            #     ip_address=request.client.host,
            #     event_type="user_registration",
            #     user_id=user_id,
            #     details={"require_otp": user_data.require_otp}
            # )
            
            return {
                "success": True,
                "message": "User registered successfully. Please verify your email with OTP.",
                "user_id": user_id,
                "require_otp": True,
                "development_otp": otp_code if settings.ENVIRONMENT == "development" else None
            }
        else:
            # Auto-verify user
            user_service.verify_user(user_id)
            
            return {
                "success": True,
                "message": "User registered successfully.",
                "user_id": user_id,
                "require_otp": False
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/verify-email")
async def verify_email(
    otp_data: OTPVerify,
    request: Request
):
    """
    Xác thực email với OTP
    """
    try:
        # Get user by email
        user = user_service.get_user_by_email(otp_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check OTP attempt limit
        otp_attempts = otp_service.get_otp_attempts(str(user["_id"]), otp_data.purpose)
        if otp_attempts >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới."
            )
        
        # Verify OTP
        verify_result = otp_service.verify_otp(
            user_id=str(user["_id"]),
            otp_code=otp_data.otp_code,
            purpose=otp_data.purpose
        )
        
        if not verify_result["valid"]:
            # Get current attempts after verification (already incremented in verify_otp)
            current_attempts = otp_service.get_otp_attempts(str(user["_id"]), otp_data.purpose)
            
            if current_attempts >= 5:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới."
                )
            else:
                remaining_attempts = 5 - current_attempts
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"OTP bị sai vui lòng nhập lại. Còn {remaining_attempts} lần thử."
                )
        
        # Verify user
        user_service.verify_user(str(user["_id"]))
        
        # Log security event (tạm thời bỏ qua để test)
        # security_service.record_security_event(
        #     ip_address=request.client.host,
        #     event_type="email_verified",
        #     user_id=str(user["_id"])
        # )
        
        # Generate tokens for verified user
        access_token = security_service.create_access_token(
            data={"sub": str(user["_id"]), "email": user["email"]}
        )
        refresh_token = security_service.create_refresh_token(
            data={"sub": str(user["_id"]), "email": user["email"]}
        )
        
        # Create session (tạm thời bỏ qua để test)
        # session_id = security_service.create_session(
        #     user_id=str(user["_id"]),
        #     ip_address=request.client.host,
        #     user_agent=request.headers.get("user-agent", ""),
        #     refresh_token=refresh_token
        # )
        session_id = "temp_session_id"
        
        return {
            "success": True,
            "message": "Email verified successfully",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_id": session_id,
            "user": {
                "id": str(user["_id"]),
                "email": user["email"],
                "username": user["username"],
                "is_verified": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/login")
async def login_user(
    login_data: UserLogin,
    request: Request
):
    """
    Đăng nhập với optional OTP
    """
    try:
        # Verify captcha if provided
        if login_data.captcha_token:
            captcha_result = await captcha_service.verify_captcha(
                token=login_data.captcha_token,
                remote_ip=request.client.host
            )

            if not captcha_result["success"]:
                error_message = captcha_service.get_error_message(
                    captcha_result.get("error_codes", [])
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message
                )

        # Get user
        user = user_service.get_user_by_email(login_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tài khoản không tồn tại"
            )
        
        # Verify password
        if not security_service.verify_password(login_data.password, user["hashed_password"]):
            # Log failed login attempt
            security_service.log_security_event(
                event_type="failed_login",
                user_id=str(user["_id"]),
                ip_address=request.client.host,
                details={"reason": "invalid_password"}
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sai tài khoản hoặc mật khẩu"
            )
        
        # Check if user is verified
        if not user.get("is_verified", False):
            return {
                "success": False,
                "message": "Tài khoản chưa được xác thực",
                "require_verification": True,
                "email": user["email"]
            }
        
        # Check if user is active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is disabled"
            )
        
        # Handle OTP requirement
        if login_data.require_otp or user.get("twofa_enabled", False):
            if not login_data.otp_code:
                # Send OTP
                otp_code = otp_service.create_otp(
                    user_id=str(user["_id"]),
                    purpose="login",
                    email=login_data.email,
                    username=user["username"],
                    ip_address=request.client.host,
                    user_agent=request.headers.get("user-agent")
                )
                
                if not otp_code:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to send OTP"
                    )
                
                return {
                    "success": False,
                    "message": "OTP required for login",
                    "require_otp": True,
                    "email": user["email"],
                    "development_otp": otp_code if settings.ENVIRONMENT == "development" else None
                }
            else:
                # Verify OTP
                if not otp_service.verify_otp(
                    user_id=str(user["_id"]),
                    otp_code=login_data.otp_code,
                    purpose="login"
                ):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid OTP"
                    )
        
        # Create session
        session_data = session_service.create_session(
            user_id=str(user["_id"]),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent", ""),
            device_info={
                "ip": request.client.host,
                "user_agent": request.headers.get("user-agent", ""),
                "accept_language": request.headers.get("accept-language", "")
            }
        )
        
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create session"
            )
        
        # Update last login
        user_service.update_last_login(str(user["_id"]))
        
        # Log successful login
        security_service.log_security_event(
            event_type="successful_login",
            user_id=str(user["_id"]),
            ip_address=request.client.host,
            details={"session_id": session_data["session_id"]}
        )

        # Send login notification email
        try:
            from app.services.email_service import email_service
            email_service.send_login_notification(
                to_email=user["email"],
                username=user["username"],
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent", ""),
                login_time=datetime.utcnow()
            )
        except Exception as e:
            logger.warning(f"Failed to send login notification email: {e}")
            # Don't fail login if email fails
        
        return {
            "success": True,
            "message": "Login successful",
            "access_token": session_data["access_token"],
            "refresh_token": session_data["refresh_token"],
            "expires_at": session_data["expires_at"],
            "refresh_expires_at": session_data["refresh_expires_at"],
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "email": user["email"],
                "is_verified": user.get("is_verified", False),
                "twofa_enabled": user.get("twofa_enabled", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/refresh")
async def refresh_token(
    refresh_data: RefreshToken,
    request: Request
):
    """
    Refresh access token
    """
    try:
        session_data = session_service.refresh_session(
            refresh_token=refresh_data.refresh_token,
            ip_address=request.client.host
        )
        
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return {
            "success": True,
            "access_token": session_data["access_token"],
            "expires_at": session_data["expires_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/logout")
async def logout_user(
    logout_data: LogoutRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Đăng xuất
    """
    try:
        user_id = current_user["sub"]
        
        if logout_data.logout_all:
            # Revoke all sessions
            revoked_count = session_service.revoke_all_user_sessions(
                user_id=user_id,
                reason="user_logout_all"
            )
            
            return {
                "success": True,
                "message": f"Logged out from {revoked_count} sessions"
            }
        else:
            # Revoke specific session
            session_id = logout_data.session_id or current_user.get("session_id")
            if session_id:
                session_service.revoke_session(session_id, "user_logout")
            
            return {
                "success": True,
                "message": "Logged out successfully"
            }
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/request-otp")
async def request_otp(
    otp_request: OTPRequest,
    request: Request
):
    """
    Yêu cầu gửi OTP cho mục đích bất kỳ
    """
    try:
        # Get user
        user = user_service.get_user_by_email(otp_request.email)
        if not user:
            # Don't reveal if user exists
            return {
                "success": True,
                "message": "If the email exists, an OTP has been sent"
            }
        
        # Send OTP
        otp_code = otp_service.create_otp(
            user_id=str(user["_id"]),
            purpose=otp_request.purpose,
            email=otp_request.email,
            username=user.get("username", ""),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        if otp_code:
            # Reset OTP attempts when new OTP is created
            otp_service.reset_otp_attempts(str(user["_id"]), otp_request.purpose)
            
            # Log security event (tạm thời bỏ qua để test)
            # security_service.record_security_event(
            #     ip_address=request.client.host,
            #     event_type=f"otp_requested_{otp_request.purpose}",
            #     user_id=str(user["_id"])
            # )
        
        return {
            "success": True,
            "message": "If the email exists, an OTP has been sent",
            "development_otp": otp_code if settings.ENVIRONMENT == "development" else None
        }
        
    except Exception as e:
        logger.error(f"OTP request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/request-password-reset")
async def request_password_reset(
    otp_request: OTPRequest,
    request: Request
):
    """
    Yêu cầu reset password
    """
    try:
        # Get user
        user = user_service.get_user_by_email(otp_request.email)
        if not user:
            # Trả về lỗi rõ ràng khi email không tồn tại
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email không tồn tại trong hệ thống"
            )
        
        # Send OTP
        otp_code = otp_service.create_otp(
            user_id=str(user["_id"]),
            purpose=otp_request.purpose,
            email=otp_request.email,
            username=user.get("username", ""),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        if otp_code:
            # Log security event (tạm thời bỏ qua để test)
            # security_service.record_security_event(
            #     ip_address=request.client.host,
            #     event_type="password_reset_requested",
            #     user_id=str(user["_id"])
            # )
            pass
        
        return {
            "success": True,
            "message": "OTP đã được gửi đến email của bạn",
            "development_otp": otp_code if settings.ENVIRONMENT == "development" else None
        }
        
    except Exception as e:
        logger.error(f"Password reset request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/verify-password-reset-otp")
async def verify_password_reset_otp(
    otp_data: OTPVerify,
    request: Request
):
    """
    Verify OTP cho password reset
    """
    try:
        # Get user
        user = user_service.get_user_by_email(otp_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify OTP
        verify_result = otp_service.verify_otp(
            user_id=str(user["_id"]),
            otp_code=otp_data.otp_code,
            purpose="password_reset"
        )
        
        if not verify_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP"
            )
        
        return {
            "success": True,
            "message": "OTP verified successfully",
            "user": {
                "id": str(user["_id"]),
                "email": user["email"],
                "username": user["username"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset OTP verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/reset-password")
async def reset_password(
    reset_data: PasswordReset,
    request: Request
):
    """
    Reset password (sau khi đã verify OTP)
    """
    try:
        # Get user
        user = user_service.get_user_by_email(reset_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Hash new password
        hashed_password = security_service.hash_password(reset_data.new_password)
        
        # Update password
        if not user_service.update_password(str(user["_id"]), hashed_password):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password"
            )
        
        # Revoke all sessions (tạm thời bỏ qua để test)
        # session_service.revoke_all_user_sessions(
        #     user_id=str(user["_id"]),
        #     reason="password_changed"
        # )
        
        # Log security event
        security_service.log_security_event(
            event_type="password_reset",
            user_id=str(user["_id"]),
            ip_address=request.client.host,
            details={"method": "email_otp"}
        )

        # Send password changed notification email
        try:
            from app.services.email_service import email_service
            email_service.send_password_change_notification(
                to_email=user["email"],
                username=user["username"],
                change_time=datetime.utcnow()
            )
        except Exception as e:
            logger.warning(f"Failed to send password changed notification email: {e}")
            # Don't fail password reset if email fails

        return {
            "success": True,
            "message": "Password reset successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/me")
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy thông tin user hiện tại
    """
    try:
        user = user_service.get_user_by_id(current_user["sub"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "success": True,
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "email": user["email"],
                "is_verified": user.get("is_verified", False),
                "twofa_enabled": user.get("twofa_enabled", False),
                "created_at": user.get("created_at"),
                "last_login": user.get("last_login")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user info error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/sessions")
async def get_user_sessions(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lấy danh sách session của user
    """
    try:
        session_stats = session_service.get_session_stats(current_user["sub"])
        
        return {
            "success": True,
            "sessions": session_stats
        }
        
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/change-password")
async def change_password(
    request: Request,
    password_data: Dict[str, str],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Đổi mật khẩu user
    """
    try:
        current_password = password_data.get("current_password")
        new_password = password_data.get("new_password")

        if not current_password or not new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password and new password are required"
            )

        # Get user
        user = user_service.get_user_by_id(current_user["sub"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify current password
        if not security_service.verify_password(current_password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Hash new password
        hashed_password = security_service.hash_password(new_password)

        # Update password
        if not user_service.update_password(current_user["sub"], hashed_password):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password"
            )

        # Log security event
        security_service.log_security_event(
            event_type="password_changed",
            user_id=current_user["sub"],
            ip_address=request.client.host,
            details={"method": "user_initiated"}
        )

        return {
            "success": True,
            "message": "Password changed successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/2fa/toggle")
async def toggle_2fa(
    request: Request,
    toggle_data: Dict[str, bool],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Bật/tắt 2FA cho user
    """
    try:
        enable = toggle_data.get("enable", False)

        # Get user
        user = user_service.get_user_by_id(current_user["sub"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Update 2FA status
        from app.models.user import UserUpdate
        user_update = UserUpdate(twofa_enabled=enable)

        if not user_service.update_user(current_user["sub"], user_update):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update 2FA settings"
            )

        # Log security event
        security_service.log_security_event(
            event_type="2fa_toggled",
            user_id=current_user["sub"],
            ip_address=request.client.host,
            details={"enabled": enable}
        )

        response = {
            "success": True,
            "message": f"2FA {'enabled' if enable else 'disabled'} successfully"
        }

        # If enabling 2FA, generate QR code (mock for now)
        if enable:
            response["qr_code"] = "data:image/png;base64,mock-qr-code-data"

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling 2FA: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
