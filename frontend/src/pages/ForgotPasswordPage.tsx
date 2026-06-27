import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  LockClosedIcon, 
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import ApiClient from '../lib/api';
import clsx from 'clsx';
import ThemeToggle from '../components/ThemeToggle';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Xử lý thay đổi input
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    
    // Clear error khi user bắt đầu nhập lại
    if (error) {
      setError(null);
    }
  };

  // Xử lý gửi yêu cầu reset password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email.trim()) {
      setError('Email không được để trống');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email không hợp lệ');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Gửi yêu cầu reset password

      const response = await ApiClient.post('/auth/request-password-reset', {
        email: email.trim(),
        purpose: 'password_reset'
      });

      // Reset password response

      if (response.success) {
        setIsSuccess(true);
        toast.success('OTP đã được gửi! Vui lòng kiểm tra email.');
      } else {
        setError('Không thể gửi yêu cầu đặt lại mật khẩu');
        toast.error('Không thể gửi yêu cầu đặt lại mật khẩu');
      }

    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Không thể gửi yêu cầu đặt lại mật khẩu';
      
      // Xử lý các loại lỗi cụ thể
      if (error.response?.status === 404) {
        errorMessage = 'Email không tồn tại trong hệ thống';
      } else if (error.response?.status === 422) {
        errorMessage = 'Email không hợp lệ';
      } else if (error.response?.status === 429) {
        errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Quay lại trang đăng nhập
  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  // Chuyển đến trang reset password
  const handleContinueToReset = () => {
    navigate('/reset-password', { 
      state: { email: email },
      replace: true 
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              OTP đã được gửi!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Chúng tôi đã gửi mã OTP đến <strong>{email}</strong>. 
              Vui lòng kiểm tra email và nhập mã để đặt lại mật khẩu.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleContinueToReset}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Tiếp tục đặt lại mật khẩu
              </button>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="w-full py-2 px-4 text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200"
              >
                Gửi lại OTP
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <LockClosedIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Quên mật khẩu?
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Nhập email của bạn để nhận mã OTP đặt lại mật khẩu
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
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
                value={email}
                onChange={handleEmailChange}
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
                disabled={isLoading}
              />
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isLoading
                  ? 'bg-secondary-300 dark:bg-secondary-600 text-secondary-500 dark:text-secondary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 text-white shadow-lg hover:shadow-xl'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Đang kiểm tra email...
                </div>
              ) : (
                'Gửi mã OTP'
              )}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Không nhận được email? Kiểm tra thư mục spam hoặc{' '}
            <button
              onClick={() => {
                setEmail('');
                setError(null);
              }}
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              thử lại với email khác
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage; 
