# Build stage — Docker context must be the monorepo root so
# packages/app-tour is available for the @clippster/app-tour alias.
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=https://api.clippster.app/api
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY landing/package.json landing/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy landing source and shared package (tsconfig/vite resolve ../packages/app-tour)
COPY landing/ ./
COPY packages/app-tour /packages/app-tour

# Build the application
RUN yarn build

# Production stage — Node injects unique title/description/JSON-LD per URL
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY landing/server.mjs ./server.mjs
COPY landing/src/seo ./src/seo

ENV PORT=8080
ENV API_URL=https://api.clippster.app/api
ENV SITE_URL=https://clippster.app
EXPOSE 8080

CMD ["node", "server.mjs"]
