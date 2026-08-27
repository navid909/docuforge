# Worker service - BullMQ PDF processing
FROM node:20-slim

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy worker code
COPY worker.js .
COPY --from=builder /opt/venv /opt/venv

# If the worker needs Python backends, install minimal deps
# (BullMQ workers typically run Node.js, but PDF processing may need Python)
# RUN apt-get update && apt-get install -y python3 python3-pip && \
#     pip3 install --no-cache-dir -r ../backend/requirements.txt 2>/dev/null || true

USER appuser

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(0)).on('error', () => process.exit(1))" || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "worker.js"]
