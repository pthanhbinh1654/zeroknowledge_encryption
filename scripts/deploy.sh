#!/bin/bash

# Zero Knowledge Encryption System Deployment Script
# This script automates the deployment process for the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
ENV_FILE=${ENV_FILE:-.env}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log_success "All requirements met"
}

check_env_file() {
    log_info "Checking environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file $ENV_FILE not found. Creating from template..."
        
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            log_warning "Please edit $ENV_FILE with your configuration before continuing."
            exit 1
        else
            log_error "No environment template found. Please create $ENV_FILE manually."
            exit 1
        fi
    fi
    
    # Check for required environment variables
    required_vars=(
        "JWT_SECRET_KEY"
        "SENDGRID_API_KEY"
        "HCAPTCHA_SECRET_KEY"
        "HCAPTCHA_SITE_KEY"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" || grep -q "^${var}=$" "$ENV_FILE"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        log_error "Please set these variables in $ENV_FILE"
        exit 1
    fi
    
    log_success "Environment configuration is valid"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build with no cache for production
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f "$COMPOSE_FILE" build --no-cache
    else
        docker-compose -f "$COMPOSE_FILE" build
    fi
    
    log_success "Docker images built successfully"
}

setup_volumes() {
    log_info "Setting up Docker volumes..."
    
    # Create volumes if they don't exist
    docker volume create zero-knowledge-mongodb-data 2>/dev/null || true
    docker volume create zero-knowledge-minio-data 2>/dev/null || true
    docker volume create zero-knowledge-redis-data 2>/dev/null || true
    
    log_success "Docker volumes created"
}

start_services() {
    log_info "Starting services..."
    
    # Start services in the correct order
    docker-compose -f "$COMPOSE_FILE" up -d mongodb minio redis
    
    # Wait for database to be ready
    log_info "Waiting for MongoDB to be ready..."
    timeout=60
    while ! docker-compose -f "$COMPOSE_FILE" exec -T mongodb mongo --eval "db.adminCommand('ping')" &>/dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            log_error "MongoDB failed to start within 60 seconds"
            exit 1
        fi
    done
    
    # Wait for MinIO to be ready
    log_info "Waiting for MinIO to be ready..."
    timeout=60
    while ! curl -f http://localhost:9000/minio/health/live &>/dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            log_error "MinIO failed to start within 60 seconds"
            exit 1
        fi
    done
    
    # Start backend
    docker-compose -f "$COMPOSE_FILE" up -d backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    timeout=60
    while ! curl -f http://localhost:8000/health &>/dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            log_error "Backend failed to start within 60 seconds"
            exit 1
        fi
    done
    
    # Start frontend and other services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "All services started successfully"
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Run any necessary database setup
    docker-compose -f "$COMPOSE_FILE" exec -T backend python scripts/setup_db.py
    
    log_success "Database migrations completed"
}

setup_minio() {
    log_info "Setting up MinIO buckets..."
    
    # Create bucket if it doesn't exist
    docker-compose -f "$COMPOSE_FILE" exec -T backend python scripts/setup_minio.py
    
    log_success "MinIO setup completed"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if all services are running
    services=("mongodb" "minio" "redis" "backend" "frontend")
    
    for service in "${services[@]}"; do
        if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            log_error "Service $service is not running"
            return 1
        fi
    done
    
    # Check health endpoints
    if ! curl -f http://localhost:8000/health &>/dev/null; then
        log_error "Backend health check failed"
        return 1
    fi
    
    if ! curl -f http://localhost:3000/health &>/dev/null; then
        log_error "Frontend health check failed"
        return 1
    fi
    
    log_success "Deployment verification passed"
}

show_status() {
    log_info "Deployment Status:"
    echo ""
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    log_info "Application URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/docs"
    echo "  MinIO Console: http://localhost:9001"
    echo ""
    log_info "To view logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
    log_info "To stop services: docker-compose -f $COMPOSE_FILE down"
}

cleanup() {
    log_info "Cleaning up..."
    docker-compose -f "$COMPOSE_FILE" down
    docker system prune -f
    log_success "Cleanup completed"
}

# Main deployment function
deploy() {
    log_info "Starting deployment for environment: $ENVIRONMENT"
    
    check_requirements
    check_env_file
    setup_volumes
    build_images
    start_services
    run_migrations
    setup_minio
    
    if verify_deployment; then
        log_success "Deployment completed successfully!"
        show_status
    else
        log_error "Deployment verification failed"
        exit 1
    fi
}

# Command line argument handling
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "cleanup")
        cleanup
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
        ;;
    "restart")
        log_info "Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart "${2:-}"
        log_success "Services restarted"
        ;;
    "stop")
        log_info "Stopping services..."
        docker-compose -f "$COMPOSE_FILE" down
        log_success "Services stopped"
        ;;
    "update")
        log_info "Updating deployment..."
        docker-compose -f "$COMPOSE_FILE" pull
        build_images
        docker-compose -f "$COMPOSE_FILE" up -d
        log_success "Deployment updated"
        ;;
    *)
        echo "Usage: $0 {deploy|cleanup|status|logs|restart|stop|update}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  cleanup  - Stop services and clean up"
        echo "  status   - Show deployment status"
        echo "  logs     - Show service logs"
        echo "  restart  - Restart services"
        echo "  stop     - Stop all services"
        echo "  update   - Update and restart services"
        exit 1
        ;;
esac
