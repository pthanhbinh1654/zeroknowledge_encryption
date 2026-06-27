import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  EnvelopeIcon, 
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import ApiClient from '../lib/api';
import clsx from 'clsx';
import ThemeToggle from '../components/ThemeToggle';

const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Lấy email từ navigation state
  const email = (location.state as any)?.email || '';

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
      navigate('/register', { replace: true });
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

      const response = await ApiClient.post('/auth/verify-email', {
        email: email,
        otp_code: otpString,
        purpose: 'registration'
      });

      // Verification response

      if (response.access_token) {
        // Lưu token
        localStorage.setItem('access_token', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }
        
        setIsVerified(true);
        toast.success('Xác thực email thành công! Chào mừng bạn!');
        
        // Chuyển hướng sau 2 giây
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        toast.error('Xác thực thất bại - không nhận được token');
      }

    } catch (error: any) {
      console.error('Email verification error:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'OTP bị sai vui lòng nhập lại';
      
      toast.error(errorMessage);
      
      // Nếu bị khoá do quá nhiều lần thử
      if (error.response?.status === 429) {
        setError('Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.');
        toast.error('Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi lại OTP
  const handleResendOTP = async () => {
    try {
      // Gửi lại OTP

      await ApiClient.post('/auth/request-otp', {
        email: email,
        purpose: 'registration'
      });

      // Reset countdown và OTP
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError(null);
      
      toast.success('OTP đã được gửi lại! Vui lòng kiểm tra email.');
      
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Không thể gửi lại OTP';
      
      toast.error(errorMessage);
    }
  };

  // Quay lại trang đăng ký
  const handleBackToRegister = () => {
    navigate('/register', { replace: true });
  };

  if (!email) {
    return null;
  }

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Xác thực thành công!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Email của bạn đã được xác thực. Đang chuyển hướng...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
            <EnvelopeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Xác thực Email
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chúng tôi đã gửi mã xác thực đến
          </p>
          <p className="text-blue-600 dark:text-blue-400 font-medium">
            {email}
          </p>
        </div>

        {/* OTP Input */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 text-center">
              Nhập mã xác thực 6 số
            </label>
            
            <div className="flex justify-center space-x-3 mb-4">
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

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Nhập mã 6 số đã được gửi đến email của bạn
            </p>
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
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
              'Xác thực Email'
            )}
          </button>

          {/* Resend OTP */}
          <div className="text-center mt-6">
            <button
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

          {/* Back to Register */}
          <div className="text-center mt-4">
            <button
              onClick={handleBackToRegister}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
            >
              ← Quay lại đăng ký
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage; 
