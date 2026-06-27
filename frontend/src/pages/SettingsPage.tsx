import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  CogIcon,
  UserIcon,
  ShieldCheckIcon,
  BellIcon,
  PaintBrushIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { UserService, type UserProfile, type UserSettings } from '../services/user.service';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/UI/LoadingSpinner';

// ==================================================
// SETTINGS PAGE - Trang cài đặt người dùng
// ==================================================

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // User data states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    username: '',
    full_name: '',
    email: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);

        // Load user profile first (required)
        const profile = await UserService.getCurrentUser();
        setUserProfile(profile);
        setProfileForm({
          username: profile.username,
          full_name: profile.username || '',
          email: profile.email || ''
        });

        // Try to load settings (optional)
        try {
          const settings = await UserService.getUserSettings();
          setUserSettings(settings);
        } catch (settingsError) {
          console.warn('Could not load user settings, using defaults:', settingsError);
          // Use default settings if API fails
          setUserSettings({
            notifications: {
              email_enabled: true,
              security_alerts: true,
              activity_summary: false
            },
            security: {
              session_timeout: 30,
              require_2fa: false,
              login_notifications: true
            },
            preferences: {
              theme: 'dark' as const,
              language: 'vi',
              timezone: 'Asia/Ho_Chi_Minh'
            }
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        toast.error('Không thể tải thông tin người dùng');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const success = await UserService.updateProfile(profileForm);
      if (success) {
        toast.success('Cập nhật thông tin thành công');
        // Refresh profile data
        const updatedProfile = await UserService.getCurrentUser();
        setUserProfile(updatedProfile);
      } else {
        toast.error('Không thể cập nhật thông tin');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsSaving(true);
      const success = await UserService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      if (success) {
        toast.success('Đổi mật khẩu thành công');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error('Không thể đổi mật khẩu');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Có lỗi xảy ra khi đổi mật khẩu');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle settings update
  const handleSettingsUpdate = async (section: keyof UserSettings, updates: any) => {
    if (!userSettings) return;

    try {
      const newSettings = {
        ...userSettings,
        [section]: { ...userSettings[section], ...updates }
      };

      const success = await UserService.updateUserSettings(newSettings);
      if (success) {
        setUserSettings(newSettings);
        toast.success('Cập nhật cài đặt thành công');
      } else {
        toast.error('Không thể cập nhật cài đặt');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Có lỗi xảy ra khi cập nhật cài đặt');
    }
  };

  // Handle 2FA toggle
  const handle2FAToggle = async () => {
    if (!userProfile) return;

    try {
      setIsSaving(true);
      const result = await UserService.toggle2FA(!userProfile.twofa_enabled);

      if (result.success) {
        const updatedProfile = { ...userProfile, twofa_enabled: !userProfile.twofa_enabled };
        setUserProfile(updatedProfile);

        if (updatedProfile.twofa_enabled) {
          toast.success('Đã bật xác thực 2 yếu tố');
          if (result.qr_code) {
            // Show QR code modal here
            // QR Code generated
          }
        } else {
          toast.success('Đã tắt xác thực 2 yếu tố');
        }
      } else {
        toast.error('Không thể thay đổi cài đặt 2FA');
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast.error('Có lỗi xảy ra khi thay đổi cài đặt 2FA');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle notification toggle
  const handleNotificationToggle = async (notificationType: string) => {
    if (!userSettings) return;

    try {
      setIsSaving(true);

      const currentValue = userSettings.notifications?.[notificationType] || false;
      const newNotifications = {
        ...userSettings.notifications,
        [notificationType]: !currentValue
      };

      const result = await UserService.updateUserSettings({
        notifications: newNotifications
      });

      if (result) {
        setUserSettings(prev => prev ? {
          ...prev,
          notifications: newNotifications
        } : null);

        toast.success(`Đã ${!currentValue ? 'bật' : 'tắt'} thông báo ${
          notificationType === 'login_notifications' ? 'đăng nhập' :
          notificationType === 'password_change_notifications' ? 'thay đổi mật khẩu' :
          'bảo mật'
        }`);
      } else {
        toast.error('Không thể thay đổi cài đặt thông báo');
      }
    } catch (error) {
      console.error('Error toggling notification:', error);
      toast.error('Có lỗi xảy ra khi thay đổi cài đặt thông báo');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Thông tin cá nhân', icon: UserIcon },
    { id: 'security', name: 'Bảo mật', icon: ShieldCheckIcon },
    { id: 'notifications', name: 'Thông báo', icon: BellIcon },
    { id: 'preferences', name: 'Tùy chọn', icon: PaintBrushIcon },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Cài đặt
        </h1>
        <p className="text-sm sm:text-base text-secondary-600 dark:text-secondary-400">
          Quản lý thông tin cá nhân và cài đặt bảo mật
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                )}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-4 sm:p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                  Thông tin cá nhân
                </h2>

                {userProfile && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={userProfile.email}
                          disabled
                          className="w-full px-3 py-2 border border-secondary-300 rounded-md bg-secondary-50 dark:bg-secondary-700 dark:border-secondary-600 text-secondary-500 dark:text-secondary-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                          Trạng thái xác thực
                        </label>
                        <div className="flex items-center">
                          <span className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            userProfile.is_verified
                              ? 'bg-success-100 dark:bg-success-900/20 text-success-800 dark:text-success-200'
                              : 'bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200'
                          )}>
                            {userProfile.is_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                          Tên người dùng
                        </label>
                        <input
                          type="text"
                          value={profileForm.username}
                          onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                          className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                          Tên đầy đủ
                        </label>
                        <input
                          type="text"
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                          className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                      >
                        {isSaving ? <LoadingSpinner size="small" className="mr-2" /> : null}
                        Cập nhật thông tin
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                  Cài đặt bảo mật
                </h2>

                {/* 2FA Section */}
                {userProfile && (
                  <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-secondary-900 dark:text-white">
                          Xác thực 2 yếu tố (2FA)
                        </h3>
                        <p className="text-xs text-secondary-500 dark:text-secondary-400">
                          Tăng cường bảo mật cho tài khoản của bạn
                        </p>
                      </div>
                      <button
                        onClick={handle2FAToggle}
                        disabled={isSaving}
                        className={clsx(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                          userProfile.twofa_enabled
                            ? 'bg-primary-600'
                            : 'bg-secondary-200 dark:bg-secondary-700'
                        )}
                      >
                        <span
                          className={clsx(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            userProfile.twofa_enabled ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}



                {/* Change Password Section */}
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <h3 className="text-sm font-medium text-secondary-900 dark:text-white">
                    Đổi mật khẩu
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Mật khẩu hiện tại
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.current ? (
                          <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-secondary-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.new ? (
                          <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-secondary-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.confirm ? (
                          <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-secondary-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSaving ? <LoadingSpinner size="small" className="mr-2" /> : <KeyIcon className="h-4 w-4 mr-2" />}
                    Đổi mật khẩu
                  </button>
                </form>
              </div>
            )}

            {/* Add other tabs content here */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                    Cài đặt thông báo
                  </h2>
                  <p className="text-secondary-600 dark:text-secondary-400 mt-2">
                    Quản lý các thông báo email và cảnh báo bảo mật
                  </p>
                </div>

                {/* Email Notifications Section */}
                {userSettings && (
                  <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-6">
                    <h3 className="text-base font-medium text-secondary-900 dark:text-white mb-4">
                      Thông báo Email
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-secondary-900 dark:text-white">Thông báo đăng nhập</p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400">
                            Nhận email khi có đăng nhập từ thiết bị mới hoặc địa điểm lạ
                          </p>
                        </div>
                        <button
                          onClick={() => handleNotificationToggle('login_notifications')}
                          disabled={isSaving}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                            userSettings.notifications?.email_enabled
                              ? 'bg-primary-600'
                              : 'bg-secondary-200 dark:bg-secondary-700'
                          )}
                        >
                          <span
                            className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              userSettings.notifications?.email_enabled ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-secondary-900 dark:text-white">Thông báo thay đổi mật khẩu</p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400">
                            Nhận email xác nhận khi mật khẩu được thay đổi
                          </p>
                        </div>
                        <button
                          onClick={() => handleNotificationToggle('password_change_notifications')}
                          disabled={isSaving}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                            userSettings.notifications?.security_alerts
                              ? 'bg-primary-600'
                              : 'bg-secondary-200 dark:bg-secondary-700'
                          )}
                        >
                          <span
                            className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              userSettings.notifications?.security_alerts ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-secondary-900 dark:text-white">Thông báo hoạt động bảo mật</p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400">
                            Nhận email về các hoạt động bảo mật quan trọng và cảnh báo
                          </p>
                        </div>
                        <button
                          onClick={() => handleNotificationToggle('security_notifications')}
                          disabled={isSaving}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                            userSettings.notifications?.activity_summary
                              ? 'bg-primary-600'
                              : 'bg-secondary-200 dark:bg-secondary-700'
                          )}
                        >
                          <span
                            className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              userSettings.notifications?.activity_summary ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <BellIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Lưu ý về thông báo
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Các thông báo email giúp bạn theo dõi hoạt động tài khoản và phát hiện sớm các truy cập trái phép.
                            Khuyến nghị bật tất cả thông báo để đảm bảo bảo mật tối đa.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                  Tùy chọn cá nhân
                </h2>
                <p className="text-secondary-600 dark:text-secondary-400">
                  Tính năng này sẽ được triển khai trong phiên bản tiếp theo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

