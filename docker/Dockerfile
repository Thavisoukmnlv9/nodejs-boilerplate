# syntax=docker/dockerfile:1

# ─── Build stage: install everything, generate client, compile TS, prune dev ──
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
# Compile → dist, drop dev deps, then (re)generate the client against prod deps.
RUN npm run build \
  && npm prune --omit=dev \
  && npx prisma generate

# ─── Runtime stage: tiny, non-root ────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
# openssl for Prisma engines; tini for correct PID-1 signal handling (graceful shutdown).
RUN apk add --no-cache openssl tini \
  && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh \
  && mkdir -p logs uploads \
  && chown -R app:app /app

USER app
EXPOSE 8080

# tini → entrypoint (optionally migrates) → CMD. Worker overrides CMD.
ENTRYPOINT ["/sbin/tini", "--", "./docker/entrypoint.sh"]
CMD ["node", "dist/server.js"]
