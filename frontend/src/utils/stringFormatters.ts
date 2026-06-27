// String formatters for the Zero-Knowledge File Encryption Application
import { EncryptionAlgorithm, KeyDerivationFunction, SignatureAlgorithm, SystemHealthStatus, ActivityType, PasswordStrength } from '../types/enums';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatAlgorithmName = (algorithm: EncryptionAlgorithm): string => {
  switch (algorithm) {
    case EncryptionAlgorithm.AES_256_GCM:
      return 'AES-256-GCM (Recommended)';
    case EncryptionAlgorithm.CHACHA20_POLY1305:
      return 'ChaCha20-Poly1305';
    case EncryptionAlgorithm.XCHACHA20_POLY1305:
      return 'XChaCha20-Poly1305';
    case EncryptionAlgorithm.CAMELLIA_256_GCM:
      return 'Camellia-256-GCM';
    case EncryptionAlgorithm.AES_256_CBC:
      return 'AES-256-CBC (Legacy)';
    default:
      return algorithm;
  }
};

export const formatKeyDerivationName = (kdf: KeyDerivationFunction): string => {
  switch (kdf) {
    case KeyDerivationFunction.ARGON2ID:
      return 'Argon2id (Recommended)';
    case KeyDerivationFunction.PBKDF2:
      return 'PBKDF2';
    case KeyDerivationFunction.SCRYPT:
      return 'Scrypt';
    default:
      return kdf;
  }
};

export const formatSignatureAlgorithmName = (algorithm: SignatureAlgorithm): string => {
  switch (algorithm) {
    case SignatureAlgorithm.ED25519:
      return 'Ed25519 (Classic)';
    case SignatureAlgorithm.DILITHIUM3:
      return 'Dilithium3 (Post-Quantum)';
    case SignatureAlgorithm.DILITHIUM5:
      return 'Dilithium5 (Post-Quantum)';
    default:
      return algorithm;
  }
};

export const formatSystemHealthStatus = (status: SystemHealthStatus): string => {
  switch (status) {
    case SystemHealthStatus.HEALTHY:
      return 'Khỏe mạnh';
    case SystemHealthStatus.WARNING:
      return 'Cảnh báo';
    case SystemHealthStatus.ERROR:
      return 'Lỗi';
    default:
      return 'Không xác định';
  }
};

export const formatActivityType = (type: ActivityType): string => {
  switch (type) {
    case ActivityType.FILE_UPLOAD:
      return 'Tải lên file';
    case ActivityType.FILE_DOWNLOAD:
      return 'Tải xuống file';
    case ActivityType.FILE_DELETE:
      return 'Xóa file';
    case ActivityType.LOGIN:
      return 'Đăng nhập';
    case ActivityType.LOGOUT:
      return 'Đăng xuất';
    case ActivityType.SECURITY_EVENT:
      return 'Sự kiện bảo mật';
    case ActivityType.PASSWORD_CHANGE:
      return 'Đổi mật khẩu';
    case ActivityType.OTP_ENABLE:
      return 'Bật OTP';
    case ActivityType.OTP_DISABLE:
      return 'Tắt OTP';
    default:
      return 'Hoạt động khác';
  }
};

export const formatPasswordStrength = (strength: PasswordStrength): string => {
  switch (strength) {
    case PasswordStrength.WEAK:
      return 'Yếu';
    case PasswordStrength.MEDIUM:
      return 'Trung bình';
    case PasswordStrength.GOOD:
      return 'Tốt';
    case PasswordStrength.STRONG:
      return 'Mạnh';
    default:
      return 'Không xác định';
  }
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Vừa xong';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} tháng trước`;
  return `${Math.floor(diffInSeconds / 31536000)} năm trước`;
};

export const formatProgress = (current: number, total: number): string => {
  const percentage = Math.round((current / total) * 100);
  return `${percentage}%`;
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};