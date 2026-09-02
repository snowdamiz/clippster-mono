# Build stage — Docker context must be the monorepo root so
# packages/app-tour is available for the @clippster/app-tour alias.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY landing/package.json landing/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy landing source and shared package (tsconfig/vite resolve ../packages/app-tour)
COPY landing/ ./
COPY packages/app-tour /packages/app-tour

# Build the application
RUN yarn build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (Fly.io default)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
