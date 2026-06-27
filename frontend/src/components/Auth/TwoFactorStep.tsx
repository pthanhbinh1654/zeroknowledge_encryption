import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface TwoFactorStepProps {
  email: string;
  onVerify: (otpCode: string) => Promise<void>;
  onResendOTP: () => Promise<void>;
  onBack?: () => void;
  isLoading: boolean;
  developmentOTP?: string;
}

const TwoFactorStep: React.FC<TwoFactorStepProps> = ({
  email,
  onVerify,
  onResendOTP,
  onBack,
  isLoading,
  developmentOTP
}) => {
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtpCode = otpCode.split('');
    newOtpCode[index] = value;
    const updatedOtpCode = newOtpCode.join('');
    setOtpCode(updatedOtpCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (updatedOtpCode.length === 6) {
      handleVerify(updatedOtpCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const codeToVerify = code || otpCode;
    if (codeToVerify.length !== 6) {
      toast.error('Vui lòng nhập đầy đủ 6 chữ số');
      return;
    }

    try {
      await onVerify(codeToVerify);
    } catch (error) {
      // Reset OTP input on error
      setOtpCode('');
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    
    try {
      await onResendOTP();
      setCountdown(60);
      setCanResend(false);
      setOtpCode('');
      inputRefs.current[0]?.focus();
      toast.success('Mã OTP mới đã được gửi');
    } catch (error) {
      toast.error('Không thể gửi lại mã OTP');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900">
          <ShieldCheckIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-secondary-900 dark:text-white">
          Xác thực hai yếu tố
        </h2>
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          Chúng tôi đã gửi mã xác thực 6 chữ số đến email
        </p>
        <p className="font-medium text-primary-600 dark:text-primary-400">
          {email}
        </p>
      </div>

      {/* Development OTP Display */}
      {developmentOTP && (
        <div className="p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
          <p className="text-sm text-warning-800 dark:text-warning-200">
            <strong>Development Mode:</strong> OTP Code: <code className="font-mono">{developmentOTP}</code>
          </p>
        </div>
      )}

      {/* OTP Input */}
      <div className="space-y-4">
        <div className="flex justify-center space-x-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={otpCode[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-12 text-center text-lg font-semibold border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          onClick={() => handleVerify()}
          disabled={otpCode.length !== 6 || isLoading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Đang xác thực...
            </>
          ) : (
            'Xác thực'
          )}
        </button>
      </div>

      {/* Resend OTP */}
      <div className="text-center space-y-3">
        <p className="text-sm text-secondary-600 dark:text-secondary-400">
          Không nhận được mã?{' '}
          {canResend ? (
            <button
              onClick={handleResend}
              className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
            >
              Gửi lại
            </button>
          ) : (
            <span className="text-secondary-500 dark:text-secondary-400">
              Gửi lại sau {countdown}s
            </span>
          )}
        </p>

        {/* Back to Login */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
          >
            ← Quay lại đăng nhập
          </button>
        )}
      </div>
    </div>
  );
};

export default TwoFactorStep;
