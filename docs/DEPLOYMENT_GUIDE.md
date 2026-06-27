# Zero Knowledge Encryption System - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Zero Knowledge Encryption System in various environments, from development to production.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100 Mbps

**Recommended for Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 100GB+ SSD
- Network: 1 Gbps
- Load Balancer
- SSL Certificate

### Software Dependencies

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for development)
- Python 3.9+ (for development)
- MongoDB 5.0+
- MinIO Server
- Nginx (for production)

## Quick Start (Development)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/zero-knowledge-encryption.git
cd zero-knowledge-encryption
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 3. Start Services

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy development environment
./scripts/deploy.sh
```

### 4. Verify Deployment

```bash
# Check service status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

## Production Deployment

### 1. Server Preparation

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip
```

#### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install -y certbot

# Generate certificate
sudo certbot certonly --standalone -d yourapp.com -d api.yourapp.com

# Certificate files will be in:
# /etc/letsencrypt/live/yourapp.com/fullchain.pem
# /etc/letsencrypt/live/yourapp.com/privkey.pem
```

#### Using Custom Certificate
```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/certs/yourapp

# Copy your certificate files
sudo cp your-cert.pem /etc/ssl/certs/yourapp/cert.pem
sudo cp your-key.pem /etc/ssl/certs/yourapp/key.pem
sudo chmod 600 /etc/ssl/certs/yourapp/key.pem
```

### 3. Production Configuration

#### Environment Variables
```bash
# Production .env file
ENVIRONMENT=production
DEBUG=false

# Database
MONGODB_URL=mongodb://mongodb:27017/zero_knowledge_encryption
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-mongo-password

# MinIO
MINIO_ACCESS_KEY=your-production-access-key
MINIO_SECRET_KEY=your-production-secret-key
MINIO_USE_SSL=true

# JWT (Generate strong keys)
JWT_SECRET_KEY=your-super-secret-jwt-key-256-bits-minimum
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourapp.com

# hCaptcha
HCAPTCHA_SECRET_KEY=your-hcaptcha-secret-key
HCAPTCHA_SITE_KEY=your-hcaptcha-site-key

# Security
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=300

# SSL
SSL_CERT_PATH=/etc/ssl/certs/yourapp/cert.pem
SSL_KEY_PATH=/etc/ssl/certs/yourapp/key.pem
```

#### Nginx Configuration
```bash
# Create nginx config
sudo mkdir -p nginx
```

Create `nginx/nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:80;
    }
    
    upstream backend {
        server backend:8000;
    }
    
    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourapp.com api.yourapp.com;
        return 301 https://$server_name$request_uri;
    }
    
    # Frontend HTTPS
    server {
        listen 443 ssl http2;
        server_name yourapp.com;
        
        ssl_certificate /etc/ssl/certs/yourapp/cert.pem;
        ssl_certificate_key /etc/ssl/certs/yourapp/key.pem;
        
        # SSL Security
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        
        # Security Headers
        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # Backend API HTTPS
    server {
        listen 443 ssl http2;
        server_name api.yourapp.com;
        
        ssl_certificate /etc/ssl/certs/yourapp/cert.pem;
        ssl_certificate_key /etc/ssl/certs/yourapp/key.pem;
        
        # SSL Security (same as above)
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        
        # Security Headers
        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        
        # Rate Limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        
        location / {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS
            add_header Access-Control-Allow-Origin "https://yourapp.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        }
    }
}
```

### 4. Production Deployment

#### Deploy Application
```bash
# Set production environment
export ENVIRONMENT=production

# Deploy with production configuration
./scripts/deploy.sh

# Verify deployment
./scripts/deploy.sh status
```

#### Setup Monitoring
```bash
# Start monitoring services
docker-compose up -d prometheus grafana

# Access monitoring
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

### 5. Database Backup Setup

#### Automated MongoDB Backup
```bash
# Create backup script
sudo mkdir -p /opt/backups/scripts
```

Create `/opt/backups/scripts/backup-mongodb.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="zero-knowledge-encryption_mongodb_1"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
docker exec $CONTAINER_NAME mongodump --out /tmp/backup_$DATE
docker cp $CONTAINER_NAME:/tmp/backup_$DATE $BACKUP_DIR/

# Compress backup
tar -czf $BACKUP_DIR/mongodb_backup_$DATE.tar.gz -C $BACKUP_DIR backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Remove old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: mongodb_backup_$DATE.tar.gz"
```

#### Setup Cron Job
```bash
# Make script executable
sudo chmod +x /opt/backups/scripts/backup-mongodb.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line: 0 2 * * * /opt/backups/scripts/backup-mongodb.sh
```

### 6. Security Hardening

#### Firewall Configuration
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow specific ports for monitoring (optional)
sudo ufw allow from trusted-ip to any port 3001  # Grafana
sudo ufw allow from trusted-ip to any port 9090  # Prometheus

# Check status
sudo ufw status
```

#### Fail2Ban Setup
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for Nginx
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
sudo nano /etc/fail2ban/jail.local
```

Add to `/etc/fail2ban/jail.local`:
```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
```

### 7. Monitoring and Alerting

#### Log Aggregation
```bash
# Setup log rotation
sudo nano /etc/logrotate.d/zero-knowledge-app
```

Add to logrotate config:
```
/var/log/zero-knowledge/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

#### Health Checks
```bash
# Create health check script
sudo nano /opt/scripts/health-check.sh
```

```bash
#!/bin/bash
# Health check script

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "ERROR: Some services are down"
    exit 1
fi

# Check API health
if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "ERROR: API health check failed"
    exit 1
fi

# Check frontend
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "ERROR: Frontend health check failed"
    exit 1
fi

echo "All services healthy"
```

### 8. Scaling and Load Balancing

#### Horizontal Scaling
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
  
  frontend:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

#### Load Balancer Configuration
```nginx
upstream backend_cluster {
    least_conn;
    server backend_1:8000;
    server backend_2:8000;
    server backend_3:8000;
}

upstream frontend_cluster {
    least_conn;
    server frontend_1:80;
    server frontend_2:80;
}
```

## Maintenance

### Regular Tasks

#### Daily
- Check service health
- Monitor disk usage
- Review error logs

#### Weekly
- Update security patches
- Review backup integrity
- Monitor performance metrics

#### Monthly
- Rotate SSL certificates (if needed)
- Update dependencies
- Security audit

### Troubleshooting

#### Common Issues

**Service Won't Start:**
```bash
# Check logs
docker-compose logs service-name

# Check resource usage
docker stats

# Restart service
docker-compose restart service-name
```

**Database Connection Issues:**
```bash
# Check MongoDB status
docker-compose exec mongodb mongo --eval "db.adminCommand('ping')"

# Check network connectivity
docker-compose exec backend ping mongodb
```

**SSL Certificate Issues:**
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/yourapp/cert.pem -text -noout

# Test SSL configuration
openssl s_client -connect yourapp.com:443
```

### Rollback Procedure

```bash
# Stop current deployment
docker-compose down

# Restore from backup
./scripts/restore-backup.sh backup-date

# Start previous version
git checkout previous-tag
./scripts/deploy.sh
```

## Support

For deployment support:
- Documentation: https://docs.yourapp.com/deployment
- Support Email: devops@yourapp.com
- Emergency Contact: +1-xxx-xxx-xxxx
