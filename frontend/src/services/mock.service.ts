// Mock Service - Thay thế tất cả API calls thiếu
// Sẽ tự động switch sang real API khi backend sẵn sàng

import type { 
  FileEncryptionMetadata,
  EncryptFileRequest,
  EncryptFileResponse,
  DashboardStats
} from '../types/api';

class MockService {
  private static isBackendAvailable = false;

  // Check nếu backend có sẵn
  static async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/health', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      this.isBackendAvailable = response.ok;
      return this.isBackendAvailable;
    } catch {
      this.isBackendAvailable = false;
      return false;
    }
  }

  // Mock data
  private static mockFiles: FileEncryptionMetadata[] = [
    {
      id: 'mock-1',
      filename: 'document.pdf',
      original_size: 2048576,
      encrypted_size: 2098176,
      algorithm: 'AES-256-GCM',
      key_derivation: 'PBKDF2',
      salt: 'mock-salt-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_id: 'mock-user',
      file_hash: 'mock-hash-1',
      is_deleted: false
    },
    {
      id: 'mock-2', 
      filename: 'image.jpg',
      original_size: 1536000,
      encrypted_size: 1546000,
      algorithm: 'XChaCha20-Poly1305',
      key_derivation: 'Argon2id',
      salt: 'mock-salt-2',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      owner_id: 'mock-user',
      file_hash: 'mock-hash-2',
      is_deleted: false
    }
  ];

  private static mockAlgorithms = [
    { 
      name: 'AES-256-GCM', 
      description: 'Advanced Encryption Standard 256-bit với Galois/Counter Mode', 
      key_size: 256,
      type: 'symmetric',
      security_level: 'high',
      performance: 'excellent',
      features: ['authenticated_encryption', 'parallel_processing']
    },
    { 
      name: 'XChaCha20-Poly1305', 
      description: 'XChaCha20 stream cipher với Poly1305 authenticator', 
      key_size: 256,
      type: 'symmetric',
      security_level: 'very_high',
      performance: 'excellent',
      features: ['authenticated_encryption', 'extended_nonce', 'modern_cipher']
    },
    
    { 
      name: 'Serpent-256-EAX', 
      description: 'Serpent 256-bit với EAX mode (authenticated encryption)', 
      key_size: 256,
      type: 'symmetric',
      security_level: 'very_high',
      performance: 'good',
      features: ['authenticated_encryption', 'high_security_margin']
    }
  ];

  // Files API Mock
  static async getFiles(page: number = 1, limit: number = 10, search?: string, algorithm?: string) {
    await this.delay(500); // Simulate network delay
    
    let filteredFiles = [...this.mockFiles];
    
    if (search) {
      filteredFiles = filteredFiles.filter(f => 
        f.filename.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (algorithm) {
      filteredFiles = filteredFiles.filter(f => f.algorithm === algorithm);
    }

    const start = (page - 1) * limit;
    const paginatedFiles = filteredFiles.slice(start, start + limit);

    return {
      data: paginatedFiles,
      total: filteredFiles.length,
      page,
      limit
    };
  }

  static async getUsedAlgorithms(): Promise<string[]> {
    await this.delay(300);
    return this.mockAlgorithms.map(a => a.name);
  }

  static async uploadAndEncryptFile(
    file: File,
    encryptionData: EncryptFileRequest,
    onProgress?: (progress: number) => void
  ): Promise<EncryptFileResponse> {
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await this.delay(100);
      onProgress?.(i);
    }

    const mockFileMetadata: FileEncryptionMetadata = {
      id: `mock-${Date.now()}`,
      filename: file.name,
      original_size: file.size,
      encrypted_size: file.size + 1024,
      algorithm: encryptionData.algorithm,
      key_derivation: encryptionData.key_derivation,
      salt: `mock-salt-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_id: 'mock-user',
      file_hash: `mock-hash-${Date.now()}`,
      is_deleted: false
    };

    this.mockFiles.unshift(mockFileMetadata);

    return {
      file_id: mockFileMetadata.id,
      download_url: `mock://download/${mockFileMetadata.id}`,
      metadata: mockFileMetadata
    };
  }

  static async decryptFile(fileId: string, _password: string) {
    await this.delay(1000);
    const file = this.mockFiles.find(f => f.id === fileId);
    
    if (!file) throw new Error('File not found');
    
    // Simulate download
    const blob = new Blob(['Mock decrypted content'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    
    URL.revokeObjectURL(url);

    return {
      download_url: url,
      file_metadata: file
    };
  }

  static async deleteFile(fileId: string) {
    await this.delay(300);
    const index = this.mockFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      this.mockFiles.splice(index, 1);
    }
  }

  static async updateFile(fileId: string, updates: { filename?: string }) {
    await this.delay(300);
    const file = this.mockFiles.find(f => f.id === fileId);
    if (file && updates.filename) {
      file.filename = updates.filename;
      file.updated_at = new Date().toISOString();
    }
    return file;
  }

  // Dashboard API Mock
  static async getDashboardStats(): Promise<DashboardStats> {
    await this.delay(400);
    return {
      total_files: this.mockFiles.length,
      total_size: this.mockFiles.reduce((sum, f) => sum + f.original_size, 0),
      encrypted_today: 3,
      encryption_algorithms_used: {
        //'AES-256-GCM': 5,
        //'ChaCha20-Poly1305': 3,
        //'AES-256-CBC': 2
      },
      recent_files: this.mockFiles.slice(0, 5)
    };
  }

  static async getAvailableAlgorithms() {
    await this.delay(200);
    return {
      encryption_algorithms: this.mockAlgorithms,
      key_derivation_functions: ['PBKDF2', 'Argon2', 'Scrypt'],
      hash_algorithms: ['BLAKE3', 'SHA256', 'SHA512']
    };
  }

  static async getSystemHealth() {
    await this.delay(300);
    return {
      status: 'healthy' as const,
      services: {
        database: true,
        storage: true,
        encryption: true
      },
      uptime: 86400
    };
  }

  static async getRecentActivity() {
    await this.delay(250);
    return [
      {
        timestamp: new Date().toISOString(),
        action: 'file_encrypted',
        details: 'Đã mã hóa file document.pdf'
      },
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        action: 'login',
        details: 'Đăng nhập thành công'
      }
    ];
  }

  // Utility
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default MockService; 