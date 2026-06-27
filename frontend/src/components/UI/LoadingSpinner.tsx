import React from 'react';
import clsx from 'clsx';

// ==================================================
// LOADING SPINNER COMPONENT - Component spinner loading
// ==================================================

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

/**
 * LoadingSpinner Component - Spinner animation cho loading states
 * 
 * Features:
 * 1. Multiple sizes (small, medium, large)
 * 2. Different color themes
 * 3. Smooth CSS animations
 * 4. Accessibility support
 * 
 * @param size Kích thước spinner (mặc định: medium)
 * @param color Màu sắc spinner (mặc định: primary)
 * @param className CSS classes bổ sung
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  className = '',
}) => {
  // ==================================================
  // SIZE CONFIGURATIONS - Cấu hình kích thước
  // ==================================================

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  // ==================================================
  // COLOR CONFIGURATIONS - Cấu hình màu sắc
  // ==================================================

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    white: 'text-white',
  };

  // ==================================================
  // MAIN RENDER - Render chính
  // ==================================================

  return (
    <div
      className={clsx(
        'inline-block animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Đang tải"
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
};

export default LoadingSpinner; 
