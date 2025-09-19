# Build frontend assets
FROM node:20-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable
COPY web ./
RUN CI=true pnpm install --frozen-lockfile && pnpm run build

# Nginx runtime to serve frontend and proxy API
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy built frontend assets
COPY --from=frontend /app/web/dist ./

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
