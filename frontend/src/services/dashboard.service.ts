import ApiClient from '../lib/api';
import MockService from './mock.service';
import SessionFileManager from '../utils/sessionFileManager';
import type {
  DashboardStats
} from '../types/api';

// ==================================================
// DASHBOARD SERVICE - Xử lý các API liên quan đến dashboard với auto-fallback
// ==================================================

export class DashboardService {
  /**
   * Safely convert timestamp to ISO string
   */
  private static safeToISOString(timestamp: any): string {
    try {
      if (!timestamp) return new Date().toISOString();
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return new Date().toISOString();
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  // Auto-detect backend availability
  private static async tryApiCall<T>(
    apiCall: () => Promise<T>,
    mockCall: () => Promise<T>,
    endpoint?: string
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.info(`🔄 API endpoint ${endpoint || 'unknown'} not available, using mock data`);
        return await mockCall();
      }
      throw error;
    }
  }

  // ==================================================
  // DASHBOARD STATISTICS - Thống kê dashboard với fallback
  // ==================================================

  /**
   * Lấy thống kê tổng quan cho dashboard - Sử dụng dữ liệu thực từ session storage và MongoDB
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Try to get real data from backend first
      const response = await ApiClient.get<any>('/dashboard/stats');
      return {
        total_files: response.data.files?.total_files || 0,
        total_size: response.data.files?.total_size || 0,
        encrypted_today: response.data.files?.encrypted_today || 0,
        encryption_algorithms_used: response.data.files?.algorithms_used || {},
        recent_files: response.data.files?.recent_files || []
      };
    } catch (error: any) {
      // Check if it's a real network error or just no data
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        console.info('🔄 Backend not available, using persistent session data');
      } else {
        console.log('📊 Backend available but no data, using session storage');
      }
      return await this.getStatsFromSessionStorage();
    }
  }

  /**
   * Lấy thống kê thực từ session storage và MongoDB (user-specific)
   */
  private static async getStatsFromSessionStorage(): Promise<DashboardStats> {
    try {
      // Use SessionFileManager to get user-specific files from both session and MongoDB
      const sessionFiles = await SessionFileManager.getFiles();
      console.log('📊 Session files for dashboard:', sessionFiles);

      const today = new Date().toDateString();

      // Calculate real statistics from session data
      const totalFiles = sessionFiles.length;
      const totalSize = sessionFiles.reduce((sum: number, file: any) => {
        // Use actual MongoDB field names
        const fileSize = file.file_size || file.size || file.original_size || 0;
        console.log(`📊 File ${file.filename || file.original_name}: size=${fileSize} (file_size=${file.file_size}, size=${file.size})`);
        return sum + fileSize;
      }, 0);

      console.log(`📊 Total files: ${totalFiles}, Total size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
      const encryptedToday = sessionFiles.filter((file: any) => {
        try {
          const timestamp = file.timestamp || file.created_at || Date.now();
          const fileDate = new Date(timestamp);
          if (isNaN(fileDate.getTime())) return false;
          return fileDate.toDateString() === today;
        } catch {
          return false;
        }
      }).length;

      // Count algorithms used
      const algorithmsUsed: Record<string, number> = {};
      sessionFiles.forEach((file: any) => {
        // Use actual MongoDB field names
        const algorithm = file.encryption_algorithm || file.algorithm || 'Unknown';
        const filename = file.filename || file.original_name || 'Unknown';
        console.log(`📊 File ${filename}: algorithm=${algorithm} (encryption_algorithm=${file.encryption_algorithm})`);
        algorithmsUsed[algorithm] = (algorithmsUsed[algorithm] || 0) + 1;
      });

      console.log('📊 Algorithms used:', algorithmsUsed);

      return {
        total_files: totalFiles,
        total_size: totalSize,
        encrypted_today: encryptedToday,
        encryption_algorithms_used: algorithmsUsed,
        recent_files: sessionFiles.slice(-5).reverse().map((file: any) => {
          try {
            // Use actual MongoDB field names
            const fileSize = file.file_size || file.size || file.original_size || 0;
            const algorithm = file.encryption_algorithm || file.algorithm || 'Unknown';
            const filename = file.original_name || file.filename || 'Unknown';
            const timestamp = file.uploaded_at || file.timestamp || file.created_at;

            return {
              id: file.id,
              filename: filename,
              original_name: file.original_name,
              original_size: fileSize,
              encrypted_size: fileSize,
              size: fileSize,
              file_size: fileSize,
              algorithm: algorithm,
              encryption_algorithm: algorithm,
              key_derivation: file.key_derivation_function || 'Argon2id',
              salt: file.salt || '',
              iv: file.nonce || '',
              checksum: file.file_hash || '',
              timestamp: timestamp,
              encryption_mode: 'password',
              version: '1.0.0',
              created_at: this.safeToISOString(timestamp),
              updated_at: this.safeToISOString(timestamp),
              uploaded_at: this.safeToISOString(file.uploaded_at),
              owner_id: file.user_id || 'user',
              file_hash: file.file_hash || '',
              is_deleted: false,
              mime_type: file.mime_type,
              signature: file.signature,
              is_signed: !!file.signature
            };
          } catch (error) {
            console.warn('Error processing file for recent_files:', error, file);
            return null;
          }
        }).filter(Boolean) // Remove null entries
      };
    } catch (error) {
      console.error('Error reading session storage:', error);
      // Return empty stats if session storage fails
      return {
        total_files: 0,
        total_size: 0,
        encrypted_today: 0,
        encryption_algorithms_used: {},
        recent_files: []
      };
    }
  }

  /**
   * Lấy danh sách file gần đây - Sử dụng dữ liệu thực từ session storage
   */
  static async getRecentFiles(limit: number = 10): Promise<any[]> {
    try {
      // Try to get real data from backend first
      const response = await ApiClient.get<any>('/dashboard/files/recent', { limit });
      return response.data || [];
    } catch (error: any) {
      // Use real session data instead of mock data
      console.info('🔄 Backend not available, using real session data for recent files');
      return this.getRecentFilesFromSessionStorage(limit);
    }
  }

  /**
   * Lấy danh sách file gần đây từ session storage (user-specific)
   */
  private static async getRecentFilesFromSessionStorage(limit: number = 10): Promise<any[]> {
    try {
      // Use SessionFileManager to get user-specific files
      const sessionFiles = SessionFileManager.getFiles();

      // Sort by timestamp (most recent first) and limit results
      const allFiles = await sessionFiles;
      return allFiles
        .sort((a: any, b: any) => {
          const dateA = new Date(a.timestamp || a.created_at || 0).getTime();
          const dateB = new Date(b.timestamp || b.created_at || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, limit)
        .map((file: any) => ({
          id: file.id || Date.now().toString(),
          filename: file.filename || file.originalName || 'Unknown File',
          original_size: file.size || 0,
          encrypted_size: file.size || 0,
          algorithm: file.algorithm || 'Unknown',
          created_at: file.timestamp || file.created_at || new Date().toISOString(),
          file_hash: file.metadata?.fileHash || 'unknown'
        }));
    } catch (error) {
      console.error('Error reading recent files from session storage:', error);
      return [];
    }
  }

  /**
   * Lấy danh sách thuật toán mã hóa có sẵn - Auto fallback to mock
   */
  static async getAvailableAlgorithms(): Promise<any> {
    return this.tryApiCall(
      () => ApiClient.get<any>('/crypto/algorithms'),
      () => MockService.getAvailableAlgorithms(),
      'GET /crypto/algorithms'
    );
  }

  /**
   * Kiểm tra trạng thái hệ thống - Sử dụng trạng thái thực
   */
  static async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    services: {
      database: boolean;
      storage: boolean;
      encryption: boolean;
    };
    uptime: number;
  }> {
    try {
      // Try to get real data from backend first
      const response = await ApiClient.get<any>('/dashboard/system/health');
      return {
        status: response.data.status || 'healthy',
        services: {
          database: response.data.database || true,
          storage: response.data.storage || true,
          encryption: response.data.security || true
        },
        uptime: response.data.uptime || 0
      };
    } catch (error: any) {
      // Return real system status based on frontend capabilities
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        console.info('🔄 Backend not available, checking frontend system health');
      } else {
        console.log('🏥 Backend available, using frontend health check');
      }
      return this.getFrontendSystemHealth();
    }
  }

  /**
   * Kiểm tra trạng thái hệ thống từ frontend
   */
  private static getFrontendSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    services: {
      database: boolean;
      storage: boolean;
      encryption: boolean;
    };
    uptime: number;
  } {
    try {
      // Check if session storage is working
      const storageWorking = (() => {
        try {
          sessionStorage.setItem('test', 'test');
          sessionStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })();

      // Check if crypto APIs are available
      const encryptionWorking = typeof crypto !== 'undefined' &&
                               typeof crypto.subtle !== 'undefined';

      // Check if we have any session data (indicates database-like functionality)
      const sessionFiles = SessionFileManager.getFiles();
      const databaseWorking = Array.isArray(sessionFiles);

      const allServicesWorking = storageWorking && encryptionWorking && databaseWorking;
      const someServicesWorking = storageWorking || encryptionWorking || databaseWorking;

      return {
        status: allServicesWorking ? 'healthy' : someServicesWorking ? 'warning' : 'critical',
        services: {
          database: databaseWorking,
          storage: storageWorking,
          encryption: encryptionWorking
        },
        uptime: Date.now() - (parseInt(sessionStorage.getItem('appStartTime') || '0') || Date.now())
      };
    } catch (error) {
      console.error('Error checking frontend system health:', error);
      return {
        status: 'critical',
        services: {
          database: false,
          storage: false,
          encryption: false
        },
        uptime: 0
      };
    }
  }

  /**
   * Lấy activity log gần đây - Sử dụng dữ liệu thực từ session storage
   */
  static async getRecentActivity(limit: number = 20): Promise<{
    timestamp: string;
    action: string;
    details: string;
    ip_address?: string;
  }[]> {
    try {
      // Try to get real data from backend first
      const response = await ApiClient.get<any>('/dashboard/activity/recent', { limit });
      return response.data || [];
    } catch (error: any) {
      // Generate real activity from session data
      console.info('🔄 Backend not available, generating real activity from session data');
      return this.getActivityFromSessionStorage(limit);
    }
  }

  /**
   * Tạo activity log từ session storage
   */
  private static async getActivityFromSessionStorage(limit: number = 20): Promise<{
    timestamp: string;
    action: string;
    details: string;
    ip_address?: string;
  }[]> {
    try {
      // Use SessionFileManager to get user-specific files
      const sessionFiles = SessionFileManager.getFiles();
      const activities: any[] = [];

      // Generate activities from file operations
      const allFiles = await sessionFiles;
      allFiles.forEach((file: any) => {
        activities.push({
          timestamp: file.timestamp || file.created_at || new Date().toISOString(),
          action: 'file_encrypted',
          details: `Encrypted file: ${file.filename || file.originalName || 'Unknown'} using ${file.algorithm || 'Unknown algorithm'}`,
          ip_address: 'localhost'
        });
      });

      // Add login activity if user is logged in
      const loginTime = sessionStorage.getItem('loginTime');
      if (loginTime) {
        activities.push({
          timestamp: loginTime,
          action: 'user_login',
          details: 'User logged in successfully',
          ip_address: 'localhost'
        });
      }

      // Sort by timestamp (most recent first) and limit
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error generating activity from session storage:', error);
      return [];
    }
  }

  /**
   * Lấy thống kê sử dụng thuật toán mã hóa - Auto fallback to mock  
   */
  static async getAlgorithmUsageStats(days: number = 30): Promise<Record<string, number>> {
    return this.tryApiCall(
      () => ApiClient.get<Record<string, number>>('/dashboard/algorithm-usage', { days }),
      async () => {
        const stats = await MockService.getDashboardStats();
        return stats.encryption_algorithms_used;
      },
      'GET /dashboard/algorithm-usage'
    );
  }

  /**
   * Lấy thống kê storage usage - Auto fallback to mock
   */
  static async getStorageStats(): Promise<{
    total_files: number;
    total_size: number;
    average_file_size: number;
    storage_used_percentage: number;
  }> {
    return this.tryApiCall(
      () => ApiClient.get('/dashboard/storage'),
      async () => {
        const stats = await MockService.getDashboardStats();
        return {
          total_files: stats.total_files,
          total_size: stats.total_size,
          average_file_size: stats.total_files > 0 ? Math.round(stats.total_size / stats.total_files) : 0,
          storage_used_percentage: 15 // Mock 15%
        };
      },
      'GET /dashboard/storage'
    );
  }
} 