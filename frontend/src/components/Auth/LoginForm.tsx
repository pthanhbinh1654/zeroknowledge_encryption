import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  LockClosedIcon,
  AtSymbolIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import ApiClient from '../../lib/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import clsx from 'clsx';


// ==================================================
// VALIDATION SCHEMA
// ==================================================

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ==================================================
// LOGIN FORM COMPONENT
// ==================================================

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Watch for form changes to clear errors
  const watchedEmail = watch('email');
  const watchedPassword = watch('password');
  
  React.useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [watchedEmail, watchedPassword]);

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Đăng nhập

      const response = await ApiClient.post('/auth/login', {
        email: data.email,
        password: data.password,
        require_otp: false
      });

      // Login response

      // Handle different response types
      if (response.require_verification) {
        // User needs to verify email
        navigate('/verify-email', { 
          state: { email: response.email },
          replace: true 
        });
        return;
      }

      if (response.require_otp) {
        // User needs to enter OTP - pass along password for login OTP verification
        navigate('/verify-otp', { 
          state: { 
            email: data.email,
            purpose: 'login',
            password: data.password,
            development_otp: response.development_otp
          },
          replace: true 
        });
        return;
      }

      if (response.access_token) {
        // Lưu token
        localStorage.setItem('access_token', response.access_token);
        
        toast.success('Đăng nhập thành công!');
        navigate('/dashboard', { replace: true });
      } else {
        setError('Đăng nhập thất bại - không nhận được token');
        toast.error('Đăng nhập thất bại');
      }

    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      // Map lỗi phổ biến sang tiếng Việt cụ thể
      if (error.response?.status === 401) {
        errorMessage = 'Email hoặc mật khẩu không chính xác';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy máy chủ xác thực (404)';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
            <LockClosedIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-secondary-900 dark:text-white">
            Đăng nhập
          </h1>
          <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
            Đăng nhập vào tài khoản của bạn
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSymbolIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('email')}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className={clsx(
                    'block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm',
                    'bg-white dark:bg-secondary-800',
                    'text-secondary-900 dark:text-white',
                    'placeholder-secondary-500 dark:placeholder-secondary-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-colors duration-200',
                    errors.email
                      ? 'border-danger-300 dark:border-danger-600'
                      : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500'
                  )}
                  placeholder="Nhập email của bạn"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('password')}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={clsx(
                    'block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm',
                    'bg-white dark:bg-secondary-800',
                    'text-secondary-900 dark:text-white',
                    'placeholder-secondary-500 dark:placeholder-secondary-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-colors duration-200',
                    errors.password
                      ? 'border-danger-300 dark:border-danger-600'
                      : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500'
                  )}
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-secondary-400 hover:text-secondary-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-secondary-400 hover:text-secondary-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3">
              <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg',
                'text-white bg-primary-600 hover:bg-primary-700',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-200'
              )}
            >
              {isLoading ? (
                <LoadingSpinner size="small" className="text-white" />
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <LockClosedIcon className="h-5 w-5 text-primary-500 group-hover:text-primary-400" />
                  </span>
                  Đăng nhập
                </>
              )}
            </button>
          </div>

          {/* Links */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="text-sm">
              <span className="text-secondary-600 dark:text-secondary-400">
                Chưa có tài khoản?{' '}
              </span>
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Đăng ký ngay
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm; 
