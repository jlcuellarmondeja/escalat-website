# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# Instala dependencias (con caché de capas)
COPY package.json package-lock.json ./
RUN npm ci

# Copia el código y compila (adaptador Node → dist/server/entry.mjs)
COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# curl para el HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Solo dependencias de producción
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App compilada
COPY --from=build /app/dist ./dist

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
