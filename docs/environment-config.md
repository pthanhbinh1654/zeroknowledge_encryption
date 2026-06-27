# Environment Configuration - Biến Môi Trường và Cấu Hình Hệ Thống

## Mục Đích và Phạm Vi

Tài liệu này cung cấp hướng dẫn chi tiết về cấu hình môi trường cho hệ thống Zero Knowledge File Encryption, bao gồm biến môi trường, cấu hình services, và thiết lập bảo mật cho các môi trường development, staging và production.

## Cấu Trúc Cấu Hình

```
project-root/
├── .env.example                 # Template cho biến môi trường
├── .env.development            # Cấu hình development
├── .env.staging               # Cấu hình staging
├── .env.production            # Cấu hình production
├── docker-compose.yml         # Docker services
├── docker-compose.prod.yml    # Production Docker config
├── config/
│   ├── database.js           # Database configuration
│   ├── redis.js             # Redis configuration
│   ├── minio.js             # MinIO configuration
│   ├── email.js             # Email service config
│   └── security.js          # Security settings
└── scripts/
    ├── setup-env.sh         # Environment setup script
    ├── generate-keys.sh     # Generate crypto keys
    └── health-check.sh      # Health check script
```

## Biến Môi Trường

### 1. Core Application Settings
```bash
# .env.example

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
NODE_ENV=development                    # development, staging, production
APP_NAME="Zero Knowledge File System"
APP_VERSION=1.0.0
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
PORT=8000

# Frontend settings
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
# MongoDB
MONGODB_URI=mongodb://localhost:27017/zkfs_database
MONGODB_DB_NAME=zkfs_database
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_MAX_RETRIES=3

# =============================================================================
# STORAGE CONFIGURATION
# =============================================================================
# MinIO S3
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=encrypted-files
MINIO_SECURE=false
MINIO_REGION=us-east-1

# File upload limits
MAX_FILE_SIZE=100MB
MAX_CHUNK_SIZE=10MB
ALLOWED_FILE_TYPES=*

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================
# JWT Secrets (MUST be changed in production)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Session settings
SESSION_SECRET=your-session-secret-change-this-in-production
SESSION_TIMEOUT=3600

# Password hashing
BCRYPT_ROUNDS=12
ARGON2_MEMORY=65536
ARGON2_ITERATIONS=3
ARGON2_PARALLELISM=1

# Rate limiting
RATE_LIMIT_WINDOW=900          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT=5             # 5 attempts per window
OTP_RATE_LIMIT=3               # 3 OTP requests per window

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME="Zero Knowledge File System"

# SMTP (alternative to SendGrid)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# =============================================================================
# SMS CONFIGURATION
# =============================================================================
# Twilio
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# =============================================================================
# CAPTCHA CONFIGURATION
# =============================================================================
# hCaptcha
HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
HCAPTCHA_SECRET_KEY=your-hcaptcha-secret-key

# =============================================================================
# LOGGING & MONITORING
# =============================================================================
LOG_LEVEL=info                 # error, warn, info, debug
LOG_FORMAT=json               # json, simple
LOG_FILE_PATH=logs/app.log
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================
# Development only - DO NOT use in production
DEV_AUTO_LOGIN=false
DEV_SKIP_OTP=false
DEV_SHOW_OTP_IN_RESPONSE=true
DEV_DISABLE_RATE_LIMIT=false
DEV_ENABLE_DEBUG_ROUTES=true

# =============================================================================
# PRODUCTION SETTINGS
# =============================================================================
# SSL/TLS
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key
FORCE_HTTPS=true

# Security headers
ENABLE_HELMET=true
ENABLE_CORS=true
TRUST_PROXY=true

# Backup settings
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"    # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=zkfs-backups
```

### 2. Environment-Specific Configurations

#### Development Environment (.env.development)
```bash
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Relaxed security for development
JWT_ACCESS_EXPIRY=1h
BCRYPT_ROUNDS=4
DEV_SHOW_OTP_IN_RESPONSE=true
DEV_DISABLE_RATE_LIMIT=true

# Local services
MONGODB_URI=mongodb://localhost:27017/zkfs_dev
REDIS_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost:9000
MINIO_SECURE=false

# Debug settings
LOG_LEVEL=debug
ENABLE_DEBUG_ROUTES=true
```

#### Staging Environment (.env.staging)
```bash
NODE_ENV=staging
APP_URL=https://staging.yourdomain.com
API_URL=https://api-staging.yourdomain.com
FRONTEND_URL=https://staging.yourdomain.com

# Production-like security
JWT_ACCESS_EXPIRY=15m
BCRYPT_ROUNDS=12
DEV_SHOW_OTP_IN_RESPONSE=false
DEV_DISABLE_RATE_LIMIT=false

# Staging services
MONGODB_URI=mongodb://mongo-staging:27017/zkfs_staging
REDIS_URL=redis://redis-staging:6379/0
MINIO_ENDPOINT=minio-staging:9000
MINIO_SECURE=true

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

#### Production Environment (.env.production)
```bash
NODE_ENV=production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Maximum security
JWT_ACCESS_EXPIRY=15m
BCRYPT_ROUNDS=12
FORCE_HTTPS=true
ENABLE_HELMET=true

# Production services
MONGODB_URI=mongodb://mongo-cluster:27017/zkfs_production?replicaSet=rs0
REDIS_URL=redis://redis-cluster:6379/0
MINIO_ENDPOINT=minio-cluster:9000
MINIO_SECURE=true

# Production monitoring
LOG_LEVEL=warn
ENABLE_METRICS=true
BACKUP_ENABLED=true
```

## Docker Configuration

### 1. Development Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  # MongoDB
  mongodb:
    image: mongo:7.0
    container_name: zkfs-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: zkfs_database
    volumes:
      - mongodb_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - zkfs-network

  # Redis
  redis:
    image: redis:7.2-alpine
    container_name: zkfs-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass redis123
    volumes:
      - redis_data:/data
    networks:
      - zkfs-network

  # MinIO
  minio:
    image: minio/minio:latest
    container_name: zkfs-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    networks:
      - zkfs-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: zkfs-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=development
    env_file:
      - .env.development
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - mongodb
      - redis
      - minio
    networks:
      - zkfs-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: zkfs-frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - zkfs-network

volumes:
  mongodb_data:
  redis_data:
  minio_data:

networks:
  zkfs-network:
    driver: bridge
```

### 2. Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # MongoDB Replica Set
  mongodb-primary:
    image: mongo:7.0
    container_name: zkfs-mongodb-primary
    restart: always
    command: mongod --replSet rs0 --bind_ip_all
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGODB_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_ROOT_PASSWORD}
    volumes:
      - mongodb_primary_data:/data/db
    networks:
      - zkfs-network

  mongodb-secondary:
    image: mongo:7.0
    container_name: zkfs-mongodb-secondary
    restart: always
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongodb_secondary_data:/data/db
    networks:
      - zkfs-network

  # Redis Cluster
  redis-master:
    image: redis:7.2-alpine
    container_name: zkfs-redis-master
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_master_data:/data
    networks:
      - zkfs-network

  redis-slave:
    image: redis:7.2-alpine
    container_name: zkfs-redis-slave
    restart: always
    command: redis-server --slaveof redis-master 6379 --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_slave_data:/data
    networks:
      - zkfs-network

  # MinIO Cluster
  minio1:
    image: minio/minio:latest
    container_name: zkfs-minio1
    restart: always
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server http://minio{1...4}/data --console-address ":9001"
    volumes:
      - minio1_data:/data
    networks:
      - zkfs-network

  minio2:
    image: minio/minio:latest
    container_name: zkfs-minio2
    restart: always
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server http://minio{1...4}/data --console-address ":9001"
    volumes:
      - minio2_data:/data
    networks:
      - zkfs-network

  # Load Balancer
  nginx:
    image: nginx:alpine
    container_name: zkfs-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - backend
    networks:
      - zkfs-network

  # Backend (Multiple instances)
  backend1:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: zkfs-backend1
    restart: always
    env_file:
      - .env.production
    depends_on:
      - mongodb-primary
      - redis-master
      - minio1
    networks:
      - zkfs-network

  backend2:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: zkfs-backend2
    restart: always
    env_file:
      - .env.production
    depends_on:
      - mongodb-primary
      - redis-master
      - minio1
    networks:
      - zkfs-network

volumes:
  mongodb_primary_data:
  mongodb_secondary_data:
  redis_master_data:
  redis_slave_data:
  minio1_data:
  minio2_data:

networks:
  zkfs-network:
    driver: bridge
```

## Configuration Files

### 1. Database Configuration
```javascript
// config/database.js
const config = {
  development: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/zkfs_dev',
      options: {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379/1',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    }
  },
  
  production: {
    mongodb: {
      uri: process.env.MONGODB_URI,
      options: {
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        replicaSet: 'rs0',
        readPreference: 'secondaryPreferred',
        writeConcern: { w: 'majority', j: true }
      }
    },
    redis: {
      url: process.env.REDIS_URL,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

### 2. Security Configuration
```javascript
// config/security.js
const config = {
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: 'zkfs-auth',
    audience: 'zkfs-app'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 1000 || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Quá nhiều request từ IP này',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }
};

module.exports = config;
```

## Setup Scripts

### 1. Environment Setup Script
```bash
#!/bin/bash
# scripts/setup-env.sh

set -e

echo "🚀 Setting up Zero Knowledge File System environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please update the values before continuing."
    exit 1
fi

# Generate JWT secrets if not set
if grep -q "your-super-secret" .env; then
    echo "🔐 Generating JWT secrets..."
    
    ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    
    sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=$ACCESS_SECRET/" .env
    sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$REFRESH_SECRET/" .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
    
    echo "✅ JWT secrets generated"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p uploads/temp
mkdir -p ssl
mkdir -p backups

# Set permissions
chmod 700 ssl
chmod 755 logs uploads backups

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "package.json" ]; then
    npm install
fi

if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    cd backend && npm install && cd ..
fi

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend && npm install && cd ..
fi

# Start services with Docker
echo "🐳 Starting Docker services..."
docker-compose up -d mongodb redis minio

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Initialize database
echo "🗄️ Initializing database..."
if command -v node &> /dev/null; then
    node scripts/init-database.js
fi

echo "✅ Environment setup complete!"
echo ""
echo "🌐 Services available at:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - MinIO Console: http://localhost:9001"
echo "  - MongoDB: mongodb://localhost:27017"
echo "  - Redis: redis://localhost:6379"
echo ""
echo "📚 Next steps:"
echo "  1. Update .env file with your specific configuration"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Visit http://localhost:5173 to access the application"
```

### 2. Health Check Script
```bash
#!/bin/bash
# scripts/health-check.sh

echo "🏥 Health Check - Zero Knowledge File System"
echo "=============================================="

# Check environment variables
echo "📋 Environment: $NODE_ENV"

# Check services
services=("mongodb" "redis" "minio" "backend")
for service in "${services[@]}"; do
    if docker ps | grep -q "zkfs-$service"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
    fi
done

# Check API health
echo ""
echo "🔍 API Health Check:"
if curl -f -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend API: Healthy"
else
    echo "❌ Backend API: Unhealthy"
fi

# Check frontend
if curl -f -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend: Accessible"
else
    echo "❌ Frontend: Not accessible"
fi

# Check database connectivity
echo ""
echo "🗄️ Database Connectivity:"
if docker exec zkfs-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB: Connected"
else
    echo "❌ MongoDB: Connection failed"
fi

if docker exec zkfs-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Connected"
else
    echo "❌ Redis: Connection failed"
fi

# Check MinIO
if curl -f -s http://localhost:9000/minio/health/live > /dev/null; then
    echo "✅ MinIO: Healthy"
else
    echo "❌ MinIO: Unhealthy"
fi

echo ""
echo "🏁 Health check complete"
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Không có crypto keys trong environment variables
- Tách biệt cấu hình authentication và crypto operations
- Secure defaults cho production environment
- Proper secret management

### ⚠️ Lưu Ý Bảo Mật
```bash
# Security checklist for environment configuration

# 1. Never commit .env files to version control
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore

# 2. Use strong secrets in production
# Generate with: openssl rand -base64 64

# 3. Rotate secrets regularly
# Implement secret rotation strategy

# 4. Use environment-specific configurations
# Separate dev/staging/prod environments

# 5. Validate environment variables
# Check required variables on startup
```
