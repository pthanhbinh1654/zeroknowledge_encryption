import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { AuthService } from '../services/auth.service';
import SessionFileManager from '../utils/sessionFileManager';
import type { User, LoginRequest, RegisterRequest, LoginResponse, RegisterResponse } from '../types/api';

// ==================================================
// AUTH CONTEXT TYPES - Định nghĩa types cho AuthContext
// ==================================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Thêm states cho 2FA và email verification
  requiresOTP: boolean;
  requiresEmailVerification: boolean;
  pendingEmail?: string;
}

interface AuthContextValue extends AuthState {
  // Authentication actions
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  verifyOTP: (
    email: string,
    otp: string,
    options?: { purpose?: 'login' | 'registration'; password?: string }
  ) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<RegisterResponse>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Profile management
  updateProfile: (userData: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  checkAuthStatus: () => void;
}

// ==================================================
// CONTEXT CREATION - Tạo AuthContext
// ==================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ==================================================
// AUTH PROVIDER COMPONENT - Provider component cho AuthContext
// ==================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // ==================================================
  // STATE MANAGEMENT - Quản lý state
  // ==================================================
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    requiresOTP: false,
    requiresEmailVerification: false,
    pendingEmail: undefined,
  });

  // ==================================================
  // UTILITY FUNCTIONS - Các hàm tiện ích
  // ==================================================

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setAuthState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string) => {
    setAuthState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const setAuthenticatedUser = useCallback(async (accessToken?: string) => {
    if (accessToken) {
      try {
        const user = await AuthService.getProfile();
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          requiresOTP: false,
          requiresEmailVerification: false,
          pendingEmail: undefined,
        });
        AuthService.setCurrentUser(user);

        // Migrate legacy session data to user-specific storage
        SessionFileManager.migrateLegacyData();
      } catch (error) {
        console.error('Failed to get user profile:', error);
        clearAuthenticatedUser();
      }
    }
  }, []);

  const clearAuthenticatedUser = useCallback(() => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresOTP: false,
      requiresEmailVerification: false,
      pendingEmail: undefined,
    });
    AuthService.clearCurrentUser();
  }, []);

  // ==================================================
  // AUTHENTICATION METHODS - Các phương thức xác thực
  // ==================================================

  /**
   * Đăng nhập người dùng
   */
  const login = useCallback(async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      setLoading(true);
      clearError();

      const response = await AuthService.login(credentials);
      
      if (response.success && response.access_token) {
        await setAuthenticatedUser(response.access_token);
        // Đã có toast trong page; tránh double nếu route auth đang hiện
        if (!window.location.pathname.includes('/login')) {
          toast.success('Đăng nhập thành công!');
        }
      } else if (response.success === false && response.require_otp) {
        // Cần nhập OTP
        setAuthState(prev => ({
          ...prev,
          requiresOTP: true,
          pendingEmail: response.email,
          isLoading: false
        }));
        if (!window.location.pathname.includes('/login')) {
          toast('Vui lòng nhập mã OTP đã gửi đến email của bạn');
        }
      } else if ((response as any).require_verification) {
        // Tài khoản chưa được xác thực email
        setAuthState(prev => ({
          ...prev,
          requiresEmailVerification: true,
          pendingEmail: (response as any).email,
          isLoading: false,
        }));
        toast('Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn.');
      } else {
        // Không có access_token và không require OTP - có thể là lỗi
        const errorMessage = response.message || 'Đăng nhập thất bại - không nhận được token';
        setError(errorMessage);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setError(errorMessage);
      if (!window.location.pathname.includes('/login')) {
        toast.error(errorMessage);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setAuthenticatedUser, setError]);

  /**
   * Xác thực OTP cho 2FA
   */
  const verifyOTP = useCallback(async (
    email: string,
    otp: string,
    options?: { purpose?: 'login' | 'registration'; password?: string }
  ) => {
    try {
      setLoading(true);
      clearError();

      const response = await AuthService.verifyOTP(email, otp, options);
      
      if (response.access_token) {
        await setAuthenticatedUser(response.access_token);
        toast.success('Xác thực OTP thành công!');
      } else {
        // Không có access_token - có thể là lỗi
        const errorMessage = response.message || 'Xác thực OTP thất bại - không nhận được token';
        setError(errorMessage);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Mã OTP không chính xác';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setAuthenticatedUser, setError]);

  /**
   * Đăng ký người dùng mới
   */
  const register = useCallback(async (userData: RegisterRequest): Promise<RegisterResponse> => {
    try {
      setLoading(true);
      clearError();

      const response = await AuthService.register(userData);
      
      if (response.require_otp) {
        setAuthState(prev => ({
          ...prev,
          requiresEmailVerification: true,
          pendingEmail: userData.email,
          isLoading: false
        }));
        toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
      } else {
        // Đăng ký thành công nhưng không cần OTP
        toast.success('Đăng ký thành công!');
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Đăng ký thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setError]);

  /**
   * Xác thực email sau khi đăng ký
   */
  const verifyEmail = useCallback(async (email: string, otp: string) => {
    try {
      setLoading(true);
      clearError();

      const response = await AuthService.verifyEmail(email, otp);
      
      if (response.access_token) {
        await setAuthenticatedUser(response.access_token);
        toast.success('Xác thực email thành công! Chào mừng bạn!');
      } else {
        // Không có access_token - có thể là lỗi
        const errorMessage = response.message || 'Xác thực email thất bại - không nhận được token';
        setError(errorMessage);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Mã OTP không chính xác';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setAuthenticatedUser, setError]);

  /**
   * Đăng xuất người dùng
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      await AuthService.logout();
      clearAuthenticatedUser();
      
      toast.success('Đã đăng xuất thành công');
    } catch (error: any) {
      clearAuthenticatedUser();
      console.error('Logout error:', error);
    }
  }, [setLoading, clearAuthenticatedUser]);

  // ==================================================
  // PROFILE MANAGEMENT - Quản lý thông tin profile
  // ==================================================

  const updateProfile = useCallback(async (userData: Partial<User>) => {
    try {
      setLoading(true);
      clearError();

      // Tạm thời comment vì chưa có API update profile
      // const updatedUser = await AuthService.updateProfile(userData);
      // setAuthenticatedUser(updatedUser);
      
      toast.success('Cập nhật thông tin thành công');
      // Update profile functionality placeholder
      void userData; // To avoid unused parameter error
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Cập nhật thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  }, [setLoading, clearError, setError]);

  const refreshProfile = useCallback(async () => {
    try {
      if (!AuthService.isAuthenticated()) return;

      const user = await AuthService.getProfile();
      setAuthState(prev => ({ ...prev, user }));
      AuthService.setCurrentUser(user);
    } catch (error: any) {
      console.error('Failed to refresh profile:', error);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);

      const isAuth = AuthService.isAuthenticated();
      console.log('🔍 Auth check - isAuthenticated:', isAuth);

      if (!isAuth) {
        console.log('❌ Not authenticated, clearing user');
        clearAuthenticatedUser();
        return;
      }

      const cachedUser = AuthService.getCurrentUser();
      console.log('👤 Cached user:', cachedUser);
      console.log('👤 User properties:', cachedUser ? Object.keys(cachedUser) : 'null');

      if (cachedUser) {
        console.log('✅ Using cached user:', cachedUser.username || cachedUser.email);
        setAuthState(prev => ({
          ...prev,
          user: cachedUser,
          isAuthenticated: true,
          isLoading: false
        }));
        
        // Try to refresh profile in background, but don't fail if it doesn't work
        try {
          const user = await AuthService.getProfile();
          console.log('🔄 Refreshed user profile:', user.username || user.email);
          setAuthState(prev => ({ ...prev, user }));
          AuthService.setCurrentUser(user);
        } catch (profileError) {
          console.warn('Failed to refresh profile, using cached user:', profileError);
          // Don't clear auth, just use cached user
        }
      } else {
        // No cached user, try to get from server
        console.log('🌐 No cached user, fetching from server...');
        try {
          const user = await AuthService.getProfile();
          console.log('✅ Fetched user from server:', user.username || user.email);
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            requiresOTP: false,
            requiresEmailVerification: false,
            pendingEmail: undefined,
          });
          AuthService.setCurrentUser(user);
        } catch (error) {
          console.warn('❌ Failed to get user profile:', error);
          clearAuthenticatedUser();
        }
      }
      
    } catch (error: any) {
      console.error('Auth check failed:', error);
      // Only clear auth if token is actually invalid, not on network errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAuthenticatedUser();
      } else {
        setLoading(false);
      }
    }
  }, [setLoading, clearAuthenticatedUser]);

  // ==================================================
  // EFFECTS - Các side effects
  // ==================================================

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token' && !e.newValue) {
        clearAuthenticatedUser();
        toast('Đã đăng xuất do thay đổi ở tab khác');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [clearAuthenticatedUser]);

  // ==================================================
  // CONTEXT VALUE - Giá trị được cung cấp bởi context
  // ==================================================

  const contextValue: AuthContextValue = {
    ...authState,
    login,
    verifyOTP,
    register,
    verifyEmail,
    logout,
    updateProfile,
    refreshProfile,
    clearError,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext; 
