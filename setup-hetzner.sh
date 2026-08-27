#!/bin/bash
# Hetzner Cloud CX32 Server Setup Script
# Run this script as root on a fresh Ubuntu 22.04/24.04 server
# Sets up Docker, Docker Compose, Nginx, Certbot, and deploys the application

set -euo pipefail

# Configuration
DOMAIN="${1:-your-domain.com}"
EMAIL="${2:-admin@${DOMAIN}}"
APP_DIR="/opt/docuforge"

echo "=============================================="
echo " DocuForge Hetzner CX32 Setup"
echo "=============================================="
echo ""
echo "Domain:  ${DOMAIN}"
echo "Email:   ${EMAIL}"
echo "App Dir: ${APP_DIR}"
echo ""

# ================================================
# 1. System Update & Base Packages
# ================================================
echo "[1/9] Updating system packages..."
apt-get update
apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    logrotate \
    jq

# ================================================
# 2. Create Application User
# ================================================
echo "[2/9] Creating application user..."
if ! id -u docuforge >/dev/null 2>&1; then
    useradd -m -s /bin/bash -d /home/docuforge docuforge
    echo "User 'docuforge' created."
else
    echo "User 'docuforge' already exists."
fi

# ================================================
# 3. Install Docker
# ================================================
echo "[3/9] Installing Docker..."
if ! command -v docker >/dev/null 2>&1; then
    # Add Docker GPG key and repository
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed."
fi

# Add docuforge user to docker group
usermod -aG docker docuforge

# ================================================
# 4. Create Application Directory Structure
# ================================================
echo "[4/9] Setting up application directory..."
mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/nginx"
mkdir -p "${APP_DIR}/nginx/conf.d"
mkdir -p "${APP_DIR}/uploads"

# Set ownership
chown -R docuforge:docuforge "${APP_DIR}"

# ================================================
# 5. Configure Firewall (UFW)
# ================================================
echo "[5/9] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (don't lock yourself out!)
ufw allow OpenSSH

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
echo "y" | ufw enable

echo "Firewall configured: SSH(22), HTTP(80), HTTPS(443)"

# ================================================
# 6. Configure Fail2Ban
# ================================================
echo "[6/9] Configuring Fail2Ban..."

# Create custom jail for nginx
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/nginx-docuforge.local << 'F2B_EOF'
[nginx-docuforge]
enabled  = true
port     = http,https
filter   = nginx-docuforge
logpath  = /var/log/nginx/access.log
maxretry = 5
bantime  = 3600
findtime = 600
F2B_EOF

# Create filter for common attack patterns
mkdir -p /etc/fail2ban/filter.d
cat > /etc/fail2ban/filter.d/nginx-docuforge.local << 'F2B_FILTER'
[Definition]
failregex = ^<HOST> -.*"(GET|POST|HEAD).*HTTP.*" (403|404|429|500)
            ^<HOST> -.*"(GET|POST|HEAD).*\.(php|asp|aspx|jsp|cgi|exe|sh|bat|dll).*HTTP.*" [45]
            ^<HOST> -.*"(GET|POST|HEAD).*\[(ADSL|DIAL|DSL|PPP|PPTP|LASER)\].*HTTP.*" [45]
ignoreregex =
F2B_FILTER

systemctl enable fail2ban
systemctl restart fail2ban

echo "Fail2Ban configured."

# ================================================
# 7. Configure Log Rotation
# ================================================
echo "[7/9] Configuring log rotation..."
cat > /etc/logrotate.d/docuforge-nginx << 'LOGROTATE_EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}

/opt/docuforge/*.log {
    weekly
    missingok
    rotate 4
    compress
    delaycompress
    notifempty
    create 0640 docuforge docuforge
}
LOGROTATE_EOF

echo "Log rotation configured."

# ================================================
# 8. Setup SSH Keys (for deployment user)
# ================================================
echo "[8/9] Setting up SSH access..."
if [ ! -d /home/docuforge/.ssh ]; then
    mkdir -p /home/docuforge/.ssh
    chmod 700 /home/docuforge/.ssh
fi

# Add your deploy key here (replace with actual key)
# ssh-keyscan github.com >> /home/docuforge/.ssh/known_hosts
# echo "ssh-ed25519 AAAA..." >> /home/docuforge/.ssh/authorized_keys
# chmod 600 /home/docuforge/.ssh/authorized_keys
# chown -R docuforge:docuforge /home/docuforge/.ssh

echo "SSH directory prepared. Add your deploy key to authorized_keys."

# ================================================
# 9. Deploy Application
# ================================================
echo "[9/9] Deploying application..."

# Create .env file
cat > "${APP_DIR}/.env" << ENV_EOF
# Database
DATABASE_URL=postgresql://docuforge:CHANGE_ME_DB_PASSWORD@postgres:5432/docuforge
DB_USER=docuforge
DB_PASSWORD=CHANGE_ME_DB_PASSWORD
DB_NAME=docuforge

# Redis
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD
REDIS_URL=redis://:CHANGE_ME_REDIS_PASSWORD@redis:6379/0

# Authentication
API_KEY_SECRET=CHANGE_ME_API_KEY_SECRET_MIN_32_CHARS
JWT_SECRET=CHANGE_ME_JWT_SECRET_MIN_32_CHARS
JWT_ALGORITHM=HS256
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

# Frontend
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
NEXTAUTH_SECRET=CHANGE_ME_NEXTAUTH_SECRET_MIN_32_CHARS
NEXTAUTH_URL=https://${DOMAIN}

# File uploads
MAX_UPLOAD_SIZE=10485760
RATE_LIMIT_ENABLED=true
FILE_UPLOAD_DIR=/app/tmp

# Domain
DOMAIN=${DOMAIN}
LETSENCRYPT_EMAIL=${EMAIL}

# Environment
NODE_ENV=production
APP_URL=https://${DOMAIN}

# BullMQ
QUEUE_NAME=pdf-tasks
CONCURRENCY=5

# Features
ENABLE_PREMIUM=true
FREE_DAILY_LIMIT=3
ENV_EOF

chown docuforge:docuforge "${APP_DIR}/.env"

# Copy deployment files
# Note: In production, use git clone or rsync from CI
# For initial setup, copy from local build artifacts
if [ -d "/build-artifacts" ]; then
    cp -r /build-artifacts/* "${APP_DIR}/"
else
    echo "WARNING: No build artifacts found. Deploy files manually."
    echo "Expected files:"
    echo "  - docker-compose.yml"
    echo "  - frontend/Dockerfile"
    echo "  - backend/Dockerfile"
    echo "  - worker/Dockerfile"
    echo "  - worker/worker.js"
    echo "  - nginx/nginx.conf"
    echo "  - nginx/conf.d/*.conf"
fi

# Set proper ownership
chown -R docuforge:docuforge "${APP_DIR}"

# ================================================
# Post-Deployment Instructions
# ================================================
echo ""
echo "=============================================="
echo " Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit ${APP_DIR}/.env with real passwords and secrets"
echo "   nano ${APP_DIR}/.env"
echo ""
echo "2. Place your deployment files in ${APP_DIR}/"
echo "   - docker-compose.yml"
echo "   - frontend/, backend/, worker/, nginx/ directories"
echo ""
echo "3. Build and start services:"
echo "   cd ${APP_DIR}"
echo "   docker compose pull"
echo "   docker compose up -d"
echo ""
echo "4. Enable systemd service for auto-start:"
echo "   cp docuforge.service /etc/systemd/system/"
echo "   systemctl daemon-reload"
echo "   systemctl enable docuforge.service"
echo "   systemctl start docuforge.service"
echo ""
echo "5. Setup SSL with Certbot:"
echo "   cd ${APP_DIR}"
echo "   docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d ${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email"
echo "   docker compose up -d nginx"
echo ""
echo "6. Setup auto-renewal timer:"
echo "   cp certbot-renew.service /etc/systemd/system/"
echo "   cp certbot-renew.timer /etc/systemd/system/"
echo "   systemctl daemon-reload"
echo "   systemctl enable certbot-renew.timer"
echo "   systemctl start certbot-renew.timer"
echo ""
echo "7. Verify deployment:"
echo "   docker compose ps"
echo "   docker compose logs --tail=50"
echo ""
echo "=============================================="
echo " Troubleshooting"
echo "=============================================="
echo ""
echo "View logs:    docker compose logs -f [service-name]"
echo "Restart:      docker compose restart [service-name]"
echo "Stop all:     docker compose down"
echo "Backup DB:    docker compose exec postgres pg_dump -U docuforge docuforge > backup.sql"
echo "Restore DB:   docker compose exec -T postgres psql -U docuforge docuforge < backup.sql"
echo ""
