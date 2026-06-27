# app/core/config.py
# Đọc biến môi trường, cấu hình 

import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import Optional, List

# Đọc file .env
load_dotenv() 

class Settings(BaseSettings):
    # Cấu hình ứng dụng
    APP_NAME: str = os.getenv("APP_NAME", "Quantum-Resistant File Encryption API")
    VERSION: str = os.getenv("VERSION", "1.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Bảo mật
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # Cơ sở dữ liệu
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "quantum_file")
    
    # Email
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    FROM_EMAIL: Optional[str] = os.getenv("FROM_EMAIL")
    FROM_NAME: str = os.getenv("FROM_NAME", "Zero-Knowledge Encryption System")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    
    # Upload file
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(100 * 1024 * 1024)))  # 100MB
    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".zip", ".rar",
        ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".gif", ".bmp", ".svg", ".mp3",
        ".mp4", ".avi", ".mov", ".mkv", ".webm", ".7z", ".tar", ".gz"
    ]
    
    # OTP
    OTP_LENGTH: int = int(os.getenv("OTP_LENGTH", "6"))
    OTP_EXPIRE_MINUTES: int = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
    
    # Cấu hình MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_USE_SSL: bool = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "files")
    
    # Cấu hình mã hóa
    ENCRYPTION_KEY_SIZE: int = int(os.getenv("ENCRYPTION_KEY_SIZE", "32"))
    ARGON2_TIME_COST: int = int(os.getenv("ARGON2_TIME_COST", "2"))
    ARGON2_MEMORY_COST: int = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
    ARGON2_PARALLELISM: int = int(os.getenv("ARGON2_PARALLELISM", "1"))
    
    # hCaptcha Configuration
    HCAPTCHA_SITE_KEY: str = os.getenv("HCAPTCHA_SITE_KEY", "")
    HCAPTCHA_SECRET_KEY: str = os.getenv("HCAPTCHA_SECRET_KEY", "")
    HCAPTCHA_ENABLED: bool = os.getenv("HCAPTCHA_ENABLED", "true").lower() == "true"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "300"))  # 5 minutes
    RATE_LIMIT_MAX_REQUESTS: int = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "100"))
    
    # Security
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    ACCOUNT_LOCKOUT_DURATION: int = int(os.getenv("ACCOUNT_LOCKOUT_DURATION", "300"))  # 5 minutes
    PASSWORD_MIN_LENGTH: int = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    PASSWORD_REQUIRE_SPECIAL: bool = os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
    
    # Session Management
    SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))
    MAX_SESSIONS_PER_USER: int = int(os.getenv("MAX_SESSIONS_PER_USER", "5"))
    
    # HSM/Key Vault (tùy chọn)
    USE_HSM: bool = os.getenv("USE_HSM", "false").lower() == "true"
    HSM_PROVIDER: str = os.getenv("HSM_PROVIDER", "azure")
    KEY_VAULT_URL: str = os.getenv("KEY_VAULT_URL", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "")
    VAULT_TOKEN: str = os.getenv("VAULT_TOKEN", "")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # Cho phép trường thêm để tương thích ngược

settings = Settings()
