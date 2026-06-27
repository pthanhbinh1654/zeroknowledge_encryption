import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ShieldCheckIcon,
  UserIcon,
  AtSymbolIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import ApiClient from '../../lib/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import clsx from 'clsx';
import env from '../../config/env';
import HCaptchaWrapper from '../UI/HCaptchaWrapper';


// ==================================================
// VALIDATION SCHEMA
// ==================================================

const registerSchema = z.object({
  username: z
    .string()
    .min(1, 'Họ tên không được để trống')
    .max(100, 'Họ tên không được quá 100 ký tự'),
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống')
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số'),
  confirm_password: z
    .string()
    .min(1, 'Vui lòng xác nhận mật khẩu'),
  accept_terms: z
    .boolean()
    .refine(val => val === true, {
      message: 'Bạn phải đồng ý với điều khoản sử dụng',
    }),
  captcha_token: z
    .string()
    .min(1, 'Vui lòng hoàn thành xác thực captcha'),
}).refine(data => data.password === data.confirm_password, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirm_password'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

// ==================================================
// REGISTER FORM COMPONENT
// ==================================================

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const captchaRef = useRef<any>(null);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      accept_terms: false,
      captcha_token: '',
    },
  });

  // Watch password để hiển thị strength indicator
  const watchPassword = watch('password');

  // Watch for form changes to clear errors
  const watchedEmail = watch('email');
  const watchedUsername = watch('username');
  const watchedPasswordField = watch('password');
  const watchedConfirmPassword = watch('confirm_password');
  
  React.useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [watchedEmail, watchedUsername, watchedPasswordField, watchedConfirmPassword]);

  // Update captcha token in form when it changes
  React.useEffect(() => {
    setValue('captcha_token', captchaToken);
  }, [captchaToken, setValue]);

  // Captcha event handlers
  const onCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const onCaptchaExpire = () => {
    setCaptchaToken('');
    setValue('captcha_token', '');
  };

  const onCaptchaError = (err: string) => {
    console.error('Captcha error:', err);
    setCaptchaToken('');
    setValue('captcha_token', '');
  };

  // ==================================================
  // PASSWORD STRENGTH INDICATOR
  // ==================================================

  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
    const colors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];
    
    return {
      score: Math.min(score, 4),
      label: labels[Math.min(score, 4)],
      color: colors[Math.min(score, 4)]
    };
  };

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Đăng ký

      const response = await ApiClient.post('/auth/register', {
        username: data.username,
        email: data.email,
        password: data.password,
        require_otp: true,
        captcha_token: data.captcha_token
      });

      // Register response

      if (response.data?.require_otp || response.require_otp || response.requires_otp) {
        // Redirect to email verification
        toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
        navigate('/verify-email', { 
          state: { email: data.email },
          replace: true 
        });
      } else if (response.data?.success || response.success) {
        toast.success('Đăng ký thành công!');
        navigate('/login', { replace: true });
      } else {
        toast.error('Đăng ký thất bại - phản hồi không hợp lệ');
      }

    } catch (error: any) {
      console.error('Registration error:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Đăng ký thất bại';
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(prev => !prev);
  };

  // ==================================================
  // RENDER
  // ==================================================

  const passwordStrength = getPasswordStrength(watchPassword);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-secondary-900 dark:text-white">
            Đăng ký
          </h1>
          <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
            Tạo tài khoản để sử dụng hệ thống mã hóa file
          </p>
        </div>

        {/* Register Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="register-username" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('username')}
                  id="register-username"
                  type="text"
                  autoComplete="username"
                  className={clsx(
                    'block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm',
                    'bg-white dark:bg-secondary-800',
                    'text-secondary-900 dark:text-white',
                    'placeholder-secondary-500 dark:placeholder-secondary-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-colors duration-200',
                    errors.username
                      ? 'border-danger-300 dark:border-danger-600'
                      : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500'
                  )}
                  placeholder="Nhập tên đăng nhập"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.username.message}
                </p>
              )}
              <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-400">
                Nhập họ tên thông thường của bạn
              </p>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSymbolIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('email')}
                  id="register-email"
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
              <label htmlFor="register-password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheckIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('password')}
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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
              
              {/* Password Strength Indicator */}
              {watchPassword && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-secondary-200 dark:bg-secondary-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          passwordStrength.score === 0 ? 'w-0' :
                          passwordStrength.score === 1 ? 'w-1/4 bg-red-500' :
                          passwordStrength.score === 2 ? 'w-2/4 bg-orange-500' :
                          passwordStrength.score === 3 ? 'w-3/4 bg-yellow-500' :
                          'w-full bg-green-500'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheckIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('confirm_password')}
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={clsx(
                    'block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm',
                    'bg-white dark:bg-secondary-800',
                    'text-secondary-900 dark:text-white',
                    'placeholder-secondary-500 dark:placeholder-secondary-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-colors duration-200',
                    errors.confirm_password
                      ? 'border-danger-300 dark:border-danger-600'
                      : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500'
                  )}
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-secondary-400 hover:text-secondary-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-secondary-400 hover:text-secondary-600" />
                  )}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

                         {/* Captcha */}
             <div>
               <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                 Xác thực bảo mật
               </label>
                               <div className="flex justify-center">
                  <HCaptchaWrapper
                    key="register-captcha"
                    sitekey={env.HCAPTCHA_SITE_KEY}
                    onVerify={onCaptchaVerify}
                    onExpire={onCaptchaExpire}
                    onError={onCaptchaError}
                    theme="light"
                  />
                </div>
               {errors.captcha_token && (
                 <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                   {errors.captcha_token.message}
                 </p>
               )}
             </div>

            {/* Terms and Conditions */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  {...register('accept_terms')}
                  id="register-accept-terms"
                  type="checkbox"
                  className={clsx(
                    'h-4 w-4 rounded border-secondary-300 dark:border-secondary-600',
                    'text-primary-600 focus:ring-primary-500',
                    'bg-white dark:bg-secondary-800'
                  )}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="register-accept-terms" className="text-secondary-700 dark:text-secondary-300">
                  Tôi đồng ý với{' '}
                  <Link
                    to="/terms"
                    className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Điều khoản sử dụng
                  </Link>{' '}
                  và{' '}
                  <Link
                    to="/privacy"
                    className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Chính sách bảo mật
                  </Link>
                </label>
                {errors.accept_terms && (
                  <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                    {errors.accept_terms.message}
                  </p>
                )}
              </div>
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
                    <ShieldCheckIcon className="h-5 w-5 text-primary-500 group-hover:text-primary-400" />
                  </span>
                  Đăng ký
                </>
              )}
            </button>
          </div>

          {/* Links */}
          <div className="text-center">
            <span className="text-sm text-secondary-600 dark:text-secondary-400">
              Đã có tài khoản?{' '}
            </span>
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm; 
