"""
hCaptcha Verification Service
============================
Service để xác thực hCaptcha token từ frontend.
"""

import httpx
import logging
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class CaptchaService:
    """Service xác thực hCaptcha"""
    
    def __init__(self):
        self.secret_key = settings.HCAPTCHA_SECRET_KEY
        self.verify_url = "https://hcaptcha.com/siteverify"
        self.enabled = settings.HCAPTCHA_ENABLED
        
    async def verify_captcha(
        self,
        token: str,
        remote_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Xác thực hCaptcha token
        
        Args:
            token: hCaptcha response token từ frontend
            remote_ip: IP address của client (optional)
            
        Returns:
            Dict chứa kết quả xác thực
        """
        if not self.enabled:
            logger.info("hCaptcha is disabled, skipping verification")
            return {
                "success": True,
                "message": "Captcha verification skipped (disabled)",
                "score": 1.0
            }
            
        if not token:
            return {
                "success": False,
                "message": "Missing captcha token",
                "error_codes": ["missing-input-response"]
            }
            
        if not self.secret_key:
            logger.error("hCaptcha secret key not configured")
            return {
                "success": False,
                "message": "Captcha service not configured",
                "error_codes": ["missing-secret-key"]
            }
            
        try:
            # Prepare verification data
            data = {
                "secret": self.secret_key,
                "response": token
            }
            
            if remote_ip:
                data["remoteip"] = remote_ip
                
            # Send verification request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.verify_url,
                    data=data,
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    logger.error(f"hCaptcha API returned status {response.status_code}")
                    return {
                        "success": False,
                        "message": "Captcha verification failed",
                        "error_codes": ["api-error"]
                    }
                    
                result = response.json()
                
                # Log verification result
                if result.get("success"):
                    logger.info(f"hCaptcha verification successful for IP: {remote_ip}")
                else:
                    error_codes = result.get("error-codes", [])
                    logger.warning(f"hCaptcha verification failed: {error_codes}")
                    
                return {
                    "success": result.get("success", False),
                    "message": "Captcha verified successfully" if result.get("success") else "Captcha verification failed",
                    "error_codes": result.get("error-codes", []),
                    "challenge_ts": result.get("challenge_ts"),
                    "hostname": result.get("hostname"),
                    "score": result.get("score", 0.0) if result.get("success") else 0.0
                }
                
        except httpx.TimeoutException:
            logger.error("hCaptcha verification timeout")
            return {
                "success": False,
                "message": "Captcha verification timeout",
                "error_codes": ["timeout"]
            }
            
        except httpx.RequestError as e:
            logger.error(f"hCaptcha verification request error: {e}")
            return {
                "success": False,
                "message": "Captcha verification network error",
                "error_codes": ["network-error"]
            }
            
        except Exception as e:
            logger.error(f"hCaptcha verification unexpected error: {e}")
            return {
                "success": False,
                "message": "Captcha verification internal error",
                "error_codes": ["internal-error"]
            }
    
    def is_enabled(self) -> bool:
        """Check if captcha is enabled"""
        return self.enabled and bool(self.secret_key)
    
    def get_error_message(self, error_codes: list) -> str:
        """
        Convert error codes to user-friendly messages
        """
        error_messages = {
            "missing-input-secret": "Lỗi cấu hình captcha",
            "invalid-input-secret": "Lỗi cấu hình captcha",
            "missing-input-response": "Vui lòng hoàn thành captcha",
            "invalid-input-response": "Captcha không hợp lệ",
            "bad-request": "Yêu cầu captcha không hợp lệ",
            "timeout-or-duplicate": "Captcha đã hết hạn hoặc đã được sử dụng",
            "timeout": "Captcha verification timeout",
            "network-error": "Lỗi kết nối khi xác thực captcha",
            "internal-error": "Lỗi hệ thống khi xác thực captcha",
            "api-error": "Lỗi API captcha"
        }
        
        if not error_codes:
            return "Xác thực captcha thất bại"
            
        # Return first known error message
        for code in error_codes:
            if code in error_messages:
                return error_messages[code]
                
        return f"Lỗi captcha: {', '.join(error_codes)}"

# Global instance
captcha_service = CaptchaService()
