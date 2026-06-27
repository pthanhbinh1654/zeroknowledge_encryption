# Testing & Debugging - Quy Trình Test và Debug

## Mục Đích và Phạm Vi

Tài liệu này cung cấp hướng dẫn chi tiết về testing và debugging cho hệ thống Zero Knowledge File Encryption, bao gồm unit tests, integration tests, end-to-end tests, và các công cụ debugging hiệu quả.

## Chiến Lược Testing

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 E2E Tests (10%)                         │ │
│  │  • User workflows • Cross-browser • Performance        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Integration Tests (20%)                      │ │
│  │  • API endpoints • Database • External services        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Unit Tests (70%)                          │ │
│  │  • Crypto functions • Business logic • Utilities       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Testing

### 1. Unit Tests Setup
```typescript
// frontend/tests/setup.ts
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Mock Web Crypto API
beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
      subtle: {
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        importKey: vi.fn(),
        exportKey: vi.fn(),
        digest: vi.fn(),
        deriveKey: vi.fn(),
      }
    }
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

### 2. Crypto Functions Testing
```typescript
// frontend/tests/crypto/encryption.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AESEncryptionService } from '../../src/crypto/aes-encryption';
import { WebCryptoService } from '../../src/crypto/web-crypto';

describe('AES Encryption Service', () => {
  let encryptionService: AESEncryptionService;
  
  beforeEach(() => {
    encryptionService = new AESEncryptionService();
  });
  
  it('should encrypt and decrypt data correctly', async () => {
    const testData = new TextEncoder().encode('Hello, World!');
    const password = 'test-password-123';
    
    // Mock Web Crypto API responses
    const mockKey = {} as CryptoKey;
    const mockEncrypted = new ArrayBuffer(32);
    
    vi.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue(mockKey);
    vi.spyOn(window.crypto.subtle, 'encrypt').mockResolvedValue(mockEncrypted);
    vi.spyOn(window.crypto.subtle, 'decrypt').mockResolvedValue(testData.buffer);
    
    // Test encryption
    const encrypted = await encryptionService.encrypt(testData.buffer, password);
    
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toHaveLength(16);
    expect(encrypted.iv).toHaveLength(12);
    
    // Test decryption
    const decrypted = await encryptionService.decrypt(
      encrypted.ciphertext,
      encrypted.tag,
      password,
      encrypted.salt,
      encrypted.iv
    );
    
    expect(new Uint8Array(decrypted)).toEqual(testData);
  });
  
  it('should throw error for invalid password', async () => {
    const testData = new ArrayBuffer(16);
    const password = 'correct-password';
    const wrongPassword = 'wrong-password';
    
    // Mock encryption
    const encrypted = await encryptionService.encrypt(testData, password);
    
    // Mock decryption failure
    vi.spyOn(window.crypto.subtle, 'decrypt').mockRejectedValue(
      new Error('Decryption failed')
    );
    
    // Test wrong password
    await expect(
      encryptionService.decrypt(
        encrypted.ciphertext,
        encrypted.tag,
        wrongPassword,
        encrypted.salt,
        encrypted.iv
      )
    ).rejects.toThrow('Decryption failed');
  });
  
  it('should generate unique salt and IV for each encryption', async () => {
    const testData = new ArrayBuffer(16);
    const password = 'test-password';
    
    const result1 = await encryptionService.encrypt(testData, password);
    const result2 = await encryptionService.encrypt(testData, password);
    
    expect(result1.salt).not.toEqual(result2.salt);
    expect(result1.iv).not.toEqual(result2.iv);
  });
});
```

### 3. Component Testing
```typescript
// frontend/tests/components/EncryptionPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EncryptionPanel } from '../../src/components/Encryption/EncryptionPanel';

describe('EncryptionPanel', () => {
  it('should render encryption form', () => {
    render(<EncryptionPanel />);
    
    expect(screen.getByText('Mã Hóa File')).toBeInTheDocument();
    expect(screen.getByLabelText('Chọn file')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mã Hóa' })).toBeInTheDocument();
  });
  
  it('should handle file selection', async () => {
    render(<EncryptionPanel />);
    
    const fileInput = screen.getByLabelText('Chọn file') as HTMLInputElement;
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
  });
  
  it('should validate password strength', async () => {
    render(<EncryptionPanel />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu');
    
    // Test weak password
    fireEvent.change(passwordInput, { target: { value: '123' } });
    await waitFor(() => {
      expect(screen.getByText(/Mật khẩu quá yếu/)).toBeInTheDocument();
    });
    
    // Test strong password
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    await waitFor(() => {
      expect(screen.getByText(/Mật khẩu mạnh/)).toBeInTheDocument();
    });
  });
  
  it('should show progress during encryption', async () => {
    const mockEncrypt = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<EncryptionPanel onEncrypt={mockEncrypt} />);
    
    const fileInput = screen.getByLabelText('Chọn file') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Mật khẩu');
    const encryptButton = screen.getByRole('button', { name: 'Mã Hóa' });
    
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(encryptButton);
    
    expect(screen.getByText(/Đang mã hóa/)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/Đang mã hóa/)).not.toBeInTheDocument();
    });
  });
});
```

### 4. Integration Tests
```typescript
// frontend/tests/integration/file-encryption.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { FileEncryptionService } from '../../src/services/file-encryption';

const server = setupServer(
  rest.post('/api/files/upload', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        file_id: 'test-file-id',
        message: 'Upload successful'
      })
    );
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('File Encryption Integration', () => {
  it('should encrypt and upload file successfully', async () => {
    const service = new FileEncryptionService();
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const password = 'test-password-123';
    
    const result = await service.encryptAndUpload(testFile, password);
    
    expect(result.success).toBe(true);
    expect(result.file_id).toBe('test-file-id');
  });
});
```

## Backend Testing

### 1. Unit Tests Setup
```python
# backend/tests/conftest.py
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_database
from app.config import settings

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def test_db():
    """Create test database."""
    client = AsyncIOMotorClient(settings.MONGODB_TEST_URI)
    db = client.test_zkfs
    yield db
    await client.drop_database("test_zkfs")
    client.close()

@pytest.fixture
def test_client(test_db):
    """Create test client with test database."""
    app.dependency_overrides[get_database] = lambda: test_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def sample_user():
    """Sample user data for testing."""
    return {
        "email": "test@example.com",
        "password": "hashed_password_123",
        "full_name": "Test User"
    }
```

### 2. API Endpoint Tests
```python
# backend/tests/test_auth.py
import pytest
from fastapi.testclient import TestClient
from app.services.auth import AuthService

class TestAuthEndpoints:
    def test_register_user(self, test_client: TestClient):
        """Test user registration."""
        user_data = {
            "email": "newuser@example.com",
            "password": "hashed_password_123",
            "full_name": "New User"
        }
        
        response = test_client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["otp_sent"] is True
        assert "user_id" in data
    
    def test_register_duplicate_email(self, test_client: TestClient, sample_user):
        """Test registration with duplicate email."""
        # First registration
        test_client.post("/api/auth/register", json=sample_user)
        
        # Second registration with same email
        response = test_client.post("/api/auth/register", json=sample_user)
        
        assert response.status_code == 400
        data = response.json()
        assert "email đã tồn tại" in data["message"].lower()
    
    def test_login_success(self, test_client: TestClient, sample_user):
        """Test successful login."""
        # Register user first
        test_client.post("/api/auth/register", json=sample_user)
        
        login_data = {
            "email": sample_user["email"],
            "password": sample_user["password"]
        }
        
        response = test_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data
        assert "refresh_token" in data
    
    def test_login_invalid_credentials(self, test_client: TestClient):
        """Test login with invalid credentials."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrong_password"
        }
        
        response = test_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
```

### 3. Service Layer Tests
```python
# backend/tests/test_file_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.file_service import FileService
from app.models.file import FileMetadata

class TestFileService:
    @pytest.fixture
    def file_service(self, test_db):
        """Create FileService instance with test database."""
        minio_client = MagicMock()
        return FileService(test_db, minio_client)
    
    @pytest.mark.asyncio
    async def test_store_file_metadata(self, file_service):
        """Test storing file metadata."""
        metadata = FileMetadata(
            file_id="test-file-id",
            user_id="test-user-id",
            original_name="test.txt",
            original_size=1024,
            mime_type="text/plain",
            algorithm="AES-256-GCM",
            checksum="abc123"
        )
        
        result = await file_service.store_metadata(metadata)
        
        assert result is not None
        assert result.file_id == "test-file-id"
    
    @pytest.mark.asyncio
    async def test_get_user_files(self, file_service):
        """Test retrieving user files."""
        user_id = "test-user-id"
        
        # Store test files
        for i in range(3):
            metadata = FileMetadata(
                file_id=f"file-{i}",
                user_id=user_id,
                original_name=f"test{i}.txt",
                original_size=1024,
                mime_type="text/plain",
                algorithm="AES-256-GCM",
                checksum=f"hash{i}"
            )
            await file_service.store_metadata(metadata)
        
        files = await file_service.get_user_files(user_id)
        
        assert len(files) == 3
        assert all(f.user_id == user_id for f in files)
```

### 4. Database Tests
```python
# backend/tests/test_database.py
import pytest
from app.database import DatabaseManager

class TestDatabase:
    @pytest.mark.asyncio
    async def test_user_crud_operations(self, test_db):
        """Test user CRUD operations."""
        db_manager = DatabaseManager(test_db)
        
        # Create user
        user_data = {
            "user_id": "test-user-123",
            "email": "test@example.com",
            "password_hash": "hashed_password",
            "full_name": "Test User"
        }
        
        created_user = await db_manager.create_user(user_data)
        assert created_user["user_id"] == "test-user-123"
        
        # Read user
        user = await db_manager.get_user_by_email("test@example.com")
        assert user is not None
        assert user["email"] == "test@example.com"
        
        # Update user
        await db_manager.update_user("test-user-123", {"full_name": "Updated Name"})
        updated_user = await db_manager.get_user_by_id("test-user-123")
        assert updated_user["full_name"] == "Updated Name"
        
        # Delete user
        await db_manager.delete_user("test-user-123")
        deleted_user = await db_manager.get_user_by_id("test-user-123")
        assert deleted_user is None
```

## End-to-End Testing

### 1. E2E Test Setup
```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. E2E Test Cases
```typescript
// e2e/tests/file-encryption.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Encryption Workflow', () => {
  test('should encrypt and decrypt file successfully', async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    
    // Login
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-login"]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Navigate to encryption page
    await page.click('[data-testid="encrypt-nav"]');
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    const testFilePath = path.join(__dirname, '../fixtures/test-file.txt');
    await fileInput.setInputFiles(testFilePath);
    
    // Enter password
    await page.fill('[data-testid="password-input"]', 'encryption-password-123');
    
    // Start encryption
    await page.click('[data-testid="encrypt-button"]');
    
    // Wait for encryption to complete
    await expect(page.locator('[data-testid="encryption-success"]')).toBeVisible();
    
    // Download encrypted file
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-encrypted"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('test-file.txt.encrypted');
    
    // Test decryption
    await page.click('[data-testid="decrypt-nav"]');
    
    // Upload encrypted file
    const encryptedFileInput = page.locator('[data-testid="encrypted-file-input"]');
    await encryptedFileInput.setInputFiles(await download.path());
    
    // Enter password
    await page.fill('[data-testid="decrypt-password-input"]', 'encryption-password-123');
    
    // Start decryption
    await page.click('[data-testid="decrypt-button"]');
    
    // Wait for decryption to complete
    await expect(page.locator('[data-testid="decryption-success"]')).toBeVisible();
    
    // Verify original file is restored
    const decryptedDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-decrypted"]');
    const decryptedDownload = await decryptedDownloadPromise;
    
    expect(decryptedDownload.suggestedFilename()).toBe('test-file.txt');
  });
  
  test('should handle wrong password gracefully', async ({ page }) => {
    await page.goto('/decrypt');
    
    // Upload encrypted file (assuming one exists)
    const fileInput = page.locator('[data-testid="encrypted-file-input"]');
    const encryptedFilePath = path.join(__dirname, '../fixtures/encrypted-file.enc');
    await fileInput.setInputFiles(encryptedFilePath);
    
    // Enter wrong password
    await page.fill('[data-testid="decrypt-password-input"]', 'wrong-password');
    
    // Attempt decryption
    await page.click('[data-testid="decrypt-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Mật khẩu không đúng');
  });
});
```

## Performance Testing

### 1. Load Testing
```javascript
// performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
};

export default function() {
  // Test login endpoint
  let loginResponse = http.post('http://localhost:8000/api/auth/login', {
    email: 'test@example.com',
    password: 'hashed_password_123'
  });
  
  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (loginResponse.status === 200) {
    let token = loginResponse.json('access_token');
    
    // Test file upload
    let uploadResponse = http.post('http://localhost:8000/api/files/upload', 
      { file: http.file(new ArrayBuffer(1024), 'test.txt') },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    check(uploadResponse, {
      'upload status is 200': (r) => r.status === 200,
      'upload response time < 2s': (r) => r.timings.duration < 2000,
    });
  }
  
  sleep(1);
}
```

## Debugging Tools

### 1. Frontend Debugging
```typescript
// frontend/src/utils/debug.ts
class DebugLogger {
  private enabled: boolean;
  
  constructor() {
    this.enabled = import.meta.env.DEV || localStorage.getItem('debug') === 'true';
  }
  
  log(category: string, message: string, data?: any): void {
    if (!this.enabled) return;
    
    console.group(`🔍 [${category}] ${message}`);
    if (data) {
      console.log('Data:', data);
    }
    console.trace();
    console.groupEnd();
  }
  
  crypto(operation: string, data: any): void {
    this.log('CRYPTO', operation, {
      ...data,
      // Mask sensitive data
      key: data.key ? '[MASKED]' : undefined,
      password: data.password ? '[MASKED]' : undefined,
    });
  }
  
  api(method: string, url: string, data?: any): void {
    this.log('API', `${method} ${url}`, data);
  }
  
  error(category: string, error: Error, context?: any): void {
    console.group(`❌ [${category}] Error`);
    console.error(error);
    if (context) {
      console.log('Context:', context);
    }
    console.groupEnd();
  }
}

export const debugLogger = new DebugLogger();
```

### 2. Backend Debugging
```python
# backend/app/utils/debug.py
import logging
import functools
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)

def debug_performance(func: Callable) -> Callable:
    """Decorator to measure function performance."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            logger.debug(f"{func.__name__} executed in {execution_time:.4f}s")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"{func.__name__} failed after {execution_time:.4f}s: {e}")
            raise
    return wrapper

def debug_crypto_operation(operation: str):
    """Decorator to debug crypto operations without exposing sensitive data."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            logger.debug(f"Starting crypto operation: {operation}")
            try:
                result = await func(*args, **kwargs)
                logger.debug(f"Crypto operation {operation} completed successfully")
                return result
            except Exception as e:
                logger.error(f"Crypto operation {operation} failed: {e}")
                raise
        return wrapper
    return decorator
```

## Test Scripts

### 1. Run All Tests
```bash
#!/bin/bash
# scripts/run-tests.sh

echo "🧪 Running Zero Knowledge File System Tests"
echo "=========================================="

# Frontend tests
echo "📱 Running frontend tests..."
cd frontend
npm run test:unit
npm run test:integration
cd ..

# Backend tests
echo "🔧 Running backend tests..."
cd backend
python -m pytest tests/ -v --cov=app --cov-report=html
cd ..

# E2E tests
echo "🌐 Running E2E tests..."
npx playwright test

# Performance tests
echo "⚡ Running performance tests..."
k6 run performance/load-test.js

echo "✅ All tests completed"
```

### 2. Test Coverage Report
```bash
#!/bin/bash
# scripts/coverage-report.sh

echo "📊 Generating test coverage reports..."

# Frontend coverage
cd frontend
npm run test:coverage
cd ..

# Backend coverage
cd backend
python -m pytest --cov=app --cov-report=html --cov-report=term
cd ..

# Combine reports
echo "📋 Coverage Summary:"
echo "Frontend: Check frontend/coverage/index.html"
echo "Backend: Check backend/htmlcov/index.html"
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Tests không expose crypto keys hoặc sensitive data
- Mock crypto operations để tránh real key generation
- Separate test databases và environments
- Secure test data cleanup

### ⚠️ Lưu Ý Bảo Mật
```typescript
// Security considerations for testing
class TestSecurityValidator {
  static maskSensitiveData(data: any): any {
    const sensitiveFields = ['password', 'key', 'token', 'secret'];
    const masked = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in masked) {
        masked[field] = '[MASKED]';
      }
    }
    
    return masked;
  }
  
  static validateTestEnvironment(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Tests should not run in production environment');
    }
  }
}
```
