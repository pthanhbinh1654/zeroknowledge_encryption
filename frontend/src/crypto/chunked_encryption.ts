/**
 * Chunked Encryption
 * ==================
 * Xử lý mã hóa file lớn bằng cách chia thành chunks
 */

import { ZeroKnowledgeEncryption } from './zero_knowledge';

export class ChunkedEncryption {
  static readonly DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Mã hóa file lớn với chunking
   */
  static async encryptLargeFile(
    file: File,
    options: any
  ): Promise<any> {
    return await ZeroKnowledgeEncryption.encryptLargeFile(file, options);
  }

  /**
   * Giải mã file lớn với chunking
   */
  static async decryptLargeFile(
    encryptedData: Uint8Array,
    metadata: any,
    password: string,
    privateKey?: Uint8Array
  ): Promise<any> {
    return await ZeroKnowledgeEncryption.decryptLargeFile(
      encryptedData,
      metadata,
      password,
      privateKey
    );
  }
}
