import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  KeyIcon, 
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import ApiClient from '../lib/api';
import clsx from 'clsx';
import ThemeToggle from '../components/ThemeToggle';

const VerifyOTPPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOTP } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Lấy email và purpose từ navigation state
  const { email, purpose, password, development_otp } = (location.state as any) || {};
  const devOtp = development_otp as string | undefined;

  // Countdown timer cho nút gửi lại
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Redirect nếu không có email
  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  // Xử lý nhập OTP
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Chỉ cho phép 1 ký tự
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Tự động chuyển sang ô tiếp theo
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }

    // Clear error khi user bắt đầu nhập lại
    if (error) {
      setError(null);
    }
  };

  // Xử lý keydown để di chuyển giữa các ô
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Xử lý paste OTP
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp([...newOtp, ...Array(6 - newOtp.length).fill('')]);
    }
  };

  // Xác thực OTP
  const handleVerify = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 số OTP');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Xác thực OTP

      await verifyOTP(email, otpString, { purpose: purpose || 'login', password });

      // If we reach here, verification was successful
      setIsSuccess(true);
      toast.success('Xác thực OTP thành công!');

      // Nếu là OTP đăng nhập thì quay về trang đăng nhập để hoàn tất flow
      if ((purpose || 'login') === 'login') {
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 800);
      } else {
        // Sau verify email (registration) có thể vào dashboard
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 800);
      }

    } catch (error: any) {
      console.error('OTP verification error:', error);
      
      let errorMessage = 'Xác thực OTP thất bại';
      
      // Xử lý các loại lỗi cụ thể
      if (error.response?.status === 401) {
        errorMessage = 'Mã OTP không chính xác';
      } else if (error.response?.status === 422) {
        errorMessage = 'Mã OTP không hợp lệ';
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

  // Gửi lại OTP
  const handleResendOTP = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await ApiClient.post('/auth/request-otp', {
        email: email,
        purpose: purpose || 'login'
      });

      if (response.success) {
        setCountdown(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        toast.success('OTP đã được gửi lại!');
        if (response.development_otp) {
          toast("DEV OTP: " + response.development_otp);
        }
      } else {
        setError('Không thể gửi lại OTP');
        toast.error('Không thể gửi lại OTP');
      }

    } catch (error: any) {
      console.error('Resend OTP error:', error);
      
      let errorMessage = 'Không thể gửi lại OTP';
      
      if (error.response?.status === 404) {
        errorMessage = 'Email không tồn tại trong hệ thống';
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

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <KeyIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Xác thực OTP
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Nhập mã 6 số đã được gửi đến <strong>{email}</strong>
          </p>
          {devOtp && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              DEV OTP: <span className="font-mono">{devOtp}</span>
            </p>
          )}
        </div>

        {/* OTP Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Mã xác thực (6 số)
              </label>
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={clsx(
                      'w-12 h-12 text-center text-lg font-semibold border-2 rounded-lg transition-all duration-200',
                      'bg-white dark:bg-gray-700',
                      'text-gray-900 dark:text-white',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      error
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                    disabled={isLoading || isSuccess}
                  />
                ))}
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
                    Xác thực thành công! Đang chuyển hướng...
                  </p>
                </div>
              </div>
            )}

            {/* Verify Button */}
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
                  Đang xác thực...
                </div>
              ) : isSuccess ? (
                <div className="flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Xác thực thành công
                </div>
              ) : (
                'Xác thực OTP'
              )}
            </button>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={!canResend || isLoading || isSuccess}
                className={clsx(
                  'inline-flex items-center text-sm font-medium transition-colors duration-200',
                  canResend && !isLoading && !isSuccess
                    ? 'text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300'
                    : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                )}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                {canResend ? 'Gửi lại OTP' : `Gửi lại sau ${countdown}s`}
              </button>
            </div>

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
      </div>
    </div>
  );
};

export default VerifyOTPPage; 
