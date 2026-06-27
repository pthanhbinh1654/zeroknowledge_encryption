import ApiClient from '../lib/api';
import MockService from './mock.service';

// ==================================================
// USER SERVICE - Xử lý các API liên quan đến user với auto-fallback
// ==================================================

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_verified: boolean;
  twofa_enabled: boolean;
  created_at: string;
  last_login?: string;
}

export interface UserStats {
  total_files: number;
  total_size: number;
  last_activity: string;
  encryption_count: number;
  decryption_count: number;
}

export interface UserSettings {
  notifications: {
    email_enabled: boolean;
    security_alerts: boolean;
    activity_summary: boolean;
  };
  security: {
    session_timeout: number;
    require_2fa: boolean;
    login_notifications: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
  };
}

export class UserService {
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

  /**
   * Lấy thông tin profile user hiện tại
   */
  static async getCurrentUser(): Promise<UserProfile> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.get<any>('/auth/me');
        return {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          is_verified: response.user.is_verified,
          twofa_enabled: response.user.twofa_enabled,
          created_at: response.user.created_at,
          last_login: response.user.last_login
        };
      },
      async () => {
        // Read 2FA state from localStorage for persistence
        const stored2FA = localStorage.getItem('user_2fa_enabled');
        const twofa_enabled = stored2FA ? stored2FA === 'true' : false;

        return {
          id: 'mock-user-id',
          username: 'demo_user',
          email: 'demo@example.com',
          is_verified: true,
          twofa_enabled,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        };
      },
      'GET /auth/me'
    );
  }

  /**
   * Lấy thống kê hoạt động của user
   */
  static async getUserStats(): Promise<UserStats> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.get<any>('/user/stats');
        return {
          total_files: response.total_files || 0,
          total_size: response.total_size || 0,
          last_activity: response.last_activity || new Date().toISOString(),
          encryption_count: response.encryption_count || 0,
          decryption_count: response.decryption_count || 0
        };
      },
      async () => ({
        total_files: 12,
        total_size: 1024 * 1024 * 50, // 50MB
        last_activity: new Date().toISOString(),
        encryption_count: 8,
        decryption_count: 4
      }),
      'GET /user/stats'
    );
  }

  /**
   * Lấy cài đặt user
   */
  static async getUserSettings(): Promise<UserSettings> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.get<any>('/user/settings');
        return response.data || response;
      },
      async () => ({
        notifications: {
          email_enabled: true,
          security_alerts: true,
          activity_summary: false
        },
        security: {
          session_timeout: 30,
          require_2fa: false,
          login_notifications: true
        },
        preferences: {
          theme: 'dark' as const,
          language: 'vi',
          timezone: 'Asia/Ho_Chi_Minh'
        }
      }),
      'GET /user/settings'
    );
  }

  /**
   * Cập nhật cài đặt user
   */
  static async updateUserSettings(settings: Partial<UserSettings>): Promise<boolean> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.put('/user/settings', settings);
        return response.success || true;
      },
      async () => {
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      },
      'PUT /user/settings'
    );
  }

  /**
   * Cập nhật profile user
   */
  static async updateProfile(data: { username?: string; full_name?: string; email?: string }): Promise<boolean> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.put('/user/me', data);
        return response.success;
      },
      async () => {
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      },
      'PUT /user/me'
    );
  }

  /**
   * Đổi mật khẩu
   */
  static async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.post('/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword
        });
        return response.success;
      },
      async () => {
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      },
      'POST /auth/change-password'
    );
  }

  /**
   * Bật/tắt 2FA
   */
  static async toggle2FA(enable: boolean): Promise<{ success: boolean; qr_code?: string }> {
    return this.tryApiCall(
      async () => {
        const response = await ApiClient.post('/auth/2fa/toggle', { enable });

        // Persist 2FA state to localStorage for consistency
        localStorage.setItem('user_2fa_enabled', enable.toString());

        return {
          success: response.success || true,
          qr_code: response.qr_code
        };
      },
      async () => {
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Persist 2FA state to localStorage when backend is not available
        localStorage.setItem('user_2fa_enabled', enable.toString());

        return {
          success: true,
          qr_code: enable ? 'data:image/png;base64,mock-qr-code' : undefined
        };
      },
      'POST /auth/2fa/toggle'
    );
  }
}
