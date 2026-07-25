# Multi-stage build: node -> nginx (static serving)
# ==============================================================

# ---- STAGE 1: BUILDER ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests dulu (leverage docker cache)
COPY package.json package-lock.json* bun.lockb* ./

# Install deps (ignore optional bun.lockb)
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source lengkap
COPY . .

# Copy .env (dari server; SCP-in ke context sebelum build)
# Vite embed VITE_* env vars pada build time.

# Build production
RUN npm run build

# ---- STAGE 2: NGINX ----
FROM nginx:1.27-alpine

# Nginx config dengan SPA fallback + cache untuk assets
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output dari stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
