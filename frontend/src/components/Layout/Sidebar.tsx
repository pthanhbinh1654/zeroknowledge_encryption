import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ShieldCheckIcon,
  DocumentIcon,
  DocumentArrowDownIcon,
  LockClosedIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  FolderIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { statePersistence } from '../../utils/storage';
import clsx from 'clsx';

// ==================================================
// SIDEBAR COMPONENT - Component sidebar điều hướng chính
// ==================================================

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  onMobileClose?: () => void;
}

/**
 * Sidebar Component - Thanh điều hướng bên trái
 * 
 * Features:
 * 1. Collapsible sidebar (có thể thu gọn)
 * 2. Active route highlighting (highlight route hiện tại)
 * 3. Role-based navigation (hiển thị menu theo role)
 * 4. Modern design với icons và animations
 * 
 * @param isCollapsed Trạng thái thu gọn của sidebar
 * @param onToggleCollapse Function để toggle trạng thái thu gọn
 */
const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
  onMobileClose
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      if (isMobileView && !isCollapsed) {
        onToggleCollapse();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check on mount

    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, onToggleCollapse]);

  // Save sidebar state to localStorage
  useEffect(() => {
    const preferences = statePersistence.getPreferences();
    preferences.sidebarCollapsed = isCollapsed;
    statePersistence.savePreferences(preferences);
  }, [isCollapsed]);

  // ==================================================
  // NAVIGATION ITEMS - Danh sách menu điều hướng
  // ==================================================

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      description: 'Tổng quan hệ thống',
    },
    {
      name: 'Mã hóa File',
      href: '/encrypt',
      icon: DocumentIcon,
      description: 'Upload và mã hóa file',
    },
    {
      name: 'Giải mã File',
      href: '/decrypt',
      icon: DocumentArrowDownIcon,
      description: 'Giải mã và khôi phục file',
    },
    {
      name: 'Chữ ký số',
      href: '/signatures',
      icon: ShieldCheckIcon,
      description: 'Ký và xác thực file',
    },
    {
      name: 'Mã hóa lai',
      href: '/hybrid',
      icon: LockClosedIcon,
      description: 'Hybrid encryption với KEM',
    },
    {
      name: 'File của tôi',
      href: '/files',
      icon: FolderIcon,
      description: 'Quản lý file đã mã hóa',
    },
    // Ẩn tạm thời theo yêu cầu
    // {
    //   name: 'Thống kê',
    //   href: '/analytics',
    //   icon: ChartBarIcon,
    //   description: 'Thống kê và báo cáo',
    // },
    // {
    //   name: 'Bảo mật',
    //   href: '/security',
    //   icon: ShieldCheckIcon,
    //   description: 'Cài đặt bảo mật 2FA',
    // },
  ];

  const bottomNavigationItems = [
    {
      name: 'Profile',
      href: '/profile',
      icon: UserIcon,
      description: 'Thông tin cá nhân',
    },
    {
      name: 'Cài đặt',
      href: '/settings',
      icon: Cog6ToothIcon,
      description: 'Cài đặt ứng dụng',
    },
  ];

  // ==================================================
  // HELPER FUNCTIONS - Các hàm tiện ích
  // ==================================================

  /**
   * Kiểm tra route có active không
   * @param href Đường dẫn route
   * @returns boolean
   */
  const isActiveRoute = (href: string): boolean => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  /**
   * Xử lý logout
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // ==================================================
  // RENDER NAVIGATION ITEM - Render một item menu
  // ==================================================

  const NavigationItem: React.FC<{
    item: typeof navigationItems[0];
    isBottom?: boolean;
  }> = ({ item, isBottom = false }) => {
    const active = isActiveRoute(item.href);
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={() => {
          // Close mobile menu when clicking a link
          if (isMobile && isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
          }
          // Save current work state when navigating
          const currentPath = location.pathname;
          if (currentPath !== item.href) {
            // This would be implemented by each page component
            // statePersistence.saveWorkState(currentPath, getCurrentPageState());
          }
        }}
        className={clsx(
          'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
          'hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/20',
          {
            'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300': active,
            'text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-secondary-200': !active,
            'justify-center': isCollapsed,
            'justify-start': !isCollapsed,
            'mt-auto': isBottom, // Use isBottom to determine margin
          }
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={clsx(
          'flex-shrink-0 transition-colors duration-200',
          {
            'h-5 w-5': !isCollapsed,
            'h-6 w-6': isCollapsed,
            'text-primary-600 dark:text-primary-400': active,
            'text-secondary-400 group-hover:text-secondary-500 dark:text-secondary-500 dark:group-hover:text-secondary-400': !active,
          }
        )} />
        
        {!isCollapsed && (
          <span className="ml-3 flex-1 text-left">
            {item.name}
          </span>
        )}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-secondary-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  // ==================================================
  // MAIN RENDER - Render chính của component
  // ==================================================

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-secondary-800 shadow-lg"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <XMarkIcon className="h-6 w-6 text-secondary-600 dark:text-secondary-300" />
        ) : (
          <Bars3Icon className="h-6 w-6 text-secondary-600 dark:text-secondary-300" />
        )}
      </button>

      <div className={clsx(
        'flex flex-col h-full bg-white dark:bg-secondary-900 border-r border-secondary-200 dark:border-secondary-700 transition-all duration-300',
        {
          'w-64': !isCollapsed,
          'w-16': isCollapsed,
          // Mobile styles
          'fixed inset-y-0 left-0 z-50 md:relative': isMobile,
          'transform -translate-x-full md:translate-x-0': isMobile && !isMobileMenuOpen,
          'transform translate-x-0': isMobile && isMobileMenuOpen,
        }
      )}>
        {/* Header với logo và toggle button */}
        <div className="flex items-center justify-between p-3 border-b border-secondary-200 dark:border-secondary-700">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-primary-600 rounded-lg">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <span className="ml-3 text-lg font-semibold text-secondary-900 dark:text-white">
                SecureFS
              </span>
            </div>
          )}

        {isCollapsed && (
          <div className="flex items-center justify-center w-8 h-8 bg-primary-600 rounded-lg mx-auto">
            <ShieldCheckIcon className="w-5 h-5 text-white" />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className={clsx(
            'p-1.5 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors duration-200',
            {
              'ml-auto': isCollapsed,
            }
          )}
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? (
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          ) : (
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation chính */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <NavigationItem key={item.name} item={item} />
        ))}
      </nav>

      {/* Navigation phụ (bottom) */}
      <div className="px-2 py-3 border-t border-secondary-200 dark:border-secondary-700 space-y-1">
        {bottomNavigationItems.map((item) => (
          <NavigationItem key={item.name} item={item} isBottom />
        ))}
        
        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={clsx(
            'group flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
            'text-danger-600 hover:bg-danger-50 hover:text-danger-700 dark:text-danger-400 dark:hover:bg-danger-900/20',
            {
              'justify-center': isCollapsed,
              'justify-start': !isCollapsed,
            }
          )}
          title={isCollapsed ? 'Đăng xuất' : undefined}
        >
          <ArrowRightOnRectangleIcon className={clsx(
            'flex-shrink-0',
            {
              'h-5 w-5': !isCollapsed,
              'h-6 w-6': isCollapsed,
            }
          )} />
          
          {!isCollapsed && (
            <span className="ml-3 flex-1 text-left">
              Đăng xuất
            </span>
          )}
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-secondary-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Đăng xuất
            </div>
          )}
        </button>
      </div>

      {/* User info khi không collapsed */}
      {!isCollapsed && user && (
        <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 dark:text-white truncate">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Sidebar; 
