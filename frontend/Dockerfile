# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Cache node_modules layer
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build -- --configuration=production

# ── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# envsubst (part of gettext) lets us inject $BACKEND_URL at container start.
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Store as a template; envsubst fills in $BACKEND_URL at start time.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy built Angular app
COPY --from=builder /app/dist/tienda-de-ropa/browser /usr/share/nginx/html

EXPOSE 80

# Substitute only $BACKEND_URL and $PORT (leave nginx vars like $uri, $host, etc.
# unchanged), then start nginx. PORT defaults to 80 when not set (local/docker-compose);
# Railway sets it dynamically per service — the container must bind to it to be reachable.
CMD ["/bin/sh", "-c", "export PORT=${PORT:-80} && envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
