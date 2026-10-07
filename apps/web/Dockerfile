# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --workspaces=false --no-audit --no-fund

FROM dependencies AS build
COPY apps/web/ ./
COPY packages/shared-types/ /workspace/packages/shared-types/
COPY packages/clip-export/ /workspace/packages/clip-export/
COPY packages/api-client/ /workspace/packages/api-client/
COPY packages/cloud-sync-schema/ /workspace/packages/cloud-sync-schema/
COPY client/src/ /workspace/client/src/
COPY client/public/logo.svg client/public/logo-titlebar.svg /workspace/client/public/
RUN npm run typecheck && npm run build

FROM node:24-bookworm-slim AS media
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core python3 python3-venv ca-certificates tini util-linux \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir 'yt-dlp[default]==2026.8.19' \
    && rm -rf /var/lib/apt/lists/*
ENV YTDLP_PATH=/opt/ytdlp/bin/yt-dlp
COPY apps/web/scripts/container-entrypoint.sh /usr/local/bin/clippster-web
RUN chmod +x /usr/local/bin/clippster-web && mkdir /data && chown node:node /data
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/usr/local/bin/clippster-web"]

FROM media AS development
ENV NODE_ENV=development PORT=8090 HOST=0.0.0.0 WEB_DATA_DIR=/data
WORKDIR /workspace/apps/web
COPY --from=dependencies --chown=node:node /workspace/apps/web/node_modules ./node_modules
COPY apps/web/ ./
COPY packages/shared-types/ /workspace/packages/shared-types/
COPY packages/clip-export/ /workspace/packages/clip-export/
COPY packages/api-client/ /workspace/packages/api-client/
COPY packages/cloud-sync-schema/ /workspace/packages/cloud-sync-schema/
COPY client/src/ /workspace/client/src/
COPY client/public/logo.svg client/public/logo-titlebar.svg /workspace/client/public/
RUN ln -s /workspace/apps/web/node_modules /workspace/node_modules
EXPOSE 5175 8090
CMD ["node", "scripts/dev.mjs"]

FROM media AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 WEB_DATA_DIR=/data
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /workspace/apps/web/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
