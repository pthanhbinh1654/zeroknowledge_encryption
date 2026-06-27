import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

// ==================================================
// MODAL COMPONENT - Component modal tái sử dụng
// ==================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showCloseButton?: boolean;
  className?: string;
}

/**
 * Modal Component - Modal dialog tái sử dụng
 * 
 * Features:
 * 1. Overlay background với blur effect
 * 2. Smooth animations với Transition
 * 3. Multiple sizes
 * 4. Keyboard navigation (ESC to close)
 * 5. Click outside to close
 * 6. Accessible với proper ARIA attributes
 * 
 * @param isOpen Trạng thái mở/đóng modal
 * @param onClose Callback khi đóng modal
 * @param title Tiêu đề modal (optional)
 * @param children Nội dung modal
 * @param size Kích thước modal (mặc định: medium)
 * @param showCloseButton Hiển thị nút đóng X (mặc định: true)
 * @param className CSS classes bổ sung
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  className = '',
}) => {
  // ==================================================
  // SIZE CONFIGURATIONS - Cấu hình kích thước
  // ==================================================

  const sizeClasses = {
    small: 'max-w-sm',
    medium: 'max-w-md',
    large: 'max-w-lg',
    xlarge: 'max-w-2xl',
  };

  // ==================================================
  // MAIN RENDER - Render chính
  // ==================================================

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={clsx(
                  'w-full transform overflow-hidden rounded-lg bg-white dark:bg-secondary-800 p-6 text-left align-middle shadow-xl transition-all',
                  'border border-secondary-200 dark:border-secondary-700',
                  sizeClasses[size],
                  className
                )}
              >
                {/* Header */}
                {(title || showCloseButton) && (
                  <div className="flex items-center justify-between mb-4">
                    {title && (
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-secondary-900 dark:text-white"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        className="ml-auto p-1 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors duration-200 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"
                        aria-label="Đóng modal"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="text-secondary-700 dark:text-secondary-300">
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal; 
