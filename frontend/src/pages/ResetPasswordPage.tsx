import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  LockClosedIcon, 
  EyeIcon, 
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import ApiClient from '../lib/api';
import clsx from 'clsx';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Lấy email từ navigation state
  useEffect(() => {
    const emailFromState = (location.state as any)?.email;
    if (emailFromState) {
      setEmail(emailFromState);
    }
  }, [location.state]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Xử lý nhập OTP
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`reset-otp-${index + 1}`);
      nextInput?.focus();
    }

    if (error) setError(null);
  };

  // Gửi lại OTP
  const handleResendOTP = async () => {
    try {
      await ApiClient.post('/auth/request-password-reset', {
        email: email,
        purpose: 'password_reset'
      });

      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError(null);
      
      toast.success('OTP đã được gửi lại!');
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Không thể gửi lại OTP';
      toast.error(errorMessage);
    }
  };

  // Xử lý verify OTP
  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 số OTP');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await ApiClient.post('/auth/verify-password-reset-otp', {
        email: email,
        otp_code: otpString,
        purpose: 'password_reset'
      });

      if (response.success) {
        setIsOtpVerified(true);
        toast.success('OTP xác thực thành công! Vui lòng nhập mật khẩu mới.');
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Xác thực OTP thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await ApiClient.post('/auth/reset-password', {
        email: email,
        new_password: newPassword
      });

      if (response.success) {
        setIsSuccess(true);
        toast.success('Đặt lại mật khẩu thành công!');
        
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Đặt lại mật khẩu thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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
              Đặt lại mật khẩu thành công!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng đến trang đăng nhập...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <LockClosedIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isOtpVerified ? 'Đặt lại mật khẩu' : 'Xác thực OTP'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isOtpVerified ? 'Nhập mật khẩu mới' : 'Nhập mã OTP để xác thực'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {!isOtpVerified ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 text-center">
                  Nhập mã OTP 6 số
                </label>
                
                <div className="flex justify-center space-x-3 mb-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`reset-otp-${index}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      className={clsx(
                        'w-12 h-12 text-center text-xl font-semibold border-2 rounded-lg',
                        'bg-white dark:bg-gray-700',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'transition-all duration-200',
                        error
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                      placeholder="0"
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={!canResend || isLoading}
                    className={clsx(
                      'inline-flex items-center text-sm font-medium transition-colors duration-200',
                      canResend && !isLoading
                        ? 'text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300'
                        : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    )}
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    {canResend ? 'Gửi lại mã' : `Gửi lại sau ${countdown}s`}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.join('').length !== 6}
                className={clsx(
                  'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  isLoading || otp.join('').length !== 6
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white shadow-lg hover:shadow-xl'
                )}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Đang xác thực...
                  </div>
                ) : (
                  'Xác thực OTP'
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    placeholder="Nhập mật khẩu mới"
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
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={clsx(
                      'w-full px-4 py-3 pr-12 border-2 rounded-lg transition-all duration-200',
                      'bg-white dark:bg-gray-700',
                      'text-gray-900 dark:text-white',
                      'placeholder-gray-500 dark:placeholder-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      confirmPassword && newPassword !== confirmPassword
                        ? 'border-red-300 dark:border-red-600'
                        : error
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                    placeholder="Nhập lại mật khẩu mới"
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
                
                {confirmPassword && (
                  <div className="mt-2 flex items-center text-sm">
                    {newPassword === confirmPassword ? (
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

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </div>
              )}

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
                    Đang đặt lại mật khẩu...
                  </div>
                ) : (
                  'Đặt lại mật khẩu'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage; 
