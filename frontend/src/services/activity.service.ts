/**
 * Activity Service - Frontend service for logging user activities
 * ============================================================
 * Handles logging of all encryption, decryption, and signature activities
 * to both session storage and backend database.
 */

import ApiClient from '../lib/api';

export interface ActivityLogRequest {
  activity_type: 'encryption' | 'decryption' | 'digital_signature' | 'signature_verification' | 'key_generation';
  description: string;
  status?: 'success' | 'failed' | 'in_progress';
  file_name?: string;
  file_size?: number;
  algorithm?: string;
  encryption_mode?: 'single' | 'multi' | 'hybrid' | 'folder';
  error_message?: string;
  error_code?: string;
  details?: Record<string, any>;
}

export class ActivityService {
  private static readonly SESSION_KEY_PREFIX = 'user_activities';
  private static readonly MAX_SESSION_ACTIVITIES = 100;

  // Get user-specific storage key
  private static getUserActivityKey(): string {
    try {
      // Try to get from localStorage first (persisted login)
      const authData = localStorage.getItem('auth_user');
      if (authData) {
        const user = JSON.parse(authData);
        const userId = user.id || user.sub;
        if (userId) {
          return `${this.SESSION_KEY_PREFIX}_${userId}`;
        }
      }

      // Try to get from sessionStorage (session login)
      const sessionAuth = sessionStorage.getItem('auth_user');
      if (sessionAuth) {
        const user = JSON.parse(sessionAuth);
        const userId = user.id || user.sub;
        if (userId) {
          return `${this.SESSION_KEY_PREFIX}_${userId}`;
        }
      }

      // Fallback to guest user
      return `${this.SESSION_KEY_PREFIX}_guest_user`;
    } catch (error) {
      console.warn('Failed to get user ID for activity storage, using guest:', error);
      return `${this.SESSION_KEY_PREFIX}_guest_user`;
    }
  }

  /**
   * Log activity to both session storage and backend
   */
  static async logActivity(request: ActivityLogRequest): Promise<void> {
    try {
      // Always log to session storage first (for offline capability)
      this.logToSession(request);

      // Try to log to backend
      try {
        await ApiClient.post('/activity/log', request);
        console.log('Activity logged to backend:', request.activity_type);
      } catch (backendError) {
        console.warn('Failed to log activity to backend, using session storage only:', backendError);
        // Don't throw error - session storage logging is sufficient for offline mode
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid disrupting user workflow
    }
  }

  /**
   * Log to session storage
   */
  private static logToSession(request: ActivityLogRequest): void {
    try {
      const activities = this.getSessionActivities();
      
      const newActivity = {
        ...request,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        status: request.status || 'success'
      };

      activities.push(newActivity);

      // Keep only the most recent activities
      if (activities.length > this.MAX_SESSION_ACTIVITIES) {
        activities.splice(0, activities.length - this.MAX_SESSION_ACTIVITIES);
      }

      const activityKey = this.getUserActivityKey();
      sessionStorage.setItem(activityKey, JSON.stringify(activities));
      console.log('Activity logged to session:', request.activity_type);
    } catch (error) {
      console.error('Failed to log activity to session storage:', error);
    }
  }

  /**
   * Get activities from session storage
   */
  static getSessionActivities(): any[] {
    try {
      const activityKey = this.getUserActivityKey();
      const stored = sessionStorage.getItem(activityKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to read session activities:', error);
      return [];
    }
  }

  /**
   * Quick logging methods for common activities
   */
  static async logEncryption(
    fileName: string,
    algorithm: string,
    mode: 'single' | 'multi' | 'hybrid' | 'folder' = 'single',
    fileSize?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.logActivity({
      activity_type: 'encryption',
      description: `Mã hóa file "${fileName}" bằng ${algorithm}`,
      status: success ? 'success' : 'failed',
      file_name: fileName,
      file_size: fileSize,
      algorithm,
      encryption_mode: mode,
      error_message: errorMessage,
      details: {
        encryption_mode: mode,
        file_count: mode === 'multi' ? 'multiple' : 1
      }
    });
  }

  static async logDecryption(
    fileName: string,
    algorithm: string,
    fileSize?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.logActivity({
      activity_type: 'decryption',
      description: `Giải mã file "${fileName}" (thuật toán ${algorithm})`,
      status: success ? 'success' : 'failed',
      file_name: fileName,
      file_size: fileSize,
      algorithm,
      error_message: errorMessage
    });
  }

  static async logDigitalSignature(
    fileName: string,
    algorithm: string,
    fileSize?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.logActivity({
      activity_type: 'digital_signature',
      description: `Ký số file "${fileName}" bằng ${algorithm}`,
      status: success ? 'success' : 'failed',
      file_name: fileName,
      file_size: fileSize,
      algorithm,
      error_message: errorMessage,
      details: {
        signature_algorithm: algorithm
      }
    });
  }

  static async logSignatureVerification(
    fileName: string,
    algorithm: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.logActivity({
      activity_type: 'signature_verification',
      description: `Xác thực chữ ký file "${fileName}" (${algorithm})`,
      status: success ? 'success' : 'failed',
      file_name: fileName,
      algorithm,
      error_message: errorMessage,
      details: {
        verification_result: success ? 'valid' : 'invalid'
      }
    });
  }

  static async logKeyGeneration(
    algorithm: string,
    keyType: 'encryption' | 'signature' = 'encryption',
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.logActivity({
      activity_type: 'key_generation',
      description: `Tạo key pair ${algorithm} cho ${keyType === 'encryption' ? 'mã hóa' : 'ký số'}`,
      status: success ? 'success' : 'failed',
      algorithm,
      error_message: errorMessage,
      details: {
        key_type: keyType,
        algorithm
      }
    });
  }

  /**
   * Get activity statistics from session storage
   */
  static getActivityStats(): {
    total: number;
    today: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recent: any[];
  } {
    try {
      const activities = this.getSessionActivities();
      const today = new Date().toDateString();

      const stats = {
        total: activities.length,
        today: activities.filter(a => new Date(a.timestamp).toDateString() === today).length,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        recent: activities.slice(-10).reverse()
      };

      // Count by type and status
      activities.forEach(activity => {
        stats.byType[activity.activity_type] = (stats.byType[activity.activity_type] || 0) + 1;
        stats.byStatus[activity.status] = (stats.byStatus[activity.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get activity stats:', error);
      return {
        total: 0,
        today: 0,
        byType: {},
        byStatus: {},
        recent: []
      };
    }
  }

  /**
   * Clear all session activities for current user
   */
  static clearSessionActivities(): void {
    try {
      const activityKey = this.getUserActivityKey();
      sessionStorage.removeItem(activityKey);
      console.log('Cleared all session activities for current user');
    } catch (error) {
      console.error('Failed to clear session activities:', error);
    }
  }
}

export default ActivityService;
