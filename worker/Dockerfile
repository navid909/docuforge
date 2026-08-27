# Worker service - BullMQ PDF processing
FROM node:20-slim

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy worker code
COPY worker.js ./

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser
USER appuser

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(0)).on('error', () => process.exit(1))" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "worker.js"]
