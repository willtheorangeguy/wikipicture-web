# Stage 1: Build React frontend (build context must be web/ root)
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: nginx serves the built assets and proxies /api to backend
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/wikipicture.conf
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
EXPOSE 80
