import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import MainLayout from './components/Layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import EncryptPage from './pages/EncryptPage';
import AdvancedEncryptPage from './pages/AdvancedEncryptPage';
import HybridEncryptPage from './pages/HybridEncryptPage';
import DecryptPage from './pages/DecryptPage';
import DigitalSignatureV2 from './components/Security/DigitalSignatureV2';
import FilesPage from './pages/FilesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyOTPPage from './pages/VerifyOTPPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';

// ==================================================
// APP COMPONENT - Component chính của ứng dụng
// ==================================================

// Tạo QueryClient cho React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Initialize app start time for dashboard uptime calculation
if (!sessionStorage.getItem('appStartTime')) {
  sessionStorage.setItem('appStartTime', Date.now().toString());
}

/**
 * App Component - Root component của ứng dụng React
 *
 * Cấu trúc:
 * 1. QueryClientProvider - Quản lý state server với React Query
 * 2. ThemeProvider - Quản lý theme (light/dark mode)
 * 3. Router - Điều hướng với React Router
 * 4. AuthProvider - Context cho authentication
 * 5. Routes - Định nghĩa các routes của ứng dụng
 * 
 * Routes:
 * - Public routes: /login, /register (chỉ accessible khi chưa đăng nhập)
 * - Protected routes: /dashboard, /encrypt, /files, etc. (yêu cầu đăng nhập)
 */
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
              <Routes>
                {/* ==================================================
                    PUBLIC ROUTES - Routes công khai (login, register)
                    ================================================== */}
                
                {/* Login Page */}
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  } 
                />
                
                {/* Register Page */}
                <Route 
                  path="/register" 
                  element={
                    <PublicRoute>
                      <RegisterPage />
                    </PublicRoute>
                  } 
                />

                {/* Email Verification Page */}
                <Route 
                  path="/verify-email" 
                  element={
                    <PublicRoute>
                      <EmailVerificationPage />
                    </PublicRoute>
                  } 
                />

                {/* OTP Verification Page */}
                <Route 
                  path="/verify-otp" 
                  element={
                    <PublicRoute>
                      <VerifyOTPPage />
                    </PublicRoute>
                  } 
                />

                {/* Forgot Password Page */}
                <Route 
                  path="/forgot-password" 
                  element={
                    <PublicRoute>
                      <ForgotPasswordPage />
                    </PublicRoute>
                  } 
                />

                {/* Reset Password Page */}
                <Route 
                  path="/reset-password" 
                  element={
                    <PublicRoute>
                      <ResetPasswordPage />
                    </PublicRoute>
                  } 
                />

                {/* ==================================================
                    PROTECTED ROUTES - Routes yêu cầu authentication
                    ================================================== */}
                
                {/* Main Application Routes */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Dashboard - Trang chủ */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  
                  {/* File Encryption - Mã hóa file */}
                  <Route path="encrypt" element={<EncryptPage />} />

                  {/* File Decryption - Giải mã file */}
                  <Route path="decrypt" element={<DecryptPage />} />

                  {/* Digital Signatures - Chữ ký số */}
                  <Route path="signatures" element={<div className="p-6"><DigitalSignatureV2 /></div>} />

                  {/* Hybrid Encryption - Mã hóa lai */}
                  <Route path="hybrid" element={<HybridEncryptPage />} />

                  {/* Advanced Encryption - Mã hóa nâng cao */}
                  <Route path="advanced" element={<AdvancedEncryptPage />} />

                  {/* File Management - Quản lý file */}
                  <Route path="files" element={<FilesPage />} />
                  
                  {/* Analytics - Thống kê */}
                  {/* Ẩn/giảm tải Analytics để tránh lỗi dependency thiếu */}
                  {/* <Route path="analytics" element={<AnalyticsPage />} /> */}

                  {/* Settings - Cài đặt */}
                  <Route path="security" element={<SettingsPage />} />

                  {/* Profile - Thông tin cá nhân */}
                  <Route path="profile" element={<ProfilePage />} />

                  {/* Settings - Cài đặt ứng dụng */}
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* ==================================================
                    FALLBACK ROUTES - Routes xử lý trường hợp không tìm thấy
                    ================================================== */}
                
                {/* 404 Not Found */}
                <Route 
                  path="*" 
                  element={
                    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold text-secondary-900 dark:text-white mb-4">
                          404
                        </h1>
                        <p className="text-secondary-600 dark:text-secondary-400 mb-6">
                          Trang bạn tìm kiếm không tồn tại
                        </p>
                        <a
                          href="/dashboard"
                          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                        >
                          Về trang chủ
                        </a>
                      </div>
                    </div>
                  }
                />
              </Routes>
            </div>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
