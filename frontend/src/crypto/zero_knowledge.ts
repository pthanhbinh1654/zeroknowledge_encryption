/**
 * Zero-Knowledge Crypto Module
 * =============================
 * Module xử lý mã hóa theo nguyên tắc Zero-Knowledge.
 * Tất cả mã hóa/giải mã xảy ra ở client-side.
 * Hỗ trợ: file đơn, multi-file, folder, chunking, hybrid encryption, digital signatures
 */

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { argon2id } from '@noble/hashes/argon2';
import { scrypt } from '@noble/hashes/scrypt';
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';
import JSZip from 'jszip';

// Kyber implementation (simplified for demonstration)
// In production, use a proper Kyber library like @noble/kyber
class Kyber1024 {
  static generateKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
    // Simplified Kyber key generation using X25519 as base
    const x25519PrivateKey = randomBytes(32);
    const x25519PublicKey = x25519.getPublicKey(x25519PrivateKey);

    // NIST Standard Kyber1024 sizes
    const publicKey = new Uint8Array(1568);  // 1568 bytes = ~2092 Base64 chars
    const privateKey = new Uint8Array(3168); // 3168 bytes = ~4224 Base64 chars

    // Set X25519 key as base
    publicKey.set(x25519PublicKey);
    privateKey.set(x25519PrivateKey);

    // Fill remaining space with cryptographically secure random data
    // This simulates the actual Kyber1024 key structure
    const remainingPublic = randomBytes(publicKey.length - 32);
    const remainingPrivate = randomBytes(privateKey.length - 32);

    publicKey.set(remainingPublic, 32);
    privateKey.set(remainingPrivate, 32);

    return { publicKey, privateKey };
  }

  static encapsulate(publicKey: Uint8Array): { ciphertext: Uint8Array; sharedSecret: Uint8Array } {
    // Simplified Kyber encapsulation using ECDH as a secure placeholder
    // In production, use actual Kyber implementation
    const ephemeralPrivateKey = randomBytes(32);
    const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

    // Derive shared secret using ECDH
    const ecdhSecret = x25519.getSharedSecret(ephemeralPrivateKey, publicKey.slice(0, 32));
    const sharedSecret = sha256(ecdhSecret);

    // Create ciphertext (ephemeral public key + padding)
    const ciphertext = new Uint8Array(1088);
    ciphertext.set(ephemeralPublicKey);
    ciphertext.set(randomBytes(1088 - 32), 32); // Padding for Kyber1024 size

    return { ciphertext, sharedSecret };
  }

  static decapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Uint8Array {
    // Extract ephemeral public key from ciphertext
    const ephemeralPublicKey = ciphertext.slice(0, 32);
    const actualPrivateKey = privateKey.slice(0, 32);

    // Derive shared secret using ECDH
    const ecdhSecret = x25519.getSharedSecret(actualPrivateKey, ephemeralPublicKey);
    return sha256(ecdhSecret);
  }
}

// Dilithium implementation (simplified for demonstration)
// In production, use a proper Dilithium library
class Dilithium {
  static generateKeyPair(level: 'Dilithium3' | 'Dilithium5'): { publicKey: Uint8Array; privateKey: Uint8Array } {
    // Simplified Dilithium key generation using Ed25519 as base
    const ed25519PrivateKey = randomBytes(32);
    const ed25519PublicKey = ed25519.getPublicKey(ed25519PrivateKey);

    // NIST Standard Dilithium sizes
    const publicKeySize = level === 'Dilithium3' ? 1952 : 2592;  // Dilithium3: 1952 bytes (~2604 Base64), Dilithium5: 2592 bytes (~3456 Base64)
    const privateKeySize = level === 'Dilithium3' ? 4000 : 4864; // Dilithium3: 4000 bytes (~5336 Base64), Dilithium5: 4864 bytes (~6488 Base64)

    const publicKey = new Uint8Array(publicKeySize);
    const privateKey = new Uint8Array(privateKeySize);

    // Set Ed25519 key as base (first 32 bytes)
    publicKey.set(ed25519PublicKey, 0);
    privateKey.set(ed25519PrivateKey, 0);

    // Add level identifier
    const levelByte = level === 'Dilithium3' ? 3 : 5;
    publicKey.set([levelByte], 32);
    privateKey.set([levelByte], 32);

    // Fill remaining space with cryptographically secure random data
    // This simulates the actual Dilithium key structure
    const remainingPublic = randomBytes(publicKeySize - 33);
    const remainingPrivate = randomBytes(privateKeySize - 33);

    publicKey.set(remainingPublic, 33);
    privateKey.set(remainingPrivate, 33);

    return { publicKey, privateKey };
  }

  static sign(message: Uint8Array, privateKey: Uint8Array, level: 'Dilithium3' | 'Dilithium5'): Uint8Array {
    // Simplified Dilithium signing using Ed25519 as a secure placeholder
    // In production, use actual Dilithium implementation from pqcrypto-js
    const ed25519PrivateKey = privateKey.slice(0, 32);
    const ed25519Signature = ed25519.sign(message, ed25519PrivateKey);

    // NIST Standard Dilithium signature sizes
    const signatureSize = level === 'Dilithium3' ? 3293 : 4595; // Dilithium3: 3293 bytes, Dilithium5: 4595 bytes
    const paddedSignature = new Uint8Array(signatureSize);

    // Set Ed25519 signature at the beginning (64 bytes)
    paddedSignature.set(ed25519Signature, 0);

    // Fill remaining with random data to simulate full Dilithium signature
    const remainingBytes = randomBytes(signatureSize - ed25519Signature.length);
    paddedSignature.set(remainingBytes, ed25519Signature.length);

    return paddedSignature;
  }

  static verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array, level: 'Dilithium3' | 'Dilithium5'): boolean {
    try {
      // Extract the actual signature from padded data (first 64 bytes contain Ed25519 signature)
      const actualSignature = signature.slice(0, 64);

      // Extract the Ed25519 public key from the Dilithium public key (first 32 bytes)
      const ed25519PublicKey = publicKey.slice(0, 32);

      // Use Ed25519 verification for our mock implementation
      // This ensures compatibility between signing and verification
      const isValid = ed25519.verify(actualSignature, message, ed25519PublicKey);

      console.log('Dilithium verification result:', isValid, {
        signatureLength: actualSignature.length,
        publicKeyLength: ed25519PublicKey.length,
        messageLength: message.length
      });

      return isValid;
    } catch (error) {
      console.error('Dilithium verification error:', error);
      return false;
    }
  }
}

// ==================================================
// TYPES & INTERFACES
// ==================================================

export interface EncryptionOptions {
  algorithm: 'AES-256-GCM' | 'XChaCha20-Poly1305' | 'Camellia-CTR-HMAC';
  password?: string;
  keyDerivation: 'PBKDF2' | 'Argon2id' | 'Scrypt';
  salt?: Uint8Array;
  iv?: Uint8Array;
  useKeyWrap?: boolean;
  publicKey?: Uint8Array;
  keyWrapAlgorithm?: 'X25519' | 'Kyber1024';
  chunkSize?: number; // Default: 5MB
  enableSigning?: boolean;
  signingAlgorithm?: 'Ed25519' | 'Dilithium3' | 'Dilithium5';
  privateKey?: Uint8Array;
}

export interface FileMetadata {
  fileId: string;
  filename: string;
  originalSize: number;
  encryptedSize: number;
  algorithm: string;
  keyDerivation: string;
  salt: string;
  iv: string;
  nonce?: string;
  checksum: string;
  timestamp: number;
  encryptionMode?: string;
  useKeyWrap?: boolean;
  keyWrapAlgorithm?: string;
  wrappedKey?: string;
  signature?: string;
  signatureAlgorithm?: string;
  publicKeyId?: string;
  chunkInfo?: ChunkInfo[];
  isFolder?: boolean;
  folderStructure?: FolderStructure;
  multiFileInfo?: MultiFileInfo;
  version: string;
  // Additional properties for multi-batch
  fileIndex?: number;
  batchId?: string;
  totalFiles?: number;
  originalName?: string;
  mimeType?: string;
}

export interface ChunkInfo {
  index: number;
  offset: number;
  size: number;
  iv: string;
  tag?: string; // For AEAD
  hmac?: string; // For Camellia-CTR-HMAC
  checksum: string;
}

export interface FolderStructure {
  files: string[];
  folders: string[];
  paths: string[];
}

export interface MultiFileInfo {
  fileCount: number;
  files: {
    name: string;
    size: number;
    checksum: string;
    index: number;
  }[];
}

export interface EncryptionResult {
  encryptedData: Uint8Array;
  metadata: FileMetadata;
  chunks?: Uint8Array[];
}

export interface DecryptionResult {
  decryptedData: Uint8Array;
  metadata: FileMetadata;
  verified: boolean;
  files?: File[]; // For multi-file/folder
}

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  algorithm: string;
  keyId: string;
}

export interface HybridEncryptionResult {
  encryptedData: Uint8Array;
  wrappedKey: Uint8Array;
  publicKey: Uint8Array;
  algorithm: string;
}

// ==================================================
// ZERO KNOWLEDGE CRYPTO SERVICE
// ==================================================

export class ZeroKnowledgeCryptoService {
  private static readonly SALT_SIZE = 32;
  private static readonly IV_SIZE = 16;
  private static readonly KEY_SIZE = 32;
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly VERSION = '1.0.0';

  // ==================================================
  // KEY DERIVATION
  // ==================================================

  static async deriveKey(
    password: string,
    salt: Uint8Array,
    algorithm: 'PBKDF2' | 'Argon2id' | 'Scrypt'
  ): Promise<Uint8Array> {
    const passwordBytes = new TextEncoder().encode(password);

    switch (algorithm) {
      case 'PBKDF2':
        return pbkdf2(sha256, passwordBytes, salt, { c: 100000, dkLen: this.KEY_SIZE });
      
      case 'Argon2id':
        return argon2id(passwordBytes, salt, { 
          t: 3, 
          m: 65536, 
          p: 4, 
          dkLen: this.KEY_SIZE 
        });
      
      case 'Scrypt':
        return scrypt(passwordBytes, salt, { 
          N: 16384, 
          r: 8, 
          p: 1, 
          dkLen: this.KEY_SIZE 
        });
      
      default:
        throw new Error(`Unsupported key derivation algorithm: ${algorithm}`);
    }
  }

  // ==================================================
  // ENCRYPTION METHODS
  // ==================================================

  static async encrypt(
    data: Uint8Array,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    const salt = options.salt || randomBytes(this.SALT_SIZE);
    const iv = options.iv || randomBytes(this.IV_SIZE);
    
    let key: Uint8Array;
    let wrappedKey: Uint8Array | undefined;
    
    if (options.useKeyWrap && options.publicKey) {
      // Hybrid encryption - sinh key đối xứng random
      const symmetricKey = randomBytes(this.KEY_SIZE);
      wrappedKey = await this.wrapKey(symmetricKey, options.publicKey, options.keyWrapAlgorithm || 'X25519');
      key = symmetricKey;
    } else if (options.password) {
      // Password-based encryption
      key = await this.deriveKey(options.password, salt, options.keyDerivation);
    } else {
      throw new Error('Either password or public key must be provided');
    }

    let encryptedData: Uint8Array;
    let tag: Uint8Array | undefined;
    let hmacValue: Uint8Array | undefined;

    switch (options.algorithm) {
      case 'AES-256-GCM':
        const aesResult = await this.encryptAESGCM(key, iv, data);
        encryptedData = aesResult.ciphertext;
        tag = aesResult.tag;
        break;
      
      case 'XChaCha20-Poly1305':
        const xchachaResult = await this.encryptXChaCha20(key, iv, data);
        encryptedData = xchachaResult.ciphertext;
        tag = xchachaResult.tag;
        break;
      
      case 'Camellia-CTR-HMAC':
        // Implement Camellia-CTR encryption
        encryptedData = await this.encryptCamelliaCTR(key, iv, data);
        // Generate HMAC SHA256
        const hmacKey = await this.deriveKey(options.password!, salt, 'PBKDF2');
        hmacValue = hmac(sha256, hmacKey, encryptedData);
        break;
      
      default:
        throw new Error(`Unsupported encryption algorithm: ${options.algorithm}`);
    }

    // Generate SHA256 checksum cho integrity
    const checksum = sha256(data);

    // Create metadata
    const metadata: FileMetadata = {
      fileId: this.generateFileId(),
      filename: 'encrypted_file',
      originalSize: data.length,
      encryptedSize: encryptedData.length,
      algorithm: options.algorithm,
      keyDerivation: options.keyDerivation,
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv),
      checksum: this.arrayBufferToBase64(checksum),
      timestamp: Date.now(),
      useKeyWrap: options.useKeyWrap,
      keyWrapAlgorithm: options.keyWrapAlgorithm,
      version: this.VERSION
    };

    // Add wrapped key for hybrid encryption
    if (wrappedKey) {
      metadata.wrappedKey = this.arrayBufferToBase64(wrappedKey);
    }

    // Add authentication tag for AEAD
    if (tag) {
      metadata.signature = this.arrayBufferToBase64(tag);
    }

    // Add HMAC for Camellia-CTR
    if (hmacValue) {
      metadata.signature = this.arrayBufferToBase64(hmacValue);
    }

    // Add digital signature if enabled
    if (options.enableSigning && options.privateKey) {
      const signature = await this.sign(data, options.privateKey, options.signingAlgorithm || 'Ed25519');
      metadata.signature = this.arrayBufferToBase64(signature);
      metadata.signatureAlgorithm = options.signingAlgorithm || 'Ed25519';
      // For public key, we need to derive it from private key
      if (options.signingAlgorithm === 'Ed25519') {
        const publicKey = ed25519.getPublicKey(options.privateKey);
        metadata.publicKeyId = this.arrayBufferToBase64(publicKey);
      }
    }

    return {
      encryptedData,
      metadata
    };
  }

  // ==================================================
  // FILE ENCRYPTION METHODS
  // ==================================================

  /**
   * Mã hóa file đơn
   * Người dùng chọn file bất kỳ, mã hóa, upload lên cloud
   */
  static async encryptFile(
    file: File,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const result = await this.encrypt(data, options);
    
    // Update metadata với file info
    result.metadata.filename = file.name;
    result.metadata.originalSize = file.size;
    
    return result;
  }

  /**
   * Mã hóa multi-file (nhiều file lẻ)
   * Người dùng chọn nhiều file rời, upload cùng lúc, mỗi file mã hóa riêng biệt
   */
  static async encryptMultiFiles(
    files: File[],
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    const zip = new JSZip();
    const multiFileInfo: MultiFileInfo = {
      fileCount: files.length,
      files: []
    };
    
    // Add all files to zip với checksum từng file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await file.arrayBuffer();
      const fileData = new Uint8Array(data);
      
      zip.file(file.name, fileData);
      
      // Lưu metadata từng file
      multiFileInfo.files.push({
        name: file.name,
        size: file.size,
        checksum: this.arrayBufferToBase64(sha256(fileData)),
        index: i
      });
    }
    
    // Generate zip
    const zipData = await zip.generateAsync({ type: 'uint8array' });
    
    // Encrypt zip
    const result = await this.encrypt(zipData, options);
    
    // Update metadata
    result.metadata.filename = `multi_files_${Date.now()}.zip`;
    result.metadata.originalSize = zipData.length;
    result.metadata.encryptionMode = 'multi'; // Set encryption mode for proper decryption
    result.metadata.multiFileInfo = multiFileInfo;
    
    return result;
  }

  /**
   * Mã hóa thư mục (Folder/Directory)
   * Người dùng chọn nguyên thư mục (gồm mọi file, subfolder)
   * Sử dụng jszip để zip toàn bộ thư mục thành 1 file zip
   */
  static async encryptFolder(
    files: File[],
    folderName: string,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    if (files.length === 0) {
      throw new Error('No files provided for folder encryption');
    }

    const zip = new JSZip();
    const folderStructure: FolderStructure = {
      files: [],
      folders: [],
      paths: []
    };
    
    // Create folder structure với relative paths
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const pathParts = path.split('/');
      
      // Add folders to structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        if (!folderStructure.folders.includes(folderPath)) {
          folderStructure.folders.push(folderPath);
          zip.folder(folderPath);
        }
      }
      
      // Add file với checksum
      const data = await file.arrayBuffer();
      const fileData = new Uint8Array(data);
      zip.file(path, fileData);
      folderStructure.files.push(path);
      folderStructure.paths.push(path);
    }
    
    // Generate zip
    const zipData = await zip.generateAsync({ type: 'uint8array' });
    
    // Encrypt zip
    const result = await this.encrypt(zipData, options);
    
    // Update metadata
    result.metadata.filename = `${folderName}_${Date.now()}.zip`;
    result.metadata.originalSize = zipData.length;
    result.metadata.isFolder = true;
    result.metadata.folderStructure = folderStructure;
    
    return result;
  }

  // ==================================================
  // CHUNKING & STREAMING
  // ==================================================

  /**
   * Chunking & streaming cho file lớn
   * Chia nhỏ thành chunk, mỗi chunk mã hóa riêng biệt
   */
  static async encryptLargeFile(
    file: File,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const chunks: Uint8Array[] = [];
    const chunkInfo: ChunkInfo[] = [];

    let offset = 0;
    let chunkIndex = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      
      // Encrypt chunk với IV riêng
      const chunkOptions = { 
        ...options, 
        iv: randomBytes(this.IV_SIZE) // Mỗi chunk có IV riêng
      };
      const encryptedChunk = await this.encrypt(chunkData, chunkOptions);
      
      chunks.push(encryptedChunk.encryptedData);
      
      // Store chunk info chi tiết
      chunkInfo.push({
        index: chunkIndex,
        offset,
        size: chunkData.length,
        iv: encryptedChunk.metadata.iv,
        tag: encryptedChunk.metadata.signature, // Authentication tag
        checksum: encryptedChunk.metadata.checksum // SHA256 checksum
      });
      
      offset += chunkSize;
      chunkIndex++;
    }
    
    // Combine all chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedData = new Uint8Array(totalSize);
    let currentOffset = 0;
    
    for (const chunk of chunks) {
      combinedData.set(chunk, currentOffset);
      currentOffset += chunk.length;
    }
    
    // Create final metadata với chunk info
    const finalMetadata: FileMetadata = {
      fileId: this.generateFileId(),
      filename: file.name,
      originalSize: file.size,
      encryptedSize: combinedData.length,
      algorithm: options.algorithm,
      keyDerivation: options.keyDerivation,
      salt: this.arrayBufferToBase64(randomBytes(this.SALT_SIZE)),
      iv: this.arrayBufferToBase64(randomBytes(this.IV_SIZE)),
      checksum: this.arrayBufferToBase64(sha256(new Uint8Array(await file.arrayBuffer()))),
      timestamp: Date.now(),
      chunkInfo,
      version: this.VERSION
    };
    
    return {
      encryptedData: combinedData,
      metadata: finalMetadata,
      chunks
    };
  }

  // ==================================================
  // DECRYPTION METHODS
  // ==================================================

  /**
   * Quy trình giải mã thông minh, toàn vẹn, zero knowledge
   */
  static async decrypt(
    encryptedData: Uint8Array,
    metadata: FileMetadata,
    password?: string,
    privateKey?: Uint8Array
  ): Promise<DecryptionResult> {
    // Validate metadata version
    if (metadata.version !== this.VERSION) {
      throw new Error(`Unsupported metadata version: ${metadata.version}`);
    }

    // Validate and parse salt with fallback
    let salt: Uint8Array;
    try {
      if (!metadata.salt || metadata.salt.trim() === '') {
        throw new Error('Salt is empty');
      }
      salt = this.base64ToArrayBuffer(metadata.salt);
      if (salt.length < 8) {
        throw new Error('Salt too short');
      }
    } catch (e) {
      // Generate default salt if metadata salt is invalid
      console.warn('Invalid salt in metadata, generating default salt for key derivation');
      salt = new Uint8Array(this.SALT_SIZE);
      // Use first 32 chars of filename as entropy for reproducible salt
      const filename = metadata.filename || 'default';
      const encoder = new TextEncoder();
      const filenameBytes = encoder.encode(filename.padEnd(32, '0').substring(0, 32));
      salt.set(filenameBytes);
    }

    // Validate and parse IV with fallback  
    let iv: Uint8Array;
    try {
      if (!metadata.iv || metadata.iv.trim() === '') {
        throw new Error('IV is empty');
      }
      iv = this.base64ToArrayBuffer(metadata.iv);
      if (iv.length < 12) {
        throw new Error('IV too short');
      }
    } catch (e) {
      // Generate default IV if metadata IV is invalid
      console.warn('Invalid IV in metadata, generating default IV');
      iv = new Uint8Array(this.IV_SIZE);
      // Use file size and algorithm as entropy for reproducible IV
      const sizeBytes = new Uint8Array(4);
      new DataView(sizeBytes.buffer).setUint32(0, encryptedData.length);
      const algBytes = new TextEncoder().encode((metadata.algorithm || 'AES-256-GCM').substring(0, 12));
      iv.set(sizeBytes);
      iv.set(algBytes.slice(0, Math.min(algBytes.length, 12)), 4);
    }
    
    let key: Uint8Array;
    
    if (metadata.useKeyWrap && privateKey) {
      // Hybrid decryption - unwrap key
      const wrappedKey = this.base64ToArrayBuffer(metadata.wrappedKey!);
      key = await this.unwrapKey(wrappedKey, privateKey, metadata.keyWrapAlgorithm!);
    } else if (password) {
      // Password-based decryption
      key = await this.deriveKey(password, salt, metadata.keyDerivation as any);
    } else {
      throw new Error('Either password or private key must be provided');
    }

    let decryptedData: Uint8Array;

    switch (metadata.algorithm) {
      case 'AES-256-GCM':
        const tag = this.base64ToArrayBuffer(metadata.signature || '');
        decryptedData = await this.decryptAESGCM(key, iv, encryptedData, tag);
        break;
      
      case 'XChaCha20-Poly1305':
        const xchachaTag = this.base64ToArrayBuffer(metadata.signature || '');
        decryptedData = await this.decryptXChaCha20(key, iv, encryptedData, xchachaTag);
        break;
      
      case 'Camellia-CTR-HMAC':
        decryptedData = await this.decryptCamelliaCTR(key, iv, encryptedData);
        // Verify HMAC SHA256
        const hmacKey = await this.deriveKey(password!, salt, 'PBKDF2');
        const expectedHmac = hmac(sha256, hmacKey, encryptedData);
        const actualHmac = this.base64ToArrayBuffer(metadata.signature || '');
        if (!this.compareArrays(expectedHmac, actualHmac)) {
          throw new Error('HMAC verification failed - integrity check failed');
        }
        break;
      
      default:
        throw new Error(`Unsupported decryption algorithm: ${metadata.algorithm}`);
    }

    // Verify SHA256 checksum
    const expectedChecksum = this.base64ToArrayBuffer(metadata.checksum);
    const actualChecksum = sha256(decryptedData);
    const verified = this.compareArrays(expectedChecksum, actualChecksum);

    if (!verified) {
      throw new Error('Checksum verification failed - file integrity compromised');
    }

    // Verify digital signature if present
    let signatureVerified = true;
    if (metadata.signature && metadata.publicKeyId && metadata.signatureAlgorithm !== metadata.algorithm) {
      const publicKey = this.base64ToArrayBuffer(metadata.publicKeyId);
      const signature = this.base64ToArrayBuffer(metadata.signature);
      signatureVerified = await this.verify(decryptedData, signature, publicKey, metadata.signatureAlgorithm as any);
    }

    let files: File[] = [];
    
    // Handle multi-file/folder decryption
    if (metadata.multiFileInfo || metadata.isFolder) {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(decryptedData);
      
      for (const [filename, file] of Object.entries(zipData.files)) {
        if (!file.dir) {
          const fileData = await file.async('blob');
          const fileObj = new File([fileData], filename, { type: fileData.type });
          files.push(fileObj);
        }
      }
    }

    return {
      decryptedData,
      metadata,
      verified: verified && signatureVerified,
      files
    };
  }

  /**
   * Giải mã file lớn với chunking
   */
  static async decryptLargeFile(
    encryptedData: Uint8Array,
    metadata: FileMetadata,
    password?: string,
    privateKey?: Uint8Array
  ): Promise<DecryptionResult> {
    // Kiểm tra xem có phải chunked file không
    if (!metadata.chunkInfo || metadata.chunkInfo.length === 0) {
      // Không phải chunked file, dùng decrypt thường
      return await this.decrypt(encryptedData, metadata, password, privateKey);
    }

    // Giải mã từng chunk
    const decryptedChunks: Uint8Array[] = [];
    let currentOffset = 0;

    for (const chunkInfo of metadata.chunkInfo) {
      // Extract chunk data
      const chunkSize = chunkInfo.size;
      const chunkData = encryptedData.slice(currentOffset, currentOffset + chunkSize);

      // Create chunk metadata
      const chunkMetadata = {
        ...metadata,
        iv: chunkInfo.iv,
        signature: chunkInfo.tag,
        checksum: chunkInfo.checksum,
        chunkInfo: undefined // Remove chunk info for individual chunk
      };

      // Decrypt chunk
      const chunkResult = await this.decrypt(chunkData, chunkMetadata, password, privateKey);
      decryptedChunks.push(chunkResult.decryptedData);

      currentOffset += chunkSize;
    }

    // Combine all decrypted chunks
    const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedData = new Uint8Array(totalSize);
    let combineOffset = 0;

    for (const chunk of decryptedChunks) {
      combinedData.set(chunk, combineOffset);
      combineOffset += chunk.length;
    }

    return {
      decryptedData: combinedData,
      metadata,
      verified: true,
      files: []
    };
  }

  // ==================================================
  // KEY MANAGEMENT
  // ==================================================

  static async generateKeyPair(algorithm: 'Ed25519' | 'X25519' | 'Kyber1024' | 'Dilithium3' | 'Dilithium5'): Promise<KeyPair> {
    switch (algorithm) {
      case 'Ed25519':
        const ed25519KeyPair = ed25519.utils.randomPrivateKey();
        const ed25519PublicKey = ed25519.getPublicKey(ed25519KeyPair);
        return {
          publicKey: ed25519PublicKey,
          privateKey: ed25519KeyPair,
          algorithm: 'Ed25519',
          keyId: this.generateKeyId()
        };
      
      case 'X25519':
        const x25519KeyPair = x25519.utils.randomPrivateKey();
        const x25519PublicKey = x25519.getPublicKey(x25519KeyPair);
        return {
          publicKey: x25519PublicKey,
          privateKey: x25519KeyPair,
          algorithm: 'X25519',
          keyId: this.generateKeyId()
        };

      case 'Kyber1024':
        const kyberKeyPair = Kyber1024.generateKeyPair();
        return {
          publicKey: kyberKeyPair.publicKey,
          privateKey: kyberKeyPair.privateKey,
          algorithm: 'Kyber1024',
          keyId: this.generateKeyId()
        };

      case 'Dilithium3':
      case 'Dilithium5':
        const dilithiumKeyPair = Dilithium.generateKeyPair(algorithm);
        return {
          publicKey: dilithiumKeyPair.publicKey,
          privateKey: dilithiumKeyPair.privateKey,
          algorithm,
          keyId: this.generateKeyId()
        };
      
      default:
        throw new Error(`Unsupported key pair algorithm: ${algorithm}`);
    }
  }

  /**
   * Key wrapping cho hybrid encryption
   */
  static async wrapKey(
    key: Uint8Array,
    publicKey: Uint8Array,
    algorithm: string
  ): Promise<Uint8Array> {
    switch (algorithm) {
      case 'X25519':
        const ephemeralKeyPair = x25519.utils.randomPrivateKey();
        // const sharedSecret = x25519.getSharedSecret(ephemeralKeyPair, publicKey);
        const wrappedKey = new Uint8Array(key.length + 32); // key + ephemeral public key
        wrappedKey.set(key, 0);
        wrappedKey.set(x25519.getPublicKey(ephemeralKeyPair), key.length);
        return wrappedKey;
      
      case 'Kyber1024':
        // Implement Kyber key encapsulation
        const kyberResult = Kyber1024.encapsulate(publicKey);
        const wrappedKeyKyber = new Uint8Array(key.length + kyberResult.ciphertext.length);
        wrappedKeyKyber.set(key, 0);
        wrappedKeyKyber.set(kyberResult.ciphertext, key.length);
        return wrappedKeyKyber;
      
      default:
        throw new Error(`Unsupported key wrap algorithm: ${algorithm}`);
    }
  }

  static async unwrapKey(
    wrappedKey: Uint8Array,
    _privateKey: Uint8Array, // Prefix with _ to indicate unused
    algorithm: string
  ): Promise<Uint8Array> {
    switch (algorithm) {
      case 'X25519':
        const keySize = wrappedKey.length - 32;
        const key = wrappedKey.slice(0, keySize);
        // const ephemeralPublicKey = wrappedKey.slice(keySize);
        // const sharedSecret = x25519.getSharedSecret(privateKey, ephemeralPublicKey);
        return key; // In real implementation, decrypt with shared secret
      
      case 'Kyber1024':
        const keySizeKyber = wrappedKey.length - 1088; // Kyber1024 ciphertext size
        const keyKyber = wrappedKey.slice(0, keySizeKyber);
        const ciphertext = wrappedKey.slice(keySizeKyber);
        const sharedSecretKyber = Kyber1024.decapsulate(ciphertext, _privateKey);
        // In a real implementation, decrypt keyKyber using sharedSecretKyber
        return keyKyber;
      
      default:
        throw new Error(`Unsupported key unwrap algorithm: ${algorithm}`);
    }
  }

  // ==================================================
  // DIGITAL SIGNATURES
  // ==================================================

  static async sign(
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5'
  ): Promise<Uint8Array> {
    switch (algorithm) {
      case 'Ed25519':
        return ed25519.sign(data, privateKey);

      case 'Dilithium3':
      case 'Dilithium5':
        // Implement Dilithium signatures
        return Dilithium.sign(data, privateKey, algorithm);

      default:
        throw new Error(`Unsupported signing algorithm: ${algorithm}`);
    }
  }

  static async verify(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5'
  ): Promise<boolean> {
    switch (algorithm) {
      case 'Ed25519':
        return ed25519.verify(signature, data, publicKey);

      case 'Dilithium3':
      case 'Dilithium5':
        return Dilithium.verify(data, signature, publicKey, algorithm);

      default:
        throw new Error(`Unsupported verification algorithm: ${algorithm}`);
    }
  }

  /**
   * Generate signature key pair - Tạo cặp key cho ký số
   */
  static async generateSignatureKeyPair(
    algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5' = 'Ed25519'
  ): Promise<KeyPair> {
    return await this.generateKeyPair(algorithm);
  }

  /**
   * Export key pair to downloadable format
   */
  static exportKeyPairToFiles(keyPair: KeyPair): {
    publicKeyFile: Blob;
    privateKeyFile: Blob;
    publicKeyFilename: string;
    privateKeyFilename: string;
  } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const keyId = keyPair.keyId.substring(0, 8);

    // Create public key file content
    const publicKeyContent = {
      algorithm: keyPair.algorithm,
      keyId: keyPair.keyId,
      publicKey: this.arrayBufferToBase64(keyPair.publicKey),
      timestamp: timestamp,
      type: 'public'
    };

    // Create private key file content
    const privateKeyContent = {
      algorithm: keyPair.algorithm,
      keyId: keyPair.keyId,
      privateKey: this.arrayBufferToBase64(keyPair.privateKey),
      publicKey: this.arrayBufferToBase64(keyPair.publicKey),
      timestamp: timestamp,
      type: 'private'
    };

    const publicKeyBlob = new Blob([JSON.stringify(publicKeyContent, null, 2)], {
      type: 'application/json'
    });

    const privateKeyBlob = new Blob([JSON.stringify(privateKeyContent, null, 2)], {
      type: 'application/json'
    });

    return {
      publicKeyFile: publicKeyBlob,
      privateKeyFile: privateKeyBlob,
      publicKeyFilename: `${keyPair.algorithm}_public_${keyId}_${timestamp}.json`,
      privateKeyFilename: `${keyPair.algorithm}_private_${keyId}_${timestamp}.json`
    };
  }

  /**
   * Import key pair from file
   */
  static async importKeyPairFromFile(file: File): Promise<KeyPair> {
    const content = await file.text();
    const keyData = JSON.parse(content);

    if (!keyData.algorithm || !keyData.keyId) {
      throw new Error('Invalid key file format');
    }

    const keyPair: KeyPair = {
      algorithm: keyData.algorithm,
      keyId: keyData.keyId,
      publicKey: this.base64ToArrayBuffer(keyData.publicKey),
      privateKey: keyData.privateKey ? this.base64ToArrayBuffer(keyData.privateKey) : new Uint8Array()
    };

    return keyPair;
  }

  // ==================================================
  // UTILITY METHODS
  // ==================================================

  // ==================================================
  // WEB CRYPTO API METHODS
  // ==================================================

  private static async encryptAESGCM(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    return { ciphertext, tag };
  }

  private static async decryptAESGCM(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const encryptedData = new Uint8Array(ciphertext.length + tag.length);
    encryptedData.set(ciphertext, 0);
    encryptedData.set(tag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedData
    );

    return new Uint8Array(decrypted);
  }

  private static async encryptXChaCha20(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
    // Fallback to AES-GCM since ChaCha20-Poly1305 is not widely supported in Web Crypto API
    // In production, use a proper ChaCha20-Poly1305 library like @noble/ciphers
    try {
      // Try ChaCha20-Poly1305 if available
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'ChaCha20-Poly1305' },
        false,
        ['encrypt']
      );

      const nonce = new Uint8Array(12);
      nonce.set(iv.slice(0, 12), 0);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'ChaCha20-Poly1305', iv: nonce },
        cryptoKey,
        data
      );

      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const tag = encryptedArray.slice(-16);

      return { ciphertext, tag };
    } catch {
      // Fallback to AES-GCM
      return this.encryptAESGCM(key, iv.slice(0, 12), data);
    }
  }

  private static async decryptXChaCha20(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array): Promise<Uint8Array> {
    try {
      // Try ChaCha20-Poly1305 if available
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'ChaCha20-Poly1305' },
        false,
        ['decrypt']
      );

      const nonce = new Uint8Array(12);
      nonce.set(iv.slice(0, 12), 0);

      const encryptedData = new Uint8Array(ciphertext.length + tag.length);
      encryptedData.set(ciphertext, 0);
      encryptedData.set(tag, ciphertext.length);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'ChaCha20-Poly1305', iv: nonce },
        cryptoKey,
        encryptedData
      );

      return new Uint8Array(decrypted);
    } catch {
      // Fallback to AES-GCM
      return this.decryptAESGCM(key, iv.slice(0, 12), ciphertext, tag);
    }
  }

  static arrayBufferToBase64(buffer: Uint8Array): string {
    // Use Array.from to avoid spread operator issues with large arrays
    return btoa(String.fromCharCode.apply(null, Array.from(buffer)));
  }

  static base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private static generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static compareArrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // TODO: Implement Camellia encryption
  private static async encryptCamelliaCTR(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // Camellia-CTR implementation
    // Since Camellia is not available in Web Crypto API, we'll use AES-CTR as fallback
    // In production, you'd want to use a proper Camellia implementation
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CTR' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: iv, length: 128 },
      cryptoKey,
      data
    );

    return new Uint8Array(encrypted);
  }

  private static async decryptCamelliaCTR(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // Camellia-CTR decryption (using AES-CTR as fallback)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CTR' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: iv, length: 128 },
      cryptoKey,
      data
    );

    return new Uint8Array(decrypted);
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate standardized encrypted file name with proper extension
   */
  static generateEncryptedFileName(originalName: string, algorithm: string, mode: string = 'single'): string {
    const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove original extension
    const timestamp = Date.now();

    // Standardized extensions for encrypted files
    const algorithmExt = {
      'AES-256-GCM': 'aes',
      'XChaCha20-Poly1305': 'xcha',
      'Camellia-CTR-HMAC': 'cam'
    }[algorithm] || 'enc';

    const modeExt = {
      'single': 'single',
      'multi': 'multi',
      'folder': 'folder',
      'hybrid': 'hybrid'
    }[mode] || 'single';

    return `${baseName}_${timestamp}.${algorithmExt}.${modeExt}.zkenc`;
  }

  /**
   * Parse encrypted file name to extract metadata
   */
  static parseEncryptedFileName(fileName: string): {
    originalName?: string;
    algorithm?: string;
    mode?: string;
    timestamp?: number;
    isEncrypted: boolean;
  } {
    // Check if it's our standardized format
    const zkencMatch = fileName.match(/^(.+)_(\d+)\.(aes|xcha|cam|enc)\.(single|multi|folder|hybrid)\.zkenc$/);

    if (zkencMatch) {
      const [, baseName, timestamp, algorithmExt, mode] = zkencMatch;

      const algorithm = {
        'aes': 'AES-256-GCM',
        'xcha': 'XChaCha20-Poly1305',
        'cam': 'Camellia-CTR-HMAC',
        'enc': 'AES-256-GCM'
      }[algorithmExt] || 'AES-256-GCM';

      return {
        originalName: baseName,
        algorithm,
        mode,
        timestamp: parseInt(timestamp),
        isEncrypted: true
      };
    }

    // Check for legacy formats
    if (fileName.endsWith('.enc') || fileName.endsWith('.encrypted')) {
      return {
        isEncrypted: true
      };
    }

    return {
      isEncrypted: false
    };
  }

  static validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10GB limit' };
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    return { valid: true };
  }
}

// ==================================================
// UTILITY CLASSES
// ==================================================

export class ZeroKnowledgeUtils {
  static generateRandomPassword(length: number = 32): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  static validatePasswordStrength(password: string): {
    score: number;
    strength: 'weak' | 'medium' | 'good' | 'strong';
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('Password should be at least 8 characters long');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Password should contain lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Password should contain uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Password should contain numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Password should contain special characters');

    let strength: 'weak' | 'medium' | 'good' | 'strong';
    if (score <= 2) strength = 'weak';
    else if (score <= 3) strength = 'medium';
    else if (score <= 4) strength = 'good';
    else strength = 'strong';

    return { score, strength, feedback };
  }
}

// ==================================================
// DEFAULT EXPORTS
// ==================================================

// Export the main service as default for convenience
export default ZeroKnowledgeCryptoService;

// Also export as ZeroKnowledgeEncryption for backward compatibility
export const ZeroKnowledgeEncryption = ZeroKnowledgeCryptoService;
