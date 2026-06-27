import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './UI/LoadingSpinner';

// ==================================================
// PUBLIC ROUTE COMPONENT - Component cho các routes công khai (login, register)
// ==================================================

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component PublicRoute - Dành cho các trang công khai như login, register
 * 
 * Cách hoạt động:
 * 1. Kiểm tra trạng thái đăng nhập của user từ AuthContext
 * 2. Nếu đang loading: hiển thị loading spinner
 * 3. Nếu chưa đăng nhập: hiển thị component con (children)
 * 4. Nếu đã đăng nhập: redirect đến dashboard hoặc intended destination
 * 
 * Use case: Ngăn user đã đăng nhập truy cập lại trang login/register
 * 
 * @param children React components (thường là login/register form)
 * @param redirectTo Đường dẫn redirect khi đã đăng nhập (mặc định: '/dashboard')
 * @returns JSX element hoặc Navigate component
 */
const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  redirectTo = '/dashboard' 
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

  // Nếu đã đăng nhập, redirect đến dashboard hoặc intended destination
  if (isAuthenticated) {
    // Kiểm tra có intended destination từ ProtectedRoute không
    const intendedDestination = location.state?.from || redirectTo;
    
    return (
      <Navigate 
        to={intendedDestination} 
        replace 
      />
    );
  }

  // Nếu chưa đăng nhập, hiển thị component con (login/register form)
  return <>{children}</>;
};

export default PublicRoute; 
