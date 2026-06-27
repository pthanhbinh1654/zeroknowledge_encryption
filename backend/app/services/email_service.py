"""
Simple Email Service
===================
Simplified email service for Zero Knowledge Encryption System.
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class EmailService:
    """SMTP email service — credentials are loaded from environment variables.
    Set SMTP_USERNAME, SMTP_PASSWORD, FROM_EMAIL, SMTP_SERVER, SMTP_PORT in your .env file.
    """

    def __init__(self):
        from app.core.config import settings
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME or ''
        self.smtp_password = settings.SMTP_PASSWORD or ''
        self.from_email = settings.FROM_EMAIL or settings.SMTP_USERNAME or ''
        self.from_name = settings.FROM_NAME
        
    def send_otp_email(self, to_email: str, username: str, otp_code: str, purpose: str = "verification") -> bool:
        """Send OTP email"""
        try:
            subject = f"OTP Verification - {purpose}"
            
            html_content = f"""
            <html>
            <body>
                <h2>Zero Knowledge Encryption System</h2>
                <p>Hello {username},</p>
                <p>Your OTP code is: <strong>{otp_code}</strong></p>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending OTP email: {e}")
            return False
    
    def send_welcome_email(self, to_email: str, username: str) -> bool:
        """Send welcome email"""
        try:
            subject = "Welcome to Zero Knowledge Encryption System"
            
            html_content = f"""
            <html>
            <body>
                <h2>Welcome {username}!</h2>
                <p>Your account has been successfully created.</p>
                <p>You can now start encrypting your files securely.</p>
                <p>Thank you for choosing Zero Knowledge Encryption!</p>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending welcome email: {e}")
            return False
    
    def send_login_notification(self, to_email: str, username: str, ip_address: str, user_agent: str, login_time: datetime) -> bool:
        """Send login notification"""
        try:
            subject = "Login Notification - Zero Knowledge Encryption"
            
            html_content = f"""
            <html>
            <body>
                <h2>Login Notification</h2>
                <p>Hello {username},</p>
                <p>We detected a login to your account:</p>
                <ul>
                    <li>Time: {login_time.strftime('%Y-%m-%d %H:%M:%S')}</li>
                    <li>IP Address: {ip_address}</li>
                    <li>Device: {user_agent[:100]}...</li>
                </ul>
                <p>If this was not you, please change your password immediately.</p>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending login notification: {e}")
            return False
    
    def send_password_change_notification(self, to_email: str, username: str, change_time: datetime) -> bool:
        """Send password change notification"""
        try:
            subject = "Password Changed - Zero Knowledge Encryption"
            
            html_content = f"""
            <html>
            <body>
                <h2>Password Changed</h2>
                <p>Hello {username},</p>
                <p>Your password was successfully changed at {change_time.strftime('%Y-%m-%d %H:%M:%S')}.</p>
                <p>If you did not make this change, please contact us immediately.</p>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending password change notification: {e}")
            return False
    
    def send_security_alert(self, to_email: str, username: str, alert_type: str, details: Dict[str, Any], timestamp: datetime) -> bool:
        """Send security alert"""
        try:
            subject = f"Security Alert - {alert_type}"
            
            html_content = f"""
            <html>
            <body>
                <h2>Security Alert</h2>
                <p>Hello {username},</p>
                <p>We detected suspicious activity on your account:</p>
                <p><strong>Alert Type:</strong> {alert_type}</p>
                <p><strong>Time:</strong> {timestamp.strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Details:</strong> {str(details)}</p>
                <p>Please review your account security settings.</p>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending security alert: {e}")
            return False
    
    def send_file_activity_notification(self, to_email: str, username: str, activity_type: str, filename: str, timestamp: datetime) -> bool:
        """Send file activity notification"""
        try:
            subject = f"File Activity - {activity_type}"
            
            html_content = f"""
            <html>
            <body>
                <h2>File Activity Notification</h2>
                <p>Hello {username},</p>
                <p>File activity detected:</p>
                <ul>
                    <li>Activity: {activity_type}</li>
                    <li>File: {filename}</li>
                    <li>Time: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}</li>
                </ul>
            </body>
            </html>
            """
            
            return self._send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Error sending file activity notification: {e}")
            return False
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SMTP"""
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email
            
            # Create HTML part
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            # Send real email
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, to_email, message.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    def is_enabled(self) -> bool:
        """Check if email service is enabled"""
        return True  # Always enabled for testing
    
    def validate_email_address(self, email: str) -> bool:
        """Validate email address format"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

# Create global instance
email_service = EmailService()
