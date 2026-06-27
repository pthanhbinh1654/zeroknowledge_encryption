# Multi-stage build: Node.js for building, Nginx for serving
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install ALL dependencies (devDependencies are needed for vite build)
RUN npm ci

# Copy source code
COPY . .

# Build the Vite application (output goes to /app/dist)
RUN npm run build

# ─── Production stage ────────────────────────────────────────────────────────
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy Vite build output (dist/, NOT build/)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
