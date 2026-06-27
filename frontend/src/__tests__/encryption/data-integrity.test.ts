/**
 * Test Suite: Tính Toàn Vẹn Dữ Liệu (Data Integrity)
 * ================================================
 * Kiểm tra tính toàn vẹn dữ liệu trong quá trình mã hóa/giải mã
 * với các loại file khác nhau và kích thước khác nhau
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';
import { sha256 } from 'js-sha256';

describe('Data Integrity Tests', () => {
  let testFiles: { [key: string]: File } = {};
  
  beforeEach(async () => {
    // Tạo test files với các kích thước khác nhau
    testFiles = {
      // File nhỏ < 1MB
      smallText: createTestFile('small.txt', 'text/plain', generateTestContent(500)), // 500 bytes
      smallImage: createTestFile('small.jpg', 'image/jpeg', generateBinaryContent(50 * 1024)), // 50KB
      mediumDoc: createTestFile('medium.pdf', 'application/pdf', generateTestContent(500 * 1024)), // 500KB
      
      // File lớn > 100MB (simulated - sẽ dùng chunking)
      largeFile: createTestFile('large.bin', 'application/octet-stream', generateTestContent(150 * 1024 * 1024)), // 150MB
      
      // File đặc biệt
      emptyFile: createTestFile('empty.txt', 'text/plain', ''),
      unicodeFile: createTestFile('unicode.txt', 'text/plain', '🔐 Mã hóa Zero Knowledge 🛡️ Bảo mật tuyệt đối 🚀'),
      specialCharsFile: createTestFile('special-chars!@#$%^&*()_+.txt', 'text/plain', 'File with special characters in name')
    };
  });

  afterEach(() => {
    // Cleanup
    testFiles = {};
  });

  describe('File nhỏ (<1MB) - Integrity Tests', () => {
    it('should preserve data integrity for small text file', async () => {
      const file = testFiles.smallText;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'test-password-123',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.encryptedData).toBeDefined();
      expect(encryptResult.metadata.checksum).toBe(originalChecksum);

      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'test-password-123'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      expect(decryptResult.decryptedData.length).toBe(originalContent.byteLength);
      
      // So sánh byte-by-byte
      const originalBytes = new Uint8Array(originalContent);
      expect(Array.from(decryptResult.decryptedData)).toEqual(Array.from(originalBytes));
    });

    it('should preserve data integrity for small binary file', async () => {
      const file = testFiles.smallImage;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'binary-test-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'binary-test-password'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      expect(decryptResult.decryptedData.length).toBe(originalContent.byteLength);
    });

    it('should preserve data integrity for medium document', async () => {
      const file = testFiles.mediumDoc;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'Camellia-CTR+HMAC' as const,
        password: 'medium-file-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'medium-file-password'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      expect(decryptResult.decryptedData.length).toBe(originalContent.byteLength);
    });
  });

  describe('File lớn (>100MB) - Chunked Encryption Tests', () => {
    it('should preserve data integrity for large file with chunking', async () => {
      const file = testFiles.largeFile;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'large-file-password',
        keyDerivation: 'Argon2id' as const,
        chunkSize: 10 * 1024 * 1024 // 10MB chunks
      };

      // Mã hóa với chunking
      const encryptResult = await ZeroKnowledgeEncryption.encryptLargeFile(file, encryptionOptions);
      expect(encryptResult.metadata.isChunked).toBe(true);
      expect(encryptResult.metadata.chunkInfo).toBeDefined();

      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decryptLargeFile(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'large-file-password'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      expect(decryptResult.decryptedData.length).toBe(originalContent.byteLength);
    });
  });

  describe('Edge Cases - Special Files', () => {
    it('should handle empty file correctly', async () => {
      const file = testFiles.emptyFile;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'empty-file-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'empty-file-password'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      expect(decryptResult.decryptedData.length).toBe(0);
    });

    it('should handle unicode content correctly', async () => {
      const file = testFiles.unicodeFile;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'unicode-password-🔐',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'unicode-password-🔐'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
      
      // Kiểm tra nội dung unicode
      const decryptedText = new TextDecoder().decode(decryptResult.decryptedData);
      expect(decryptedText).toBe('🔐 Mã hóa Zero Knowledge 🛡️ Bảo mật tuyệt đối 🚀');
    });

    it('should handle special characters in filename', async () => {
      const file = testFiles.specialCharsFile;
      const originalContent = await file.arrayBuffer();
      const originalChecksum = sha256(new Uint8Array(originalContent));

      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'special-chars-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('special-chars!@#$%^&*()_+.txt');
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'special-chars-password'
      );

      // Kiểm tra tính toàn vẹn
      const decryptedChecksum = sha256(decryptResult.decryptedData);
      expect(decryptedChecksum).toBe(originalChecksum);
    });
  });

  describe('Checksum Verification Tests', () => {
    it('should detect data corruption during decryption', async () => {
      const file = testFiles.smallText;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'corruption-test',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Corrupt the encrypted data
      const corruptedData = new Uint8Array(encryptResult.encryptedData);
      corruptedData[0] = corruptedData[0] ^ 0xFF; // Flip bits

      // Giải mã với dữ liệu bị corrupt
      await expect(
        ZeroKnowledgeEncryption.decrypt(
          corruptedData,
          encryptResult.metadata,
          'corruption-test'
        )
      ).rejects.toThrow();
    });

    it('should detect metadata tampering', async () => {
      const file = testFiles.smallText;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'tampering-test',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Tamper with metadata checksum
      const tamperedMetadata = { ...encryptResult.metadata };
      tamperedMetadata.checksum = 'invalid-checksum';

      // Giải mã với metadata bị tamper
      await expect(
        ZeroKnowledgeEncryption.decrypt(
          encryptResult.encryptedData,
          tamperedMetadata,
          'tampering-test'
        )
      ).rejects.toThrow();
    });
  });
});

// Helper functions
function createTestFile(name: string, type: string, content: string | Uint8Array): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

function generateTestContent(size: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateBinaryContent(size: number): Uint8Array {
  const content = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    content[i] = Math.floor(Math.random() * 256);
  }
  return content;
}
