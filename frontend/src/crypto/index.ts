/**
 * Crypto Module Index
 * ===================
 * Central export point for all crypto-related modules
 */

// Import everything first
import ZeroKnowledgeCryptoService, {
  ZeroKnowledgeEncryption,
  ZeroKnowledgeUtils,
  type EncryptionOptions,
  type FileMetadata,
  type ChunkInfo,
  type FolderStructure,
  type MultiFileInfo,
  type EncryptionResult,
  type DecryptionResult,
  type KeyPair,
  type HybridEncryptionResult
} from './zero_knowledge';

// Re-export everything explicitly
export {
  ZeroKnowledgeCryptoService as default,
  ZeroKnowledgeEncryption,
  ZeroKnowledgeUtils
};

export type {
  EncryptionOptions,
  FileMetadata,
  ChunkInfo,
  FolderStructure,
  MultiFileInfo,
  EncryptionResult,
  DecryptionResult,
  KeyPair,
  HybridEncryptionResult
};

// Export everything from advanced_features module
export * from './advanced_features';
