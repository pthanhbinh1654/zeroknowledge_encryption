import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { statePersistence, initializeStorage } from '../../utils/storage';
import LoadingSpinner from '../UI/LoadingSpinner';
import clsx from 'clsx';

// ==================================================
// MAIN LAYOUT COMPONENT - Layout chính của ứng dụng
// ==================================================

const MainLayout: React.FC = () => {
  // ==================================================
  // STATE & HOOKS
  // ==================================================

  const { isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Initialize storage and restore preferences
  useEffect(() => {
    initializeStorage();
    const preferences = statePersistence.getPreferences();
    setSidebarCollapsed(preferences.sidebarCollapsed || isMobile);
  }, []);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Auto-collapse sidebar on mobile
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed]);
  
  // ==================================================
  // HANDLERS
  // ==================================================
  
  const toggleSidebar = () => {
    setSidebarCollapsed((prev: boolean) => !prev);
  };

  const closeSidebar = () => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  };

  // ==================================================
  // LOADING STATE
  // ==================================================
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // ==================================================
  // MAIN RENDER
  // ==================================================
  
  return (
    <div className="h-screen flex overflow-hidden bg-secondary-50 dark:bg-secondary-900">
      {/* Sidebar - Fixed positioning to not take space from main content */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 bg-white dark:bg-secondary-800 transform transition-all duration-300 ease-in-out',
        {
          // Mobile behavior
          '-translate-x-full': isMobile && sidebarCollapsed,
          'translate-x-0': isMobile && !sidebarCollapsed,
          'w-64': isMobile && !sidebarCollapsed,
          // Desktop behavior - always fixed, content adjusts with padding
          'md:translate-x-0': !isMobile,
          'md:w-64': !isMobile && !sidebarCollapsed,
          'md:w-16': !isMobile && sidebarCollapsed,
        }
      )}>
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobile={isMobile}
          onMobileClose={closeSidebar}
        />
      </div>

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 z-40 bg-secondary-600 bg-opacity-75"
          onClick={closeSidebar}
        />
      )}

      {/* Main content - Use padding instead of margin to avoid layout issues */}
      <div className={clsx(
        'flex-1 min-w-0 overflow-hidden transition-all duration-300',
        {
          'md:pl-64': !sidebarCollapsed && !isMobile,
          'md:pl-16': sidebarCollapsed && !isMobile,
          'pl-0': isMobile,
        }
      )}>
        <div className="flex flex-col h-full min-w-0">
          {/* Header */}
          <Header />
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-secondary-50 dark:bg-secondary-900">
            <div className="py-3 sm:py-4">
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout; 
