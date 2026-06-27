
import React from 'react';
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white dark:bg-secondary-800 shadow-sm border-b border-secondary-200 dark:border-secondary-700">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">
            Zero-Knowledge Encryption
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <ThemeToggle />
          {/* Ẩn user và logout ở header theo yêu cầu (đã có ở sidebar) */}
        </div>
      </div>
    </header>
  );
};

export default Header; 
