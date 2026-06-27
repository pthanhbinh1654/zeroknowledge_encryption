# Authentication - OTP, JWT và Session Management

## Mục Đích và Phạm Vi

Module Authentication cung cấp hệ thống xác thực bảo mật đa lớp với OTP (One-Time Password), JWT tokens, và session management hiện đại. Đảm bảo tách biệt hoàn toàn với crypto operations theo nguyên tắc Zero Knowledge.

## Kiến Trúc Authentication

```
┌─────────────────────────────────────────────────────────────┐
│                Authentication Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Frontend Auth Layer                     │ │
│  │  • Login Form • OTP Input • Session Management          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Auth Service Layer                      │ │
│  │  • AuthService • OTPService • TokenService              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Backend Auth Layer                      │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │    JWT      │ │     OTP     │ │      Session        │ │ │
│  │  │ Management  │ │  Generation │ │    Management       │ │ │
│  │  │             │ │             │ │                     │ │ │
│  │  │• Access     │ │• TOTP       │ │• Redis Store        │ │ │
│  │  │• Refresh    │ │• Email/SMS  │ │• Rate Limiting      │ │ │
│  │  │• Validation │ │• Validation │ │• Device Tracking    │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 External Services                       │ │
│  │  • SendGrid (Email) • Twilio (SMS) • hCaptcha          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## JWT Token Management

### 1. Token Structure
```typescript
// JWT Payload Structure
interface JWTPayload {
  // Standard claims
  sub: string;          // User ID
  iat: number;          // Issued at
  exp: number;          // Expiration time
  jti: string;          // JWT ID (unique)
  iss: string;          // Issuer
  aud: string;          // Audience
  
  // Custom claims
  email: string;
  role: string;
  permissions: string[];
  session_id: string;
  device_id: string;
  
  // Security claims
  ip_address: string;
  user_agent_hash: string;
  two_factor_verified: boolean;
}

// Token pair structure
interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}
```

### 2. JWT Service Implementation
```typescript
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string = '15m';
  private refreshTokenExpiry: string = '7d';
  
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
  }
  
  // Generate token pair
  generateTokenPair(
    userId: string,
    sessionId: string,
    userInfo: {
      email: string;
      role: string;
      permissions: string[];
    },
    deviceInfo: {
      ip_address: string;
      user_agent: string;
      device_id: string;
    }
  ): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const accessJti = uuidv4();
    const refreshJti = uuidv4();
    
    // Access token payload
    const accessPayload: JWTPayload = {
      sub: userId,
      iat: now,
      exp: now + (15 * 60), // 15 minutes
      jti: accessJti,
      iss: 'zkfs-auth',
      aud: 'zkfs-app',
      email: userInfo.email,
      role: userInfo.role,
      permissions: userInfo.permissions,
      session_id: sessionId,
      device_id: deviceInfo.device_id,
      ip_address: deviceInfo.ip_address,
      user_agent_hash: this.hashUserAgent(deviceInfo.user_agent),
      two_factor_verified: true
    };
    
    // Refresh token payload (minimal)
    const refreshPayload = {
      sub: userId,
      iat: now,
      exp: now + (7 * 24 * 60 * 60), // 7 days
      jti: refreshJti,
      iss: 'zkfs-auth',
      aud: 'zkfs-refresh',
      session_id: sessionId,
      device_id: deviceInfo.device_id,
      type: 'refresh'
    };
    
    const accessToken = jwt.sign(accessPayload, this.accessTokenSecret);
    const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 15 * 60,
      token_type: 'Bearer'
    };
  }
  
  // Verify access token
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('TOKEN_EXPIRED', 'Access token đã hết hạn');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('INVALID_TOKEN', 'Access token không hợp lệ');
      }
      throw error;
    }
  }
  
  // Verify refresh token
  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('REFRESH_EXPIRED', 'Refresh token đã hết hạn');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('INVALID_REFRESH', 'Refresh token không hợp lệ');
      }
      throw error;
    }
  }
  
  // Refresh access token
  async refreshAccessToken(
    refreshToken: string,
    sessionService: SessionService
  ): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);
    
    // Validate session
    const session = await sessionService.getSession(payload.session_id);
    if (!session || !session.is_active) {
      throw new AuthError('SESSION_INVALID', 'Session không hợp lệ');
    }
    
    // Generate new token pair
    return this.generateTokenPair(
      payload.sub,
      payload.session_id,
      session.user_info,
      session.device_info
    );
  }
  
  private hashUserAgent(userAgent: string): string {
    return require('crypto')
      .createHash('sha256')
      .update(userAgent)
      .digest('hex')
      .substring(0, 16);
  }
}
```

## OTP (One-Time Password) System

### 1. OTP Generation Service
```typescript
import { authenticator } from 'otplib';
import crypto from 'crypto';

class OTPService {
  private emailService: EmailService;
  private smsService: SMSService;
  private redisClient: RedisClient;
  
  constructor(
    emailService: EmailService,
    smsService: SMSService,
    redisClient: RedisClient
  ) {
    this.emailService = emailService;
    this.smsService = smsService;
    this.redisClient = redisClient;
  }
  
  // Generate numeric OTP
  generateNumericOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }
    
    return otp;
  }
  
  // Generate TOTP (Time-based OTP)
  generateTOTP(secret: string): string {
    return authenticator.generate(secret);
  }
  
  // Send OTP via email
  async sendEmailOTP(
    email: string,
    purpose: 'registration' | 'login' | 'password_reset',
    userId?: string
  ): Promise<{
    success: boolean;
    otp_id: string;
    expires_in: number;
    development_otp?: string;
  }> {
    const otp = this.generateNumericOTP(6);
    const otpId = uuidv4();
    const expiresIn = 5 * 60; // 5 minutes
    
    // Store OTP in Redis
    const otpData = {
      otp: otp,
      email: email,
      purpose: purpose,
      user_id: userId,
      attempts: 0,
      created_at: new Date().toISOString()
    };
    
    await this.redisClient.setex(
      `otp:${otpId}`,
      expiresIn,
      JSON.stringify(otpData)
    );
    
    // Send email
    const emailTemplate = this.getEmailTemplate(purpose, otp);
    await this.emailService.sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });
    
    // Log OTP generation
    await this.logOTPActivity(userId || email, 'otp_sent', purpose);
    
    const result = {
      success: true,
      otp_id: otpId,
      expires_in: expiresIn
    };
    
    // Include OTP in development mode
    if (process.env.NODE_ENV === 'development') {
      (result as any).development_otp = otp;
    }
    
    return result;
  }
  
  // Send OTP via SMS
  async sendSMSOTP(
    phone: string,
    purpose: string,
    userId?: string
  ): Promise<{
    success: boolean;
    otp_id: string;
    expires_in: number;
  }> {
    const otp = this.generateNumericOTP(6);
    const otpId = uuidv4();
    const expiresIn = 5 * 60;
    
    // Store OTP in Redis
    const otpData = {
      otp: otp,
      phone: phone,
      purpose: purpose,
      user_id: userId,
      attempts: 0,
      created_at: new Date().toISOString()
    };
    
    await this.redisClient.setex(
      `otp:${otpId}`,
      expiresIn,
      JSON.stringify(otpData)
    );
    
    // Send SMS
    const message = `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`;
    await this.smsService.sendSMS(phone, message);
    
    await this.logOTPActivity(userId || phone, 'otp_sent', purpose);
    
    return {
      success: true,
      otp_id: otpId,
      expires_in: expiresIn
    };
  }
  
  // Verify OTP
  async verifyOTP(
    otpId: string,
    otpCode: string,
    maxAttempts: number = 3
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const otpDataStr = await this.redisClient.get(`otp:${otpId}`);
    
    if (!otpDataStr) {
      return {
        success: false,
        error: 'OTP đã hết hạn hoặc không tồn tại'
      };
    }
    
    const otpData = JSON.parse(otpDataStr);
    
    // Check attempts
    if (otpData.attempts >= maxAttempts) {
      await this.redisClient.del(`otp:${otpId}`);
      return {
        success: false,
        error: 'Đã vượt quá số lần thử cho phép'
      };
    }
    
    // Verify OTP
    if (otpData.otp !== otpCode) {
      otpData.attempts += 1;
      await this.redisClient.setex(
        `otp:${otpId}`,
        await this.redisClient.ttl(`otp:${otpId}`),
        JSON.stringify(otpData)
      );
      
      return {
        success: false,
        error: `Mã OTP không đúng. Còn ${maxAttempts - otpData.attempts} lần thử.`
      };
    }
    
    // OTP verified successfully
    await this.redisClient.del(`otp:${otpId}`);
    await this.logOTPActivity(
      otpData.user_id || otpData.email || otpData.phone,
      'otp_verified',
      otpData.purpose
    );
    
    return {
      success: true,
      data: {
        email: otpData.email,
        phone: otpData.phone,
        purpose: otpData.purpose,
        user_id: otpData.user_id
      }
    };
  }
  
  private getEmailTemplate(purpose: string, otp: string) {
    const templates = {
      registration: {
        subject: 'Xác thực tài khoản - Zero Knowledge File System',
        html: `
          <h2>Xác thực tài khoản</h2>
          <p>Mã OTP của bạn là: <strong>${otp}</strong></p>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `
      },
      login: {
        subject: 'Mã đăng nhập - Zero Knowledge File System',
        html: `
          <h2>Đăng nhập</h2>
          <p>Mã OTP đăng nhập của bạn là: <strong>${otp}</strong></p>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `
      },
      password_reset: {
        subject: 'Đặt lại mật khẩu - Zero Knowledge File System',
        html: `
          <h2>Đặt lại mật khẩu</h2>
          <p>Mã OTP để đặt lại mật khẩu: <strong>${otp}</strong></p>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `
      }
    };
    
    return templates[purpose] || templates.login;
  }
}
```

### 2. Frontend OTP Integration
```typescript
class FrontendOTPService {
  private apiClient: APIClient;
  
  constructor(apiClient: APIClient) {
    this.apiClient = apiClient;
  }
  
  // Request OTP
  async requestOTP(
    email: string,
    purpose: 'registration' | 'login' | 'password_reset'
  ): Promise<{
    success: boolean;
    otp_id: string;
    expires_in: number;
    development_otp?: string;
  }> {
    const response = await this.apiClient.post('/api/auth/request-otp', {
      email,
      purpose
    });
    
    return response.data;
  }
  
  // Verify OTP
  async verifyOTP(
    otpId: string,
    otpCode: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const response = await this.apiClient.post('/api/auth/verify-otp', {
      otp_id: otpId,
      otp_code: otpCode
    });
    
    return response.data;
  }
  
  // OTP input component helper
  createOTPInput(
    onComplete: (otp: string) => void,
    onResend: () => void
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'otp-input-container';
    
    // Create 6 input fields
    const inputs: HTMLInputElement[] = [];
    for (let i = 0; i < 6; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'otp-digit';
      input.addEventListener('input', (e) => this.handleOTPInput(e, inputs, onComplete));
      input.addEventListener('keydown', (e) => this.handleOTPKeydown(e, inputs));
      inputs.push(input);
      container.appendChild(input);
    }
    
    // Add resend button
    const resendBtn = document.createElement('button');
    resendBtn.textContent = 'Gửi lại mã';
    resendBtn.addEventListener('click', onResend);
    container.appendChild(resendBtn);
    
    return container;
  }
  
  private handleOTPInput(
    event: Event,
    inputs: HTMLInputElement[],
    onComplete: (otp: string) => void
  ): void {
    const target = event.target as HTMLInputElement;
    const index = inputs.indexOf(target);
    
    // Move to next input
    if (target.value && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
    
    // Check if all inputs are filled
    const otp = inputs.map(input => input.value).join('');
    if (otp.length === 6) {
      onComplete(otp);
    }
  }
  
  private handleOTPKeydown(
    event: KeyboardEvent,
    inputs: HTMLInputElement[]
  ): void {
    const target = event.target as HTMLInputElement;
    const index = inputs.indexOf(target);
    
    // Handle backspace
    if (event.key === 'Backspace' && !target.value && index > 0) {
      inputs[index - 1].focus();
    }
  }
}
```

## Session Management

### 1. Session Service
```typescript
interface SessionData {
  session_id: string;
  user_id: string;
  device_info: {
    ip_address: string;
    user_agent: string;
    device_id: string;
    browser: string;
    os: string;
    device_type: 'desktop' | 'mobile' | 'tablet';
  };
  security: {
    two_factor_verified: boolean;
    last_activity: Date;
    login_time: Date;
    ip_changes: string[];
  };
  tokens: {
    access_jti: string;
    refresh_jti: string;
  };
  is_active: boolean;
  expires_at: Date;
}

class SessionService {
  private redisClient: RedisClient;
  private mongoClient: MongoDBClient;
  
  constructor(redisClient: RedisClient, mongoClient: MongoDBClient) {
    this.redisClient = redisClient;
    this.mongoClient = mongoClient;
  }
  
  // Create new session
  async createSession(
    userId: string,
    deviceInfo: any,
    tokenJTIs: { access: string; refresh: string }
  ): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date();
    
    const sessionData: SessionData = {
      session_id: sessionId,
      user_id: userId,
      device_info: deviceInfo,
      security: {
        two_factor_verified: true,
        last_activity: now,
        login_time: now,
        ip_changes: []
      },
      tokens: {
        access_jti: tokenJTIs.access,
        refresh_jti: tokenJTIs.refresh
      },
      is_active: true,
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    // Store in Redis for fast access
    await this.redisClient.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(sessionData)
    );
    
    // Store in MongoDB for persistence
    await this.mongoClient.sessions.insertOne({
      ...sessionData,
      created_at: now,
      updated_at: now
    });
    
    return sessionId;
  }
  
  // Get session
  async getSession(sessionId: string): Promise<SessionData | null> {
    // Try Redis first
    const redisData = await this.redisClient.get(`session:${sessionId}`);
    if (redisData) {
      return JSON.parse(redisData);
    }
    
    // Fallback to MongoDB
    const mongoData = await this.mongoClient.sessions.findOne({
      session_id: sessionId,
      is_active: true,
      expires_at: { $gt: new Date() }
    });
    
    if (mongoData) {
      // Restore to Redis
      await this.redisClient.setex(
        `session:${sessionId}`,
        Math.floor((mongoData.expires_at.getTime() - Date.now()) / 1000),
        JSON.stringify(mongoData)
      );
      
      return mongoData;
    }
    
    return null;
  }
  
  // Update session activity
  async updateActivity(sessionId: string, ipAddress: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    
    // Check for IP change
    if (session.device_info.ip_address !== ipAddress) {
      session.security.ip_changes.push(ipAddress);
      
      // Security alert for IP change
      await this.sendSecurityAlert(session.user_id, 'ip_change', {
        old_ip: session.device_info.ip_address,
        new_ip: ipAddress
      });
    }
    
    session.security.last_activity = new Date();
    session.device_info.ip_address = ipAddress;
    
    // Update both stores
    await this.redisClient.setex(
      `session:${sessionId}`,
      await this.redisClient.ttl(`session:${sessionId}`),
      JSON.stringify(session)
    );
    
    await this.mongoClient.sessions.updateOne(
      { session_id: sessionId },
      {
        $set: {
          'security.last_activity': session.security.last_activity,
          'device_info.ip_address': ipAddress,
          'security.ip_changes': session.security.ip_changes,
          updated_at: new Date()
        }
      }
    );
  }
  
  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    // Remove from Redis
    await this.redisClient.del(`session:${sessionId}`);
    
    // Mark as inactive in MongoDB
    await this.mongoClient.sessions.updateOne(
      { session_id: sessionId },
      {
        $set: {
          is_active: false,
          revoked_at: new Date(),
          updated_at: new Date()
        }
      }
    );
  }
  
  // Revoke all user sessions
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const filter: any = { user_id: userId, is_active: true };
    if (exceptSessionId) {
      filter.session_id = { $ne: exceptSessionId };
    }
    
    const sessions = await this.mongoClient.sessions.find(filter).toArray();
    
    for (const session of sessions) {
      await this.revokeSession(session.session_id);
    }
  }
}
```

## Rate Limiting và Security

### 1. Rate Limiting Service
```typescript
class RateLimitService {
  private redisClient: RedisClient;
  
  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
  }
  
  // Check rate limit
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds);
    const redisKey = `rate_limit:${key}:${window}`;
    
    const current = await this.redisClient.incr(redisKey);
    
    if (current === 1) {
      await this.redisClient.expire(redisKey, windowSeconds);
    }
    
    const remaining = Math.max(0, limit - current);
    const resetTime = (window + 1) * windowSeconds;
    
    return {
      allowed: current <= limit,
      remaining,
      resetTime
    };
  }
  
  // Login rate limiting
  async checkLoginRateLimit(
    identifier: string // email or IP
  ): Promise<{ allowed: boolean; remaining: number }> {
    return await this.checkRateLimit(`login:${identifier}`, 5, 300); // 5 attempts per 5 minutes
  }
  
  // OTP rate limiting
  async checkOTPRateLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    return await this.checkRateLimit(`otp:${identifier}`, 3, 300); // 3 OTP requests per 5 minutes
  }
}
```

### 2. Security Monitoring
```typescript
class SecurityMonitoringService {
  private mongoClient: MongoDBClient;
  private emailService: EmailService;
  
  constructor(mongoClient: MongoDBClient, emailService: EmailService) {
    this.mongoClient = mongoClient;
    this.emailService = emailService;
  }
  
  // Log security event
  async logSecurityEvent(
    userId: string,
    eventType: string,
    details: any,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    await this.mongoClient.security_logs.insertOne({
      user_id: userId,
      event_type: eventType,
      details: details,
      severity: severity,
      timestamp: new Date(),
      ip_address: details.ip_address,
      user_agent: details.user_agent
    });
    
    // Send alert for high severity events
    if (severity === 'high') {
      await this.sendSecurityAlert(userId, eventType, details);
    }
  }
  
  // Detect suspicious activity
  async detectSuspiciousActivity(userId: string): Promise<boolean> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Check for multiple failed logins
    const failedLogins = await this.mongoClient.security_logs.countDocuments({
      user_id: userId,
      event_type: 'login_failed',
      timestamp: { $gte: last24Hours }
    });
    
    if (failedLogins >= 10) {
      await this.logSecurityEvent(userId, 'suspicious_activity', {
        reason: 'multiple_failed_logins',
        count: failedLogins
      }, 'high');
      return true;
    }
    
    // Check for logins from multiple IPs
    const uniqueIPs = await this.mongoClient.security_logs.distinct('ip_address', {
      user_id: userId,
      event_type: 'login_success',
      timestamp: { $gte: last24Hours }
    });
    
    if (uniqueIPs.length >= 5) {
      await this.logSecurityEvent(userId, 'suspicious_activity', {
        reason: 'multiple_ip_logins',
        ips: uniqueIPs
      }, 'high');
      return true;
    }
    
    return false;
  }
}
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Authentication tách biệt hoàn toàn với crypto operations
- Không lưu trữ crypto keys trong session
- JWT chỉ chứa thông tin identity, không chứa sensitive data
- OTP và session management độc lập với file encryption

### ⚠️ Lưu Ý Bảo Mật
```typescript
// Security validation for auth operations
class AuthSecurityValidator {
  static validateAuthRequest(request: any): void {
    // Ensure no crypto keys in auth requests
    const forbiddenFields = [
      'private_key', 'public_key', 'passphrase', 
      'encryption_key', 'decryption_key', 'crypto_data'
    ];
    
    for (const field of forbiddenFields) {
      if (field in request) {
        throw new Error(`Forbidden field in auth request: ${field}`);
      }
    }
  }
  
  static validateJWTPayload(payload: any): void {
    // Ensure JWT doesn't contain crypto material
    const sensitiveFields = [
      'key', 'passphrase', 'private_key', 'crypto'
    ];
    
    for (const field of sensitiveFields) {
      if (field in payload) {
        throw new Error(`Sensitive field in JWT: ${field}`);
      }
    }
  }
}
```
