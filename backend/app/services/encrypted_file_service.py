"""
Encrypted File Service - Zero-Knowledge Implementation
=====================================================
Service xử lý file đã mã hóa theo nguyên tắc Zero-Knowledge.
Server không bao giờ thấy dữ liệu gốc, chỉ lưu trữ dữ liệu đã mã hóa.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, BinaryIO
from bson import ObjectId

from app.database import get_database
from app.core.minio_client import minio_client
from app.models.encrypted_file import (
    FileUploadRequest,
    FileDecryptRequest,
    FileListResponse,
    FileOperationResult,
    EncryptionStats,
    EncryptedFileMetadata
)
from app.services.crypto_service import crypto_service
from app.services.user_service import user_service
from app.core.config import settings

logger = logging.getLogger(__name__)

class EncryptedFileService:
    """Service xử lý file đã mã hóa theo Zero-Knowledge principles"""
    
    def __init__(self):
        self.db = get_database()

    async def get_user_files(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Lấy danh sách file đã mã hóa của user

        Args:
            user_id: ID của user
            limit: Số lượng file tối đa
            offset: Offset cho pagination

        Returns:
            Dict chứa files và total count
        """
        try:
            # Query files từ database
            files_cursor = self.db.encrypted_files.find(
                {"user_id": user_id}
            ).sort("created_at", -1).skip(offset).limit(limit)

            files = []
            for file_doc in files_cursor:
                # Debug: Log MongoDB document structure
                logger.info(f"MongoDB file doc keys: {list(file_doc.keys())}")
                logger.info(f"File: {file_doc.get('original_name')} - Size: {file_doc.get('file_size')} - Algorithm: {file_doc.get('encryption_algorithm')}")

                # Map MongoDB fields to frontend format based on actual collection structure
                file_size = file_doc.get("file_size", 0)  # Use actual field name from MongoDB
                algorithm = file_doc.get("encryption_algorithm", "Unknown")  # Use actual field name
                filename = file_doc.get("original_name", "") or file_doc.get("encrypted_name", "")
                uploaded_at = file_doc.get("uploaded_at", "")

                files.append({
                    "id": str(file_doc["_id"]),
                    "file_id": file_doc.get("file_id", ""),
                    "filename": filename,
                    "original_name": file_doc.get("original_name", ""),
                    "encrypted_name": file_doc.get("encrypted_name", ""),
                    "original_size": file_size,
                    "encrypted_size": file_size,  # Use same size for now
                    "size": file_size,  # Primary size field
                    "file_size": file_size,  # Keep original field name
                    "algorithm": algorithm,
                    "encryption_algorithm": algorithm,
                    "key_derivation_function": file_doc.get("key_derivation_function", ""),
                    "mime_type": file_doc.get("mime_type", ""),
                    "file_hash": file_doc.get("file_hash", ""),
                    "nonce": file_doc.get("nonce", ""),
                    "salt": file_doc.get("salt", ""),
                    "signature": file_doc.get("signature", ""),
                    "signature_algorithm": file_doc.get("signature_algorithm", ""),
                    "public_key": file_doc.get("public_key", ""),
                    "is_signed": bool(file_doc.get("signature")),
                    "created_at": uploaded_at,
                    "uploaded_at": uploaded_at,
                    "timestamp": uploaded_at,
                    "last_accessed": file_doc.get("last_accessed", ""),
                    "description": file_doc.get("description", ""),
                    "tags": file_doc.get("tags", []),
                    "user_id": file_doc.get("user_id", ""),
                    "encryption_type": "password"  # Default type
                })

            # Đếm tổng số files
            total = self.db.encrypted_files.count_documents({"user_id": user_id})

            return {
                "files": files,
                "total": total
            }

        except Exception as e:
            logger.error(f"Error getting user files: {e}")
            return {
                "files": [],
                "total": 0
            }

    async def persist_file_metadata(self, file_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persist file metadata to MongoDB for long-term storage

        Args:
            file_data: File data from frontend

        Returns:
            Dict with MongoDB document ID
        """
        try:
            # Create document for MongoDB
            doc = {
                "filename": file_data.get("filename", ""),
                "original_name": file_data.get("original_name", ""),
                "encrypted_data": file_data.get("encrypted_data", ""),  # Base64 encoded
                "metadata": file_data.get("metadata", {}),
                "algorithm": file_data.get("algorithm", ""),
                "mode": file_data.get("mode", "single"),
                "size": file_data.get("size", 0),
                "type": file_data.get("type", "encrypted"),
                "signature": file_data.get("signature"),
                "public_key": file_data.get("public_key"),
                "user_id": file_data.get("user_id", ""),
                "timestamp": file_data.get("timestamp", datetime.utcnow().isoformat()),
                "uploaded_at": datetime.utcnow(),
                "created_at": datetime.utcnow(),
                "is_signed": bool(file_data.get("signature")),
                "encryption_type": "password",  # Default type
                "original_size": file_data.get("size", 0),
                "encrypted_size": len(file_data.get("encrypted_data", "")),
                "file_type": file_data.get("metadata", {}).get("type", ""),
                "file_id": str(ObjectId())  # Generate unique file ID
            }

            # Insert into MongoDB
            result = self.db.encrypted_files.insert_one(doc)

            logger.info(f"File metadata persisted to MongoDB: {doc['filename']}")

            return {
                "_id": str(result.inserted_id),
                "file_id": doc["file_id"],
                "success": True
            }

        except Exception as e:
            logger.error(f"Error persisting file metadata: {e}")
            raise Exception(f"Failed to persist file metadata: {str(e)}")
    
    def upload_and_encrypt(
        self,
        file_data: BinaryIO,
        filename: str,
        file_size: int,
        user_id: str,
        request: FileUploadRequest
    ) -> FileOperationResult:
        """
        Upload file đã mã hóa (client-side encryption)
        
        Zero-Knowledge Principles:
        - Server không thấy file gốc
        - Server không thấy password/key
        - Server chỉ lưu dữ liệu đã mã hóa
        """
        try:
            # Validate encryption request (tạm thời bỏ qua để debug)
            # validation = crypto_service.validate_encryption_request(request.dict())
            # if not validation["valid"]:
            #     return FileOperationResult(
            #         success=False,
            #         message=f"Invalid encryption parameters: {', '.join(validation['errors'])}"
            #     )
            
            # Đọc dữ liệu đã mã hóa từ client
            encrypted_data = file_data.read()
            
            # Tạo file ID
            file_id = str(ObjectId())
            encrypted_filename = f"{file_id}_{filename}.enc"
            
            # Tạo metadata
            metadata = EncryptedFileMetadata(
                file_id=file_id,
                original_name=filename,
                encrypted_name=encrypted_filename,
                file_size=file_size,
                file_hash=request.checksum,
                encryption_algorithm=request.encryption_algorithm,
                key_derivation_function=request.key_derivation_function,
                nonce=request.iv,
                tag="",  # Client sẽ cung cấp
                use_key_wrap=request.use_key_wrap,
                key_wrap_algorithm=request.key_wrap_algorithm,
                salt=request.salt,
                wrapped_key=request.wrapped_key,
                public_key=request.public_key,
                signature_algorithm=request.signature_algorithm,
                signature=request.signature,
                public_key_signature=request.public_key_signature,
                user_id=user_id,
                description=request.description,
                tags=request.tags or []
            )
            
            # Lưu metadata vào database
            self.db.encrypted_files.insert_one(metadata.model_dump())

            # Lấy email của user để tạo bucket riêng
            user = user_service.get_user_by_id(user_id)
            user_email = user.get("email") if user else None

            # Tạo lại stream cho MinIO upload
            import io
            file_stream = io.BytesIO(encrypted_data)
            file_stream.seek(0)

            # Lưu encrypted data vào MinIO với bucket riêng cho user
            if not minio_client.upload_file(encrypted_filename, file_stream, len(encrypted_data), user_email):
                return FileOperationResult(
                    success=False,
                    message="Failed to upload encrypted file to storage"
                )
            
            # Log zero-knowledge operation
            zk_metadata = crypto_service.get_zero_knowledge_metadata(
                "upload",
                user_id,
                file_id=file_id,
                algorithm=request.encryption_algorithm.value,
                file_size=file_size
            )
            logger.info(f"Zero-knowledge upload: {zk_metadata}")
            
            return FileOperationResult(
                success=True,
                message="File uploaded successfully",
                file_id=file_id,
                details={
                    "encrypted_filename": encrypted_filename,
                    "zero_knowledge": True
                }
            )
            
        except Exception as e:
            logger.error(f"Error in upload_and_encrypt: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return FileOperationResult(
                success=False,
                message=f"Upload failed: {str(e)}"
            )
    
    def decrypt_and_download(
        self,
        file_id: str,
        user_id: str,
        request: FileDecryptRequest
    ) -> Optional[Dict[str, Any]]:
        """
        Chuẩn bị file đã mã hóa để download (client-side decryption)
        
        Zero-Knowledge Principles:
        - Server không giải mã file
        - Server chỉ trả về dữ liệu đã mã hóa
        - Client tự giải mã
        """
        try:
            # Tìm file metadata
            file_metadata = self.db.encrypted_files.find_one({
                "file_id": file_id,
                "user_id": user_id
            })
            
            if not file_metadata:
                raise ValueError("File not found or access denied")
            
            # Cập nhật access count và timestamp
            self.db.encrypted_files.update_one(
                {"file_id": file_id},
                {
                    "$inc": {"access_count": 1},
                    "$set": {"last_accessed": datetime.utcnow()}
                }
            )
            
            # Lấy encrypted data từ MinIO
            encrypted_data = minio_client.download_file(file_metadata["encrypted_name"])
            
            if not encrypted_data:
                raise ValueError("Encrypted data not found")
            
            # Log zero-knowledge operation
            zk_metadata = crypto_service.get_zero_knowledge_metadata(
                "download",
                user_id,
                file_id=file_id,
                algorithm=file_metadata["encryption_algorithm"]
            )
            logger.info(f"Zero-knowledge download: {zk_metadata}")
            
            # Trả về metadata và encrypted data cho client
            return {
                "file_metadata": {
                    "filename": file_metadata["original_name"],
                    "original_size": file_metadata["file_size"],
                    "encryption_algorithm": file_metadata["encryption_algorithm"],
                    "key_derivation_function": file_metadata["key_derivation_function"],
                    "use_key_wrap": file_metadata["use_key_wrap"],
                    "key_wrap_algorithm": file_metadata["key_wrap_algorithm"],
                    "salt": file_metadata["salt"],
                    "nonce": file_metadata["nonce"],
                    "file_hash": file_metadata["file_hash"],
                    "wrapped_key": file_metadata.get("wrapped_key"),
                    "signature_algorithm": file_metadata.get("signature_algorithm"),
                    "signature": file_metadata.get("signature"),
                    "public_key_signature": file_metadata.get("public_key_signature")
                },
                "encrypted_data": encrypted_data,
                "zero_knowledge": True
            }
            
        except Exception as e:
            logger.error(f"Error in decrypt_and_download: {e}")
            return None
    
    def get_file_metadata(
        self,
        file_id: str,
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Lấy metadata của file đã mã hóa

        Args:
            file_id: ID của file
            user_id: ID của user

        Returns:
            Metadata của file (không có sensitive data)
        """
        try:
            # Truy vấn theo schema hiện đang lưu: file_id và user_id là chuỗi
            file_doc = self.db.encrypted_files.find_one({
                "file_id": file_id,
                "user_id": user_id
            })

            if not file_doc:
                return None

            # Chuẩn hóa giá trị thuật toán (có thể đã lưu là Enum hoặc string)
            enc_algo = file_doc.get("encryption_algorithm")
            if hasattr(enc_algo, "value"):
                enc_algo = enc_algo.value

            # Trả về metadata an toàn (không bao gồm key/password)
            return {
                "id": file_doc.get("file_id"),
                "original_name": file_doc.get("original_name"),
                "file_size": file_doc.get("file_size", 0),
                "encryption_algorithm": enc_algo,
                "uploaded_at": (file_doc.get("uploaded_at").isoformat() if file_doc.get("uploaded_at") else None),
                "last_accessed": (file_doc.get("last_accessed").isoformat() if file_doc.get("last_accessed") else None),
                "description": file_doc.get("description"),
                "tags": file_doc.get("tags", []),
                "has_signature": bool(file_doc.get("signature_algorithm")),
            }

        except Exception as e:
            logger.error(f"Error getting file metadata: {e}")
            return None

    def list_encrypted_files(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 20
    ) -> FileListResponse:
        """
        Lấy danh sách file đã mã hóa của user
        
        Zero-Knowledge Principles:
        - Chỉ trả về metadata, không có nội dung
        - Không lưu trữ thông tin nhạy cảm
        """
        try:
            skip = (page - 1) * per_page
            
            # Đếm tổng số file
            total_files = self.db.encrypted_files.count_documents({
                "user_id": user_id
            })
            
            # Lấy danh sách file
            files = list(self.db.encrypted_files.find(
                {"user_id": user_id},
                {
                    "file_id": 1,
                    "original_name": 1,
                    "file_size": 1,
                    "encryption_algorithm": 1,
                    "uploaded_at": 1,
                    "last_accessed": 1,
                    "description": 1,
                    "tags": 1,
                    "signature_algorithm": 1
                }
            ).skip(skip).limit(per_page).sort("uploaded_at", -1))
            
            # Format response
            file_list = []
            for file in files:
                file_list.append({
                    "id": file["file_id"],
                    "filename": file["original_name"],
                    "original_size": file["file_size"],
                    "encryption_algorithm": file["encryption_algorithm"],
                    "uploaded_at": file["uploaded_at"].isoformat(),
                    "last_accessed": file["last_accessed"].isoformat() if file.get("last_accessed") else None,
                    "description": file.get("description"),
                    "tags": file.get("tags", []),
                    "signed": bool(file.get("signature_algorithm"))
                })
            
            return FileListResponse(
                files=file_list,
                total=total_files,
                page=page,
                per_page=per_page
            )
            
        except Exception as e:
            logger.error(f"Error in list_encrypted_files: {e}")
            return FileListResponse(
                files=[],
                total=0,
                page=page,
                per_page=per_page
            )
    
    def delete_encrypted_file(
        self,
        file_id: str,
        user_id: str,
        secure_delete: bool = True
    ) -> FileOperationResult:
        """
        Xóa file đã mã hóa
        
        Zero-Knowledge Principles:
        - Server không cần biết nội dung file
        - Secure delete overwrites encrypted data
        """
        try:
            # Tìm file
            file_metadata = self.db.encrypted_files.find_one({
                "file_id": file_id,
                "user_id": user_id
            })
            
            if not file_metadata:
                return FileOperationResult(
                    success=False,
                    message="File not found or access denied"
                )
            
            # Secure delete nếu được yêu cầu
            if secure_delete:
                minio_client.delete_file(file_metadata["encrypted_name"])
            
            # Xóa metadata
            self.db.encrypted_files.delete_one({"file_id": file_id})
            
            # Log zero-knowledge operation
            zk_metadata = crypto_service.get_zero_knowledge_metadata(
                "delete",
                user_id,
                file_id=file_id
            )
            logger.info(f"Zero-knowledge delete: {zk_metadata}")
            
            return FileOperationResult(
                success=True,
                message="File deleted successfully",
                file_id=file_id
            )
            
        except Exception as e:
            logger.error(f"Error in delete_encrypted_file: {e}")
            return FileOperationResult(
                success=False,
                message=f"Delete failed: {str(e)}"
            )
    
    def get_encryption_stats(self, user_id: str) -> EncryptionStats:
        """
        Lấy thống kê về file mã hóa
        
        Zero-Knowledge Principles:
        - Chỉ thống kê metadata, không có nội dung
        """
        try:
            # Đếm tổng số file
            total_files = self.db.encrypted_files.count_documents({"user_id": user_id})
            
            # Tính tổng dung lượng
            pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
            ]
            size_result = list(self.db.encrypted_files.aggregate(pipeline))
            total_size = size_result[0]["total_size"] if size_result else 0
            
            # Thống kê theo thuật toán
            algorithm_stats = list(self.db.encrypted_files.aggregate([
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": "$encryption_algorithm", "count": {"$sum": 1}}}
            ]))
            by_algorithm = {stat["_id"]: stat["count"] for stat in algorithm_stats}
            
            # Thống kê theo key wrap
            wrap_stats = list(self.db.encrypted_files.aggregate([
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": "$key_wrap_algorithm", "count": {"$sum": 1}}}
            ]))
            by_wrap_type = {stat["_id"] or "None": stat["count"] for stat in wrap_stats}
            
            # File gần đây
            recent_files = list(self.db.encrypted_files.find(
                {"user_id": user_id},
                {
                    "file_id": 1,
                    "original_name": 1,
                    "file_size": 1,
                    "encryption_algorithm": 1,
                    "uploaded_at": 1
                }
            ).sort("uploaded_at", -1).limit(5))
            
            recent_files_list = []
            for file in recent_files:
                recent_files_list.append({
                    "id": file["file_id"],
                    "filename": file["original_name"],
                    "size": file["file_size"],
                    "algorithm": file["encryption_algorithm"],
                    "uploaded_at": file["uploaded_at"].isoformat()
                })
            
            return EncryptionStats(
                total_files=total_files,
                total_size=total_size,
                by_algorithm=by_algorithm,
                by_wrap_type=by_wrap_type,
                recent_files=recent_files_list
            )
            
        except Exception as e:
            logger.error(f"Error in get_encryption_stats: {e}")
            return EncryptionStats()

    async def get_user_file_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy thống kê file cho dashboard
        """
        try:
            # Đếm tổng số file
            total_files = self.db.encrypted_files.count_documents({"user_id": user_id})

            # Đếm file theo algorithm (đảm bảo trả về JSON-safe)
            algorithm_pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": "$encryption_algorithm", "count": {"$sum": 1}}}
            ]
            raw_alg_stats = list(self.db.encrypted_files.aggregate(algorithm_pipeline))

            algorithm_stats: list[dict] = []
            for item in raw_alg_stats:
                algo = item.get("_id")
                # Nếu là Enum thì lấy value, nếu None thì gán "unknown"
                if hasattr(algo, "value"):
                    algo = algo.value  # type: ignore[attr-defined]
                algo = algo or "unknown"
                algorithm_stats.append({"algorithm": str(algo), "count": int(item.get("count", 0))})

            # Tính tổng dung lượng
            size_pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
            ]
            size_result = list(self.db.encrypted_files.aggregate(size_pipeline))
            total_size = int(size_result[0]["total_size"]) if size_result else 0

            # File gần đây (project trường cần thiết và chuyển kiểu cho JSON)
            recent_cursor = self.db.encrypted_files.find(
                {"user_id": user_id},
                {
                    "_id": 0,
                    "file_id": 1,
                    "original_name": 1,
                    "file_size": 1,
                    "encryption_algorithm": 1,
                    "uploaded_at": 1,
                    "created_at": 1,
                }
            ).sort([("uploaded_at", -1), ("created_at", -1)]).limit(5)

            recent_files: list[dict] = []
            for f in recent_cursor:
                enc_algo = f.get("encryption_algorithm")
                if hasattr(enc_algo, "value"):
                    enc_algo = enc_algo.value  # type: ignore[attr-defined]
                uploaded_at = f.get("uploaded_at") or f.get("created_at")
                recent_files.append({
                    "id": f.get("file_id"),
                    "filename": f.get("original_name"),
                    "size": int(f.get("file_size", 0)),
                    "algorithm": enc_algo,
                    "uploaded_at": uploaded_at.isoformat() if uploaded_at else None,
                })

            return {
                "total_files": int(total_files),
                "total_size": total_size,
                "algorithm_distribution": algorithm_stats,
                "recent_files": recent_files,
            }
            
        except Exception as e:
            logger.error(f"Error getting user file stats: {e}")
            return {
                "total_files": 0,
                "total_size": 0,
                "algorithm_distribution": [],
                "recent_files": []
            }

    async def get_recent_files(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Lấy danh sách file gần đây của user

        Args:
            user_id: ID của user
            limit: Số lượng file tối đa

        Returns:
            List[Dict]: Danh sách file gần đây
        """
        try:
            # Convert string user_id to ObjectId
            try:
                object_id = ObjectId(user_id)
            except Exception:
                logger.error(f"Invalid user_id format: {user_id}")
                return []

            # Query recent files
            files_cursor = self.db.encrypted_files.find(
                {"user_id": object_id}
            ).sort("created_at", -1).limit(limit)

            recent_files = []
            for file_doc in files_cursor:
                recent_files.append({
                    "id": str(file_doc["_id"]),
                    "filename": file_doc.get("filename", "Unknown"),
                    "original_size": file_doc.get("original_size", 0),
                    "encrypted_size": file_doc.get("encrypted_size", 0),
                    "algorithm": file_doc.get("algorithm", "Unknown"),
                    "created_at": file_doc.get("created_at"),
                    "file_type": file_doc.get("file_type", "file")
                })

            return recent_files

        except Exception as e:
            logger.error(f"Error getting recent files for user {user_id}: {e}")
            return []

    def update_file_metadata(self, file_id: str, user_id: str, updates: dict) -> dict:
        """
        Cập nhật metadata của file đã mã hóa

        Args:
            file_id: ID của file
            user_id: ID của user
            updates: Dữ liệu cập nhật

        Returns:
            Thông tin file đã cập nhật
        """
        try:
            # Validate file ownership
            file_doc = self.db.encrypted_files.find_one({
                "file_id": file_id,
                "user_id": user_id
            })

            if not file_doc:
                raise ValueError(f"File {file_id} not found or access denied")

            # Prepare update data (only allow safe fields)
            allowed_fields = ['filename', 'description', 'tags', 'metadata']
            safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

            if not safe_updates:
                raise ValueError("No valid fields to update")

            # Add update timestamp
            safe_updates['updated_at'] = datetime.utcnow()

            # Update the document
            result = self.db.encrypted_files.update_one(
                {"file_id": file_id, "user_id": user_id},
                {"$set": safe_updates}
            )

            if result.modified_count == 0:
                raise ValueError("No changes were made")

            # Return updated document
            updated_doc = self.db.encrypted_files.find_one({
                "file_id": file_id,
                "user_id": user_id
            })

            return {
                "file_id": updated_doc["file_id"],
                "filename": updated_doc.get("filename"),
                "description": updated_doc.get("description"),
                "tags": updated_doc.get("tags", []),
                "updated_at": updated_doc.get("updated_at")
            }

        except Exception as e:
            logger.error(f"Error updating file metadata {file_id}: {e}")
            raise


# Singleton instance
encrypted_file_service = EncryptedFileService()