import React from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  onClose, 
  className 
}) => {
  if (!message) return null;

  return (
    <div className={clsx(
      'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4',
      'animate-slide-down',
      className
    )}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-danger-400" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-danger-600 dark:text-danger-400 font-medium">
            {message}
          </p>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex text-danger-400 hover:text-danger-600 dark:hover:text-danger-300"
            >
              <span className="sr-only">Đóng</span>
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage; 
