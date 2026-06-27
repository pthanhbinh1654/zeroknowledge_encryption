import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './UI/LoadingSpinner';

// ==================================================
// PROTECTED ROUTE COMPONENT - Component bảo vệ routes yêu cầu authentication
// ==================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component ProtectedRoute - Bảo vệ các route yêu cầu đăng nhập
 * 
 * Cách hoạt động:
 * 1. Kiểm tra trạng thái đăng nhập của user từ AuthContext
 * 2. Nếu đang loading: hiển thị loading spinner
 * 3. Nếu đã đăng nhập: hiển thị component con (children)
 * 4. Nếu chưa đăng nhập: redirect đến trang login với state chứa intended destination
 * 
 * @param children React components cần được bảo vệ
 * @param redirectTo Đường dẫn redirect (mặc định: '/login')
 * @returns JSX element hoặc Navigate component
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Nếu đang loading authentication state, hiển thị loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Nếu chưa đăng nhập, redirect đến login page
  // Lưu current location để redirect back sau khi login
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location.pathname,
          message: 'Vui lòng đăng nhập để tiếp tục' 
        }}
        replace 
      />
    );
  }

  // Nếu đã đăng nhập, hiển thị component con
  return <>{children}</>;
};

export default ProtectedRoute; 
