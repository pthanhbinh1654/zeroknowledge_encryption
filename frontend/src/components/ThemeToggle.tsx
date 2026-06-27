import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();

  // Theme toggle debug (development only)
  if (import.meta.env.DEV) {
    // ThemeToggle rendering
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    // Theme toggle debug (development only)
    if (import.meta.env.DEV) {
      // Toggling theme
    }
    setTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 bg-secondary-100 dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-all duration-200"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <SunIcon className="h-5 w-5 text-warning-500" />
      ) : (
        <MoonIcon className="h-5 w-5 text-secondary-700" />
      )}
    </button>
  );
};

export default ThemeToggle; 
