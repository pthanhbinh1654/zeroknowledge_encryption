/**
 * Advanced Crypto Features
 * ========================
 * Bổ sung các tính năng nâng cao cho Zero-Knowledge Crypto:
 * - Multi-file encryption
 * - Folder/Directory encryption
 * - Chunking & streaming
 * - Hybrid encryption
 * - Digital signatures
 */

import JSZip from 'jszip';
import { ZeroKnowledgeEncryption } from './zero_knowledge';

// ==================================================
// MULTI-FILE ENCRYPTION
// ==================================================

export class MultiFileEncryption {
  /**
   * Mã hóa nhiều file rời rạc (không nén ZIP, mã hóa từng file riêng biệt)
   */
  static async encryptMultipleFiles(
    files: File[],
    options: any
  ): Promise<any[]> {
    const encryptedFiles = [];

    // Mã hóa từng file riêng biệt
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await file.arrayBuffer();
      const fileData = new Uint8Array(data);

      // Mã hóa file riêng biệt
      const result = await ZeroKnowledgeEncryption.encrypt(fileData, options);

      // Cập nhật metadata cho từng file
      result.metadata.filename = file.name;
      result.metadata.originalSize = file.size;
      result.metadata.encryptionMode = 'multi'; // Đánh dấu là multi-batch
      result.metadata.fileIndex = i; // Thứ tự file trong batch
      result.metadata.batchId = `batch_${Date.now()}`; // ID chung cho batch
      result.metadata.totalFiles = files.length; // Tổng số file trong batch
      result.metadata.originalName = file.name;
      result.metadata.mimeType = file.type;

      encryptedFiles.push(result);
    }

    return encryptedFiles;
  }

  /**
   * Giải mã nhiều file (từng file riêng biệt, không phải ZIP)
   */
  static async decryptMultipleFiles(
    encryptedData: Uint8Array,
    metadata: any,
    password?: string,
    privateKey?: Uint8Array
  ): Promise<File[]> {
    // Giải mã file đơn lẻ (không phải ZIP)
    const result = await ZeroKnowledgeEncryption.decrypt(
      encryptedData,
      metadata,
      password,
      privateKey
    );

    // Tạo File object từ dữ liệu đã giải mã
    const filename = metadata.originalName || metadata.filename || 'decrypted_file';
    const mimeType = metadata.mimeType || 'application/octet-stream';

    const fileObj = new File([result.decryptedData], filename, { type: mimeType });
    return [fileObj];
  }

  private static generateChecksum(file: File): string {
    // Placeholder - implement actual checksum generation
    return `checksum_${file.name}_${file.size}`;
  }
}

// ==================================================
// FOLDER ENCRYPTION
// ==================================================

export class FolderEncryption {
  /**
   * Mã hóa thư mục hoàn chỉnh
   */
  static async encryptFolder(
    files: File[],
    folderName: string,
    options: any
  ): Promise<any> {
    const zip = new JSZip();
    const folderStructure = {
      files: [] as string[],
      folders: [] as string[],
      paths: [] as string[]
    };
    
    // Tạo cấu trúc thư mục
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const pathParts = path.split('/');
      
      // Thêm thư mục vào cấu trúc
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        if (!folderStructure.folders.includes(folderPath)) {
          folderStructure.folders.push(folderPath);
          zip.folder(folderPath);
        }
      }
      
      // Thêm file - đảm bảo đọc đầy đủ dữ liệu
      const data = await file.arrayBuffer();
      if (data.byteLength === 0) {
        console.warn(`File ${path} is empty or could not be read`);
      }
      zip.file(path, data);
      folderStructure.files.push(path);
      folderStructure.paths.push(path);
    }
    
    // Tạo zip
    const zipData = await zip.generateAsync({ type: 'uint8array' });
    
    // Debug: Log folder structure (remove in production)
    if (import.meta.env.DEV) {
      console.log('Folder structure:', folderStructure);
      console.log('ZIP content size before encryption:', zipData.length);
    }
    
    // Mã hóa zip
    const result = await ZeroKnowledgeEncryption.encrypt(zipData, options);

    // Cập nhật metadata với tên folder gốc
    result.metadata.filename = `${folderName}.encrypted`;
    result.metadata.originalSize = zipData.length;
    result.metadata.isFolder = true;
    result.metadata.folderStructure = folderStructure;
    result.metadata.encryptionMode = 'folder';

    return result;
  }

  /**
   * Giải mã thư mục
   */
  static async decryptFolder(
    encryptedData: Uint8Array,
    metadata: any,
    password?: string,
    privateKey?: Uint8Array
  ): Promise<{ files: File[]; structure: any }> {
    const result = await ZeroKnowledgeEncryption.decrypt(
      encryptedData,
      metadata,
      password,
      privateKey
    );

    const zip = new JSZip();
    const zipData = await zip.loadAsync(result.decryptedData);
    const files: File[] = [];
    const structure = metadata.folderStructure || { files: [], folders: [], paths: [] };

    for (const [filename, file] of Object.entries(zipData.files)) {
      if (!file.dir) {
        const fileData = await file.async('blob');
        const fileObj = new File([fileData], filename, { type: fileData.type });
        files.push(fileObj);
      }
    }

    return { files, structure };
  }
}

// ==================================================
// CHUNKING & STREAMING
// ==================================================

export class ChunkedEncryption {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Mã hóa file lớn theo chunk
   */
  static async encryptLargeFile(
    file: File,
    options: any
  ): Promise<any> {
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const chunks: Uint8Array[] = [];
    const chunkInfo: any[] = [];
    
    let offset = 0;
    let chunkIndex = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      
      // Mã hóa chunk
      const chunkOptions = { ...options };
      const encryptedChunk = await ZeroKnowledgeEncryption.encrypt(chunkData, chunkOptions);
      
      chunks.push(encryptedChunk.encryptedData);
      
      // Lưu thông tin chunk
      chunkInfo.push({
        index: chunkIndex,
        offset,
        size: chunkData.length,
        iv: encryptedChunk.metadata.iv,
        tag: encryptedChunk.metadata.signature, // Tái sử dụng signature field cho tag
        checksum: encryptedChunk.metadata.checksum
      });
      
      offset += chunkSize;
      chunkIndex++;
    }
    
    // Kết hợp tất cả chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedData = new Uint8Array(totalSize);
    let currentOffset = 0;
    
    for (const chunk of chunks) {
      combinedData.set(chunk, currentOffset);
      currentOffset += chunk.length;
    }
    
    // Tạo metadata cuối cùng
    const finalMetadata = {
      fileId: this.generateFileId(),
      filename: file.name,
      originalSize: file.size,
      encryptedSize: combinedData.length,
      algorithm: options.algorithm,
      keyDerivation: options.keyDerivation,
      salt: this.arrayBufferToBase64(this.generateRandomBytes(32)),
      iv: this.arrayBufferToBase64(this.generateRandomBytes(16)),
      checksum: this.generateFileChecksum(file),
      timestamp: Date.now(),
      chunkInfo
    };
    
    return {
      encryptedData: combinedData,
      metadata: finalMetadata,
      chunks
    };
  }

  /**
   * Giải mã file lớn theo chunk
   */
  static async decryptLargeFile(
    encryptedData: Uint8Array,
    metadata: any,
    password?: string,
    privateKey?: Uint8Array
  ): Promise<Uint8Array> {
    if (!metadata.chunkInfo || metadata.chunkInfo.length === 0) {
      // File không được chunk, giải mã bình thường
      const result = await ZeroKnowledgeEncryption.decrypt(
        encryptedData,
        metadata,
        password,
        privateKey
      );
      return result.decryptedData;
    }

    // Giải mã từng chunk
    const decryptedChunks: Uint8Array[] = [];
    let currentOffset = 0;

    for (const chunkInfo of metadata.chunkInfo) {
      const chunkSize = chunkInfo.size;
      const chunkData = encryptedData.slice(currentOffset, currentOffset + chunkSize);
      
      // Tạo metadata cho chunk
      const chunkMetadata = {
        ...metadata,
        iv: chunkInfo.iv,
        signature: chunkInfo.tag, // Tái sử dụng tag
        checksum: chunkInfo.checksum
      };

      const result = await ZeroKnowledgeEncryption.decrypt(
        chunkData,
        chunkMetadata,
        password,
        privateKey
      );

      decryptedChunks.push(result.decryptedData);
      currentOffset += chunkSize;
    }

    // Kết hợp các chunk đã giải mã
    const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedData = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of decryptedChunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    return combinedData;
  }

  private static generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private static generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  private static arrayBufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  private static async generateFileChecksum(file: File): Promise<string> {
    // Placeholder - implement actual SHA256
    return `checksum_${file.name}_${file.size}`;
  }
}

// ==================================================
// HYBRID ENCRYPTION
// ==================================================

export class HybridEncryption {
  /**
   * Mã hóa lai với key wrapping
   */
  static async encryptWithKeyWrap(
    data: Uint8Array,
    publicKey: Uint8Array,
    keyWrapAlgorithm: 'X25519' | 'Kyber1024' = 'X25519'
  ): Promise<any> {
    // Tạo symmetric key ngẫu nhiên
    const symmetricKey = this.generateRandomBytes(32);
    
    // Wrap key với public key
    const wrappedKey = await this.wrapKey(symmetricKey, publicKey, keyWrapAlgorithm);
    
    // Mã hóa data với symmetric key
    const options = {
      algorithm: 'AES-256-GCM' as const,
      keyDerivation: 'PBKDF2' as const,
      salt: this.generateRandomBytes(32),
      iv: this.generateRandomBytes(16)
    };

    const result = await ZeroKnowledgeEncryption.encrypt(data, {
      ...options,
      useKeyWrap: true,
      keyWrapAlgorithm,
      publicKey
    });

    // Cập nhật metadata
    result.metadata.wrappedKey = this.arrayBufferToBase64(wrappedKey);
    result.metadata.useKeyWrap = true;
    result.metadata.keyWrapAlgorithm = keyWrapAlgorithm;

    return result;
  }

  /**
   * Giải mã lai với key unwrapping
   */
  static async decryptWithKeyWrap(
    encryptedData: Uint8Array,
    metadata: any,
    privateKey: Uint8Array
  ): Promise<Uint8Array> {
    // Unwrap key (not used in this simplified implementation)
    await this.unwrapKey(
      this.base64ToArrayBuffer(metadata.wrappedKey),
      privateKey,
      metadata.keyWrapAlgorithm
    );

    // Giải mã với symmetric key
    const result = await ZeroKnowledgeEncryption.decrypt(
      encryptedData,
      metadata,
      undefined, // Không dùng password
      privateKey
    );

    return result.decryptedData;
  }

  private static async wrapKey(
    key: Uint8Array,
    _publicKey: Uint8Array, // Prefix with _ to indicate unused
    algorithm: string
  ): Promise<Uint8Array> {
    switch (algorithm) {
      case 'X25519':
        // Implement X25519 key wrapping
        const wrappedKey = new Uint8Array(key.length + 32);
        wrappedKey.set(key, 0);
        // Add ephemeral public key
        wrappedKey.set(this.generateRandomBytes(32), key.length);
        return wrappedKey;
      
      case 'Kyber1024':
        // Implement Kyber key encapsulation
        throw new Error('Kyber1024 not yet implemented');
      
      default:
        throw new Error(`Unsupported key wrap algorithm: ${algorithm}`);
    }
  }

  private static async unwrapKey(
    wrappedKey: Uint8Array,
    _privateKey: Uint8Array, // Prefix with _ to indicate unused
    algorithm: string
  ): Promise<Uint8Array> {
    switch (algorithm) {
      case 'X25519':
        const keySize = wrappedKey.length - 32;
        return wrappedKey.slice(0, keySize);
      
      case 'Kyber1024':
        throw new Error('Kyber1024 not yet implemented');
      
      default:
        throw new Error(`Unsupported key unwrap algorithm: ${algorithm}`);
    }
  }

  private static generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  private static arrayBufferToBase64(buffer: Uint8Array): string {
    // Use Array.from to avoid spread operator issues with large arrays
    return btoa(String.fromCharCode.apply(null, Array.from(buffer)));
  }

  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

// ==================================================
// DIGITAL SIGNATURES
// ==================================================

export class DigitalSignatures {
  /**
   * Ký số file
   */
  static async signFile(
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5' = 'Ed25519'
  ): Promise<{ signature: Uint8Array; publicKey: Uint8Array }> {
    const signature = await ZeroKnowledgeEncryption.sign(data, privateKey, algorithm);

    // For Ed25519, derive public key from private key
    let publicKey: Uint8Array;
    if (algorithm === 'Ed25519') {
      // Import ed25519 from noble-curves
      const { ed25519 } = await import('@noble/curves/ed25519');
      publicKey = ed25519.getPublicKey(privateKey);
    } else {
      // For post-quantum algorithms, we'd need to store the public key separately
      // For now, use a placeholder
      publicKey = new Uint8Array(32);
    }

    return { signature, publicKey };
  }

  /**
   * Xác thực chữ ký số
   */
  static async verifySignature(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5' = 'Ed25519'
  ): Promise<boolean> {
    return await ZeroKnowledgeEncryption.verify(data, signature, publicKey, algorithm);
  }

  /**
   * Tạo key pair cho ký số
   */
  static async generateSignatureKeyPair(
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5' = 'Ed25519'
  ): Promise<any> {
    return await ZeroKnowledgeEncryption.generateKeyPair(algorithm);
  }
}

// ==================================================
// EXPORT ALL FEATURES
// ==================================================

// All classes are already exported above with 'export class'
// No need for duplicate exports 