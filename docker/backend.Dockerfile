# --- Build stage -------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install --workspace backend --include-workspace-root

COPY shared ./shared
COPY backend ./backend

WORKDIR /app/backend
RUN npx prisma generate && npm run build

# --- Runtime stage -----------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/

RUN mkdir -p /data /uploads && chown -R app:app /data /uploads /app
USER app

WORKDIR /app/backend
EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
# Migrations are applied on boot so the mounted database is always current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/backend/src/server.js"]
