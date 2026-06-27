# Zero Knowledge Encryption System - API Documentation

## Overview

This document provides comprehensive documentation for the Zero Knowledge Encryption System API. The API follows RESTful principles and provides endpoints for user authentication, file encryption/decryption, security management, and analytics.

## Base URL

```
Production: https://api.yourapp.com
Development: http://localhost:8000
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting

- Authentication endpoints: 10 requests per minute
- General API endpoints: 100 requests per minute  
- File upload endpoints: 20 requests per 5 minutes

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T10:00:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {}
  },
  "timestamp": "2024-01-01T10:00:00Z"
}
```

## Endpoints

### Authentication

#### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "confirm_password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "string",
    "message": "OTP sent to email"
  }
}
```

#### POST /api/auth/verify-otp

Verify OTP code for account activation.

**Request Body:**
```json
{
  "user_id": "string",
  "otp_code": "string (6 digits)",
  "purpose": "registration|login|password_reset"
}
```

#### POST /api/auth/login

Authenticate user and receive access tokens.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "captcha_token": "string (hCaptcha token)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "user": {
      "id": "string",
      "username": "string",
      "email": "string"
    }
  }
}
```

#### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

#### POST /api/auth/logout

Logout and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

#### POST /api/auth/forgot-password

Request password reset OTP.

**Request Body:**
```json
{
  "email": "string"
}
```

#### POST /api/auth/reset-password

Reset password with OTP verification.

**Request Body:**
```json
{
  "email": "string",
  "otp_code": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

### File Management

#### POST /api/encrypted/upload

Upload and encrypt files.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**
- `file`: File to upload
- `algorithm`: Encryption algorithm (AES-256-GCM, ChaCha20-Poly1305, etc.)
- `metadata`: JSON string with additional metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "string",
    "filename": "string",
    "algorithm": "string",
    "size": "number",
    "uploaded_at": "string (ISO date)"
  }
}
```

#### GET /api/encrypted/files

List user's encrypted files with pagination and search.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20, max: 100)
- `search`: Search term for filename
- `algorithm`: Filter by encryption algorithm
- `file_type`: Filter by file type
- `sort_by`: Sort field (uploaded_at, filename, size)
- `sort_order`: Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "string",
        "filename": "string",
        "algorithm": "string",
        "original_size": "number",
        "encrypted_size": "number",
        "file_type": "string",
        "uploaded_at": "string",
        "has_signature": "boolean"
      }
    ],
    "pagination": {
      "page": "number",
      "per_page": "number",
      "total": "number",
      "pages": "number",
      "has_next": "boolean",
      "has_prev": "boolean"
    }
  }
}
```

#### GET /api/encrypted/download/{file_id}

Download encrypted file.

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file data with appropriate headers

#### DELETE /api/encrypted/files/{file_id}

Delete encrypted file.

**Headers:** `Authorization: Bearer <token>`

#### POST /api/encrypted/files/bulk-delete

Delete multiple files.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "file_ids": ["string", "string", ...]
}
```

#### PUT /api/encrypted/files/{file_id}

Update file metadata.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "filename": "string (optional)"
}
```

### Security & Audit

#### GET /api/security/audit-logs

Get security audit logs for the user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `per_page`: Items per page
- `event_type`: Filter by event type
- `severity`: Filter by severity (low, medium, high, critical)
- `status`: Filter by status (success, failed, blocked)
- `date_from`: Start date (ISO format)
- `date_to`: End date (ISO format)
- `search`: Search in IP, username, or event details

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "string",
        "event_type": "string",
        "username": "string",
        "ip_address": "string",
        "user_agent": "string",
        "timestamp": "string",
        "severity": "string",
        "status": "string",
        "details": {}
      }
    ],
    "total": "number"
  }
}
```

#### GET /api/security/audit-logs/export

Export audit logs as CSV.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:** Same as audit logs list

**Response:** CSV file download

#### GET /api/security/alerts

Get recent security alerts.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Number of alerts (default: 10, max: 50)
- `severity`: Filter by severity

#### POST /api/security/alerts/{alert_id}/acknowledge

Acknowledge a security alert.

**Headers:** `Authorization: Bearer <token>`

### Analytics

#### GET /api/analytics/overview

Get analytics overview for the user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `time_range`: Time range (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_files": "number",
    "total_size": "number",
    "encryption_count": "number",
    "decryption_count": "number",
    "most_used_algorithm": "string",
    "recent_activity": []
  }
}
```

#### GET /api/analytics/advanced

Get advanced analytics data.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `time_range`: Time range (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_files": "number",
      "total_size": "number",
      "success_rate": "number"
    },
    "trends": {
      "daily_activity": [],
      "algorithm_usage": [],
      "file_types": []
    },
    "security": {
      "login_attempts": [],
      "security_events": []
    },
    "performance": {
      "avg_encryption_time": "number",
      "avg_decryption_time": "number"
    }
  }
}
```

### User Management

#### GET /api/user/profile

Get user profile information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "created_at": "string",
    "is_verified": "boolean",
    "settings": {}
  }
}
```

#### PUT /api/user/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "username": "string (optional)",
  "email": "string (optional)"
}
```

#### POST /api/user/change-password

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

#### GET /api/user/settings

Get user settings.

**Headers:** `Authorization: Bearer <token>`

#### PUT /api/user/settings

Update user settings.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email_notifications": "boolean",
  "login_alerts": "boolean",
  "session_timeout": "number"
}
```

### Cryptography

#### POST /api/crypto/generate-keypair

Generate cryptographic key pairs.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "algorithm": "Ed25519|Dilithium3|Dilithium5|X25519|Kyber1024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "public_key": "string (base64)",
    "private_key": "string (base64)",
    "algorithm": "string"
  }
}
```

#### POST /api/crypto/sign

Sign data with private key.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "data": "string (base64)",
  "private_key": "string (base64)",
  "algorithm": "Ed25519|Dilithium3|Dilithium5"
}
```

#### POST /api/crypto/verify

Verify digital signature.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "data": "string (base64)",
  "signature": "string (base64)",
  "public_key": "string (base64)",
  "algorithm": "string"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `FILE_TOO_LARGE` | File exceeds size limit |
| `INVALID_ALGORITHM` | Unsupported encryption algorithm |
| `CAPTCHA_FAILED` | hCaptcha verification failed |
| `ACCOUNT_LOCKED` | Account temporarily locked |
| `OTP_EXPIRED` | OTP code expired |
| `OTP_INVALID` | Invalid OTP code |
| `INTERNAL_ERROR` | Internal server error |

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `413` - Payload Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error

## SDKs and Examples

### JavaScript/TypeScript

```typescript
import { ZeroKnowledgeAPI } from '@zero-knowledge/api-client';

const api = new ZeroKnowledgeAPI({
  baseURL: 'https://api.yourapp.com',
  apiKey: 'your-api-key'
});

// Upload and encrypt file
const result = await api.files.upload(file, {
  algorithm: 'AES-256-GCM'
});

// List files
const files = await api.files.list({
  page: 1,
  per_page: 20
});
```

### Python

```python
from zero_knowledge_client import ZeroKnowledgeAPI

api = ZeroKnowledgeAPI(
    base_url='https://api.yourapp.com',
    api_key='your-api-key'
)

# Upload file
result = api.files.upload(
    file_path='document.pdf',
    algorithm='AES-256-GCM'
)

# Get audit logs
logs = api.security.get_audit_logs(
    time_range='30d',
    event_type='login'
)
```

## Webhooks

The API supports webhooks for real-time notifications:

### Events

- `file.uploaded` - File uploaded and encrypted
- `file.downloaded` - File downloaded
- `file.deleted` - File deleted
- `security.alert` - Security alert triggered
- `user.login` - User logged in
- `user.password_changed` - Password changed

### Webhook Payload

```json
{
  "event": "file.uploaded",
  "timestamp": "2024-01-01T10:00:00Z",
  "user_id": "string",
  "data": {
    "file_id": "string",
    "filename": "string",
    "algorithm": "string"
  }
}
```

## Support

For API support and questions:
- Documentation: https://docs.yourapp.com
- Support Email: api-support@yourapp.com
- GitHub Issues: https://github.com/your-org/zero-knowledge-encryption/issues
