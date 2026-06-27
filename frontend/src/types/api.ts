// ==================================================
// API RESPONSE TYPES - Định nghĩa cấu trúc response từ API
// ==================================================

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  detail?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================================================
// USER & AUTHENTICATION TYPES - Quản lý người dùng và xác thực
// ==================================================

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  last_login?: string;
  is_verified: boolean;
  twofa_enabled: boolean;
  is_active: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  captcha_token?: string;
}

export interface LoginResponse {
  success?: boolean;
  access_token?: string;
  token_type?: string;
  message?: string;
  require_otp?: boolean;
  otp_required?: boolean;
  email?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  email_verification_required: boolean;
  email: string;
}

export interface EmailVerificationRequest {
  email: string;
  otp: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

// ==================================================
// TOTP/2FA TYPES - Xác thực hai yếu tố
// ==================================================

export interface TOTPSetupResponse extends ApiResponse {
  qr_code: string;
  secret: string;
  backup_codes: string[];
}

export interface TOTPVerifyRequest {
  totp_code: string;
}

// ==================================================
// FILE ENCRYPTION TYPES - Mã hóa file
// ==================================================

export interface EncryptionAlgorithm {
  name: string;
  description: string;
  key_size: number;
  block_size?: number;
}

export interface FileEncryptionMetadata {
  id: string;
  filename: string;
  original_size: number;
  encrypted_size: number;
  algorithm: string;
  key_derivation: string;
  salt: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  file_hash: string;
  is_deleted: boolean;
}

export interface EncryptFileRequest {
  algorithm: string;
  password: string;
  key_derivation: string;
}

export interface EncryptFileResponse extends ApiResponse {
  file_id: string;
  download_url: string;
  metadata: FileEncryptionMetadata;
}

export interface DecryptFileRequest {
  file_id: string;
  password: string;
}

export interface DecryptFileResponse extends ApiResponse {
  download_url: string;
  filename: string;
  expires_at: string;
}

// ==================================================
// FILE UPLOAD TYPES - Upload file
// ==================================================

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadedFile {
  file: File;
  progress: FileUploadProgress;
  status: 'pending' | 'uploading' | 'encrypting' | 'completed' | 'error';
  error?: string;
  result?: EncryptFileResponse;
}

// ==================================================
// CRYPTO ALGORITHMS - Danh sách thuật toán mã hóa
// ==================================================

export interface CryptoAlgorithmsResponse extends ApiResponse {
  encryption_algorithms: EncryptionAlgorithm[];
  key_derivation_functions: string[];
  hash_algorithms: string[];
}

// ==================================================
// DASHBOARD STATISTICS - Thống kê dashboard
// ==================================================

export interface DashboardStats {
  total_files: number;
  total_size: number;
  encrypted_today: number;
  encryption_algorithms_used: Record<string, number>;
  recent_files: FileEncryptionMetadata[];
}

export interface DashboardResponse extends ApiResponse<DashboardStats> {}

// ==================================================
// ERROR TYPES - Xử lý lỗi
// ==================================================

export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ==================================================
// FORM TYPES - Các form trong ứng dụng
// ==================================================

export interface LoginFormData {
  email: string;
  password: string;
  totp_code?: string;
  remember_me: boolean;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}

export interface EncryptionFormData {
  algorithm: string;
  password: string;
  confirm_password: string;
  key_derivation: string;
}

// ==================================================
// UTILITY TYPES - Các type tiện ích
// ==================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  language: string;
  auto_logout: number;
  show_tooltips: boolean;
} 