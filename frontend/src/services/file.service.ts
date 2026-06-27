/**
 * File Service - Zero-Knowledge Implementation
 * ===========================================
 * Service xử lý file theo nguyên tắc Zero-Knowledge.
 * Tất cả mã hóa/giải mã xảy ra ở client-side.
 */

import { apiClient } from '../lib/api';
import { ZeroKnowledgeEncryption, ZeroKnowledgeUtils, type EncryptionOptions } from '../crypto';

// ==================================================
// FILE SERVICE - Service xử lý file theo Zero-Knowledge
// ==================================================

export class FileService {
  // ==================================================
  // FILE VALIDATION - Kiểm tra file
  // ==================================================

  static validateFile(file: File): { valid: boolean; error?: string } {
    return ZeroKnowledgeEncryption.validateFile(file);
  }

  static formatFileSize(bytes: number): string {
    return ZeroKnowledgeEncryption.formatFileSize(bytes);
  }

  // ==================================================
  // FILE ENCRYPTION - Mã hóa file
  // ==================================================

  static async uploadAndEncryptFile(
    file: File,
    options: {
      algorithm: string;
      password: string;
      key_derivation: string;
      use_key_wrap?: boolean;
      key_wrap_algorithm?: string;
      signature_algorithm?: string;
      description?: string;
      tags?: string[];
    },
    onProgress?: (progress: number) => void
  ): Promise<any> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Prepare encryption options
      const encryptionOptions: EncryptionOptions = {
        algorithm: options.algorithm as 'AES-256-GCM' | 'XChaCha20-Poly1305' | 'Camellia-CTR-HMAC',
        password: options.password,
        keyDerivation: options.key_derivation as 'Argon2id',
      };

      // Encrypt file on client-side (Zero-Knowledge)
      const result = await ZeroKnowledgeEncryption.encryptFile(file, encryptionOptions);

      if (onProgress) onProgress(50);

      // Prepare FormData for upload
      const formData = new FormData();
      formData.append('file', new Blob([result.encryptedData]), file.name);

      // Prepare metadata for backend
      const metadata = {
        encryption_algorithm: options.algorithm,
        key_derivation_function: options.key_derivation,
        use_key_wrap: options.use_key_wrap || false,
        key_wrap_algorithm: options.key_wrap_algorithm,
        public_key: result.metadata?.publicKeyId,
        wrapped_key: result.metadata?.wrappedKey,
        salt: result.metadata?.salt,
        iv: result.metadata?.iv,
        checksum: result.metadata?.checksum,
        signature_algorithm: options.signature_algorithm,
        signature: result.metadata?.signature,
        public_key_signature: result.metadata?.signature,
        description: options.description,
        tags: options.tags || []
      };
      formData.append('encryption_data', JSON.stringify(metadata));

      // Upload encrypted file and metadata to backend
      const config: any = {
        headers: {
          // 'Content-Type' will be set automatically by browser for FormData
        }
      };
      // Only add onUploadProgress if supported by Axios (browser only)
      if (typeof window !== 'undefined' && onProgress) {
        config.onUploadProgress = (progressEvent: any) => {
          if (progressEvent.total) {
            const uploadProgress = (progressEvent.loaded / progressEvent.total) * 50;
            onProgress(50 + uploadProgress);
          }
        };
      }
      const response = await apiClient.post('/encrypted/upload', formData, config);

      if (onProgress) onProgress(100);
      return response.data;
    } catch (error: any) {
      console.error('File encryption & upload error:', error);
      throw error;
    }
  }

  // ==================================================
  // FOLDER ENCRYPTION - Mã hóa thư mục
  // ==================================================

  static async uploadAndEncryptFolder(
    files: File[],
    options: {
      algorithm: string;
      password: string;
      key_derivation: string;
    },
    onProgress?: (progress: number) => void
  ): Promise<any> {
    try {
      // Validate all files
      for (const file of files) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
          throw new Error(`${file.name}: ${validation.error}`);
        }
      }

      // Prepare encryption options
      const encryptionOptions: EncryptionOptions = {
        algorithm: options.algorithm as 'AES-256-GCM' | 'XChaCha20-Poly1305',
        password: options.password,
        keyDerivation: options.key_derivation as 'PBKDF2' | 'Argon2id' | 'Scrypt',
      };

      // Encrypt folder on client-side (Zero-Knowledge)
      const result = await ZeroKnowledgeEncryption.encryptFolder(files, 'encrypted_folder', encryptionOptions);

      // Update progress
      if (onProgress) onProgress(50);

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', new Blob([result.encryptedData]), 'folder.zip');
      formData.append('metadata', JSON.stringify(result.metadata));

      // Upload encrypted data to server
      const response = await apiClient.post('/encrypted/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      } as any);

      if (onProgress) onProgress(100);

      return response.data;
    } catch (error: any) {
      console.error('Folder encryption error:', error);
      throw error;
    }
  }

  // ==================================================
  // FILE DECRYPTION - Giải mã file
  // ==================================================

  static async downloadAndDecryptFile(
    fileId: string,
    options: {
      password?: string;
      privateKey?: Uint8Array;
    }
  ): Promise<{ data: Uint8Array; filename: string }> {
    try {
      // Download encrypted file from server
      const response = await apiClient.get(`/encrypted/download/${fileId}`, {
        responseType: 'arraybuffer',
      });

      // Parse metadata
      const metadata = JSON.parse(response.headers['x-file-metadata']);
      
      // Decrypt on client-side (Zero-Knowledge)
      const decryptionOptions = {
        algorithm: metadata.encryption_algorithm,
        password: options.password,
        keyDerivation: metadata.key_derivation_function,
        salt: metadata.salt,
        iv: metadata.nonce,
        checksum: metadata.file_hash,
        useKeyWrap: metadata.use_key_wrap,
        privateKey: options.privateKey,
        keyWrapAlgorithm: metadata.key_wrap_algorithm,
        wrappedKey: metadata.wrapped_key,
      } as any;

      const result = await ZeroKnowledgeEncryption.decrypt(
        new Uint8Array(response.data as ArrayBuffer),
        decryptionOptions as any
      );

      return {
        data: result.decryptedData,
        filename: metadata.filename,
      };
    } catch (error: any) {
      console.error('File decryption error:', error);
      throw error;
    }
  }

  // ==================================================
  // FILE MANAGEMENT - Quản lý file
  // ==================================================

  static async listEncryptedFiles(page: number = 1, perPage: number = 20): Promise<any> {
    try {
      const response = await apiClient.get('/encrypted/list', {
        params: { page, per_page: perPage },
      });
      return response.data;
    } catch (error: any) {
      console.error('List files error:', error);
      throw error;
    }
  }

  static async deleteEncryptedFile(fileId: string): Promise<any> {
    try {
      const response = await apiClient.delete(`/encrypted/${fileId}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  static async getEncryptionStats(): Promise<any> {
    try {
      const response = await apiClient.get('/encrypted/stats');
      return response.data;
    } catch (error: any) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  // Alias methods for compatibility
  static async getUserFiles(page: number = 1, perPage: number = 20, search?: string, algorithm?: string): Promise<any> {
    try {
      let url = `/encrypted/list?page=${page}&per_page=${perPage}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (algorithm) url += `&algorithm=${encodeURIComponent(algorithm)}`;
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error getting user files:', error);
      throw error;
    }
  }

  static async getAvailableAlgorithms(): Promise<string[]> {
    try {
      const response = await apiClient.get('/encrypted/algorithms');
      return (response.data as any).algorithms || [];
    } catch (error: any) {
      console.error('Error getting algorithms:', error);
      return ['AES-256-GCM', 'XChaCha20-Poly1305', 'Camellia-CTR'];
    }
  }

  static async deleteUserFile(fileId: string): Promise<any> {
    return this.deleteEncryptedFile(fileId);
  }

  static async updateUserFile(fileId: string, updates: any): Promise<any> {
    try {
      const response = await apiClient.put(`/encrypted/${fileId}`, updates);
      return response.data;
    } catch (error: any) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  static async deleteMultipleUserFiles(fileIds: string[]): Promise<any> {
    try {
      const response = await apiClient.post('/encrypted/batch-delete', { file_ids: fileIds });
      return response.data;
    } catch (error: any) {
      console.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  // ==================================================
  // KEY MANAGEMENT - Quản lý key
  // ==================================================

  static async generateKeyPair(algorithm: 'Ed25519' | 'X25519'): Promise<any> {
    try {
      const keyPair = await ZeroKnowledgeEncryption.generateKeyPair(algorithm);
      
      // Convert to base64 for storage
      const publicKeyBase64 = btoa(String.fromCharCode(...keyPair.publicKey));
      const privateKeyBase64 = btoa(String.fromCharCode(...keyPair.privateKey));

      return {
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        algorithm: keyPair.algorithm,
      };
    } catch (error: any) {
      console.error('Generate key pair error:', error);
      throw error;
    }
  }

  // ==================================================
  // DIGITAL SIGNATURES - Ký số
  // ==================================================

  static async signFile(
    fileData: Uint8Array,
    privateKeyBase64: string,
    algorithm: 'Ed25519' = 'Ed25519'
  ): Promise<{ signature: string; publicKey: string }> {
    try {
      // Convert base64 to Uint8Array
      const privateKey = new Uint8Array(
        atob(privateKeyBase64).split('').map(char => char.charCodeAt(0))
      );

      // Sign file
      const signature = await ZeroKnowledgeEncryption.sign(fileData, privateKey, algorithm);

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

      // Convert to base64 - use Array.from to avoid spread operator issues with large arrays
      const signatureBase64 = btoa(String.fromCharCode.apply(null, Array.from(signature)));
      const publicKeyBase64 = btoa(String.fromCharCode.apply(null, Array.from(publicKey)));

      return {
        signature: signatureBase64,
        publicKey: publicKeyBase64,
      };
    } catch (error: any) {
      console.error('Sign file error:', error);
      throw error;
    }
  }

  static async verifyFileSignature(
    fileData: Uint8Array,
    signatureBase64: string,
    publicKeyBase64: string,
    algorithm: 'Ed25519' = 'Ed25519'
  ): Promise<boolean> {
    try {
      // Convert base64 to Uint8Array
      const signature = new Uint8Array(
        atob(signatureBase64).split('').map(char => char.charCodeAt(0))
      );
      const publicKey = new Uint8Array(
        atob(publicKeyBase64).split('').map(char => char.charCodeAt(0))
      );

      // Verify signature
      return await ZeroKnowledgeEncryption.verify(fileData, signature, publicKey, algorithm);
    } catch (error: any) {
      console.error('Verify signature error:', error);
      throw error;
    }
  }

  // ==================================================
  // UTILITY FUNCTIONS - Các hàm tiện ích
  // ==================================================

  static generateRandomPassword(length: number = 32): string {
    return ZeroKnowledgeUtils.generateRandomPassword(length);
  }

  static validatePasswordStrength(password: string) {
    return ZeroKnowledgeUtils.validatePasswordStrength(password);
  }

  static downloadFile(data: Uint8Array, filename: string): void {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
} 