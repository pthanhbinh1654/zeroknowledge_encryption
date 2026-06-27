import ApiClient, { TokenManager } from '../lib/api';
import type { User, LoginResponse, RegisterResponse } from '../types/api';

type LoginAPIResponse = LoginResponse & {
  refresh_token?: string;
  token_type?: string;
  expires_at?: string | number;
  refresh_expires_at?: string | number;
  user?: User;
  development_otp?: string;
  require_verification?: boolean;
};

// ==================================================
// AUTHENTICATION SERVICE - Xử lý các API liên quan đến xác thực
// ==================================================

export class AuthService {
  // ==================================================
  // LOGIN & REGISTER - Đăng nhập và đăng ký
  // ==================================================

  /**
   * Đăng nhập người dùng
   * @param credentials Thông tin đăng nhập (email, password, totp_code)
   * @returns Promise với thông tin user và tokens
   */
  static async login(
    credentials: {
      email: string;
      password: string;
      require_otp?: boolean;
      otp_code?: string;
      captcha_token?: string;
      totp_code?: string;
    }
  ): Promise<LoginAPIResponse> {
    const response = await ApiClient.post<LoginAPIResponse>('/auth/login', credentials);
    
    if (response.success && response.access_token) {
      TokenManager.setTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token || '',
        token_type: response.token_type || 'bearer',
        expires_in: 3600,
      });
      if (response.user) {
        AuthService.setCurrentUser(response.user);
      }
    }
    
    return response;
  }

  /**
   * Xác thực OTP cho 2FA login
   */
  static async verifyOTP(
    email: string,
    otp: string,
    options?: { purpose?: 'login' | 'registration'; password?: string }
  ): Promise<LoginAPIResponse> {
    const purpose = options?.purpose || 'login';
    
    if (purpose === 'login') {
      // Đúng flow: xác thực OTP đăng nhập bằng cách gọi lại /auth/login cùng mật khẩu và otp_code
      if (!options?.password) {
        throw new Error('Thiếu mật khẩu để xác thực OTP đăng nhập');
      }
      const response = await ApiClient.post<LoginAPIResponse>('/auth/login', {
        email,
        password: options.password,
        require_otp: true,
        otp_code: otp,
      });
      
      if (response.access_token) {
        TokenManager.setTokens({
          access_token: response.access_token,
          refresh_token: response.refresh_token || '',
          token_type: response.token_type || 'bearer',
          expires_in: 3600,
        });
        if (response.user) {
          AuthService.setCurrentUser(response.user);
        }
      }
      return response;
    }
    
    // Mặc định: xác thực email sau đăng ký
    const response = await ApiClient.post<LoginAPIResponse>('/auth/verify-email', { 
      email, 
      otp_code: otp,
      purpose: 'registration'
    });
    
    if (response.access_token) {
      TokenManager.setTokens({
        access_token: response.access_token,
        refresh_token: '',
        token_type: response.token_type || 'bearer',
        expires_in: 3600
      });
    }
    
    return response;
  }

  /**
   * Đăng ký người dùng mới
   * @param userData Thông tin đăng ký
   * @returns Promise với thông tin cần xác thực email
   */
  static async register(userData: { username: string; email: string; password: string }): Promise<RegisterResponse & { require_otp?: boolean; development_otp?: string; email?: string }> {
    const response = await ApiClient.post<RegisterResponse & { require_otp?: boolean; development_otp?: string; email?: string }>('/auth/register', userData);
    
    // Trong development mode, backend trả về development_otp
    // Development OTP sẽ được hiển thị trong UI
    
    return response;
  }

  /**
   * Xác thực email sau khi đăng ký
   */
  static async verifyEmail(email: string, otp: string): Promise<LoginAPIResponse> {
    const response = await ApiClient.post<LoginAPIResponse>('/auth/verify-email', { 
      email, 
      otp_code: otp,
      purpose: 'registration'
    });
    
    if (response.access_token) {
      TokenManager.setTokens({
        access_token: response.access_token,
        refresh_token: '',
        token_type: response.token_type || 'bearer',
        expires_in: 3600
      });
    }
    
    return response;
  }

  /**
   * Đăng xuất người dùng
   * Xóa tokens và gọi API logout
   */
  static async logout(): Promise<void> {
    try {
      await ApiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      // Luôn xóa tokens dù API có lỗi
      TokenManager.clearTokens();
    }
  }

  /**
   * Refresh access token
   * @returns Promise với tokens mới
   */
  static async refreshToken(): Promise<LoginAPIResponse> {
    // Backend sử dụng cookie cho refresh token
    const response = await ApiClient.post<LoginAPIResponse>('/auth/refresh');

    // Cập nhật access token mới
    if (response.access_token) {
      TokenManager.setTokens({
        access_token: response.access_token,
        refresh_token: '',
        token_type: response.token_type || 'bearer',
        expires_in: 3600
      });
    }

    return response;
  }

  // ==================================================
  // USER PROFILE - Quản lý thông tin người dùng
  // ==================================================

  /**
   * Lấy thông tin profile của user hiện tại
   * @returns Promise với thông tin user
   */
  static async getProfile(): Promise<User> {
    const response = await ApiClient.get('/auth/me');
    // Handle both formats: direct user object or {success: true, user: {...}}
    if (response.success && response.user) {
      return response.user;
    }
    return response;
  }

  /**
   * Thay đổi mật khẩu
   * @param oldPassword Mật khẩu hiện tại
   * @param newPassword Mật khẩu mới
   * @returns Promise với thông báo thành công
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return ApiClient.post<{ success: boolean; message?: string }>('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // ==================================================
  // TWO-FACTOR AUTHENTICATION (2FA) - Xác thực hai yếu tố
  // ==================================================

  /**
   * Bật/tắt 2FA
   */
  static async toggle2FA(enabled: boolean): Promise<{ success: boolean; message?: string; qr_code?: string }> {
    return ApiClient.post<{ success: boolean; message?: string; qr_code?: string }>('/auth/enable-2fa', { enabled });
  }

  // ==================================================
  // PASSWORD RESET - Đặt lại mật khẩu
  // ==================================================

  /**
   * Yêu cầu đặt lại mật khẩu
   * @param email Email để gửi OTP
   * @returns Promise với thông báo gửi email thành công
   */
  static async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
    return ApiClient.post<{ success: boolean; message?: string }>('/auth/request-reset-password', { email });
  }

  /**
   * Xác nhận đặt lại mật khẩu với OTP
   */
  static async confirmPasswordReset(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return ApiClient.post<{ success: boolean; message?: string }>('/auth/reset-password', {
      email,
      otp,
      new_password: newPassword,
    });
  }

  // ==================================================
  // UTILITY METHODS - Các phương thức tiện ích
  // ==================================================

  /**
   * Kiểm tra trạng thái đăng nhập
   * @returns true nếu đã đăng nhập, false nếu chưa
   */
  static isAuthenticated(): boolean {
    const hasTokens = TokenManager.hasTokens();
    const isExpired = TokenManager.isTokenExpired();
    console.log('🔑 Token check - hasTokens:', hasTokens, 'isExpired:', isExpired);
    return hasTokens && !isExpired;
  }

  /**
   * Lấy thông tin user từ localStorage (nếu có)
   * @returns User info hoặc null
   */
  static getCurrentUser(): User | null {
    const userJson = localStorage.getItem('current_user');
    if (!userJson) return null;

    const parsed = JSON.parse(userJson);
    // Handle both formats: direct user object or {success: true, user: {...}}
    if (parsed.success && parsed.user) {
      return parsed.user;
    }
    return parsed;
  }

  /**
   * Lưu thông tin user vào localStorage và sessionStorage
   * @param user Thông tin user
   */
  static setCurrentUser(user: User): void {
    // Ensure we store only the user object, not wrapped response
    const cleanUser = user && typeof user === 'object' && 'user' in user ? (user as any).user : user;
    const userData = JSON.stringify(cleanUser);

    // Store in localStorage for persistence across sessions
    localStorage.setItem('current_user', userData);

    // Store in sessionStorage for session-specific access (used by SessionFileManager)
    sessionStorage.setItem('auth_user', userData);

    // Also store in localStorage with auth_user key for consistency
    localStorage.setItem('auth_user', userData);

    console.log('User data stored for user:', user.id || user.username);
  }

  /**
   * Xóa thông tin user khỏi localStorage và sessionStorage
   */
  static clearCurrentUser(): void {
    localStorage.removeItem('current_user');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_user');

    console.log('User data cleared from storage');
  }
} 