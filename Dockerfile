FROM node:20-alpine
WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application files
COPY server/ ./server/
COPY dashboard/ ./dashboard/

# Create data directory and drop to non-root user
RUN mkdir -p data/db && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/auth/verify || exit 1

CMD ["node", "server/index.js"]
