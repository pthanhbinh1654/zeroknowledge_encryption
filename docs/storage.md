# Storage - MongoDB Metadata & MinIO S3 Ciphertext

## Mục Đích và Phạm Vi

Module Storage quản lý việc lưu trữ dữ liệu theo nguyên tắc Zero Knowledge với sự tách biệt rõ ràng: MongoDB lưu metadata không nhạy cảm, MinIO S3 lưu ciphertext. Đảm bảo không có thông tin plaintext nào được lưu trữ.

## Kiến Trúc Storage

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐ │
│  │       MongoDB           │    │       MinIO S3          │ │
│  │   (Metadata Only)       │    │   (Ciphertext Only)     │ │
│  │                         │    │                         │ │
│  │ • User information      │    │ • Encrypted files       │ │
│  │ • File metadata         │    │ • File chunks           │ │
│  │ • Encryption params     │    │ • Signature files       │ │
│  │ • Activity logs         │    │ • Backup data           │ │
│  │ • Session data          │    │                         │ │
│  │ • Settings              │    │ ❌ NO PLAINTEXT         │ │
│  │                         │    │ ❌ NO KEYS              │ │
│  │ ❌ NO PLAINTEXT         │    │ ❌ NO PASSWORDS         │ │
│  │ ❌ NO KEYS              │    │                         │ │
│  └─────────────────────────┘    └─────────────────────────┘ │
│              │                              │               │
│              │                              │               │
│              └──────────────┬───────────────┘               │
│                             │                               │
│                    ┌─────────────────┐                     │
│                    │   Application   │                     │
│                    │     Layer       │                     │
│                    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## MongoDB Schema Design

### 1. Users Collection
```javascript
// users collection
{
  _id: ObjectId("..."),
  user_id: "user_123456",           // UUID
  email: "user@example.com",
  password_hash: "argon2id_hash",   // Hashed tại frontend
  full_name: "Nguyễn Văn A",
  phone: "+84901234567",
  
  // Account status
  is_verified: true,
  is_active: true,
  email_verified_at: ISODate("2024-01-01T00:00:00Z"),
  
  // Security settings
  two_factor_enabled: true,
  login_attempts: 0,
  locked_until: null,
  
  // Preferences
  settings: {
    theme: "dark",
    language: "vi",
    default_algorithm: "AES-256-GCM",
    auto_logout: 3600,
    email_notifications: true
  },
  
  // Timestamps
  created_at: ISODate("2024-01-01T00:00:00Z"),
  updated_at: ISODate("2024-01-01T00:00:00Z"),
  last_login: ISODate("2024-01-01T00:00:00Z"),
  
  // Indexes
  indexes: [
    { email: 1 },
    { user_id: 1 },
    { created_at: -1 }
  ]
}
```

### 2. Files Collection
```javascript
// files collection
{
  _id: ObjectId("..."),
  file_id: "file_789abc",           // UUID
  user_id: "user_123456",           // Reference to users
  
  // File metadata (safe to store)
  original_name: "document.pdf",
  original_size: 1048576,           // bytes
  mime_type: "application/pdf",
  file_extension: ".pdf",
  
  // Encryption metadata
  algorithm: "AES-256-GCM",
  kdf: "Argon2id",
  encrypted_size: 1048600,          // bytes (with padding/overhead)
  
  // Integrity verification
  plaintext_checksum: "sha256_hash_of_original",
  ciphertext_checksum: "sha256_hash_of_encrypted",
  
  // Chunking information (if applicable)
  is_chunked: false,
  chunk_count: 0,
  chunk_size: 0,
  
  // Storage information
  storage_path: "users/user_123456/files/file_789abc",
  storage_bucket: "encrypted-files",
  
  // Digital signature info
  has_signature: true,
  signature_algorithm: "Ed25519",
  signature_file_id: "sig_456def",
  
  // Access control
  is_public: false,
  shared_with: [],
  
  // Statistics
  download_count: 5,
  last_accessed: ISODate("2024-01-01T00:00:00Z"),
  
  // Timestamps
  created_at: ISODate("2024-01-01T00:00:00Z"),
  updated_at: ISODate("2024-01-01T00:00:00Z"),
  
  // Indexes
  indexes: [
    { user_id: 1, created_at: -1 },
    { file_id: 1 },
    { original_name: "text" },
    { algorithm: 1 },
    { created_at: -1 }
  ]
}
```

### 3. File Chunks Collection
```javascript
// file_chunks collection (for large files)
{
  _id: ObjectId("..."),
  chunk_id: "chunk_123",
  file_id: "file_789abc",           // Reference to files
  user_id: "user_123456",
  
  // Chunk information
  chunk_index: 0,                   // 0-based
  chunk_offset: 0,                  // bytes
  chunk_size: 5242880,              // 5MB
  
  // Encryption per chunk
  chunk_iv: [12, 34, 56, ...],      // IV for this chunk
  chunk_checksum: "sha256_hash",
  
  // Storage
  storage_path: "users/user_123456/chunks/chunk_123",
  
  // Timestamps
  created_at: ISODate("2024-01-01T00:00:00Z"),
  
  // Indexes
  indexes: [
    { file_id: 1, chunk_index: 1 },
    { chunk_id: 1 }
  ]
}
```

### 4. Digital Signatures Collection
```javascript
// signatures collection
{
  _id: ObjectId("..."),
  signature_id: "sig_456def",
  file_id: "file_789abc",           // Reference to files
  user_id: "user_123456",           // Signer
  
  // Signature metadata
  algorithm: "Ed25519",             // Ed25519, Dilithium3, Dilithium5
  public_key_fingerprint: "abc123...",
  
  // Signer information
  signer_info: {
    name: "Nguyễn Văn A",
    email: "user@example.com",
    organization: "Company XYZ"
  },
  
  // Verification status
  is_verified: true,
  verified_at: ISODate("2024-01-01T00:00:00Z"),
  verified_by: "user_789xyz",
  
  // Storage
  signature_file_path: "signatures/sig_456def.json",
  
  // Timestamps
  signed_at: ISODate("2024-01-01T00:00:00Z"),
  created_at: ISODate("2024-01-01T00:00:00Z"),
  
  // Indexes
  indexes: [
    { file_id: 1 },
    { user_id: 1, created_at: -1 },
    { signature_id: 1 }
  ]
}
```

### 5. Sessions Collection
```javascript
// sessions collection
{
  _id: ObjectId("..."),
  session_id: "sess_abc123",
  user_id: "user_123456",
  
  // JWT tokens
  access_token_jti: "jti_access_123",
  refresh_token_jti: "jti_refresh_456",
  
  // Session info
  ip_address: "192.168.1.100",
  user_agent: "Mozilla/5.0...",
  device_info: {
    browser: "Chrome",
    os: "Windows 10",
    device_type: "desktop"
  },
  
  // Security
  is_active: true,
  last_activity: ISODate("2024-01-01T00:00:00Z"),
  
  // Timestamps
  created_at: ISODate("2024-01-01T00:00:00Z"),
  expires_at: ISODate("2024-01-08T00:00:00Z"),
  
  // Indexes
  indexes: [
    { user_id: 1, is_active: 1 },
    { session_id: 1 },
    { expires_at: 1 }  // TTL index
  ]
}
```

### 6. Activity Logs Collection
```javascript
// activity_logs collection
{
  _id: ObjectId("..."),
  log_id: "log_789xyz",
  user_id: "user_123456",
  
  // Activity details
  activity_type: "file_upload",     // file_upload, file_download, login, etc.
  resource_type: "file",
  resource_id: "file_789abc",
  
  // Action details
  action: "upload",
  details: {
    file_name: "document.pdf",
    file_size: 1048576,
    algorithm: "AES-256-GCM",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0..."
  },
  
  // Result
  status: "success",                // success, failed, error
  error_message: null,
  
  // Timestamps
  timestamp: ISODate("2024-01-01T00:00:00Z"),
  
  // Indexes
  indexes: [
    { user_id: 1, timestamp: -1 },
    { activity_type: 1, timestamp: -1 },
    { timestamp: -1 }  // TTL index (auto-delete old logs)
  ]
}
```

## MinIO S3 Storage Structure

### 1. Bucket Organization
```
encrypted-files/                    # Main bucket for encrypted files
├── users/
│   ├── user_123456/
│   │   ├── files/
│   │   │   ├── file_789abc         # Single encrypted file
│   │   │   ├── file_def456         # Another encrypted file
│   │   │   └── ...
│   │   ├── chunks/
│   │   │   ├── chunk_001           # File chunk 1
│   │   │   ├── chunk_002           # File chunk 2
│   │   │   └── ...
│   │   └── signatures/
│   │       ├── sig_456def.json     # Signature file
│   │       └── ...
│   └── user_789xyz/
│       └── ...
├── temp/                           # Temporary uploads
│   ├── upload_session_123/
│   └── ...
└── backups/                        # Backup data
    ├── daily/
    ├── weekly/
    └── monthly/
```

### 2. File Naming Convention
```python
# File path generation
def generate_file_path(user_id: str, file_id: str, file_type: str = "file") -> str:
    """
    Generate storage path for files
    """
    if file_type == "file":
        return f"users/{user_id}/files/{file_id}"
    elif file_type == "chunk":
        return f"users/{user_id}/chunks/{file_id}"
    elif file_type == "signature":
        return f"users/{user_id}/signatures/{file_id}.json"
    else:
        raise ValueError(f"Unknown file type: {file_type}")

# Examples:
# users/user_123456/files/file_789abc
# users/user_123456/chunks/chunk_001
# users/user_123456/signatures/sig_456def.json
```

### 3. MinIO Configuration
```python
from minio import Minio
from minio.error import S3Error
import os

class MinIOClient:
    def __init__(self):
        self.client = Minio(
            endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=os.getenv("MINIO_SECURE", "false").lower() == "true"
        )
        self.bucket_name = os.getenv("MINIO_BUCKET", "encrypted-files")
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                
                # Set bucket policy (private by default)
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:*",
                            "Resource": [
                                f"arn:aws:s3:::{self.bucket_name}",
                                f"arn:aws:s3:::{self.bucket_name}/*"
                            ]
                        }
                    ]
                }
                self.client.set_bucket_policy(self.bucket_name, json.dumps(policy))
        except S3Error as e:
            print(f"Error creating bucket: {e}")
```

## Database Operations

### 1. MongoDB Operations
```python
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
import asyncio

class MongoDBClient:
    def __init__(self, connection_string: str):
        self.client = AsyncIOMotorClient(connection_string)
        self.db = self.client.zkfs_database
        
        # Collections
        self.users = self.db.users
        self.files = self.db.files
        self.chunks = self.db.file_chunks
        self.signatures = self.db.signatures
        self.sessions = self.db.sessions
        self.activity_logs = self.db.activity_logs
    
    async def create_indexes(self):
        """Create all necessary indexes"""
        # Users indexes
        await self.users.create_indexes([
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("created_at", DESCENDING)])
        ])
        
        # Files indexes
        await self.files.create_indexes([
            IndexModel([("file_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("original_name", TEXT)]),
            IndexModel([("algorithm", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)])
        ])
        
        # Chunks indexes
        await self.chunks.create_indexes([
            IndexModel([("chunk_id", ASCENDING)], unique=True),
            IndexModel([("file_id", ASCENDING), ("chunk_index", ASCENDING)])
        ])
        
        # Sessions indexes with TTL
        await self.sessions.create_indexes([
            IndexModel([("session_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("is_active", ASCENDING)]),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0)  # TTL
        ])
        
        # Activity logs with TTL (keep for 90 days)
        await self.activity_logs.create_indexes([
            IndexModel([("user_id", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("activity_type", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("timestamp", ASCENDING)], expireAfterSeconds=7776000)  # 90 days
        ])
```

### 2. File Storage Operations
```python
class FileStorageService:
    def __init__(self, mongo_client: MongoDBClient, minio_client: MinIOClient):
        self.mongo = mongo_client
        self.minio = minio_client
    
    async def store_file(
        self, 
        user_id: str, 
        file_data: bytes, 
        metadata: dict
    ) -> str:
        """Store encrypted file and metadata"""
        file_id = generate_uuid()
        
        # 1. Upload ciphertext to MinIO
        file_path = generate_file_path(user_id, file_id, "file")
        
        try:
            self.minio.client.put_object(
                bucket_name=self.minio.bucket_name,
                object_name=file_path,
                data=io.BytesIO(file_data),
                length=len(file_data),
                content_type="application/octet-stream"
            )
            
            # 2. Store metadata in MongoDB
            file_doc = {
                "file_id": file_id,
                "user_id": user_id,
                "original_name": metadata["original_name"],
                "original_size": metadata["original_size"],
                "mime_type": metadata["mime_type"],
                "algorithm": metadata["algorithm"],
                "encrypted_size": len(file_data),
                "plaintext_checksum": metadata["checksum"],
                "ciphertext_checksum": calculate_sha256(file_data),
                "storage_path": file_path,
                "storage_bucket": self.minio.bucket_name,
                "is_chunked": False,
                "has_signature": False,
                "is_public": False,
                "download_count": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await self.mongo.files.insert_one(file_doc)
            
            # 3. Log activity
            await self.log_activity(
                user_id, 
                "file_upload", 
                file_id, 
                {"file_name": metadata["original_name"]}
            )
            
            return file_id
            
        except Exception as e:
            # Cleanup on error
            try:
                self.minio.client.remove_object(self.minio.bucket_name, file_path)
            except:
                pass
            raise e
    
    async def retrieve_file(self, user_id: str, file_id: str) -> tuple[bytes, dict]:
        """Retrieve encrypted file and metadata"""
        # 1. Get metadata from MongoDB
        file_doc = await self.mongo.files.find_one({
            "file_id": file_id,
            "user_id": user_id
        })
        
        if not file_doc:
            raise FileNotFoundError("File not found")
        
        # 2. Download ciphertext from MinIO
        try:
            response = self.minio.client.get_object(
                bucket_name=self.minio.bucket_name,
                object_name=file_doc["storage_path"]
            )
            file_data = response.read()
            
            # 3. Update access statistics
            await self.mongo.files.update_one(
                {"file_id": file_id},
                {
                    "$inc": {"download_count": 1},
                    "$set": {"last_accessed": datetime.utcnow()}
                }
            )
            
            # 4. Log activity
            await self.log_activity(
                user_id, 
                "file_download", 
                file_id,
                {"file_name": file_doc["original_name"]}
            )
            
            return file_data, file_doc
            
        except S3Error as e:
            raise FileNotFoundError(f"File data not found: {e}")
```

### 3. Chunked File Operations
```python
async def store_chunked_file(
    self, 
    user_id: str, 
    chunks: List[bytes], 
    metadata: dict
) -> str:
    """Store large file as chunks"""
    file_id = generate_uuid()
    
    try:
        # 1. Store each chunk in MinIO
        chunk_docs = []
        for i, chunk_data in enumerate(chunks):
            chunk_id = f"{file_id}_chunk_{i:04d}"
            chunk_path = generate_file_path(user_id, chunk_id, "chunk")
            
            # Upload chunk
            self.minio.client.put_object(
                bucket_name=self.minio.bucket_name,
                object_name=chunk_path,
                data=io.BytesIO(chunk_data),
                length=len(chunk_data),
                content_type="application/octet-stream"
            )
            
            # Prepare chunk metadata
            chunk_doc = {
                "chunk_id": chunk_id,
                "file_id": file_id,
                "user_id": user_id,
                "chunk_index": i,
                "chunk_offset": i * metadata.get("chunk_size", 0),
                "chunk_size": len(chunk_data),
                "chunk_iv": metadata.get("chunk_ivs", [])[i],
                "chunk_checksum": calculate_sha256(chunk_data),
                "storage_path": chunk_path,
                "created_at": datetime.utcnow()
            }
            chunk_docs.append(chunk_doc)
        
        # 2. Store chunk metadata in MongoDB
        await self.mongo.chunks.insert_many(chunk_docs)
        
        # 3. Store file metadata
        file_doc = {
            "file_id": file_id,
            "user_id": user_id,
            "original_name": metadata["original_name"],
            "original_size": metadata["original_size"],
            "mime_type": metadata["mime_type"],
            "algorithm": metadata["algorithm"],
            "encrypted_size": sum(len(chunk) for chunk in chunks),
            "plaintext_checksum": metadata["checksum"],
            "is_chunked": True,
            "chunk_count": len(chunks),
            "chunk_size": metadata.get("chunk_size", 0),
            "storage_bucket": self.minio.bucket_name,
            "has_signature": False,
            "is_public": False,
            "download_count": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.mongo.files.insert_one(file_doc)
        
        return file_id
        
    except Exception as e:
        # Cleanup chunks on error
        for chunk_doc in chunk_docs:
            try:
                self.minio.client.remove_object(
                    self.minio.bucket_name, 
                    chunk_doc["storage_path"]
                )
            except:
                pass
        raise e
```

## Backup và Recovery

### 1. MongoDB Backup Strategy
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/mongodb/$DATE"

# Create backup
mongodump --uri="mongodb://localhost:27017/zkfs_database" --out="$BACKUP_DIR"

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" -C "/backups/mongodb" "$DATE"

# Upload to backup storage
aws s3 cp "$BACKUP_DIR.tar.gz" s3://zkfs-backups/mongodb/

# Cleanup old backups (keep 30 days)
find /backups/mongodb -name "*.tar.gz" -mtime +30 -delete
```

### 2. MinIO Backup Strategy
```python
# MinIO backup using mc (MinIO Client)
import subprocess
from datetime import datetime

def backup_minio_bucket():
    """Backup MinIO bucket to another storage"""
    date_str = datetime.now().strftime("%Y%m%d")
    backup_path = f"backup-storage/minio/{date_str}/"
    
    # Mirror bucket to backup location
    cmd = [
        "mc", "mirror", 
        "local/encrypted-files", 
        f"backup/{backup_path}"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"Backup successful: {backup_path}")
    else:
        print(f"Backup failed: {result.stderr}")
```

## Monitoring và Metrics

### 1. Storage Metrics
```python
class StorageMetrics:
    def __init__(self, mongo_client: MongoDBClient, minio_client: MinIOClient):
        self.mongo = mongo_client
        self.minio = minio_client
    
    async def get_storage_stats(self, user_id: str = None) -> dict:
        """Get storage statistics"""
        match_filter = {"user_id": user_id} if user_id else {}
        
        # MongoDB aggregation
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": None,
                "total_files": {"$sum": 1},
                "total_original_size": {"$sum": "$original_size"},
                "total_encrypted_size": {"$sum": "$encrypted_size"},
                "files_by_algorithm": {
                    "$push": {
                        "algorithm": "$algorithm",
                        "count": 1
                    }
                }
            }}
        ]
        
        result = await self.mongo.files.aggregate(pipeline).to_list(1)
        
        return {
            "total_files": result[0]["total_files"] if result else 0,
            "total_original_size": result[0]["total_original_size"] if result else 0,
            "total_encrypted_size": result[0]["total_encrypted_size"] if result else 0,
            "compression_ratio": self._calculate_compression_ratio(result[0] if result else {}),
            "files_by_algorithm": self._group_by_algorithm(result[0]["files_by_algorithm"] if result else [])
        }
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- MongoDB chỉ lưu metadata không nhạy cảm
- MinIO chỉ lưu ciphertext
- Không có plaintext hoặc key nào được lưu trữ
- Tách biệt hoàn toàn giữa metadata và ciphertext

### ⚠️ Lưu Ý Bảo Mật
```python
# Validation để đảm bảo không lưu sensitive data
def validate_metadata_safety(metadata: dict):
    """Ensure metadata doesn't contain sensitive information"""
    forbidden_fields = [
        'plaintext', 'password', 'passphrase', 'private_key', 
        'key', 'decrypted_data', 'original_content'
    ]
    
    for field in forbidden_fields:
        if field in metadata:
            raise ValueError(f"Forbidden field in metadata: {field}")
    
    # Check nested objects
    for key, value in metadata.items():
        if isinstance(value, dict):
            validate_metadata_safety(value)
```
