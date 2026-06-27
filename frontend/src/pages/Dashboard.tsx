import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentIcon,
  ServerIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { DashboardService } from '../services/dashboard.service';
import { UserService } from '../services/user.service';
import { formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import DashboardCharts from '../components/DashboardCharts';

import clsx from 'clsx';

// ==================================================
// DASHBOARD PAGE - Trang dashboard chính
// ==================================================

/**
 * Dashboard Component - Trang tổng quan hệ thống với advanced charts
 * 
 * Features:
 * 1. Overview statistics cards
 * 2. Advanced charts và analytics
 * 3. Recent files list
 * 4. Algorithm usage chart
 * 5. System health status
 * 6. Quick action buttons
 * 7. Recent activity feed
 */
const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // ==================================================
  // STATE MANAGEMENT - Quản lý state
  // ==================================================

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [fileStats] = useState<any>(null);
  const [securityStats] = useState<any>(null);
  const [usageStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==================================================
  // DATA FETCHING - Lấy dữ liệu từ API
  // ==================================================

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is authenticated
      if (!user) {
        // User not authenticated, showing empty dashboard
        setDashboardData({
          totalFiles: 0,
          totalSize: 0,
          encryptedToday: 0,
          securityEvents: 0,
          algorithmsUsed: {},
          recentFiles: []
        });
        setSystemHealth({
          status: 'healthy',
          database: 'connected',
          storage: 'available',
          encryption: 'operational'
        });
        setIsLoading(false);
        return;
      }

      // User data available for dashboard

      // Fetch multiple data sources in parallel including user data
      const [stats, files, health, activity, userProfile] = await Promise.allSettled([
        DashboardService.getDashboardStats(),
        DashboardService.getRecentFiles(5),
        DashboardService.getSystemHealth(),
        DashboardService.getRecentActivity(10),
        UserService.getCurrentUser(),
      ]);

      // Handle dashboard stats
      if (stats.status === 'fulfilled') {
        // Map the response to expected format
        const mappedData = {
          totalFiles: stats.value.total_files || 0,
          totalSize: stats.value.total_size || 0,
          encryptedToday: stats.value.encrypted_today || 0,
          securityEvents: 0, // stats.value.security_events || 0,
          algorithmsUsed: stats.value.encryption_algorithms_used || {},
          recentFiles: stats.value.recent_files || []
        };

        // Dashboard data mapped successfully

        setDashboardData(mappedData);
      }

      // Handle recent files
      if (files.status === 'fulfilled') {
        setRecentFiles(files.value);
      }

      // Handle system health
      if (health.status === 'fulfilled') {
        setSystemHealth(health.value);
      }

      // Handle recent activity
      if (activity.status === 'fulfilled') {
        setRecentActivity(activity.value);
      }

      // Update user context with fresh data
      if (userProfile.status === 'fulfilled') {
        // User data is already handled by auth context, but we could update it here if needed
        // User profile refreshed
      }

    } catch (error: any) {
      // Failed to fetch dashboard data
      setError('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto refresh mỗi 5 phút
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ==================================================
  // UTILITY FUNCTIONS - Các hàm tiện ích
  // ==================================================

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string | undefined): string => {
    if (!status) {
      return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
    
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'error':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file_upload':
        return <DocumentIcon className="h-4 w-4 text-blue-500" />;
      case 'file_download':
        return <DocumentIcon className="h-4 w-4 text-green-500" />;
      case 'login':
        return <ShieldCheckIcon className="h-4 w-4 text-purple-500" />;
      case 'security_event':
        return <ShieldCheckIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  // ==================================================
  // LOADING STATE - Trạng thái loading
  // ==================================================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // ==================================================
  // ERROR STATE - Trạng thái lỗi
  // ==================================================

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Lỗi tải dữ liệu
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ==================================================
  // MAIN RENDER - Render chính
  // ==================================================

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-secondary-600 dark:text-secondary-400">
            Chào mừng trở lại, {user?.username || 'User'}!
          </p>
        </div>
        <div className="flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
          <Link
            to="/encrypt"
            className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-center text-sm sm:text-base"
          >
            Mã hóa File
          </Link>
          <Link
            to="/files"
            className="px-3 sm:px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-center text-sm sm:text-base"
          >
            Quản lý File
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-3 sm:p-4">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex-shrink-0">
                <DocumentIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-secondary-600 dark:text-secondary-400">
                  Tổng file
                </p>
                <p className="text-lg sm:text-2xl font-bold text-secondary-900 dark:text-white">
                  {dashboardData?.totalFiles || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-3 sm:p-4">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 dark:bg-success-900/20 rounded-lg flex-shrink-0">
                <ServerIcon className="h-5 w-5 sm:h-6 sm:w-6 text-success-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-secondary-600 dark:text-secondary-400">
                  Dung lượng đã dùng
                </p>
                <p className="text-lg sm:text-2xl font-bold text-secondary-900 dark:text-white">
                  {formatFileSize(dashboardData?.totalSize || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-3 sm:p-4">
            <div className="flex items-center">
              <div className="p-2 bg-warning-100 dark:bg-warning-900/20 rounded-lg flex-shrink-0">
                <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-warning-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-secondary-600 dark:text-secondary-400">
                  Mã hóa hôm nay
                </p>
                <p className="text-lg sm:text-2xl font-bold text-secondary-900 dark:text-white">
                  {dashboardData?.encryptedToday || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-3 sm:p-4">
            <div className="flex items-center">
              <div className="p-2 bg-danger-100 dark:bg-danger-900/20 rounded-lg flex-shrink-0">
                <CpuChipIcon className="h-5 w-5 sm:h-6 sm:w-6 text-danger-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-secondary-600 dark:text-secondary-400">
                  Thuật toán sử dụng
                </p>
                <p className="text-lg sm:text-2xl font-bold text-secondary-900 dark:text-white">
                  {Object.keys(dashboardData?.algorithmsUsed || {}).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-3 sm:p-4">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3 sm:mb-4">
          Analytics & Charts
        </h2>
        <DashboardCharts
          fileStats={fileStats}
          securityStats={securityStats}
          usageStats={{
            algorithms: dashboardData?.algorithmsUsed ? Object.entries(dashboardData.algorithmsUsed).map(([name, count]) => ({
              name,
              usage: count
            })) : []
          }}
        />
      </div>

      {/* Recent Files & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Recent Files */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
              File gần đây
            </h3>
            <Link
              to="/files"
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="space-y-2">
            {(dashboardData?.recentFiles || []).length > 0 ? (
              (dashboardData?.recentFiles || []).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <DocumentIcon className="h-5 w-5 text-primary-500" />
                    <div>
                      <p className="text-sm font-medium text-secondary-900 dark:text-white">
                        {file.original_name || file.filename}
                      </p>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        {formatFileSize(file.file_size || file.original_size || file.size || 0)} • {file.encryption_algorithm || file.algorithm || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-secondary-500 dark:text-secondary-400">
                    {(file.uploaded_at || file.timestamp) ? formatDistance(new Date(file.uploaded_at || file.timestamp), new Date(), {
                      addSuffix: true,
                      locale: vi,
                    }) : 'Unknown'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-secondary-500 dark:text-secondary-400 text-center py-4">
                Chưa có file nào
              </p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">
            Hoạt động gần đây
          </h3>
          <div className="space-y-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center space-x-3 p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg"
                >
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <p className="text-sm text-secondary-900 dark:text-white">
                      {activity.description}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400">
                      {activity.timestamp ? formatDistance(new Date(activity.timestamp), new Date(), {
                        addSuffix: true,
                        locale: vi,
                      }) : 'Unknown'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-secondary-500 dark:text-secondary-400 text-center py-4">
                Chưa có hoạt động nào
              </p>
            )}
          </div>
        </div>
      </div>

      {/* System Health */}
      {systemHealth && (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">
            Tình trạng hệ thống
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div key="database" className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg">
              <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                Database
              </span>
              <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(systemHealth.database))}>
                {systemHealth.database}
              </span>
            </div>
            <div key="storage" className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg">
              <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                Storage
              </span>
              <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(systemHealth.storage))}>
                {systemHealth.storage}
              </span>
            </div>
            <div key="security" className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg">
              <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                Security
              </span>
              <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(systemHealth.security))}>
                {systemHealth.security}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 
