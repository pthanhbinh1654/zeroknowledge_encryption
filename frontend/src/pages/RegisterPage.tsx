import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  UserPlusIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import ApiClient from '../lib/api';
import HCaptcha from '../components/Security/HCaptcha';
import ThemeToggle from '../components/ThemeToggle';
import clsx from 'clsx';
import { env } from '../config/env';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Kiểm tra độ mạnh mật khẩu
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = '';

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score === 0) feedback = 'Rất yếu';
    else if (score === 1) feedback = 'Yếu';
    else if (score === 2) feedback = 'Trung bình';
    else if (score === 3) feedback = 'Khá';
    else if (score === 4) feedback = 'Mạnh';
    else feedback = 'Rất mạnh';

    return { score, feedback };
  };

  // Xử lý thay đổi input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Kiểm tra độ mạnh mật khẩu
    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }

    // Clear error khi user bắt đầu nhập lại
    if (error) {
      setError(null);
    }
  };

  // Reset captcha when component unmounts or on error
  React.useEffect(() => {
    return () => {
      setCaptchaToken(null);
    };
  }, []);

  // Xử lý đăng ký
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset any existing errors
    setError(null);
    
    // Validation
    if (!formData.username.trim()) {
      setError('Tên người dùng không được để trống');
      setCaptchaToken(null); // Reset captcha on validation error
      return;
    }

    if (!formData.email.trim()) {
      setError('Email không được để trống');
      setCaptchaToken(null);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email không hợp lệ');
      setCaptchaToken(null);
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      setCaptchaToken(null);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      setCaptchaToken(null);
      return;
    }

    if (!captchaToken) {
      setError('Vui lòng xác thực captcha');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn');
      return;
    }

    if (!captchaToken) {
      setError('Vui lòng hoàn thành xác thực captcha');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Đăng ký user

      const response = await ApiClient.post('/auth/register', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        require_otp: true,
        captcha_token: captchaToken
      });

      // Register response

      if (response.require_otp || response.requires_otp) {
        toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
        
        // Chuyển đến trang xác thực email
        navigate('/verify-email', { 
          state: { email: formData.email },
          replace: true 
        });
      } else {
        // Nếu không cần OTP, chuyển đến trang đăng nhập
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
        navigate('/login', { replace: true });
      }

    } catch (error: any) {
      console.error('Registration error:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Đăng ký thất bại';
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Màu sắc cho độ mạnh mật khẩu
  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 1) return 'text-red-500';
    if (passwordStrength.score === 2) return 'text-yellow-500';
    if (passwordStrength.score === 3) return 'text-blue-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <UserPlusIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Tạo tài khoản
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Đăng ký để bắt đầu sử dụng hệ thống mã hóa
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tên người dùng
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
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
                placeholder="Nhập tên người dùng"
                autoComplete="username"
              />
            </div>

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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Độ mạnh:</span>
                    <span className={clsx('font-medium', getPasswordStrengthColor())}>
                      {passwordStrength.feedback}
                    </span>
                  </div>
                  <div className="mt-1 flex space-x-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={clsx(
                          'h-1 flex-1 rounded-full transition-all duration-200',
                          level <= passwordStrength.score
                            ? getPasswordStrengthColor().replace('text-', 'bg-')
                            : 'bg-gray-200 dark:bg-gray-600'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={clsx(
                    'w-full px-4 py-3 pr-12 border-2 rounded-lg transition-all duration-200',
                    'bg-white dark:bg-gray-700',
                    'text-gray-900 dark:text-white',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'border-red-300 dark:border-red-600'
                      : error
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="mt-2 flex items-center text-sm">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-green-600 dark:text-green-400">Mật khẩu khớp</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                      <span className="text-red-600 dark:text-red-400">Mật khẩu không khớp</span>
                    </>
                  )}
                </div>
              )}
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

            {/* hCaptcha */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>Xác thực bảo mật</span>
              </div>
              {!captchaToken && (
                <HCaptcha
                  key="register-captcha"
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
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isLoading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white shadow-lg hover:shadow-xl'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Đang đăng ký...
                </div>
              ) : (
                'Đăng ký'
              )}
            </button>

            {/* Login Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Đã có tài khoản?{' '}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                >
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage; 
