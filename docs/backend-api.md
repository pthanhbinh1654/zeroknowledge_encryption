# Backend API - FastAPI Endpoints

## Mục Đích và Phạm Vi

Backend API cung cấp các endpoint RESTful để quản lý metadata, session, authentication và storage operations. Tuân thủ nghiêm ngặt nguyên tắc Zero Knowledge - chỉ xử lý ciphertext và metadata không nhạy cảm.

## Kiến Trúc API

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Auth Routes   │  │   File Routes   │  │  User Routes │ │
│  │   /api/auth/*   │  │   /api/files/*  │  │ /api/users/* │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Storage Routes  │  │ Signature Routes│  │ Admin Routes │ │
│  │ /api/storage/*  │  │   /api/sig/*    │  │ /api/admin/* │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Middleware Layer                        │
│  • CORS • Rate Limiting • Authentication • Logging         │
├─────────────────────────────────────────────────────────────┤
│                   Database Layer                           │
│  • MongoDB ODM • MinIO Client • Redis Cache                │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Endpoints

### POST /api/auth/register
**Mục đích**: Đăng ký tài khoản mới với OTP verification

```python
from pydantic import BaseModel, EmailStr
from typing import Optional

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str  # Sẽ được hash tại frontend
    phone: Optional[str] = None
    full_name: str
    
class RegisterResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    otp_sent: bool
```

**Request Example**:
```json
{
  "email": "user@example.com",
  "password": "hashed_password_from_frontend",
  "phone": "+84901234567",
  "full_name": "Nguyễn Văn A"
}
```

**Response Example**:
```json
{
  "success": true,
  "message": "OTP đã được gửi đến email",
  "user_id": "user_123456",
  "otp_sent": true
}
```

### POST /api/auth/verify-otp
**Mục đích**: Xác thực OTP để hoàn tất đăng ký

```python
class OTPVerifyRequest(BaseModel):
    user_id: str
    otp_code: str
    otp_type: str  # "registration", "login", "password_reset"

class OTPVerifyResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user_info: Optional[dict] = None
```

### POST /api/auth/login
**Mục đích**: Đăng nhập với email/password và OTP (nếu bật)

```python
class LoginRequest(BaseModel):
    email: EmailStr
    password: str  # Hashed tại frontend
    otp_code: Optional[str] = None
    remember_me: bool = False

class LoginResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    requires_otp: bool = False
    user_info: Optional[dict] = None
```

### POST /api/auth/refresh
**Mục đích**: Refresh access token

```python
class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    success: bool
    access_token: Optional[str] = None
    expires_in: int
```

### POST /api/auth/logout
**Mục đích**: Đăng xuất và revoke tokens

```python
class LogoutRequest(BaseModel):
    refresh_token: str

class LogoutResponse(BaseModel):
    success: bool
    message: str
```

### POST /api/auth/forgot-password
**Mục đích**: Yêu cầu reset password

```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    otp_sent: bool
```

## File Management Endpoints

### POST /api/files/upload
**Mục đích**: Upload ciphertext và metadata

```python
from fastapi import UploadFile, File, Form
from typing import List

class FileUploadMetadata(BaseModel):
    original_name: str
    original_size: int
    mime_type: str
    algorithm: str
    checksum: str  # SHA256 của plaintext
    encrypted_checksum: str  # SHA256 của ciphertext
    chunk_info: Optional[dict] = None
    signature_info: Optional[dict] = None

class FileUploadResponse(BaseModel):
    success: bool
    file_id: str
    message: str
    download_url: Optional[str] = None
```

**Endpoint Implementation**:
```python
@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    metadata: str = Form(...),  # JSON string của FileUploadMetadata
    current_user: User = Depends(get_current_user)
):
    # Parse metadata
    file_metadata = FileUploadMetadata.parse_raw(metadata)
    
    # Validate file size và type
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(400, "File quá lớn")
    
    # Upload lên MinIO
    file_id = await upload_to_minio(file, current_user.id)
    
    # Lưu metadata vào MongoDB
    await save_file_metadata(file_id, file_metadata, current_user.id)
    
    return FileUploadResponse(
        success=True,
        file_id=file_id,
        message="Upload thành công"
    )
```

### GET /api/files/list
**Mục đích**: Lấy danh sách file của user

```python
class FileListQuery(BaseModel):
    page: int = 1
    limit: int = 20
    search: Optional[str] = None
    algorithm: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

class FileInfo(BaseModel):
    file_id: str
    original_name: str
    original_size: int
    algorithm: str
    created_at: datetime
    has_signature: bool
    download_count: int

class FileListResponse(BaseModel):
    success: bool
    files: List[FileInfo]
    total: int
    page: int
    limit: int
```

### GET /api/files/{file_id}
**Mục đích**: Lấy thông tin chi tiết file

```python
class FileDetailResponse(BaseModel):
    success: bool
    file_info: dict
    metadata: dict
    signature_info: Optional[dict] = None
    download_url: str
```

### GET /api/files/{file_id}/download
**Mục đích**: Download ciphertext

```python
@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    # Kiểm tra quyền truy cập
    file_info = await get_file_info(file_id, current_user.id)
    if not file_info:
        raise HTTPException(404, "File không tồn tại")
    
    # Tạo presigned URL từ MinIO
    download_url = await generate_download_url(file_id)
    
    # Log download activity
    await log_file_activity(file_id, current_user.id, "download")
    
    return RedirectResponse(download_url)
```

### DELETE /api/files/{file_id}
**Mục đích**: Xóa file

```python
class DeleteFileResponse(BaseModel):
    success: bool
    message: str

@router.delete("/{file_id}", response_model=DeleteFileResponse)
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    # Kiểm tra ownership
    file_info = await get_file_info(file_id, current_user.id)
    if not file_info:
        raise HTTPException(404, "File không tồn tại")
    
    # Xóa từ MinIO
    await delete_from_minio(file_id)
    
    # Xóa metadata từ MongoDB
    await delete_file_metadata(file_id)
    
    return DeleteFileResponse(
        success=True,
        message="Xóa file thành công"
    )
```

## Digital Signature Endpoints

### POST /api/signatures/upload
**Mục đích**: Upload signature file

```python
class SignatureUploadResponse(BaseModel):
    success: bool
    signature_id: str
    message: str

@router.post("/upload", response_model=SignatureUploadResponse)
async def upload_signature(
    signature_file: UploadFile = File(...),
    file_id: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    # Parse signature file
    signature_data = await parse_signature_file(signature_file)
    
    # Validate signature format
    if not validate_signature_format(signature_data):
        raise HTTPException(400, "Format signature không hợp lệ")
    
    # Lưu signature
    signature_id = await save_signature(signature_data, file_id, current_user.id)
    
    return SignatureUploadResponse(
        success=True,
        signature_id=signature_id,
        message="Upload signature thành công"
    )
```

### POST /api/signatures/verify
**Mục đích**: Verify signature

```python
class SignatureVerifyRequest(BaseModel):
    file_id: str
    signature_id: str

class SignatureVerifyResponse(BaseModel):
    success: bool
    is_valid: bool
    signature_info: dict
    verification_details: dict
    verified_at: datetime

@router.post("/verify", response_model=SignatureVerifyResponse)
async def verify_signature(
    request: SignatureVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    # Lấy file và signature data
    file_data = await get_file_data(request.file_id)
    signature_data = await get_signature_data(request.signature_id)
    
    # Verify signature (tại backend để log)
    verification_result = await verify_digital_signature(file_data, signature_data)
    
    # Log verification activity
    await log_signature_verification(
        request.signature_id, 
        current_user.id, 
        verification_result
    )
    
    return SignatureVerifyResponse(
        success=True,
        is_valid=verification_result.is_valid,
        signature_info=signature_data,
        verification_details=verification_result.details,
        verified_at=datetime.utcnow()
    )
```

## User Management Endpoints

### GET /api/users/profile
**Mục đích**: Lấy thông tin profile user

```python
class UserProfile(BaseModel):
    user_id: str
    email: str
    full_name: str
    phone: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]
    settings: dict
    statistics: dict

class UserProfileResponse(BaseModel):
    success: bool
    profile: UserProfile
```

### PUT /api/users/profile
**Mục đích**: Cập nhật profile

```python
class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    settings: Optional[dict] = None

class UpdateProfileResponse(BaseModel):
    success: bool
    message: str
    updated_fields: List[str]
```

### POST /api/users/change-password
**Mục đích**: Đổi password

```python
class ChangePasswordRequest(BaseModel):
    current_password: str  # Hashed
    new_password: str      # Hashed
    otp_code: str

class ChangePasswordResponse(BaseModel):
    success: bool
    message: str
    requires_relogin: bool
```

## Storage Management Endpoints

### GET /api/storage/stats
**Mục đích**: Thống kê storage usage

```python
class StorageStats(BaseModel):
    total_files: int
    total_size: int
    used_storage: int
    storage_limit: int
    files_by_algorithm: dict
    files_by_month: dict

class StorageStatsResponse(BaseModel):
    success: bool
    stats: StorageStats
```

### GET /api/storage/activity
**Mục đích**: Lấy activity logs

```python
class ActivityQuery(BaseModel):
    page: int = 1
    limit: int = 50
    activity_type: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

class ActivityLog(BaseModel):
    activity_id: str
    activity_type: str
    file_id: Optional[str]
    details: dict
    timestamp: datetime
    ip_address: str
    user_agent: str

class ActivityResponse(BaseModel):
    success: bool
    activities: List[ActivityLog]
    total: int
```

## Error Handling

### Standard Error Response
```python
class ErrorResponse(BaseModel):
    success: bool = False
    error_code: str
    message: str
    details: Optional[dict] = None
    timestamp: datetime

# Common error codes
ERROR_CODES = {
    "AUTH_001": "Token không hợp lệ",
    "AUTH_002": "Token đã hết hạn", 
    "AUTH_003": "Không có quyền truy cập",
    "FILE_001": "File không tồn tại",
    "FILE_002": "File quá lớn",
    "FILE_003": "Định dạng file không hỗ trợ",
    "STORAGE_001": "Hết dung lượng lưu trữ",
    "RATE_001": "Quá nhiều request",
    "VALIDATION_001": "Dữ liệu đầu vào không hợp lệ"
}
```

### Exception Handlers
```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error_code=f"HTTP_{exc.status_code}",
            message=exc.detail,
            timestamp=datetime.utcnow()
        ).dict()
    )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error_code="VALIDATION_001",
            message="Dữ liệu đầu vào không hợp lệ",
            details=exc.errors(),
            timestamp=datetime.utcnow()
        ).dict()
    )
```

## Middleware Configuration

### CORS Middleware
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### Rate Limiting Middleware
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limits
@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    pass

@router.post("/upload")
@limiter.limit("10/minute")
async def upload_file(request: Request, ...):
    pass
```

### Authentication Middleware
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
import jwt

security = HTTPBearer()

async def get_current_user(token: str = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "Token không hợp lệ")
        
        user = await get_user_by_id(user_id)
        if user is None:
            raise HTTPException(401, "User không tồn tại")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token đã hết hạn")
    except jwt.JWTError:
        raise HTTPException(401, "Token không hợp lệ")
```

## API Documentation

### OpenAPI Configuration
```python
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Zero Knowledge File System API",
        version="1.0.0",
        description="API cho hệ thống mã hóa file Zero Knowledge",
        routes=app.routes,
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Backend chỉ nhận và lưu ciphertext
- Metadata không chứa thông tin nhạy cảm về nội dung
- Không có endpoint nào decrypt dữ liệu
- Authentication tách biệt với crypto operations

### ⚠️ Lưu Ý Bảo Mật
```python
# Logging an toàn - không log sensitive data
import logging

logger = logging.getLogger(__name__)

def safe_log_request(request_data: dict, user_id: str):
    # Remove sensitive fields
    safe_data = {k: v for k, v in request_data.items() 
                 if k not in ['password', 'private_key', 'passphrase']}
    
    logger.info(f"User {user_id} request: {safe_data}")

# Input validation
def validate_no_plaintext(data: dict):
    """Ensure no plaintext data in request"""
    forbidden_fields = ['plaintext', 'decrypted_data', 'original_content']
    for field in forbidden_fields:
        if field in data:
            raise HTTPException(400, f"Field {field} không được phép")
```
