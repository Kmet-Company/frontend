# syntax=docker/dockerfile:1.7

# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
# We use `npm install` (not `npm ci`) so the image builds even if the lockfile
# is stale or missing. Speed flags keep the layer small.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --loglevel=error

# Copy sources and build the production bundle
COPY . .
RUN npm run build -- --configuration production

# ---- Runtime stage --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA-friendly nginx config (history API fallback + gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular 18 output lives under dist/<project>/browser
COPY --from=build /app/dist/vireal/browser /usr/share/nginx/html

EXPOSE 80

# BusyBox's wget on nginx:alpine flakes on `--spider`, so do a real GET to
# /dev/null instead. Redirect both stdout + stderr to keep the check silent.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
