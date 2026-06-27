// Enums for the Zero-Knowledge File Encryption Application

export enum EncryptionAlgorithm {
  AES_256_GCM = 'AES-256-GCM',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305',
  XCHACHA20_POLY1305 = 'XChaCha20-Poly1305',
  CAMELLIA_256_GCM = 'Camellia-256-GCM',
  AES_256_CBC = 'AES-256-CBC'
}

export enum KeyDerivationFunction {
  ARGON2ID = 'Argon2id',
  PBKDF2 = 'PBKDF2',
  SCRYPT = 'Scrypt'
}

export enum EncryptionMode {
  SINGLE = 'single',
  MULTI = 'multi',
  FOLDER = 'folder'
}

export enum SignatureAlgorithm {
  ED25519 = 'Ed25519',
  DILITHIUM3 = 'Dilithium3',
  DILITHIUM5 = 'Dilithium5'
}

export enum KeyWrapAlgorithm {
  X25519 = 'X25519',
  KYBER1024 = 'Kyber1024'
}

export enum FileStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum SystemHealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error'
}

export enum ActivityType {
  FILE_UPLOAD = 'file_upload',
  FILE_DOWNLOAD = 'file_download',
  FILE_DELETE = 'file_delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  SECURITY_EVENT = 'security_event',
  PASSWORD_CHANGE = 'password_change',
  OTP_ENABLE = 'otp_enable',
  OTP_DISABLE = 'otp_disable'
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export enum PasswordStrength {
  WEAK = 'weak',
  MEDIUM = 'medium',
  GOOD = 'good',
  STRONG = 'strong'
}