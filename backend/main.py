# main.py 
# Khởi động FastAPI và test kết nối 

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Kết nối database
from app.database import get_database, close_connection
from app.api.auth import router as auth_router
from app.api.user import router as user_router
from app.api.encrypted_file import router as encrypted_file_router
from app.api.analytics import router as analytics_router
from app.api.dashboard import router as dashboard_router
from app.api.crypto import router as crypto_router
from app.api.security import router as security_router
from app.api.activity import router as activity_router
from app.core.config import settings
from app.core.minio_client import minio_client

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý lifecycle của ứng dụng"""
    # Startup
    try:
        get_database()
        logger.info("Kết nối MongoDB thành công")
        # Kiểm tra kết nối MinIO với default bucket
        minio_ok = minio_client._check_connection(minio_client.default_bucket_name)
        app.state.minio_ok = bool(minio_ok)
        if minio_ok:
            logger.info(f"Kết nối MinIO thành công (default bucket='{minio_client.default_bucket_name}')")
        else:
            logger.warning("MinIO không khả dụng: sẽ chạy ở chế độ degrade (lưu trữ bị vô hiệu)")
    except Exception as e:
        logger.error(f"Kết nối MongoDB thất bại: {e}")
        raise

    yield

    # Shutdown
    close_connection()
    logger.info("Đã ngắt kết nối MongoDB")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Hệ thống mã hóa file kháng lượng tử - Zero-Knowledge Quantum-Resistant File Encryption System",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Cấu hình CORS
# Sử dụng danh sách từ cấu hình và thêm regex để hỗ trợ wildcard domain (ngrok) và LAN IP
_explicit_allowed_origins = [o for o in settings.ALLOWED_ORIGINS if "*" not in o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit_allowed_origins,
    # Trong môi trường dev, cho phép mọi origin để test (bao gồm mọi ngrok)
    allow_origin_regex=r".*" if settings.DEBUG or settings.ENVIRONMENT == "development" else r"^(https?:\/\/(?:[a-z0-9-]+\.)*ngrok(?:-free)?\.app|https?:\/\/(?:[a-z0-9-]+\.)*ngrok\.io|http:\/\/localhost(?::\d+)?|http:\/\/127\.0\.0\.1(?::\d+)?|http:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Thêm các router
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user_router, prefix="/api/user", tags=["User"])
app.include_router(encrypted_file_router, prefix="/api/encrypted", tags=["Encrypted Files"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(crypto_router, prefix="/api/crypto", tags=["Cryptography"])
app.include_router(security_router, prefix="/api/security", tags=["Security"])
app.include_router(activity_router, prefix="/api/activity", tags=["Activity Logging"])



@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Quantum-Resistant File Encryption API",
        "version": settings.VERSION,
        "status": "active",
        "docs": "/docs",
        "zero_knowledge": {
            "enabled": True,
            "principles": [
                "no_original_data",
                "no_private_keys", 
                "no_plaintext_passwords",
                "client_side_encryption",
                "server_blind_storage",
                "end_to_end_encryption"
            ]
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Database status
    db_ok = True
    try:
        get_database().command("ping")
    except Exception:
        db_ok = False

    # MinIO status (đã được set ở startup, fallback kiểm tra lại nếu chưa có)
    minio_ok = getattr(app.state, "minio_ok", None)
    if minio_ok is None:
        try:
            minio_ok = minio_client._check_connection()
        except Exception:
            minio_ok = False

    return {
        "status": "healthy" if (db_ok and minio_ok) else "degraded",
        "services": {
            "mongodb": db_ok,
            "minio": bool(minio_ok),
        },
        "minio": {
            "bucket": getattr(minio_client, "bucket_name", None)
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)