/**
 * Test Suite: Edge Cases
 * ======================
 * Kiểm tra các trường hợp biên và đặc biệt trong hệ thống mã hóa
 * bao gồm file rỗng, tên file đặc biệt, và các tình huống bất thường
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';
import { MultiFileEncryption, FolderEncryption } from '../../crypto/advanced_features';
import { ChunkedEncryption } from '../../crypto/chunked_encryption';
import JSZip from 'jszip';

describe('Edge Cases Tests', () => {
  let testFiles: { [key: string]: File } = {};
  
  beforeEach(async () => {
    testFiles = {
      // File rỗng
      emptyFile: createTestFile('empty.txt', 'text/plain', ''),
      
      // File với tên đặc biệt
      unicodeNameFile: createTestFile('测试文件-🔐.txt', 'text/plain', 'Unicode filename test'),
      specialCharsFile: createTestFile('file!@#$%^&*()_+-=[]{}|;:,.<>?.txt', 'text/plain', 'Special chars'),
      spaceFile: createTestFile('file with spaces.txt', 'text/plain', 'Spaces in name'),
      dotFile: createTestFile('.hidden-file', 'text/plain', 'Hidden file'),
      longNameFile: createTestFile('a'.repeat(255) + '.txt', 'text/plain', 'Very long filename'),
      
      // File với nội dung đặc biệt
      binaryFile: createBinaryFile('binary.bin', generateRandomBinary(1024)),
      nullBytesFile: createTestFile('null-bytes.bin', 'application/octet-stream', '\x00\x01\x02\x03\xFF\xFE\xFD'),
      unicodeContentFile: createTestFile('unicode-content.txt', 'text/plain', '🔐 Mã hóa Zero Knowledge 🛡️ Bảo mật tuyệt đối 🚀\n测试中文\nТест кириллица\n🎉🎊🎈'),
      
      // File với kích thước đặc biệt
      singleByteFile: createTestFile('single.txt', 'text/plain', 'A'),
      exactChunkSizeFile: createTestFile('exact-chunk.bin', 'application/octet-stream', 'x'.repeat(10 * 1024 * 1024)), // Exactly 10MB
      
      // File với extension đặc biệt
      noExtensionFile: createTestFile('no-extension', 'application/octet-stream', 'No extension file'),
      multipleDotsFile: createTestFile('file.with.multiple.dots.txt', 'text/plain', 'Multiple dots'),
      onlyExtensionFile: createTestFile('.txt', 'text/plain', 'Only extension')
    };
  });

  afterEach(() => {
    testFiles = {};
  });

  describe('Empty and Minimal Files', () => {
    it('should handle empty file encryption/decryption', async () => {
      const file = testFiles.emptyFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'empty-file-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa file rỗng
      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.originalSize).toBe(0);
      expect(encryptResult.metadata.filename).toBe('empty.txt');

      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'empty-file-password'
      );

      expect(decryptResult.decryptedData.length).toBe(0);
      expect(decryptResult.verified).toBe(true);
    });

    it('should handle single byte file', async () => {
      const file = testFiles.singleByteFile;
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'single-byte-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'single-byte-password'
      );

      expect(decryptResult.decryptedData.length).toBe(1);
      expect(new TextDecoder().decode(decryptResult.decryptedData)).toBe('A');
    });
  });

  describe('Special Filename Cases', () => {
    it('should handle unicode filenames', async () => {
      const file = testFiles.unicodeNameFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'unicode-filename-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('测试文件-🔐.txt');

      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'unicode-filename-password'
      );

      expect(decryptResult.verified).toBe(true);
    });

    it('should handle special characters in filename', async () => {
      const file = testFiles.specialCharsFile;
      
      const encryptionOptions = {
        algorithm: 'Camellia-CTR+HMAC' as const,
        password: 'special-chars-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('file!@#$%^&*()_+-=[]{}|;:,.<>?.txt');

      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'special-chars-password'
      );

      expect(decryptResult.verified).toBe(true);
    });

    it('should handle spaces in filename', async () => {
      const file = testFiles.spaceFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'space-filename-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('file with spaces.txt');
    });

    it('should handle hidden files (starting with dot)', async () => {
      const file = testFiles.dotFile;
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'hidden-file-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('.hidden-file');
    });

    it('should handle very long filenames', async () => {
      const file = testFiles.longNameFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'long-filename-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('a'.repeat(255) + '.txt');
    });

    it('should handle files without extension', async () => {
      const file = testFiles.noExtensionFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'no-extension-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      expect(encryptResult.metadata.filename).toBe('no-extension');
    });
  });

  describe('Special Content Cases', () => {
    it('should handle binary content with null bytes', async () => {
      const file = testFiles.nullBytesFile;
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'null-bytes-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'null-bytes-password'
      );

      // Kiểm tra null bytes được bảo toàn
      const expectedBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]);
      expect(Array.from(decryptResult.decryptedData)).toEqual(Array.from(expectedBytes));
    });

    it('should handle unicode content', async () => {
      const file = testFiles.unicodeContentFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'unicode-content-password-🔐',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'unicode-content-password-🔐'
      );

      const decryptedText = new TextDecoder().decode(decryptResult.decryptedData);
      expect(decryptedText).toBe('🔐 Mã hóa Zero Knowledge 🛡️ Bảo mật tuyệt đối 🚀\n测试中文\nТест кириллица\n🎉🎊🎈');
    });

    it('should handle random binary data', async () => {
      const file = testFiles.binaryFile;
      const originalContent = await file.arrayBuffer();
      
      const encryptionOptions = {
        algorithm: 'Camellia-CTR+HMAC' as const,
        password: 'binary-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'binary-password'
      );

      // So sánh byte-by-byte
      const originalBytes = new Uint8Array(originalContent);
      expect(Array.from(decryptResult.decryptedData)).toEqual(Array.from(originalBytes));
    });
  });

  describe('Chunking Edge Cases', () => {
    it('should handle file with exact chunk size', async () => {
      const file = testFiles.exactChunkSizeFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'exact-chunk-password',
        keyDerivation: 'Argon2id' as const,
        chunkSize: 10 * 1024 * 1024 // 10MB
      };

      // File có đúng kích thước chunk
      expect(file.size).toBe(10 * 1024 * 1024);

      const encryptResult = await ChunkedEncryption.encryptLargeFile(file, encryptionOptions);
      expect(encryptResult.metadata.isChunked).toBe(true);
      expect(encryptResult.metadata.chunkInfo?.length).toBe(1); // Chỉ 1 chunk

      const decryptResult = await ChunkedEncryption.decryptLargeFile(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'exact-chunk-password'
      );

      expect(decryptResult.decryptedData.length).toBe(10 * 1024 * 1024);
    });
  });

  describe('Multi-file Edge Cases', () => {
    it('should handle multi-file with mixed special cases', async () => {
      const files = [
        testFiles.emptyFile,
        testFiles.unicodeNameFile,
        testFiles.nullBytesFile,
        testFiles.dotFile
      ];
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'multi-special-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await MultiFileEncryption.encryptMultipleFiles(files, encryptionOptions);
      expect(encryptResult.metadata.multiFileInfo?.fileCount).toBe(4);

      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'multi-special-password'
      );

      // Giải nén và kiểm tra từng file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      expect(zipContent.files['empty.txt']).toBeDefined();
      expect(zipContent.files['测试文件-🔐.txt']).toBeDefined();
      expect(zipContent.files['null-bytes.bin']).toBeDefined();
      expect(zipContent.files['.hidden-file']).toBeDefined();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle corrupted metadata gracefully', async () => {
      const file = testFiles.emptyFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'corruption-test',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Corrupt metadata
      const corruptedMetadata = { ...encryptResult.metadata };
      corruptedMetadata.algorithm = 'INVALID-ALGORITHM' as any;

      await expect(
        ZeroKnowledgeEncryption.decrypt(
          encryptResult.encryptedData,
          corruptedMetadata,
          'corruption-test'
        )
      ).rejects.toThrow();
    });

    it('should handle wrong password gracefully', async () => {
      const file = testFiles.singleByteFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'correct-password',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);

      await expect(
        ZeroKnowledgeEncryption.decrypt(
          encryptResult.encryptedData,
          encryptResult.metadata,
          'wrong-password'
        )
      ).rejects.toThrow();
    });

    it('should handle missing metadata fields', async () => {
      const file = testFiles.singleByteFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'metadata-test',
        keyDerivation: 'Argon2id' as const
      };

      const encryptResult = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);
      
      // Remove required metadata field
      const incompleteMetadata = { ...encryptResult.metadata };
      delete (incompleteMetadata as any).salt;

      await expect(
        ZeroKnowledgeEncryption.decrypt(
          encryptResult.encryptedData,
          incompleteMetadata,
          'metadata-test'
        )
      ).rejects.toThrow();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid successive encryptions', async () => {
      const file = testFiles.singleByteFile;
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'rapid-test',
        keyDerivation: 'Argon2id' as const
      };

      // Thực hiện nhiều mã hóa liên tiếp
      const promises = Array.from({ length: 10 }, () => 
        ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions)
      );

      const results = await Promise.all(promises);
      
      // Tất cả kết quả phải khác nhau (do salt/IV random)
      const encryptedDataStrings = results.map(r => 
        Array.from(r.encryptedData).join(',')
      );
      
      const uniqueResults = new Set(encryptedDataStrings);
      expect(uniqueResults.size).toBe(10); // Tất cả phải unique
    });
  });
});

// Helper functions
function createTestFile(name: string, type: string, content: string | Uint8Array): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

function createBinaryFile(name: string, content: Uint8Array): File {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  return new File([blob], name, { type: 'application/octet-stream' });
}

function generateRandomBinary(size: number): Uint8Array {
  const content = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    content[i] = Math.floor(Math.random() * 256);
  }
  return content;
}
