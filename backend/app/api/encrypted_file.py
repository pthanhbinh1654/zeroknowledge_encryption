"""
Encrypted File API Endpoints
===========================
API endpoints cho upload, encrypt, decrypt, download file.
Đảm bảo Zero-Knowledge và streaming response.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any, List
import json
import logging

from app.core.security import get_current_user
from app.models.user import UserInDB
from app.models.encrypted_file import (
    FileUploadRequest,
    FileDecryptRequest,
    FileListResponse,
    FileOperationResult,
    EncryptionAlgorithm,
    KeyWrapAlgorithm,
    SecureDeleteRequest,
    EncryptionStats,
    BulkUploadRequest,
    FileDownloadRequest
)
from app.services.encrypted_file_service import encrypted_file_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/user-files")
async def get_user_files_for_frontend(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Lấy danh sách file đã mã hóa của user cho frontend
    """
    try:
        user_id = current_user.get('sub') or current_user.get('id') or ''
        logger.info(f"Getting files for user {user_id}")

        result = await encrypted_file_service.get_user_files(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        return {
            "success": True,
            "files": result.get("files", []),
            "total": result.get("total", 0),
            "page": offset // limit + 1,
            "per_page": limit
        }

    except Exception as e:
        logger.error(f"Error getting user files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user files"
        )


@router.post("/persist")
async def persist_file_to_mongodb(
    file_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Persist encrypted file data to MongoDB for long-term storage
    """
    try:
        user_id = current_user.get('sub') or current_user.get('id') or ''

        # Add user_id to file data
        file_data['user_id'] = user_id

        # Save to MongoDB
        result = await encrypted_file_service.persist_file_metadata(file_data)

        return {
            "success": True,
            "message": "File persisted successfully",
            "_id": str(result.get("_id", "")),
            "file_id": result.get("file_id", "")
        }

    except Exception as e:
        logger.error(f"Error persisting file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist file: {str(e)}"
        )


@router.get("/files", response_model=FileListResponse)
async def get_user_files(
    current_user: UserInDB = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Lấy danh sách file đã mã hóa của user

    Args:
        current_user: User hiện tại
        limit: Số lượng file tối đa
        offset: Offset cho pagination

    Returns:
        Danh sách file của user
    """
    try:
        # Extract user id from JWT payload or model
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        logger.info(f"Getting files for user {user_id}")

        result = await encrypted_file_service.get_user_files(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        return FileListResponse(
            files=result.get("files", []),
            total=result.get("total", 0),
            page=offset // limit + 1,
            per_page=limit
        )

    except Exception as e:
        logger.error(f"Error getting user files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user files"
        )


@router.post("/upload", response_model=FileOperationResult)
async def upload_and_encrypt_file(
    file: UploadFile = File(...),
    encryption_data: str = Form(...),  # JSON string của FileUploadRequest
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Upload và mã hóa file
    
    Process:
    1. Validate file size và extension
    2. Parse encryption parameters
    3. Encrypt và upload file
    4. Return file ID
    
    Note:
    - Password/key không được log
    - File gốc không được lưu
    """
    try:
        # Determine file size from stream
        try:
            file.file.seek(0, 2)  # move to end
            file_size = file.file.tell()
            file.file.seek(0)     # reset to start for downstream readers
        except Exception:
            file_size = 0

        # Validate file size
        if settings.MAX_FILE_SIZE and file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed ({settings.MAX_FILE_SIZE} bytes)"
            )
        
        # Parse encryption request
        try:
            request_data = json.loads(encryption_data)
            request = FileUploadRequest(**request_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid encryption parameters: {str(e)}"
            )
        
        # Client handles all encryption logic - server only stores encrypted data
        # No validation needed as client is responsible for encryption/decryption
        
        # Extract user id from JWT payload or model
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )

        # Process file
        result = encrypted_file_service.upload_and_encrypt(
            file_data=file.file,
            filename=file.filename,
            file_size=file_size,
            user_id=user_id,
            request=request
        )
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.message
            )

        # Send file encrypted notification email
        try:
            from app.services.email_service import email_service
            file_size_mb = round(file_size / (1024 * 1024), 2)
            email_service.send_file_encrypted_notification(
                to_email=(getattr(current_user, 'email', None) or current_user.get('email', '')),
                username=(getattr(current_user, 'username', None) or current_user.get('username', '')),
                filename=file.filename or "unknown",
                file_size=f"{file_size_mb} MB",
                algorithm=(request.encryption_algorithm.value if hasattr(request.encryption_algorithm, 'value') else str(request.encryption_algorithm)),
                file_id=result.file_id
            )
        except Exception as e:
            logger.warning(f"Failed to send file encrypted notification email: {e}")
            # Don't fail upload if email fails

        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_and_encrypt_file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process file upload"
        )


@router.get("/metadata/{file_id}")
async def get_file_metadata(
    file_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy metadata của file đã mã hóa

    Process:
    1. Validate file access
    2. Return metadata (không có key/password)

    Note:
    - Chỉ trả về metadata an toàn
    - Không bao gồm key hoặc sensitive data
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = encrypted_file_service.get_file_metadata(
            file_id=file_id,
            user_id=user_id
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or access denied"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file metadata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get file metadata"
        )


@router.get("/download/{file_id}")
async def download_encrypted_file(
    file_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Download file đã mã hóa (client-side decryption)
    
    Process:
    1. Validate file access
    2. Get encrypted data
    3. Return encrypted data + metadata
    
    Note:
    - Client handles all decryption
    - Server only returns encrypted data
    """
    try:
        # Get encrypted file data
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = encrypted_file_service.decrypt_and_download(
            file_id=file_id,
            user_id=user_id,
            request=FileDecryptRequest()
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or access denied"
            )
        
        # Return encrypted data as streaming response
        encrypted_data = result["encrypted_data"]
        
        return StreamingResponse(
            iter([encrypted_data]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={result['file_metadata']['filename']}.enc",
                "X-File-Metadata": json.dumps(result["file_metadata"]),
                "X-Zero-Knowledge": "true"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in download_encrypted_file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download file"
        )


@router.post("/bulk-upload")
async def bulk_upload_files(
    files: List[UploadFile] = File(...),
    encryption_data: str = Form(...),  # JSON string của BulkUploadRequest
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Upload nhiều file đã mã hóa (client-side encryption)
    
    Process:
    1. Validate all files
    2. Upload each file individually
    3. Return results for all files
    """
    try:
        # Parse bulk upload request
        try:
            request_data = json.loads(encryption_data)
            bulk_request = BulkUploadRequest(**request_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid bulk upload parameters: {str(e)}"
            )
        
        if len(files) != len(bulk_request.files):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of files does not match encryption data"
            )
        
        # Upload each file
        results = []
        for i, file in enumerate(files):
            try:
                # Determine size per file
                try:
                    file.file.seek(0, 2)
                    fsize = file.file.tell()
                    file.file.seek(0)
                except Exception:
                    fsize = 0
                user_id = (
                    str(getattr(current_user, 'id', None))
                    if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
                    else str(current_user.get('sub') or current_user.get('id') or '')
                )
                result = encrypted_file_service.upload_and_encrypt(
                    file_data=file.file,
                    filename=file.filename,
                    file_size=fsize,
                    user_id=user_id,
                    request=bulk_request.files[i]
                )
                results.append({
                    "filename": file.filename,
                    "success": result.success,
                    "file_id": result.file_id,
                    "message": result.message
                })
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "file_id": None,
                    "message": str(e)
                })
        
        return {
            "success": True,
            "data": {
                "results": results,
                "total_files": len(files),
                "successful_uploads": sum(1 for r in results if r["success"]),
                "zero_knowledge": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk_upload_files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process bulk upload"
        )


@router.get("/list", response_model=FileListResponse)
async def list_encrypted_files(
    page: int = 1,
    per_page: int = 20,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy danh sách file đã mã hóa của user
    
    Returns:
        Danh sách file với metadata (không có key/password)
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = encrypted_file_service.list_encrypted_files(
            user_id=user_id,
            page=page,
            per_page=per_page
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in list_encrypted_files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve file list"
        )


@router.delete("/{file_id}", response_model=FileOperationResult)
async def delete_encrypted_file(
    file_id: str,
    request: SecureDeleteRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Xóa file mã hóa
    
    Process:
    1. Validate quyền và xác nhận
    2. Xóa file từ MinIO
    3. Xóa metadata từ database
    4. Secure delete nếu được yêu cầu
    """
    try:
        if not request.confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation required for file deletion"
            )
        
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        result = encrypted_file_service.delete_encrypted_file(
            file_id=file_id,
            user_id=user_id,
            secure_delete=True
        )
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_encrypted_file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file"
        )


@router.put("/{file_id}", response_model=FileOperationResult)
async def update_encrypted_file(
    file_id: str,
    updates: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Cập nhật thông tin file đã mã hóa

    Args:
        file_id: ID của file cần cập nhật
        updates: Dữ liệu cập nhật
        current_user: User hiện tại

    Returns:
        Kết quả cập nhật file
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )

        # Update file metadata
        result = encrypted_file_service.update_file_metadata(
            file_id=file_id,
            user_id=user_id,
            updates=updates
        )

        return FileOperationResult(
            success=True,
            message="File updated successfully",
            file_id=file_id,
            data=result
        )

    except Exception as e:
        logger.error(f"Error in update_encrypted_file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update file"
        )


@router.get("/algorithms")
async def get_available_algorithms():
    """
    Lấy danh sách thuật toán mã hóa có sẵn

    Returns:
        Danh sách thuật toán mã hóa
    """
    try:
        algorithms = [
            "AES-256-GCM",
            "XChaCha20-Poly1305",
            "Camellia-CTR",
            "AES-256-CBC"
        ]

        return {"algorithms": algorithms}

    except Exception as e:
        logger.error(f"Error in get_available_algorithms: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve algorithms"
        )


@router.post("/batch-delete")
async def batch_delete_files(
    request: dict,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Xóa nhiều file cùng lúc

    Args:
        request: Dict chứa file_ids
        current_user: User hiện tại

    Returns:
        Kết quả xóa batch
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )

        file_ids = request.get('file_ids', [])
        if not file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file IDs provided"
            )

        results = []
        for file_id in file_ids:
            try:
                encrypted_file_service.delete_encrypted_file(file_id, user_id)
                results.append({"file_id": file_id, "success": True})
            except Exception as e:
                results.append({"file_id": file_id, "success": False, "error": str(e)})

        return {"results": results}

    except Exception as e:
        logger.error(f"Error in batch_delete_files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete files"
        )


@router.get("/stats", response_model=EncryptionStats)
async def get_encryption_stats(
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy thống kê về file mã hóa

    Returns:
        Thống kê chi tiết về file đã mã hóa
    """
    try:
        user_id = (
            str(getattr(current_user, 'id', None))
            if hasattr(current_user, 'id') and getattr(current_user, 'id', None)
            else str(current_user.get('sub') or current_user.get('id') or '')
        )
        stats = encrypted_file_service.get_encryption_stats(
            user_id=user_id
        )

        return stats

    except Exception as e:
        logger.error(f"Error in get_encryption_stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve encryption stats"
        )
