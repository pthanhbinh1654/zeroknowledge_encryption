"""
Storage Service for MinIO Integration
====================================
Provides smart file storage structure for encrypted files in MinIO
based on MongoDB schema with intelligent organization.

Features:
- Hierarchical folder structure based on user, date, algorithm
- Metadata-driven file naming convention
- Efficient file organization for fast retrieval
- Support for different encryption types (single, multi, hybrid)
- Digital signature file management
- Automatic cleanup and lifecycle management
"""

import os
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from minio import Minio
from minio.error import S3Error
import json
import asyncio
from pathlib import Path

from ..core.config import settings
from ..core.minio_client import get_minio_client
from ..models.encrypted_file import EncryptedFileMetadata


class StorageService:
    """
    Smart storage service for encrypted files with intelligent organization
    """
    
    def __init__(self):
        self.minio_client = get_minio_client()
        self.bucket_name = settings.MINIO_BUCKET_NAME
        
    def _generate_storage_path(
        self, 
        user_id: str, 
        metadata: EncryptedFileMetadata,
        file_type: str = "encrypted"
    ) -> str:
        """
        Generate intelligent storage path based on metadata
        
        Structure: {user_id}/{year}/{month}/{algorithm}/{encryption_mode}/{file_id}_{original_name}.{ext}
        
        Examples:
        - user123/2025/01/AES-256-GCM/single/abc123_document.pdf.enc
        - user123/2025/01/XChaCha20-Poly1305/hybrid/def456_archive.zip.enc
        - user123/2025/01/Ed25519/signature/ghi789_document.pdf.sig
        """
        
        # Extract date components
        upload_date = metadata.uploaded_at or datetime.utcnow()
        year = upload_date.strftime("%Y")
        month = upload_date.strftime("%m")
        
        # Determine encryption mode
        if metadata.use_key_wrap:
            encryption_mode = "hybrid"
        elif metadata.signature_algorithm:
            encryption_mode = "signed"
        else:
            encryption_mode = "password"
            
        # Algorithm folder (clean name)
        algorithm_folder = metadata.encryption_algorithm.value.replace("-", "_").lower()
        
        # File extension based on type
        if file_type == "signature":
            ext = "sig"
            algorithm_folder = metadata.signature_algorithm.value.lower()
        elif file_type == "public_key":
            ext = "pk"
        elif file_type == "metadata":
            ext = "json"
        else:
            ext = "enc"
            
        # Generate secure filename
        safe_original_name = self._sanitize_filename(metadata.original_name)
        filename = f"{metadata.file_id}_{safe_original_name}.{ext}"
        
        # Construct full path
        storage_path = f"{user_id}/{year}/{month}/{algorithm_folder}/{encryption_mode}/{filename}"
        
        return storage_path
        
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        # Remove or replace unsafe characters
        unsafe_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', ' ']
        safe_name = filename
        
        for char in unsafe_chars:
            safe_name = safe_name.replace(char, '_')
            
        # Limit length
        if len(safe_name) > 100:
            name_part, ext_part = os.path.splitext(safe_name)
            safe_name = name_part[:95] + ext_part
            
        return safe_name
        
    def _generate_metadata_path(self, user_id: str, file_id: str) -> str:
        """Generate metadata file path"""
        return f"{user_id}/metadata/{file_id}.json"
        
    async def store_encrypted_file(
        self,
        user_id: str,
        file_data: bytes,
        metadata: EncryptedFileMetadata,
        signature_data: Optional[bytes] = None,
        public_key_data: Optional[bytes] = None
    ) -> Dict[str, str]:
        """
        Store encrypted file with intelligent organization
        
        Returns:
            Dict with storage paths for all stored components
        """
        
        try:
            storage_paths = {}
            
            # 1. Store main encrypted file
            encrypted_path = self._generate_storage_path(user_id, metadata, "encrypted")
            await self._upload_bytes(encrypted_path, file_data, "application/octet-stream")
            storage_paths["encrypted_file"] = encrypted_path
            
            # 2. Store metadata as separate JSON file
            metadata_path = self._generate_metadata_path(user_id, metadata.file_id)
            metadata_json = json.dumps(metadata.dict(), default=str, indent=2)
            await self._upload_bytes(metadata_path, metadata_json.encode(), "application/json")
            storage_paths["metadata"] = metadata_path
            
            # 3. Store digital signature if provided
            if signature_data and metadata.signature_algorithm:
                signature_path = self._generate_storage_path(user_id, metadata, "signature")
                await self._upload_bytes(signature_path, signature_data, "application/octet-stream")
                storage_paths["signature"] = signature_path
                
            # 4. Store public key if provided (for hybrid encryption)
            if public_key_data and metadata.use_key_wrap:
                public_key_path = self._generate_storage_path(user_id, metadata, "public_key")
                await self._upload_bytes(public_key_path, public_key_data, "text/plain")
                storage_paths["public_key"] = public_key_path
                
            # 5. Update metadata with storage paths
            metadata.encrypted_name = encrypted_path
            
            return storage_paths
            
        except Exception as e:
            # Cleanup any partial uploads
            await self._cleanup_partial_upload(storage_paths)
            raise e
            
    # Helper methods
    
    async def _upload_bytes(self, object_name: str, data: bytes, content_type: str):
        """Upload bytes to MinIO"""
        from io import BytesIO
        
        data_stream = BytesIO(data)
        self.minio_client.put_object(
            self.bucket_name,
            object_name,
            data_stream,
            length=len(data),
            content_type=content_type
        )
        
    async def _download_bytes(self, object_name: str) -> bytes:
        """Download bytes from MinIO"""
        try:
            response = self.minio_client.get_object(self.bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            raise Exception(f"Object not found: {object_name}")
            
    async def _cleanup_partial_upload(self, storage_paths: Dict[str, str]):
        """Cleanup partial upload on error"""
        for path in storage_paths.values():
            try:
                self.minio_client.remove_object(self.bucket_name, path)
            except:
                pass  # Ignore errors during cleanup


# Global instance
storage_service = StorageService() 