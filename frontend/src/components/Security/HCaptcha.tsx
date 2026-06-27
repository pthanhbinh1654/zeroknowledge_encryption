import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface HCaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  className?: string;
  disabled?: boolean;
}

interface HCaptchaRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  tabindex?: number;
  callback?: (token: string) => void;
  'error-callback'?: (error: string) => void;
  'expired-callback'?: () => void;
  'chalexpired-callback'?: () => void;
}

interface HCaptchaWindow extends Window {
  hcaptcha?: {
    render: (container: string | HTMLElement, options: HCaptchaRenderOptions) => string;
    execute: (widgetId: string) => void;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
    getResponse: (widgetId: string) => string;
  };
}

declare const window: HCaptchaWindow;

// ==================================================
// HCAPTCHA COMPONENT
// ==================================================

const HCaptcha: React.FC<HCaptchaProps> = ({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'light',
  size = 'normal',
  className = '',
  disabled = false
}) => {
  const captchaRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // ==================================================
  // LOAD HCAPTCHA SCRIPT
  // ==================================================

  const loadHCaptchaScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if (window.hcaptcha) {
        setIsLoaded(true);
        resolve();
        return;
      }

      // Create and load script
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoaded(true);
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load hCaptcha script'));
      };

      document.head.appendChild(script);
    });
  }, []);

  // ==================================================
  // RENDER CAPTCHA
  // ==================================================

  const renderCaptcha = useCallback(() => {
    if (!captchaRef.current || !isLoaded || typeof window.hcaptcha === 'undefined') {
      return;
    }

    try {
      const renderParams = {
        sitekey: siteKey,
        theme: theme,
        size: size,
        callback: (response: string) => {
          setIsVerified(true);
          setError(null);
          onVerify(response);
        },
        'error-callback': (err: string) => {
          console.error('hCaptcha Error:', err);
          setIsVerified(false);
          setError(err);
          if (onError) onError(err);
        },
        'expired-callback': () => {
          setIsVerified(false);
          if (onExpire) onExpire();
        }
      };
      
      const id = window.hcaptcha.render(captchaRef.current, renderParams);

      setWidgetId(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to render hCaptcha';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [siteKey, theme, size, onVerify, onError, onExpire, isLoaded]);

  // ==================================================
  // LIFECYCLE METHODS
  // ==================================================

  useEffect(() => {
    let mounted = true;
    let scriptLoaded = false;
    
    const init = async () => {
      if (scriptLoaded || !mounted) return;
      
      try {
        await loadHCaptchaScript();
        if (mounted) {
          scriptLoaded = true;
          renderCaptcha();
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load hCaptcha';
          setError(errorMessage);
          onError?.(errorMessage);
        }
      }
    };

    init();

    // Cleanup
    return () => {
      mounted = false;
      if (widgetId && window.hcaptcha) {
        try {
          window.hcaptcha.remove(widgetId);
          scriptLoaded = false;
        } catch (err) {
          console.warn('Failed to remove hCaptcha widget:', err);
        }
      }
    };
  }, [loadHCaptchaScript, renderCaptcha, onError, widgetId]);

  // ==================================================
  // PUBLIC METHODS
  // ==================================================

  const reset = useCallback(() => {
    if (widgetId && window.hcaptcha) {
      try {
        window.hcaptcha.reset(widgetId);
        setIsVerified(false);
        setError(null);
      } catch (err) {
        console.warn('Failed to reset hCaptcha:', err);
      }
    }
  }, [widgetId]);

  const execute = useCallback(() => {
    if (widgetId && window.hcaptcha) {
      try {
        window.hcaptcha.execute(widgetId);
      } catch (err) {
        console.warn('Failed to execute hCaptcha:', err);
      }
    }
  }, [widgetId]);

  const getResponse = useCallback(() => {
    if (widgetId && window.hcaptcha) {
      try {
        return window.hcaptcha.getResponse(widgetId);
      } catch (err) {
        console.warn('Failed to get hCaptcha response:', err);
        return '';
      }
    }
    return '';
  }, [widgetId]);

  // Methods are available through the component's internal state
  // If parent components need access to these methods, consider using forwardRef

  // ==================================================
  // RENDER
  // ==================================================

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 ${className}`}>
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span className="text-sm">hCaptcha lỗi: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`hcaptcha-container ${className}`}>
      {/* Loading State */}
      {!isLoaded && (
        <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
          <span className="text-sm">Đang tải hCaptcha...</span>
        </div>
      )}

      {/* Captcha Container */}
      <div
        ref={captchaRef}
        className={`
          ${!isLoaded ? 'hidden' : ''}
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      />

      {/* Verification Status */}
      {isVerified && (
        <div className="flex items-center space-x-2 mt-2 text-green-600">
          <ShieldCheckIcon className="h-4 w-4" />
          <span className="text-xs">Xác thực thành công</span>
        </div>
      )}

      {/* Privacy Notice */}
      <span className="text-xs text-gray-500 mt-2 block">
        This site is protected by hCaptcha.
      </span>
    </div>
  );
};

export default HCaptcha;
