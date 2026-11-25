# Build stage — Docker context must be the monorepo root so
# packages/app-tour is available for the @clippster/app-tour alias.
FROM node:22-alpine AS builder

WORKDIR /app/landing

ARG VITE_API_URL=https://api.clippster.app/api
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY landing/package.json landing/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Preserve repository-relative imports between landing, shared packages and email assets.
COPY landing/ ./
COPY packages/app-tour /app/packages/app-tour
COPY packages/profile-design /app/packages/profile-design
COPY packages/shared-types /app/packages/shared-types
COPY packages/email-composer /app/packages/email-composer
COPY server/priv/email /app/server/priv/email

# Build the application
RUN yarn build

# Production stage — Node injects unique title/description/JSON-LD per URL
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/landing/dist ./dist
COPY landing/server.mjs ./server.mjs
COPY landing/site.mjs ./site.mjs
COPY landing/workspace-proxy.mjs ./workspace-proxy.mjs
COPY landing/src/seo ./src/seo

ENV PORT=8080
ENV API_URL=https://api.clippster.app/api
ENV SITE_URL=https://clippster.app
EXPOSE 8080

CMD ["node", "server.mjs"]
