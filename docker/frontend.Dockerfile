# --- Build stage -------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm install --workspace frontend --include-workspace-root

COPY shared ./shared
COPY frontend ./frontend

WORKDIR /app/frontend
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
