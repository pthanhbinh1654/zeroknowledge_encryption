// Persistent File Manager - Manages encrypted files with MongoDB persistence
// This provides persistent storage with sessionStorage as backup for offline access

import ApiClient from '../lib/api';

export interface SessionFile {
  id: string;
  filename: string;
  originalName: string;
  encryptedData: Uint8Array;
  metadata: any;
  timestamp: string;
  algorithm: string;
  mode: 'single' | 'multi' | 'folder';
  size: number;
  type: 'encrypted' | 'signed';
  signature?: string;
  publicKey?: string;
  // Add MongoDB persistence fields
  _id?: string;
  user_id?: string;
  uploaded_at?: string;
  last_accessed?: string;
  isPersisted?: boolean; // Track if file is saved to MongoDB
}

class SessionFileManager {
  private static readonly STORAGE_KEY_PREFIX = 'session_encrypted_files';
  private static readonly BACKUP_KEY_PREFIX = 'session_encrypted_files_backup';
  private static readonly VERSION_KEY_PREFIX = 'session_storage_version';
  private static readonly CURRENT_VERSION = '1.0';
  private static readonly MAX_FILES = 50; // Limit to prevent memory issues
  private static readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit

  // Get user-specific storage keys
  private static getUserStorageKey(): string {
    const userId = this.getCurrentUserId();
    return `${this.STORAGE_KEY_PREFIX}_${userId}`;
  }

  private static getUserBackupKey(): string {
    const userId = this.getCurrentUserId();
    return `${this.BACKUP_KEY_PREFIX}_${userId}`;
  }

  private static getUserVersionKey(): string {
    const userId = this.getCurrentUserId();
    return `${this.VERSION_KEY_PREFIX}_${userId}`;
  }

  // Get current user ID from auth context or session
  private static getCurrentUserId(): string {
    try {
      // Try to get from localStorage first (persisted login)
      const authData = localStorage.getItem('auth_user');
      if (authData) {
        const user = JSON.parse(authData);
        if (user.id || user.sub) {
          return user.id || user.sub;
        }
      }

      // Try to get from sessionStorage (session login)
      const sessionAuth = sessionStorage.getItem('auth_user');
      if (sessionAuth) {
        const user = JSON.parse(sessionAuth);
        if (user.id || user.sub) {
          return user.id || user.sub;
        }
      }

      // Fallback to a guest user ID (for demo purposes)
      return 'guest_user';
    } catch (error) {
      console.warn('Failed to get current user ID, using guest:', error);
      return 'guest_user';
    }
  }

  // Validate file data structure
  private static validateFileData(file: any): boolean {
    return (
      file &&
      typeof file.id === 'string' &&
      typeof file.filename === 'string' &&
      typeof file.originalName === 'string' &&
      file.encryptedData &&
      file.metadata &&
      typeof file.timestamp === 'string' &&
      typeof file.algorithm === 'string' &&
      typeof file.mode === 'string' &&
      typeof file.size === 'number' &&
      typeof file.type === 'string'
    );
  }

  // Check and migrate storage version if needed
  private static checkStorageVersion(): void {
    const versionKey = this.getUserVersionKey();
    const currentVersion = sessionStorage.getItem(versionKey);
    if (currentVersion !== this.CURRENT_VERSION) {
      console.log('Session storage version mismatch, clearing old data for user');
      this.clearAll();
      sessionStorage.setItem(versionKey, this.CURRENT_VERSION);
    }
  }

  // Get all files from session and MongoDB with enhanced error handling
  static async getFiles(): Promise<SessionFile[]> {
    try {
      this.checkStorageVersion();

      // First, try to load from MongoDB
      let mongoFiles: SessionFile[] = [];
      try {
        mongoFiles = await this.loadFromMongoDB();
        console.log(`Loaded ${mongoFiles.length} files from MongoDB`);
      } catch (error) {
        console.warn('Failed to load from MongoDB, using session storage only:', error);
      }

      // Then load from session storage
      const storageKey = this.getUserStorageKey();
      const stored = sessionStorage.getItem(storageKey);
      let sessionFiles: SessionFile[] = [];

      if (stored) {
        const files = JSON.parse(stored);

        // Validate data structure
        if (!Array.isArray(files)) {
          console.warn('Session storage corrupted: not an array, clearing');
          this.clearAll();
        } else {
          // Filter out corrupted files and convert data
          sessionFiles = files
            .filter(file => {
              if (!this.validateFileData(file)) {
                console.warn('Removing corrupted file from session:', file);
                return false;
              }
              return true;
            })
            .map((file: any) => ({
              ...file,
              encryptedData: Array.isArray(file.encryptedData)
                ? new Uint8Array(file.encryptedData)
                : new Uint8Array(Object.values(file.encryptedData))
            }));
        }
      }

      // Merge MongoDB and session files, prioritizing MongoDB data
      const mergedFiles = this.mergeFiles(mongoFiles, sessionFiles);

      // Save merged files back to session storage
      this.saveFiles(mergedFiles);

      return mergedFiles;
    } catch (error) {
      console.error('Error loading files:', error);

      // Try to restore from backup
      try {
        const backupKey = this.getUserBackupKey();
        const backup = sessionStorage.getItem(backupKey);
        if (backup) {
          console.log('Attempting to restore from backup');
          const storageKey = this.getUserStorageKey();
          sessionStorage.setItem(storageKey, backup);
          return this.getFiles(); // Recursive call to process backup
        }
      } catch (backupError) {
        console.error('Backup restoration failed:', backupError);
      }

      // Clear corrupted data and return empty array
      this.clearAll();
      return [];
    }
  }

  // Save files with backup and size checking
  private static saveFiles(files: SessionFile[]): void {
    try {
      const storageKey = this.getUserStorageKey();
      const backupKey = this.getUserBackupKey();

      // Convert Uint8Array to plain object for storage
      const storableFiles = files.map(f => ({
        ...f,
        encryptedData: Array.from(f.encryptedData)
      }));

      const dataString = JSON.stringify(storableFiles);

      // Check storage size limit
      if (dataString.length > this.MAX_STORAGE_SIZE) {
        console.warn('Session storage size limit exceeded, removing oldest files');
        // Remove oldest files until under limit
        while (storableFiles.length > 0 && JSON.stringify(storableFiles).length > this.MAX_STORAGE_SIZE) {
          storableFiles.shift();
        }
        const newDataString = JSON.stringify(storableFiles);

        // Create backup before saving
        const currentData = sessionStorage.getItem(storageKey);
        if (currentData) {
          sessionStorage.setItem(backupKey, currentData);
        }

        sessionStorage.setItem(storageKey, newDataString);
      } else {
        // Create backup before saving
        const currentData = sessionStorage.getItem(storageKey);
        if (currentData) {
          sessionStorage.setItem(backupKey, currentData);
        }

        sessionStorage.setItem(storageKey, dataString);
      }
    } catch (error) {
      console.error('Error saving session files:', error);
      throw new Error('Failed to save files to session storage');
    }
  }
  
  // Add a new encrypted file to session and persist to MongoDB
  static async addFile(file: Omit<SessionFile, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Validate input data
      if (!file.filename || !file.originalName || !file.encryptedData || !file.algorithm) {
        throw new Error('Invalid file data: missing required fields');
      }

      const files = await this.getFiles();

      // Remove oldest files if we exceed limit
      if (files.length >= this.MAX_FILES) {
        files.splice(0, files.length - this.MAX_FILES + 1);
      }

      const newFile: SessionFile = {
        ...file,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        // Ensure encryptedData is Uint8Array
        encryptedData: file.encryptedData instanceof Uint8Array
          ? file.encryptedData
          : new Uint8Array(file.encryptedData),
        isPersisted: false
      };

      // Try to persist to MongoDB first
      try {
        const persistedFile = await this.persistToMongoDB(newFile);
        newFile._id = persistedFile._id;
        newFile.isPersisted = true;
        console.log(`File persisted to MongoDB: ${newFile.filename}`);
      } catch (error) {
        console.warn(`Failed to persist to MongoDB, keeping in session only: ${error}`);
        newFile.isPersisted = false;
      }

      files.push(newFile);

      // Use the new saveFiles method
      this.saveFiles(files);

      console.log(`Added file to session: ${newFile.filename} (${newFile.type}, ${newFile.algorithm})`);
      return newFile.id;
    } catch (error) {
      console.error('Error adding session file:', error);
      throw new Error(`Failed to save file to session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Persist file to MongoDB
  private static async persistToMongoDB(file: SessionFile): Promise<any> {
    try {
      // Convert Uint8Array to base64 for transmission
      const encryptedDataBase64 = btoa(String.fromCharCode(...file.encryptedData));

      const fileData = {
        filename: file.filename,
        original_name: file.originalName,
        encrypted_data: encryptedDataBase64,
        metadata: file.metadata,
        algorithm: file.algorithm,
        mode: file.mode,
        size: file.size,
        type: file.type,
        signature: file.signature,
        public_key: file.publicKey,
        timestamp: file.timestamp
      };

      const response = await ApiClient.post('/files/persist', fileData);
      return response;
    } catch (error) {
      console.error('Error persisting to MongoDB:', error);
      throw error;
    }
  }

  // Load files from MongoDB
  private static async loadFromMongoDB(): Promise<SessionFile[]> {
    try {
      // Check if user is authenticated first
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('No authentication token found, skipping MongoDB load');
        return [];
      }

      const response = await ApiClient.get('/encrypted/user-files');
      const mongoFiles = response.files || [];

      console.log('📊 MongoDB files received:', mongoFiles);

      return mongoFiles.map((file: any) => {
        // Debug individual file mapping with actual MongoDB structure
        console.log('📊 Mapping file:', {
          id: file.id,
          original_name: file.original_name,
          filename: file.filename,
          file_size: file.file_size,
          size: file.size,
          encryption_algorithm: file.encryption_algorithm,
          algorithm: file.algorithm,
          uploaded_at: file.uploaded_at
        });

        // Use actual MongoDB field names
        const fileSize = file.file_size || file.size || file.original_size || 0;
        const algorithm = file.encryption_algorithm || file.algorithm || 'Unknown';
        const filename = file.original_name || file.filename || 'Unknown';
        const timestamp = file.uploaded_at || file.created_at || file.timestamp;

        return {
          id: file.id || file._id,
          _id: file._id,
          filename: filename,
          originalName: file.original_name || filename,
          encryptedName: file.encrypted_name,
          encryptedData: file.encrypted_data
            ? new Uint8Array(atob(file.encrypted_data).split('').map(c => c.charCodeAt(0)))
            : new Uint8Array(),
          metadata: file.metadata || {},
          timestamp: timestamp,
          algorithm: algorithm,
          encryption_algorithm: algorithm,
          mode: file.mode || 'single',
          size: fileSize,
          file_size: fileSize,
          original_size: fileSize,
          type: file.type || 'encrypted',
          mime_type: file.mime_type,
          file_hash: file.file_hash,
          signature: file.signature,
          signature_algorithm: file.signature_algorithm,
          publicKey: file.public_key,
          nonce: file.nonce,
          salt: file.salt,
          key_derivation_function: file.key_derivation_function,
          user_id: file.user_id,
          uploaded_at: file.uploaded_at,
          created_at: file.created_at,
          last_accessed: file.last_accessed,
          description: file.description,
          tags: file.tags || [],
          isPersisted: true
        };
      });
    } catch (error) {
      console.log('MongoDB not available, using local storage only');
      return [];
    }
  }

  // Merge MongoDB and session files, avoiding duplicates
  private static mergeFiles(mongoFiles: SessionFile[], sessionFiles: SessionFile[]): SessionFile[] {
    const merged = [...mongoFiles];
    const mongoIds = new Set(mongoFiles.map(f => f.id));

    // Add session files that aren't already in MongoDB
    for (const sessionFile of sessionFiles) {
      if (!mongoIds.has(sessionFile.id)) {
        merged.push(sessionFile);
      }
    }

    // Sort by timestamp (newest first)
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Get a specific file by ID (async version)
  static async getFile(id: string): Promise<SessionFile | null> {
    const files = await this.getFiles();
    return files.find(f => f.id === id) || null;
  }

  // Get a specific file by ID (synchronous version for session storage only)
  static getFileSync(id: string): SessionFile | null {
    try {
      const storageKey = this.getUserStorageKey();
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) return null;

      const files = JSON.parse(stored);
      if (!Array.isArray(files)) return null;

      const file = files.find((f: any) => f.id === id);
      if (!file) return null;

      return {
        ...file,
        encryptedData: Array.isArray(file.encryptedData)
          ? new Uint8Array(file.encryptedData)
          : new Uint8Array(Object.values(file.encryptedData))
      };
    } catch (error) {
      console.error('Error getting file sync:', error);
      return null;
    }
  }

  // Remove a file from session
  static async removeFile(id: string): Promise<boolean> {
    try {
      const files = await this.getFiles();
      const initialLength = files.length;
      const filteredFiles = files.filter(f => f.id !== id);

      if (filteredFiles.length === initialLength) {
        console.warn(`File with id ${id} not found in session`);
        return false;
      }

      this.saveFiles(filteredFiles);
      console.log(`Removed file from session: ${id}`);
      return true;
    } catch (error) {
      console.error('Error removing session file:', error);
      return false;
    }
  }

  // Clear all session files for current user
  static clearAll(): void {
    try {
      const storageKey = this.getUserStorageKey();
      const backupKey = this.getUserBackupKey();
      const versionKey = this.getUserVersionKey();

      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(backupKey);
      sessionStorage.removeItem(versionKey);
      console.log('Cleared all session storage data for current user');
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }
  }

  // Clear all session files for all users (admin function)
  static clearAllUsers(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.startsWith(this.STORAGE_KEY_PREFIX) ||
          key.startsWith(this.BACKUP_KEY_PREFIX) ||
          key.startsWith(this.VERSION_KEY_PREFIX)
        )) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      console.log(`Cleared session storage data for all users (${keysToRemove.length} keys)`);
    } catch (error) {
      console.error('Error clearing all users session storage:', error);
    }
  }

  // Migrate legacy session data to user-specific storage
  static migrateLegacyData(): void {
    try {
      const legacyKey = 'session_encrypted_files';
      const legacyData = sessionStorage.getItem(legacyKey);

      if (legacyData) {
        console.log('Found legacy session data, migrating to user-specific storage');

        // Parse legacy data
        const files = JSON.parse(legacyData);
        if (Array.isArray(files) && files.length > 0) {
          // Get current user storage key
          const userStorageKey = this.getUserStorageKey();

          // Check if user-specific data already exists
          const existingData = sessionStorage.getItem(userStorageKey);
          if (!existingData) {
            // Migrate legacy data to user-specific storage
            sessionStorage.setItem(userStorageKey, legacyData);
            console.log(`Migrated ${files.length} files to user-specific storage`);
          } else {
            console.log('User-specific data already exists, skipping migration');
          }
        }

        // Remove legacy data
        sessionStorage.removeItem(legacyKey);
        sessionStorage.removeItem('session_encrypted_files_backup');
        sessionStorage.removeItem('session_storage_version');
        console.log('Removed legacy session storage keys');
      }
    } catch (error) {
      console.error('Error migrating legacy session data:', error);
    }
  }
  
  // Get files with pagination and filtering (synchronous version for existing files array)
  static getFilesWithPaginationFromArray(
    allFiles: SessionFile[],
    page: number = 1,
    limit: number = 10,
    search?: string,
    algorithm?: string
  ): {
    files: SessionFile[];
    total: number;
    totalPages: number;
    currentPage: number;
  } {
    let files = [...allFiles];

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      files = files.filter(f =>
        f.filename.toLowerCase().includes(searchLower) ||
        f.originalName.toLowerCase().includes(searchLower)
      );
    }

    if (algorithm) {
      files = files.filter(f => f.algorithm === algorithm);
    }

    // Sort by timestamp (newest first)
    files.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = files.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      files: files.slice(startIndex, endIndex),
      total,
      totalPages,
      currentPage: page
    };
  }

  // Get files with pagination and filtering (async version that loads from MongoDB)
  static async getFilesWithPagination(
    page: number = 1,
    limit: number = 10,
    search?: string,
    algorithm?: string
  ): Promise<{
    files: SessionFile[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const allFiles = await this.getFiles();
    return this.getFilesWithPaginationFromArray(allFiles, page, limit, search, algorithm);
  }
  
  // Get storage usage info
  static async getStorageInfo(): Promise<{
    fileCount: number;
    totalSize: number;
    maxSize: number;
  }> {
    const files = await this.getFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    return {
      fileCount: files.length,
      totalSize,
      maxSize: this.MAX_FILES
    };
  }

  // Export file for download
  static async downloadFile(id: string): Promise<void> {
    const file = await this.getFile(id);
    if (!file) {
      throw new Error('File not found');
    }

    // Create download blob with metadata
    const metadataJson = JSON.stringify(file.metadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);
    const metadataLength = new Uint32Array([metadataBytes.length]);

    // Combine metadata length + metadata + encrypted data
    const combinedData = new Uint8Array(
      4 + metadataBytes.length + file.encryptedData.length
    );

    combinedData.set(new Uint8Array(metadataLength.buffer), 0);
    combinedData.set(metadataBytes, 4);
    combinedData.set(file.encryptedData, 4 + metadataBytes.length);

    const blob = new Blob([combinedData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default SessionFileManager;
