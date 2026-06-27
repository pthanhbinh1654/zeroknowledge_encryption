# Frontend Crypto - Browser-based Cryptographic Operations

## Mục Đích và Phạm Vi

Module Frontend Crypto triển khai tất cả các hoạt động mã hóa tại browser theo nguyên tắc Zero Knowledge. Sử dụng Web Crypto API và các thư viện JavaScript mạnh mẽ để đảm bảo key/passphrase không bao giờ rời khỏi thiết bị người dùng.

## Kiến Trúc Crypto Frontend

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend Crypto Architecture                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 User Interface Layer                    │ │
│  │  • File Upload • Password Input • Key Management       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Crypto Service Layer                     │ │
│  │  • EncryptionService • DecryptionService               │ │
│  │  • SignatureService • KeyManagementService             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Crypto Engine Layer                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │   Symmetric │ │ Asymmetric  │ │   Key Derivation    │ │ │
│  │  │ Encryption  │ │ Encryption  │ │      (KDF)          │ │ │
│  │  │             │ │             │ │                     │ │ │
│  │  │• AES-256-GCM│ │• X25519     │ │• Argon2id           │ │ │
│  │  │• XChaCha20  │ │• Kyber1024  │ │• HKDF               │ │ │
│  │  │• Camellia   │ │• Ed25519    │ │• PBKDF2             │ │ │
│  │  │             │ │• Dilithium  │ │                     │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Browser APIs & Libraries                │ │
│  │  • Web Crypto API • libsodium.js • noble-curves        │ │
│  │  • argon2-browser • pqcrypto-js • jszip                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Thư Viện Crypto Sử Dụng

### 1. Core Libraries
```typescript
// Package dependencies
{
  "@noble/curves": "^1.2.0",        // Ed25519, X25519
  "libsodium-wrappers": "^0.7.11",  // XChaCha20-Poly1305
  "argon2-browser": "^1.18.0",      // Key derivation
  "pqcrypto-js": "^1.0.0",          // Post-quantum crypto
  "jszip": "^3.10.1",               // ZIP compression
  "mipher": "^0.1.2",               // Camellia cipher
  "js-sha256": "^0.9.0",            // SHA256 hashing
  "otplib": "^12.0.1"               // OTP generation
}
```

### 2. Web Crypto API Integration
```typescript
// Web Crypto API wrapper
class WebCryptoService {
  private crypto: SubtleCrypto;
  
  constructor() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API not supported');
    }
    this.crypto = window.crypto.subtle;
  }
  
  // Generate secure random bytes
  generateRandomBytes(length: number): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  
  // AES-256-GCM encryption
  async encryptAES256GCM(
    data: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return await this.crypto.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
  }
  
  // AES-256-GCM decryption
  async decryptAES256GCM(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return await this.crypto.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );
  }
  
  // Import raw key material
  async importKey(
    keyData: ArrayBuffer,
    algorithm: string = 'AES-GCM'
  ): Promise<CryptoKey> {
    return await this.crypto.importKey(
      'raw',
      keyData,
      { name: algorithm },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // Calculate SHA-256 hash
  async calculateSHA256(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await this.crypto.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

## Key Derivation Functions

### 1. Argon2id Implementation
```typescript
import argon2 from 'argon2-browser';

class KeyDerivationService {
  // Argon2id key derivation
  async deriveKeyArgon2id(
    password: string,
    salt: Uint8Array,
    options: {
      iterations?: number;
      memorySize?: number;
      parallelism?: number;
      hashLength?: number;
    } = {}
  ): Promise<Uint8Array> {
    const {
      iterations = 3,
      memorySize = 64 * 1024,    // 64MB
      parallelism = 1,
      hashLength = 32
    } = options;
    
    try {
      const result = await argon2.hash({
        pass: password,
        salt: salt,
        time: iterations,
        mem: memorySize,
        parallelism: parallelism,
        hashLen: hashLength,
        type: argon2.ArgonType.Argon2id
      });
      
      return new Uint8Array(result.hash);
    } catch (error) {
      throw new Error(`Argon2id derivation failed: ${error.message}`);
    }
  }
  
  // HKDF key derivation
  async deriveKeyHKDF(
    inputKeyMaterial: Uint8Array,
    salt: Uint8Array,
    info: string,
    length: number = 32
  ): Promise<Uint8Array> {
    const webCrypto = new WebCryptoService();
    
    // Import input key material
    const keyMaterial = await webCrypto.crypto.importKey(
      'raw',
      inputKeyMaterial,
      'HKDF',
      false,
      ['deriveKey']
    );
    
    // Derive key
    const derivedKey = await webCrypto.crypto.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt,
        info: new TextEncoder().encode(info)
      },
      keyMaterial,
      { name: 'AES-GCM', length: length * 8 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export as raw bytes
    const exportedKey = await webCrypto.crypto.exportKey('raw', derivedKey);
    return new Uint8Array(exportedKey);
  }
  
  // PBKDF2 key derivation (fallback)
  async deriveKeyPBKDF2(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000,
    length: number = 32
  ): Promise<Uint8Array> {
    const webCrypto = new WebCryptoService();
    
    // Import password
    const keyMaterial = await webCrypto.crypto.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // Derive key
    const derivedKey = await webCrypto.crypto.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: length * 8 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const exportedKey = await webCrypto.crypto.exportKey('raw', derivedKey);
    return new Uint8Array(exportedKey);
  }
}
```

### 2. Secure Random Generation
```typescript
class SecureRandomService {
  // Generate cryptographically secure random bytes
  generateBytes(length: number): Uint8Array {
    if (length <= 0 || length > 65536) {
      throw new Error('Invalid length for random bytes');
    }
    
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  
  // Generate random salt
  generateSalt(length: number = 16): Uint8Array {
    return this.generateBytes(length);
  }
  
  // Generate random IV
  generateIV(length: number = 12): Uint8Array {
    return this.generateBytes(length);
  }
  
  // Generate random nonce
  generateNonce(length: number = 24): Uint8Array {
    return this.generateBytes(length);
  }
  
  // Generate random UUID
  generateUUID(): string {
    const bytes = this.generateBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }
}
```

## Symmetric Encryption Implementation

### 1. AES-256-GCM Service
```typescript
class AESEncryptionService {
  private webCrypto: WebCryptoService;
  
  constructor() {
    this.webCrypto = new WebCryptoService();
  }
  
  async encrypt(
    data: ArrayBuffer,
    password: string,
    salt?: Uint8Array
  ): Promise<{
    ciphertext: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
    tag: Uint8Array;
  }> {
    // Generate salt and IV if not provided
    const actualSalt = salt || this.webCrypto.generateRandomBytes(16);
    const iv = this.webCrypto.generateRandomBytes(12);
    
    // Derive key from password
    const keyDerivation = new KeyDerivationService();
    const keyBytes = await keyDerivation.deriveKeyArgon2id(password, actualSalt);
    const key = await this.webCrypto.importKey(keyBytes);
    
    // Encrypt data
    const encrypted = await this.webCrypto.encryptAES256GCM(data, key, iv);
    
    // Extract authentication tag (last 16 bytes)
    const ciphertext = encrypted.slice(0, -16);
    const tag = new Uint8Array(encrypted.slice(-16));
    
    return {
      ciphertext,
      salt: actualSalt,
      iv,
      tag
    };
  }
  
  async decrypt(
    ciphertext: ArrayBuffer,
    tag: Uint8Array,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    // Reconstruct encrypted data with tag
    const encryptedWithTag = new Uint8Array(ciphertext.byteLength + tag.length);
    encryptedWithTag.set(new Uint8Array(ciphertext), 0);
    encryptedWithTag.set(tag, ciphertext.byteLength);
    
    // Derive key from password
    const keyDerivation = new KeyDerivationService();
    const keyBytes = await keyDerivation.deriveKeyArgon2id(password, salt);
    const key = await this.webCrypto.importKey(keyBytes);
    
    // Decrypt data
    try {
      return await this.webCrypto.decryptAES256GCM(
        encryptedWithTag.buffer,
        key,
        iv
      );
    } catch (error) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }
}
```

### 2. XChaCha20-Poly1305 Service
```typescript
import sodium from 'libsodium-wrappers';

class XChaCha20EncryptionService {
  private initialized: boolean = false;
  
  async init(): Promise<void> {
    if (!this.initialized) {
      await sodium.ready;
      this.initialized = true;
    }
  }
  
  async encrypt(
    data: Uint8Array,
    password: string,
    salt?: Uint8Array
  ): Promise<{
    ciphertext: Uint8Array;
    salt: Uint8Array;
    nonce: Uint8Array;
  }> {
    await this.init();
    
    // Generate salt and nonce
    const actualSalt = salt || sodium.randombytes_buf(16);
    const nonce = sodium.randombytes_buf(24); // XChaCha20 nonce is 24 bytes
    
    // Derive key from password
    const keyDerivation = new KeyDerivationService();
    const key = await keyDerivation.deriveKeyArgon2id(password, actualSalt);
    
    // Encrypt with XChaCha20-Poly1305
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      data,
      null, // No additional data
      null, // No secret nonce
      nonce,
      key
    );
    
    return {
      ciphertext,
      salt: actualSalt,
      nonce
    };
  }
  
  async decrypt(
    ciphertext: Uint8Array,
    password: string,
    salt: Uint8Array,
    nonce: Uint8Array
  ): Promise<Uint8Array> {
    await this.init();
    
    // Derive key from password
    const keyDerivation = new KeyDerivationService();
    const key = await keyDerivation.deriveKeyArgon2id(password, salt);
    
    // Decrypt with XChaCha20-Poly1305
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // No secret nonce
        ciphertext,
        null, // No additional data
        nonce,
        key
      );
    } catch (error) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }
}
```

### 3. Camellia-CTR + HMAC Service
```typescript
import { Camellia } from 'mipher';
import { sha256 } from 'js-sha256';

class CamelliaEncryptionService {
  async encrypt(
    data: Uint8Array,
    password: string,
    salt?: Uint8Array
  ): Promise<{
    ciphertext: Uint8Array;
    salt: Uint8Array;
    iv: Uint8Array;
    hmac: Uint8Array;
  }> {
    // Generate salt and IV
    const actualSalt = salt || window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    
    // Derive keys from password
    const keyDerivation = new KeyDerivationService();
    const masterKey = await keyDerivation.deriveKeyArgon2id(password, actualSalt, {
      hashLength: 64 // 64 bytes for encryption + HMAC keys
    });
    
    const encryptionKey = masterKey.slice(0, 32); // First 32 bytes for encryption
    const hmacKey = masterKey.slice(32, 64);      // Last 32 bytes for HMAC
    
    // Encrypt with Camellia-CTR
    const camellia = new Camellia(encryptionKey);
    const ciphertext = camellia.encrypt(data, { mode: 'ctr', iv: iv });
    
    // Calculate HMAC
    const hmacData = new Uint8Array(iv.length + ciphertext.length);
    hmacData.set(iv, 0);
    hmacData.set(ciphertext, iv.length);
    
    const hmac = this.calculateHMAC(hmacData, hmacKey);
    
    return {
      ciphertext: new Uint8Array(ciphertext),
      salt: actualSalt,
      iv,
      hmac
    };
  }
  
  async decrypt(
    ciphertext: Uint8Array,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array,
    expectedHmac: Uint8Array
  ): Promise<Uint8Array> {
    // Derive keys from password
    const keyDerivation = new KeyDerivationService();
    const masterKey = await keyDerivation.deriveKeyArgon2id(password, salt, {
      hashLength: 64
    });
    
    const encryptionKey = masterKey.slice(0, 32);
    const hmacKey = masterKey.slice(32, 64);
    
    // Verify HMAC
    const hmacData = new Uint8Array(iv.length + ciphertext.length);
    hmacData.set(iv, 0);
    hmacData.set(ciphertext, iv.length);
    
    const calculatedHmac = this.calculateHMAC(hmacData, hmacKey);
    
    if (!this.constantTimeCompare(expectedHmac, calculatedHmac)) {
      throw new Error('HMAC verification failed - data may be corrupted');
    }
    
    // Decrypt with Camellia-CTR
    const camellia = new Camellia(encryptionKey);
    const decrypted = camellia.decrypt(ciphertext, { mode: 'ctr', iv: iv });
    
    return new Uint8Array(decrypted);
  }
  
  private calculateHMAC(data: Uint8Array, key: Uint8Array): Uint8Array {
    // HMAC-SHA256 implementation
    const blockSize = 64; // SHA256 block size
    const opad = new Uint8Array(blockSize).fill(0x5c);
    const ipad = new Uint8Array(blockSize).fill(0x36);
    
    // Prepare key
    let hmacKey = new Uint8Array(blockSize);
    if (key.length > blockSize) {
      hmacKey.set(new Uint8Array(sha256.arrayBuffer(key)), 0);
    } else {
      hmacKey.set(key, 0);
    }
    
    // XOR with pads
    const oKeyPad = hmacKey.map((byte, i) => byte ^ opad[i]);
    const iKeyPad = hmacKey.map((byte, i) => byte ^ ipad[i]);
    
    // Calculate HMAC
    const innerHash = sha256.arrayBuffer(new Uint8Array([...iKeyPad, ...data]));
    const outerHash = sha256.arrayBuffer(new Uint8Array([...oKeyPad, ...new Uint8Array(innerHash)]));
    
    return new Uint8Array(outerHash);
  }
  
  private constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }
}
```

## File Processing Services

### 1. File Reader Service
```typescript
class FileReaderService {
  // Read file as ArrayBuffer
  async readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Read file in chunks for large files
  async readInChunks(
    file: File,
    chunkSize: number = 5 * 1024 * 1024, // 5MB chunks
    onProgress?: (progress: number) => void
  ): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = [];
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await this.readAsArrayBuffer(chunk);
      chunks.push(new Uint8Array(arrayBuffer));
      
      offset += chunkSize;
      
      if (onProgress) {
        onProgress((offset / file.size) * 100);
      }
    }
    
    return chunks;
  }
  
  // Calculate file hash
  async calculateFileHash(file: File): Promise<string> {
    const arrayBuffer = await this.readAsArrayBuffer(file);
    const webCrypto = new WebCryptoService();
    return await webCrypto.calculateSHA256(arrayBuffer);
  }
}
```

### 2. ZIP Processing Service
```typescript
import JSZip from 'jszip';

class ZipProcessingService {
  // Create ZIP from directory
  async createZipFromFiles(files: File[]): Promise<Blob> {
    const zip = new JSZip();
    
    for (const file of files) {
      // Preserve relative path if available
      const path = (file as any).webkitRelativePath || file.name;
      zip.file(path, file);
    }
    
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }
  
  // Extract files from ZIP
  async extractZipFiles(zipBlob: Blob): Promise<{
    files: { name: string; data: Uint8Array }[];
    structure: string[];
  }> {
    const zip = await JSZip.loadAsync(zipBlob);
    const files: { name: string; data: Uint8Array }[] = [];
    const structure: string[] = [];
    
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      structure.push(relativePath);
      
      if (!zipEntry.dir) {
        const data = await zipEntry.async('uint8array');
        files.push({ name: relativePath, data });
      }
    }
    
    return { files, structure };
  }
}
```

## Memory Management và Security

### 1. Secure Memory Management
```typescript
class SecureMemoryManager {
  // Securely clear sensitive data
  clearSensitiveData(...arrays: Uint8Array[]): void {
    for (const array of arrays) {
      if (array && array.length > 0) {
        // Overwrite with random data
        window.crypto.getRandomValues(array);
        
        // Then zero out
        array.fill(0);
      }
    }
  }
  
  // Secure string clearing
  clearSensitiveString(str: string): void {
    // JavaScript strings are immutable, but we can try to minimize exposure
    if (typeof str === 'string') {
      // Create a new string with random characters of same length
      const randomStr = Array.from({ length: str.length }, () => 
        String.fromCharCode(Math.floor(Math.random() * 256))
      ).join('');
      
      // This doesn't actually clear the original string from memory,
      // but it's a best effort approach
      str = randomStr;
    }
  }
  
  // Force garbage collection if available
  forceGarbageCollection(): void {
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
  
  // Create secure context for sensitive operations
  async withSecureContext<T>(
    operation: () => Promise<T>,
    sensitiveData: Uint8Array[]
  ): Promise<T> {
    try {
      return await operation();
    } finally {
      // Always clear sensitive data
      this.clearSensitiveData(...sensitiveData);
      this.forceGarbageCollection();
    }
  }
}
```

### 2. Input Validation Service
```typescript
class InputValidationService {
  // Validate file type
  validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type) || 
           allowedTypes.some(type => file.name.toLowerCase().endsWith(type));
  }
  
  // Validate file size
  validateFileSize(file: File, maxSize: number): boolean {
    return file.size <= maxSize;
  }
  
  // Validate password strength
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;
    
    // Length check
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    else feedback.push('Mật khẩu phải có ít nhất 8 ký tự');
    
    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    // Common patterns
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Tránh lặp lại ký tự');
      score -= 1;
    }
    
    return {
      isValid: score >= 4,
      score: Math.max(0, Math.min(5, score)),
      feedback
    };
  }
  
  // Sanitize filename
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }
}
```

## Error Handling và Logging

### 1. Crypto Error Handler
```typescript
enum CryptoErrorType {
  UNSUPPORTED_BROWSER = 'UNSUPPORTED_BROWSER',
  INVALID_KEY = 'INVALID_KEY',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INTEGRITY_CHECK_FAILED = 'INTEGRITY_CHECK_FAILED',
  INSUFFICIENT_MEMORY = 'INSUFFICIENT_MEMORY',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE'
}

class CryptoError extends Error {
  constructor(
    public type: CryptoErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

class CryptoErrorHandler {
  static handle(error: any): CryptoError {
    if (error instanceof CryptoError) {
      return error;
    }
    
    // Map common errors
    if (error.message?.includes('not supported')) {
      return new CryptoError(
        CryptoErrorType.UNSUPPORTED_BROWSER,
        'Trình duyệt không hỗ trợ tính năng crypto cần thiết'
      );
    }
    
    if (error.message?.includes('decrypt')) {
      return new CryptoError(
        CryptoErrorType.DECRYPTION_FAILED,
        'Giải mã thất bại - mật khẩu không đúng hoặc dữ liệu bị hỏng'
      );
    }
    
    return new CryptoError(
      CryptoErrorType.DECRYPTION_FAILED,
      `Lỗi crypto: ${error.message}`
    );
  }
}
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Tất cả crypto operations tại browser
- Key/password không bao giờ gửi lên server
- Secure memory management
- Input validation nghiêm ngặt

### ⚠️ Lưu Ý Bảo Mật
```typescript
// Security checklist for crypto operations
class SecurityChecklist {
  static validateEnvironment(): void {
    // Check HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('HTTPS required for crypto operations');
    }
    
    // Check Web Crypto API
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }
    
    // Check secure context
    if (!window.isSecureContext) {
      throw new Error('Secure context required');
    }
  }
  
  static validateInput(data: any): void {
    // Prevent prototype pollution
    if (data && typeof data === 'object') {
      if ('__proto__' in data || 'constructor' in data || 'prototype' in data) {
        throw new Error('Invalid input detected');
      }
    }
  }
}
```
