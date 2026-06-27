# Error Handling - Xử Lý Lỗi và Troubleshooting

## Mục Đích và Phạm Vi

Tài liệu này cung cấp hướng dẫn chi tiết về xử lý lỗi, troubleshooting và giải quyết các vấn đề thường gặp trong hệ thống Zero Knowledge File Encryption. Bao gồm error codes, logging strategies, và recovery procedures.

## Phân Loại Lỗi

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Classification                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 System Errors                           │ │
│  │  • Database connection • Service unavailable           │ │
│  │  • Network timeout • Memory overflow                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Crypto Errors                             │ │
│  │  • Invalid key • Decryption failed                     │ │
│  │  • Integrity check failed • Unsupported algorithm      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               User Errors                               │ │
│  │  • Invalid input • Authentication failed               │ │
│  │  • Permission denied • Rate limit exceeded             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Business Logic Errors                     │ │
│  │  • File not found • Invalid operation                  │ │
│  │  • Quota exceeded • Validation failed                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Error Codes và Messages

### 1. System Error Codes
```typescript
// frontend/src/types/errors.ts
export enum SystemErrorCode {
  // Database errors
  DB_CONNECTION_FAILED = 'SYS_001',
  DB_QUERY_TIMEOUT = 'SYS_002',
  DB_TRANSACTION_FAILED = 'SYS_003',
  
  // Network errors
  NETWORK_TIMEOUT = 'SYS_101',
  NETWORK_UNAVAILABLE = 'SYS_102',
  API_UNREACHABLE = 'SYS_103',
  
  // Memory errors
  MEMORY_OVERFLOW = 'SYS_201',
  BUFFER_OVERFLOW = 'SYS_202',
  
  // Service errors
  SERVICE_UNAVAILABLE = 'SYS_301',
  SERVICE_OVERLOADED = 'SYS_302',
  MAINTENANCE_MODE = 'SYS_303'
}

export const SystemErrorMessages = {
  [SystemErrorCode.DB_CONNECTION_FAILED]: 'Không thể kết nối đến cơ sở dữ liệu',
  [SystemErrorCode.DB_QUERY_TIMEOUT]: 'Truy vấn cơ sở dữ liệu quá thời gian',
  [SystemErrorCode.NETWORK_TIMEOUT]: 'Kết nối mạng quá thời gian',
  [SystemErrorCode.NETWORK_UNAVAILABLE]: 'Không có kết nối mạng',
  [SystemErrorCode.MEMORY_OVERFLOW]: 'Không đủ bộ nhớ để thực hiện thao tác',
  [SystemErrorCode.SERVICE_UNAVAILABLE]: 'Dịch vụ tạm thời không khả dụng'
};
```

### 2. Crypto Error Codes
```typescript
export enum CryptoErrorCode {
  // Key errors
  INVALID_KEY = 'CRYPTO_001',
  KEY_GENERATION_FAILED = 'CRYPTO_002',
  KEY_DERIVATION_FAILED = 'CRYPTO_003',
  
  // Encryption errors
  ENCRYPTION_FAILED = 'CRYPTO_101',
  DECRYPTION_FAILED = 'CRYPTO_102',
  INVALID_ALGORITHM = 'CRYPTO_103',
  UNSUPPORTED_FORMAT = 'CRYPTO_104',
  
  // Integrity errors
  INTEGRITY_CHECK_FAILED = 'CRYPTO_201',
  CHECKSUM_MISMATCH = 'CRYPTO_202',
  SIGNATURE_INVALID = 'CRYPTO_203',
  
  // Browser compatibility
  WEB_CRYPTO_UNSUPPORTED = 'CRYPTO_301',
  ALGORITHM_UNSUPPORTED = 'CRYPTO_302'
}

export const CryptoErrorMessages = {
  [CryptoErrorCode.INVALID_KEY]: 'Khóa mã hóa không hợp lệ',
  [CryptoErrorCode.DECRYPTION_FAILED]: 'Giải mã thất bại - mật khẩu có thể không đúng',
  [CryptoErrorCode.INTEGRITY_CHECK_FAILED]: 'Kiểm tra toàn vẹn thất bại - file có thể bị hỏng',
  [CryptoErrorCode.WEB_CRYPTO_UNSUPPORTED]: 'Trình duyệt không hỗ trợ Web Crypto API',
  [CryptoErrorCode.SIGNATURE_INVALID]: 'Chữ ký số không hợp lệ'
};
```

### 3. User Error Codes
```typescript
export enum UserErrorCode {
  // Authentication
  INVALID_CREDENTIALS = 'USER_001',
  ACCOUNT_LOCKED = 'USER_002',
  ACCOUNT_NOT_VERIFIED = 'USER_003',
  SESSION_EXPIRED = 'USER_004',
  
  // Authorization
  PERMISSION_DENIED = 'USER_101',
  INSUFFICIENT_PRIVILEGES = 'USER_102',
  
  // Input validation
  INVALID_INPUT = 'USER_201',
  MISSING_REQUIRED_FIELD = 'USER_202',
  INVALID_FILE_TYPE = 'USER_203',
  FILE_TOO_LARGE = 'USER_204',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'USER_301',
  TOO_MANY_ATTEMPTS = 'USER_302'
}

export const UserErrorMessages = {
  [UserErrorCode.INVALID_CREDENTIALS]: 'Email hoặc mật khẩu không đúng',
  [UserErrorCode.ACCOUNT_LOCKED]: 'Tài khoản đã bị khóa do quá nhiều lần đăng nhập sai',
  [UserErrorCode.SESSION_EXPIRED]: 'Phiên đăng nhập đã hết hạn',
  [UserErrorCode.PERMISSION_DENIED]: 'Bạn không có quyền thực hiện thao tác này',
  [UserErrorCode.INVALID_FILE_TYPE]: 'Loại file không được hỗ trợ',
  [UserErrorCode.FILE_TOO_LARGE]: 'File quá lớn (tối đa 100MB)',
  [UserErrorCode.RATE_LIMIT_EXCEEDED]: 'Quá nhiều request, vui lòng thử lại sau'
};
```

## Error Handling Classes

### 1. Frontend Error Handler
```typescript
// frontend/src/utils/error-handler.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public category: 'system' | 'crypto' | 'user' | 'business' = 'system',
    public severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    public recoverable: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  handle(error: Error | AppError, context?: string): AppError {
    let appError: AppError;
    
    if (error instanceof AppError) {
      appError = error;
    } else {
      appError = this.convertToAppError(error);
    }
    
    // Log error
    this.logError(appError, context);
    
    // Show user notification
    this.showUserNotification(appError);
    
    // Report to monitoring service
    this.reportError(appError, context);
    
    return appError;
  }
  
  private convertToAppError(error: Error): AppError {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new AppError(
        SystemErrorCode.NETWORK_UNAVAILABLE,
        'Lỗi kết nối mạng',
        'system',
        'high',
        true
      );
    }
    
    // Crypto errors
    if (error.message.includes('crypto') || error.message.includes('decrypt')) {
      return new AppError(
        CryptoErrorCode.DECRYPTION_FAILED,
        'Lỗi mã hóa/giải mã',
        'crypto',
        'high',
        false
      );
    }
    
    // Default system error
    return new AppError(
      'UNKNOWN_ERROR',
      error.message || 'Lỗi không xác định',
      'system',
      'medium',
      true
    );
  }
  
  private logError(error: AppError, context?: string): void {
    this.errorLog.push(error);
    
    console.group(`🚨 [${error.category.toUpperCase()}] ${error.code}`);
    console.error('Message:', error.message);
    console.error('Severity:', error.severity);
    console.error('Recoverable:', error.recoverable);
    if (context) console.error('Context:', context);
    if (error.details) console.error('Details:', error.details);
    console.error('Stack:', error.stack);
    console.groupEnd();
  }
  
  private showUserNotification(error: AppError): void {
    const toast = (window as any).toast;
    if (!toast) return;
    
    switch (error.severity) {
      case 'critical':
        toast.error(error.message, { duration: 10000 });
        break;
      case 'high':
        toast.error(error.message, { duration: 6000 });
        break;
      case 'medium':
        toast.warning(error.message, { duration: 4000 });
        break;
      case 'low':
        toast.info(error.message, { duration: 2000 });
        break;
    }
  }
  
  private reportError(error: AppError, context?: string): void {
    // Send to monitoring service (e.g., Sentry)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          category: error.category,
          severity: error.severity,
          code: error.code
        },
        extra: {
          context,
          details: error.details,
          recoverable: error.recoverable
        }
      });
    }
  }
  
  // Recovery strategies
  async attemptRecovery(error: AppError): Promise<boolean> {
    if (!error.recoverable) return false;
    
    switch (error.code) {
      case SystemErrorCode.NETWORK_TIMEOUT:
        return await this.retryWithBackoff();
      
      case SystemErrorCode.DB_CONNECTION_FAILED:
        return await this.reconnectDatabase();
      
      case UserErrorCode.SESSION_EXPIRED:
        return await this.refreshSession();
      
      default:
        return false;
    }
  }
  
  private async retryWithBackoff(maxRetries: number = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      try {
        // Retry the failed operation
        return true;
      } catch (error) {
        if (i === maxRetries - 1) return false;
      }
    }
    return false;
  }
  
  private async reconnectDatabase(): Promise<boolean> {
    // Implement database reconnection logic
    return false;
  }
  
  private async refreshSession(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        return true;
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
    }
    
    return false;
  }
}
```

### 2. Backend Error Handler
```python
# backend/app/utils/error_handler.py
from enum import Enum
from typing import Optional, Dict, Any
import logging
import traceback
from fastapi import HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

class ErrorCategory(str, Enum):
    SYSTEM = "system"
    CRYPTO = "crypto"
    USER = "user"
    BUSINESS = "business"

class ErrorSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        recoverable: bool = True,
        details: Optional[Dict[str, Any]] = None,
        http_status: int = 500
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.severity = severity
        self.recoverable = recoverable
        self.details = details or {}
        self.http_status = http_status

class ErrorHandler:
    def __init__(self):
        self.error_log = []
    
    def handle_error(self, error: Exception, context: Optional[str] = None) -> AppError:
        """Handle any exception and convert to AppError."""
        if isinstance(error, AppError):
            app_error = error
        else:
            app_error = self._convert_to_app_error(error)
        
        # Log error
        self._log_error(app_error, context)
        
        # Report to monitoring
        self._report_error(app_error, context)
        
        return app_error
    
    def _convert_to_app_error(self, error: Exception) -> AppError:
        """Convert standard exceptions to AppError."""
        error_message = str(error)
        
        # Database errors
        if "connection" in error_message.lower():
            return AppError(
                code="DB_CONNECTION_FAILED",
                message="Database connection failed",
                category=ErrorCategory.SYSTEM,
                severity=ErrorSeverity.HIGH,
                http_status=503
            )
        
        # Validation errors
        if "validation" in error_message.lower():
            return AppError(
                code="VALIDATION_ERROR",
                message="Input validation failed",
                category=ErrorCategory.USER,
                severity=ErrorSeverity.LOW,
                http_status=400
            )
        
        # Authentication errors
        if "authentication" in error_message.lower() or "unauthorized" in error_message.lower():
            return AppError(
                code="AUTHENTICATION_FAILED",
                message="Authentication failed",
                category=ErrorCategory.USER,
                severity=ErrorSeverity.MEDIUM,
                http_status=401
            )
        
        # Default error
        return AppError(
            code="UNKNOWN_ERROR",
            message=error_message or "Unknown error occurred",
            category=ErrorCategory.SYSTEM,
            severity=ErrorSeverity.MEDIUM,
            http_status=500
        )
    
    def _log_error(self, error: AppError, context: Optional[str] = None):
        """Log error with appropriate level."""
        log_data = {
            "code": error.code,
            "message": error.message,
            "category": error.category,
            "severity": error.severity,
            "context": context,
            "details": error.details,
            "traceback": traceback.format_exc()
        }
        
        if error.severity == ErrorSeverity.CRITICAL:
            logger.critical("Critical error occurred", extra=log_data)
        elif error.severity == ErrorSeverity.HIGH:
            logger.error("High severity error", extra=log_data)
        elif error.severity == ErrorSeverity.MEDIUM:
            logger.warning("Medium severity error", extra=log_data)
        else:
            logger.info("Low severity error", extra=log_data)
    
    def _report_error(self, error: AppError, context: Optional[str] = None):
        """Report error to monitoring service."""
        # Implement error reporting to external service
        pass
    
    def create_http_response(self, error: AppError) -> JSONResponse:
        """Create HTTP response from AppError."""
        return JSONResponse(
            status_code=error.http_status,
            content={
                "success": False,
                "error_code": error.code,
                "message": error.message,
                "category": error.category,
                "severity": error.severity,
                "recoverable": error.recoverable,
                "details": error.details if error.severity != ErrorSeverity.CRITICAL else None
            }
        )

# Global error handler instance
error_handler = ErrorHandler()
```

## Common Error Scenarios

### 1. Crypto Operation Failures
```typescript
// frontend/src/services/crypto-error-recovery.ts
export class CryptoErrorRecovery {
  static async handleDecryptionFailure(
    error: AppError,
    retryCallback: () => Promise<any>
  ): Promise<any> {
    switch (error.code) {
      case CryptoErrorCode.INVALID_KEY:
        // Prompt user to re-enter password
        const newPassword = await this.promptForPassword();
        if (newPassword) {
          return await retryCallback();
        }
        break;
      
      case CryptoErrorCode.INTEGRITY_CHECK_FAILED:
        // File may be corrupted, offer to download again
        const shouldRedownload = await this.confirmRedownload();
        if (shouldRedownload) {
          return await this.redownloadFile();
        }
        break;
      
      case CryptoErrorCode.WEB_CRYPTO_UNSUPPORTED:
        // Show browser compatibility message
        this.showBrowserCompatibilityMessage();
        break;
      
      default:
        throw error;
    }
  }
  
  private static async promptForPassword(): Promise<string | null> {
    return new Promise((resolve) => {
      // Show password input modal
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div class="modal">
          <h3>Nhập lại mật khẩu</h3>
          <input type="password" id="retry-password" placeholder="Mật khẩu">
          <button onclick="resolve(document.getElementById('retry-password').value)">Thử lại</button>
          <button onclick="resolve(null)">Hủy</button>
        </div>
      `;
      document.body.appendChild(modal);
    });
  }
}
```

### 2. Network Error Recovery
```typescript
export class NetworkErrorRecovery {
  static async handleNetworkError(
    error: AppError,
    originalRequest: () => Promise<any>
  ): Promise<any> {
    switch (error.code) {
      case SystemErrorCode.NETWORK_TIMEOUT:
        return await this.retryWithExponentialBackoff(originalRequest);
      
      case SystemErrorCode.API_UNREACHABLE:
        return await this.checkConnectivityAndRetry(originalRequest);
      
      default:
        throw error;
    }
  }
  
  private static async retryWithExponentialBackoff(
    request: () => Promise<any>,
    maxRetries: number = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  private static async checkConnectivityAndRetry(
    request: () => Promise<any>
  ): Promise<any> {
    // Check if online
    if (!navigator.onLine) {
      await this.waitForConnection();
    }
    
    return await request();
  }
  
  private static waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  }
}
```

## Troubleshooting Guide

### 1. Common Issues và Solutions
```markdown
## File Encryption Issues

### Issue: "Mã hóa thất bại - không đủ bộ nhớ"
**Cause**: File quá lớn cho bộ nhớ available
**Solution**: 
1. Sử dụng chunking mode
2. Giảm chunk size trong settings
3. Đóng các tab/app khác để giải phóng RAM

### Issue: "Web Crypto API không được hỗ trợ"
**Cause**: Browser cũ hoặc không secure context
**Solution**:
1. Update browser lên version mới nhất
2. Đảm bảo sử dụng HTTPS
3. Kiểm tra browser compatibility

### Issue: "Giải mã thất bại - mật khẩu không đúng"
**Cause**: Sai password hoặc file bị corrupt
**Solution**:
1. Kiểm tra lại password (case-sensitive)
2. Thử download lại file
3. Kiểm tra file integrity

## Authentication Issues

### Issue: "Phiên đăng nhập đã hết hạn"
**Cause**: JWT token expired
**Solution**:
1. Refresh page để auto-refresh token
2. Đăng nhập lại nếu refresh token cũng expired
3. Kiểm tra system clock

### Issue: "Quá nhiều request"
**Cause**: Rate limiting triggered
**Solution**:
1. Đợi 5-15 phút trước khi thử lại
2. Kiểm tra có script tự động nào đang chạy không
3. Contact admin nếu vấn đề persist

## Storage Issues

### Issue: "Upload thất bại"
**Cause**: Network, file size, hoặc server issues
**Solution**:
1. Kiểm tra kết nối internet
2. Verify file size < 100MB
3. Thử lại sau vài phút
4. Kiểm tra disk space

### Issue: "File không tìm thấy"
**Cause**: File đã bị xóa hoặc moved
**Solution**:
1. Refresh file list
2. Kiểm tra trong trash/recycle bin
3. Contact admin để restore từ backup
```

### 2. Debug Commands
```bash
# Health check script
#!/bin/bash
echo "=== Zero Knowledge File System Debug ==="

# Check services
echo "1. Service Status:"
docker ps | grep zkfs

# Check logs
echo "2. Recent Errors:"
docker logs zkfs-backend --tail=50 | grep ERROR

# Check database
echo "3. Database Status:"
docker exec zkfs-mongodb mongosh --eval "db.adminCommand('ping')"

# Check storage
echo "4. Storage Status:"
docker exec zkfs-minio mc admin info local

# Check network
echo "5. Network Connectivity:"
curl -f http://localhost:8000/health || echo "Backend unreachable"
curl -f http://localhost:5173 || echo "Frontend unreachable"

# Check disk space
echo "6. Disk Usage:"
df -h | grep -E "(docker|var)"
```

## Monitoring và Alerting

### 1. Error Metrics
```typescript
// frontend/src/utils/error-metrics.ts
export class ErrorMetrics {
  private static metrics = {
    totalErrors: 0,
    errorsByCategory: new Map<string, number>(),
    errorsBySeverity: new Map<string, number>(),
    recoveryAttempts: 0,
    successfulRecoveries: 0
  };
  
  static recordError(error: AppError): void {
    this.metrics.totalErrors++;
    
    const categoryCount = this.metrics.errorsByCategory.get(error.category) || 0;
    this.metrics.errorsByCategory.set(error.category, categoryCount + 1);
    
    const severityCount = this.metrics.errorsBySeverity.get(error.severity) || 0;
    this.metrics.errorsBySeverity.set(error.severity, severityCount + 1);
  }
  
  static recordRecoveryAttempt(successful: boolean): void {
    this.metrics.recoveryAttempts++;
    if (successful) {
      this.metrics.successfulRecoveries++;
    }
  }
  
  static getMetrics() {
    return {
      ...this.metrics,
      recoveryRate: this.metrics.recoveryAttempts > 0 
        ? this.metrics.successfulRecoveries / this.metrics.recoveryAttempts 
        : 0
    };
  }
}
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Error messages không expose sensitive data
- Crypto errors không reveal key information
- Logs được sanitized để remove secrets
- Error recovery không compromise security

### ⚠️ Lưu Ý Bảo Mật
```typescript
// Security-aware error handling
class SecureErrorHandler {
  static sanitizeError(error: AppError): AppError {
    // Remove sensitive data from error details
    const sanitizedDetails = { ...error.details };
    
    const sensitiveFields = ['key', 'password', 'token', 'secret', 'private_key'];
    for (const field of sensitiveFields) {
      if (field in sanitizedDetails) {
        sanitizedDetails[field] = '[REDACTED]';
      }
    }
    
    return new AppError(
      error.code,
      error.message,
      error.category,
      error.severity,
      error.recoverable,
      sanitizedDetails
    );
  }
  
  static shouldLogDetails(error: AppError): boolean {
    // Don't log details for crypto errors to avoid key exposure
    return error.category !== 'crypto';
  }
}
```
