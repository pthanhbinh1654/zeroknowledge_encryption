/**
 * Test Suite: Xử Lý Thư Mục (Folder Handling)
 * ==========================================
 * Kiểm tra việc nén thư mục thành archive và bảo toàn cấu trúc
 * sau khi mã hóa và giải mã
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';
import { FolderEncryption } from '../../crypto/advanced_features';
import JSZip from 'jszip';
import { sha256 } from 'js-sha256';

describe('Folder Handling Tests', () => {
  let testFolders: { [key: string]: File[] } = {};
  
  beforeEach(async () => {
    // Tạo test folders với cấu trúc phức tạp
    testFolders = {
      // Thư mục đơn giản
      simpleFolder: createSimpleFolder(),
      
      // Thư mục phức tạp với nhiều cấp
      complexFolder: createComplexFolder(),
      
      // Thư mục rỗng
      emptyFolder: [],
      
      // Thư mục với file đặc biệt
      specialFolder: createSpecialFolder(),
      
      // Thư mục với file lớn
      largeFolderFiles: createLargeFolderFiles()
    };
  });

  afterEach(() => {
    // Cleanup
    testFolders = {};
  });

  describe('Simple Folder Tests', () => {
    it('should encrypt and decrypt simple folder structure', async () => {
      const files = testFolders.simpleFolder;
      const folderName = 'simple-test-folder';
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'folder-password-123',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa thư mục
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      
      expect(encryptResult.metadata.isFolder).toBe(true);
      expect(encryptResult.metadata.folderStructure).toBeDefined();
      expect(encryptResult.metadata.filename).toContain(folderName);

      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'folder-password-123'
      );

      // Giải nén và kiểm tra cấu trúc
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      // Kiểm tra các file trong zip
      const expectedFiles = ['file1.txt', 'file2.txt', 'subfolder/file3.txt'];
      for (const fileName of expectedFiles) {
        expect(zipContent.files[fileName]).toBeDefined();
        expect(zipContent.files[fileName].dir).toBe(false);
      }
      
      // Kiểm tra subfolder
      expect(zipContent.files['subfolder/']).toBeDefined();
      expect(zipContent.files['subfolder/'].dir).toBe(true);
    });

    it('should preserve file content in simple folder', async () => {
      const files = testFolders.simpleFolder;
      const folderName = 'content-test-folder';
      
      // Lưu nội dung gốc để so sánh
      const originalContents: { [key: string]: string } = {};
      for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        originalContents[path] = await file.text();
      }
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'content-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa và giải mã
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'content-password'
      );

      // Giải nén và kiểm tra nội dung
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      for (const [path, originalContent] of Object.entries(originalContents)) {
        const zipFile = zipContent.files[path];
        expect(zipFile).toBeDefined();
        
        const decryptedContent = await zipFile.async('text');
        expect(decryptedContent).toBe(originalContent);
      }
    });
  });

  describe('Complex Folder Tests', () => {
    it('should handle complex nested folder structure', async () => {
      const files = testFolders.complexFolder;
      const folderName = 'complex-nested-folder';
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'complex-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      
      // Kiểm tra metadata folder structure
      const folderStructure = encryptResult.metadata.folderStructure;
      expect(folderStructure.folders).toContain('level1');
      expect(folderStructure.folders).toContain('level1/level2');
      expect(folderStructure.folders).toContain('level1/level2/level3');
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'complex-password'
      );

      // Giải nén và kiểm tra cấu trúc phức tạp
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      // Kiểm tra các cấp thư mục
      expect(zipContent.files['level1/']).toBeDefined();
      expect(zipContent.files['level1/level2/']).toBeDefined();
      expect(zipContent.files['level1/level2/level3/']).toBeDefined();
      
      // Kiểm tra file ở các cấp khác nhau
      expect(zipContent.files['root.txt']).toBeDefined();
      expect(zipContent.files['level1/file1.txt']).toBeDefined();
      expect(zipContent.files['level1/level2/file2.txt']).toBeDefined();
      expect(zipContent.files['level1/level2/level3/deep.txt']).toBeDefined();
    });

    it('should preserve relative paths in complex structure', async () => {
      const files = testFolders.complexFolder;
      const folderName = 'path-test-folder';
      
      const encryptionOptions = {
        algorithm: 'Camellia-CTR+HMAC' as const,
        password: 'path-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa và giải mã
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'path-password'
      );

      // Giải nén và kiểm tra paths
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      // Kiểm tra relative paths được bảo toàn
      const expectedPaths = [
        'root.txt',
        'level1/file1.txt',
        'level1/level2/file2.txt',
        'level1/level2/level3/deep.txt'
      ];
      
      for (const path of expectedPaths) {
        expect(zipContent.files[path]).toBeDefined();
        expect(zipContent.files[path].name).toBe(path);
      }
    });
  });

  describe('Edge Cases - Special Folders', () => {
    it('should handle empty folder', async () => {
      const files = testFolders.emptyFolder;
      const folderName = 'empty-folder';
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'empty-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa thư mục rỗng sẽ throw error
      await expect(
        FolderEncryption.encryptFolder(files, folderName, encryptionOptions)
      ).rejects.toThrow('No files provided for folder encryption');
    });

    it('should handle folder with special characters', async () => {
      const files = testFolders.specialFolder;
      const folderName = 'special-chars-folder!@#$%';
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'special-password-🔐',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      expect(encryptResult.metadata.filename).toContain(folderName);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'special-password-🔐'
      );

      // Giải nén và kiểm tra file với tên đặc biệt
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      expect(zipContent.files['unicode-file-🔐.txt']).toBeDefined();
      expect(zipContent.files['special!@#$%.txt']).toBeDefined();
      expect(zipContent.files['folder with spaces/file in spaces.txt']).toBeDefined();
    });

    it('should handle folder with large files', async () => {
      const files = testFolders.largeFolderFiles;
      const folderName = 'large-files-folder';
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'large-files-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      
      // Kiểm tra kích thước zip
      expect(encryptResult.metadata.originalSize).toBeGreaterThan(0);
      
      // Giải mã
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'large-files-password'
      );

      // Giải nén và kiểm tra file lớn
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      const largeFile = zipContent.files['large-file.bin'];
      expect(largeFile).toBeDefined();
      
      const largeFileContent = await largeFile.async('uint8array');
      expect(largeFileContent.length).toBe(5 * 1024 * 1024); // 5MB
    });
  });

  describe('Folder Structure Integrity', () => {
    it('should maintain exact folder structure after encryption/decryption', async () => {
      const files = testFolders.complexFolder;
      const folderName = 'structure-integrity-test';
      
      // Tạo map cấu trúc gốc
      const originalStructure = new Map<string, boolean>(); // path -> isDirectory
      for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        const pathParts = path.split('/');
        
        // Add all parent directories
        for (let i = 1; i < pathParts.length; i++) {
          const dirPath = pathParts.slice(0, i).join('/') + '/';
          originalStructure.set(dirPath, true);
        }
        
        // Add file
        originalStructure.set(path, false);
      }
      
      const encryptionOptions = {
        algorithm: 'AES-256-GCM' as const,
        password: 'structure-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa và giải mã
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'structure-password'
      );

      // Giải nén và so sánh cấu trúc
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      for (const [path, isDirectory] of originalStructure) {
        expect(zipContent.files[path]).toBeDefined();
        expect(zipContent.files[path].dir).toBe(isDirectory);
      }
    });

    it('should preserve file checksums in folder structure', async () => {
      const files = testFolders.simpleFolder;
      const folderName = 'checksum-test-folder';
      
      // Tính checksum cho từng file gốc
      const originalChecksums = new Map<string, string>();
      for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        const content = new Uint8Array(await file.arrayBuffer());
        const checksum = sha256(content);
        originalChecksums.set(path, checksum);
      }
      
      const encryptionOptions = {
        algorithm: 'XChaCha20-Poly1305' as const,
        password: 'checksum-password',
        keyDerivation: 'Argon2id' as const
      };

      // Mã hóa và giải mã
      const encryptResult = await FolderEncryption.encryptFolder(files, folderName, encryptionOptions);
      const decryptResult = await ZeroKnowledgeEncryption.decrypt(
        encryptResult.encryptedData,
        encryptResult.metadata,
        'checksum-password'
      );

      // Giải nén và kiểm tra checksum
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(decryptResult.decryptedData);
      
      for (const [path, originalChecksum] of originalChecksums) {
        const zipFile = zipContent.files[path];
        expect(zipFile).toBeDefined();
        
        const decryptedContent = await zipFile.async('uint8array');
        const decryptedChecksum = sha256(decryptedContent);
        expect(decryptedChecksum).toBe(originalChecksum);
      }
    });
  });
});

// Helper functions để tạo test folders
function createSimpleFolder(): File[] {
  return [
    createFileWithPath('file1.txt', 'text/plain', 'Content of file 1'),
    createFileWithPath('file2.txt', 'text/plain', 'Content of file 2'),
    createFileWithPath('subfolder/file3.txt', 'text/plain', 'Content of file 3 in subfolder')
  ];
}

function createComplexFolder(): File[] {
  return [
    createFileWithPath('root.txt', 'text/plain', 'Root level file'),
    createFileWithPath('level1/file1.txt', 'text/plain', 'File in level 1'),
    createFileWithPath('level1/level2/file2.txt', 'text/plain', 'File in level 2'),
    createFileWithPath('level1/level2/level3/deep.txt', 'text/plain', 'Deep nested file')
  ];
}

function createSpecialFolder(): File[] {
  return [
    createFileWithPath('unicode-file-🔐.txt', 'text/plain', 'Unicode content 🚀'),
    createFileWithPath('special!@#$%.txt', 'text/plain', 'Special chars content'),
    createFileWithPath('folder with spaces/file in spaces.txt', 'text/plain', 'File in folder with spaces')
  ];
}

function createLargeFolderFiles(): File[] {
  const largeContent = new Uint8Array(5 * 1024 * 1024); // 5MB
  for (let i = 0; i < largeContent.length; i++) {
    largeContent[i] = i % 256;
  }
  
  return [
    createFileWithPath('small.txt', 'text/plain', 'Small file'),
    createFileWithPath('large-file.bin', 'application/octet-stream', largeContent)
  ];
}

function createFileWithPath(path: string, type: string, content: string | Uint8Array): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], path.split('/').pop() || path, { type });
  
  // Mock webkitRelativePath for folder structure
  Object.defineProperty(file, 'webkitRelativePath', {
    value: path,
    writable: false
  });
  
  return file;
}
