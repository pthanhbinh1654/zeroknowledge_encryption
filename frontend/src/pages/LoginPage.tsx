import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  XCircleIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import TwoFactorStep from '../components/Auth/TwoFactorStep';
import HCaptcha from '../components/Security/HCaptcha';
import ThemeToggle from '../components/ThemeToggle';
import clsx from 'clsx';
import { env } from '../config/env';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState<number>(Date.now());
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [developmentOTP, setDevelopmentOTP] = useState<string | null>(null);

  // Xử lý thay đổi input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error khi user bắt đầu nhập lại
    if (error) {
      setError(null);
    }
  };

  // Xử lý đăng nhập
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email.trim()) {
      setError('Email không được để trống');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email không hợp lệ');
      return;
    }

    if (!formData.password) {
      setError('Mật khẩu không được để trống');
      return;
    }

    // Check if captcha is required
    if (showCaptcha && !captchaToken) {
      setError('Vui lòng hoàn thành xác thực captcha');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Đăng nhập user

      const response = await login({
        email: formData.email.trim(),
        password: formData.password,
        captcha_token: captchaToken,
        require_otp: false
      } as any);

      // Login response

      if (response.success && response.access_token) {
        setIsSuccess(true);
        toast.success('Đăng nhập thành công!');
        
        // Chờ 1 giây rồi chuyển đến dashboard
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
      } else if (response.require_otp) {
        // Cần OTP - hiển thị bước 2FA
        setShow2FA(true);
        setDevelopmentOTP((response as any).development_otp || null);
        toast.success('Mã OTP đã được gửi đến email của bạn');
      } else if ((response as any)?.require_verification) {
        // Tránh double toast: trang verify sẽ có toast riêng khi gửi/resend
        navigate('/verify-email', { state: { email: (response as any).email || formData.email }, replace: true });
      } else {
        toast.error('Đăng nhập thất bại - không nhận được token');
      }

    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Đăng nhập thất bại';
      
      // Xử lý các loại lỗi cụ thể
      if (error.response?.status === 401) {
        errorMessage = 'Email hoặc mật khẩu không chính xác';
        // Tăng số lần thất bại và hiển thị captcha sau 3 lần
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        if (newFailedAttempts >= 3) {
          setShowCaptcha(true);
          errorMessage += '. Vui lòng hoàn thành xác thực captcha để tiếp tục.';
        }
      } else if (error.response?.status === 422) {
        errorMessage = 'Dữ liệu không hợp lệ';
      } else if (error.response?.status === 429) {
        errorMessage = 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau';
        setShowCaptcha(true);
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Lỗi mạng/không kết nối
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau';
      }

      toast.error(errorMessage);

      // Reset captcha token on error
      setCaptchaToken(null);
      // Force re-mount captcha sau mỗi lần sai
      setCaptchaKey(Date.now());
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 2FA verification
  const handle2FAVerify = async (otpCode: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await login({
        email: formData.email.trim(),
        password: formData.password,
        otp_code: otpCode,
        require_otp: true
      } as any);

      if (response.success && response.access_token) {
        setIsSuccess(true);
        toast.success('Đăng nhập thành công!');

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
      } else {
        throw new Error('Xác thực OTP thất bại');
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      let errorMessage = 'Xác thực OTP thất bại';

      if (error.response?.status === 401) {
        errorMessage = 'Mã OTP không chính xác';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
      throw error; // Re-throw to let TwoFactorStep handle UI reset
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    try {
      setIsLoading(true);

      const response = await login({
        email: formData.email.trim(),
        password: formData.password,
        require_otp: true
      } as any);

      if (response.require_otp) {
        setDevelopmentOTP((response as any).development_otp || null);
      } else {
        throw new Error('Không thể gửi lại mã OTP');
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      toast.error('Không thể gửi lại mã OTP');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back to login from 2FA
  const handleBackToLogin = () => {
    setShow2FA(false);
    setDevelopmentOTP(null);
    setError(null);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Theme toggle cho trang public */}
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <KeyIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Đăng nhập
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chào mừng bạn trở lại hệ thống mã hóa
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {show2FA ? (
            <TwoFactorStep
              email={formData.email}
              onVerify={handle2FAVerify}
              onResendOTP={handleResendOTP}
              onBack={handleBackToLogin}
              isLoading={isLoading}
              developmentOTP={developmentOTP}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={clsx(
                  'w-full px-4 py-3 border-2 rounded-lg transition-all duration-200',
                  'bg-white dark:bg-gray-700',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-500 dark:placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  error
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                )}
                placeholder="Nhập email của bạn"
                autoComplete="email"
                disabled={isLoading || isSuccess}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={clsx(
                    'w-full px-4 py-3 pr-12 border-2 rounded-lg transition-all duration-200',
                    'bg-white dark:bg-gray-700',
                    'text-gray-900 dark:text-white',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    error
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  disabled={isLoading || isSuccess}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  disabled={isLoading || isSuccess}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Đăng nhập thành công! Đang chuyển hướng...
                  </p>
                </div>
              </div>
            )}

            {/* hCaptcha */}
            {showCaptcha && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <ShieldCheckIcon className="h-4 w-4" />
                  <span>Xác thực bảo mật</span>
                </div>
                <HCaptcha
                  key={captchaKey}
                  siteKey={env.HCAPTCHA_SITE_KEY}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setError(null);
                  }}
                  onError={(error) => {
                    setCaptchaToken(null);
                    setError(`Lỗi captcha: ${error}`);
                  }}
                  onExpire={() => {
                    setCaptchaToken(null);
                    setError('Captcha đã hết hạn, vui lòng thử lại');
                  }}
                  theme="light"
                  size="normal"
                  disabled={isLoading}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <button type="button" className="underline" onClick={() => setCaptchaKey(Date.now())}>
                    Làm mới captcha
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={clsx(
                'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isLoading || isSuccess
                  ? 'bg-secondary-300 dark:bg-secondary-600 text-secondary-500 dark:text-secondary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 text-white shadow-lg hover:shadow-xl'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Đang đăng nhập...
                </div>
              ) : isSuccess ? (
                <div className="flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Đăng nhập thành công
                </div>
              ) : (
                'Đăng nhập'
              )}
            </button>

            {/* Links */}
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chưa có tài khoản?{' '}
                <Link
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                >
                  Đăng ký ngay
                </Link>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quên mật khẩu?{' '}
                <Link
                  to="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                >
                  Khôi phục mật khẩu
                </Link>
              </p>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 
