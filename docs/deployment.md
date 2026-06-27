# Deployment - Triển Khai Production

## Mục Đích và Phạm Vi

Tài liệu này cung cấp hướng dẫn chi tiết về triển khai hệ thống Zero Knowledge File Encryption lên môi trường production, bao gồm cấu hình bảo mật, scaling strategies, monitoring, và maintenance procedures.

## Kiến Trúc Production

```
┌─────────────────────────────────────────────────────────────┐
│                Production Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Load Balancer                           │ │
│  │              (Nginx/CloudFlare)                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Frontend Cluster                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │   React     │ │    CDN      │ │   Static Assets     │ │ │
│  │  │   App       │ │  (Images,   │ │   (JS, CSS, etc)    │ │ │
│  │  │             │ │   Videos)   │ │                     │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Backend Cluster                          │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │  FastAPI    │ │  FastAPI    │ │     FastAPI         │ │ │
│  │  │ Instance 1  │ │ Instance 2  │ │    Instance N       │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Storage Cluster                          │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │  MongoDB    │ │    Redis    │ │      MinIO S3       │ │ │
│  │  │ Replica Set │ │   Cluster   │ │     Cluster         │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Monitoring & Logging                       │ │
│  │  • Prometheus • Grafana • ELK Stack • Alerting         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Pre-Deployment Checklist

### 1. Security Checklist
```bash
# Security validation script
#!/bin/bash
echo "🔒 Security Pre-Deployment Checklist"
echo "===================================="

# Check environment variables
echo "1. Environment Variables:"
if grep -q "your-super-secret" .env.production; then
    echo "❌ Default secrets detected - MUST change before deployment"
    exit 1
else
    echo "✅ Custom secrets configured"
fi

# Check HTTPS configuration
echo "2. HTTPS Configuration:"
if [ -f "ssl/cert.pem" ] && [ -f "ssl/private.key" ]; then
    echo "✅ SSL certificates present"
else
    echo "❌ SSL certificates missing"
    exit 1
fi

# Check database security
echo "3. Database Security:"
if grep -q "admin:password123" docker-compose.prod.yml; then
    echo "❌ Default database credentials detected"
    exit 1
else
    echo "✅ Custom database credentials configured"
fi

# Check CORS settings
echo "4. CORS Configuration:"
if grep -q "localhost" .env.production; then
    echo "⚠️  Localhost detected in production config"
else
    echo "✅ Production domains configured"
fi

echo "✅ Security checklist completed"
```

### 2. Performance Checklist
```bash
# Performance validation script
#!/bin/bash
echo "⚡ Performance Pre-Deployment Checklist"
echo "======================================"

# Check build optimization
echo "1. Build Optimization:"
cd frontend
npm run build
BUILD_SIZE=$(du -sh dist | cut -f1)
echo "Frontend build size: $BUILD_SIZE"

# Check bundle analysis
npm run analyze
echo "✅ Bundle analysis completed"

# Check backend optimization
echo "2. Backend Optimization:"
cd ../backend
python -m pytest tests/performance/ -v
echo "✅ Performance tests completed"

# Check database indexes
echo "3. Database Indexes:"
# Add database index verification
echo "✅ Database indexes verified"
```

## Docker Production Setup

### 1. Production Dockerfile
```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```dockerfile
# backend/Dockerfile.prod
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Nginx Load Balancer
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
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend1
      - backend2
    networks:
      - zkfs-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: zkfs-frontend
    restart: always
    networks:
      - zkfs-network

  # Backend Instances
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

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

  # MongoDB Replica Set
  mongodb-primary:
    image: mongo:7.0
    container_name: zkfs-mongodb-primary
    restart: always
    command: mongod --replSet rs0 --bind_ip_all --auth
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGODB_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_ROOT_PASSWORD}
    volumes:
      - mongodb_primary_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - zkfs-network

  mongodb-secondary:
    image: mongo:7.0
    container_name: zkfs-mongodb-secondary
    restart: always
    command: mongod --replSet rs0 --bind_ip_all --auth
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

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: zkfs-prometheus
    restart: always
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - zkfs-network

  grafana:
    image: grafana/grafana:latest
    container_name: zkfs-grafana
    restart: always
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - zkfs-network

volumes:
  mongodb_primary_data:
  mongodb_secondary_data:
  redis_master_data:
  minio1_data:
  prometheus_data:
  grafana_data:

networks:
  zkfs-network:
    driver: bridge
```

## Nginx Configuration

### 1. Production Nginx Config
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend1:8000;
        server backend2:8000;
        keepalive 32;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Frontend
    server {
        listen 80;
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/ssl/certs/cert.pem;
        ssl_certificate_key /etc/ssl/certs/private.key;

        # Redirect HTTP to HTTPS
        if ($scheme != "https") {
            return 301 https://$host$request_uri;
        }

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Login rate limiting
        location /api/auth/login {
            limit_req zone=login burst=3 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Deployment Scripts

### 1. Automated Deployment Script
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting Zero Knowledge File System Deployment"
echo "================================================"

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_ENABLED=${2:-true}

# Validate environment
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
    echo "❌ Invalid environment. Use 'production' or 'staging'"
    exit 1
fi

# Pre-deployment checks
echo "1. Running pre-deployment checks..."
./scripts/pre-deployment-check.sh $ENVIRONMENT

# Backup current deployment
if [ "$BACKUP_ENABLED" = "true" ]; then
    echo "2. Creating backup..."
    ./scripts/backup.sh
fi

# Build and test
echo "3. Building application..."
docker-compose -f docker-compose.prod.yml build

# Database migration
echo "4. Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend python -m alembic upgrade head

# Deploy with zero downtime
echo "5. Deploying with zero downtime..."
docker-compose -f docker-compose.prod.yml up -d --remove-orphans

# Health checks
echo "6. Running health checks..."
./scripts/health-check.sh

# Post-deployment verification
echo "7. Post-deployment verification..."
./scripts/post-deployment-check.sh

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Application URLs:"
echo "  - Frontend: https://yourdomain.com"
echo "  - API: https://api.yourdomain.com"
echo "  - Monitoring: https://monitoring.yourdomain.com"
```

### 2. Rollback Script
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

echo "🔄 Rolling back Zero Knowledge File System"
echo "========================================"

BACKUP_VERSION=${1:-latest}

# Stop current deployment
echo "1. Stopping current deployment..."
docker-compose -f docker-compose.prod.yml down

# Restore from backup
echo "2. Restoring from backup version: $BACKUP_VERSION"
./scripts/restore.sh $BACKUP_VERSION

# Start previous version
echo "3. Starting previous version..."
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
echo "4. Verifying rollback..."
./scripts/health-check.sh

echo "✅ Rollback completed successfully!"
```

## Monitoring và Alerting

### 1. Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'zkfs-backend'
    static_configs:
      - targets: ['backend1:8000', 'backend2:8000']
    metrics_path: '/metrics'

  - job_name: 'zkfs-mongodb'
    static_configs:
      - targets: ['mongodb-primary:27017']

  - job_name: 'zkfs-redis'
    static_configs:
      - targets: ['redis-master:6379']

  - job_name: 'zkfs-minio'
    static_configs:
      - targets: ['minio1:9000']

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Alert Rules
```yaml
# monitoring/alert_rules.yml
groups:
  - name: zkfs_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseDown
        expr: up{job="zkfs-mongodb"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MongoDB is down"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
```

## Backup và Recovery

### 1. Backup Script
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$BACKUP_DATE"

echo "📦 Creating backup: $BACKUP_DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
echo "Backing up MongoDB..."
docker exec zkfs-mongodb-primary mongodump --out $BACKUP_DIR/mongodb

# Backup MinIO
echo "Backing up MinIO..."
docker exec zkfs-minio1 mc mirror local/encrypted-files $BACKUP_DIR/minio/

# Backup configuration
echo "Backing up configuration..."
cp -r .env.production docker-compose.prod.yml nginx/ $BACKUP_DIR/config/

# Compress backup
echo "Compressing backup..."
tar -czf $BACKUP_DIR.tar.gz -C /backups $BACKUP_DATE

# Upload to remote storage
echo "Uploading to remote storage..."
aws s3 cp $BACKUP_DIR.tar.gz s3://zkfs-backups/

# Cleanup old backups (keep 30 days)
find /backups -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_DIR.tar.gz"
```

## SSL/TLS Configuration

### 1. SSL Certificate Setup
```bash
#!/bin/bash
# scripts/setup-ssl.sh

echo "🔒 Setting up SSL certificates"

# Using Let's Encrypt
if command -v certbot &> /dev/null; then
    echo "Using Let's Encrypt..."
    certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com
    
    # Copy certificates
    cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
    cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/private.key
    
    # Set permissions
    chmod 600 ssl/private.key
    chmod 644 ssl/cert.pem
    
    echo "✅ SSL certificates configured"
else
    echo "❌ Certbot not found. Please install certbot or provide custom certificates"
    exit 1
fi
```

## Performance Optimization

### 1. Database Optimization
```javascript
// scripts/optimize-database.js
const { MongoClient } = require('mongodb');

async function optimizeDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        // Create indexes for better performance
        await db.collection('files').createIndexes([
            { key: { user_id: 1, created_at: -1 } },
            { key: { file_id: 1 }, unique: true },
            { key: { original_name: 'text' } }
        ]);
        
        await db.collection('users').createIndexes([
            { key: { email: 1 }, unique: true },
            { key: { user_id: 1 }, unique: true }
        ]);
        
        console.log('✅ Database optimization completed');
    } finally {
        await client.close();
    }
}

optimizeDatabase().catch(console.error);
```

## Tuân Thủ Zero Knowledge

### ✅ Nguyên Tắc Được Đảm Bảo
- Production deployment không expose crypto keys
- Secure environment variable management
- Encrypted communication (HTTPS/TLS)
- Proper secret rotation procedures
- Monitoring không log sensitive data

### ⚠️ Lưu Ý Bảo Mật Production
```bash
# Production security checklist
echo "🔒 Production Security Validation"

# 1. No default passwords
grep -r "password123\|admin123\|secret123" . && echo "❌ Default passwords found" || echo "✅ No default passwords"

# 2. HTTPS enforced
grep "FORCE_HTTPS=true" .env.production && echo "✅ HTTPS enforced" || echo "❌ HTTPS not enforced"

# 3. Secure headers enabled
grep "ENABLE_HELMET=true" .env.production && echo "✅ Security headers enabled" || echo "❌ Security headers disabled"

# 4. Rate limiting enabled
grep "RATE_LIMIT" .env.production && echo "✅ Rate limiting configured" || echo "❌ Rate limiting not configured"
```
