import React, { useRef, useEffect, useState } from 'react';

interface HCaptchaWrapperProps {
  sitekey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: (error: string) => void;
  theme?: 'light' | 'dark';
}

const HCaptchaWrapper: React.FC<HCaptchaWrapperProps> = ({
  sitekey,
  onVerify,
  onExpire,
  onError,
  theme = 'light'
}) => {
  const [HCaptchaComponent, setHCaptchaComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const captchaRef = useRef<any>(null);

  useEffect(() => {
    const loadHCaptcha = async () => {
      try {
        const module = await import('@hcaptcha/react-hcaptcha');
        setHCaptchaComponent(() => module.default);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load HCaptcha:', error);
        onError('Failed to load captcha');
        setIsLoading(false);
      }
    };

    loadHCaptcha();
  }, [onError]);

  if (isLoading) {
    return (
      <div className="h-10 w-64 bg-gray-200 rounded animate-pulse flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading captcha...</span>
      </div>
    );
  }

  if (!HCaptchaComponent) {
    return (
      <div className="h-10 w-64 bg-red-100 border border-red-300 rounded flex items-center justify-center">
        <span className="text-red-600 text-sm">Captcha not available</span>
      </div>
    );
  }

  return (
    <HCaptchaComponent
      ref={captchaRef}
      sitekey={sitekey}
      onVerify={onVerify}
      onExpire={onExpire}
      onError={onError}
      theme={theme}
    />
  );
};

export default HCaptchaWrapper; 