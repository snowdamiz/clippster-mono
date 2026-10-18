# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-bookworm-slim AS dependencies
# Keep the filesystem root distinct from Vite's /workspace/ URL base.
# Matching them causes shared Vue style requests to lose their @fs prefix.
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --workspaces=false --no-audit --no-fund

FROM dependencies AS build
COPY apps/web/ ./
COPY packages/shared-types/ /repo/packages/shared-types/
COPY packages/email-composer/ /repo/packages/email-composer/
COPY server/priv/email/ /repo/server/priv/email/
COPY packages/clip-export/ /repo/packages/clip-export/
COPY packages/api-client/ /repo/packages/api-client/
COPY packages/cloud-sync-schema/ /repo/packages/cloud-sync-schema/
COPY client/src/ /repo/client/src/
COPY client/public/ /repo/client/public/
RUN npm run typecheck && npm run build

FROM node:24-bookworm-slim AS media
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core python3 python3-venv ca-certificates tini util-linux \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir 'yt-dlp[default,curl-cffi]==2026.8.19' \
    && rm -rf /var/lib/apt/lists/*
ENV YTDLP_PATH=/opt/ytdlp/bin/yt-dlp
COPY client/public/fonts/ /usr/local/share/fonts/clippster/
COPY apps/web/scripts/container-entrypoint.sh /usr/local/bin/clippster-web
RUN sed -i 's/\r$//' /usr/local/bin/clippster-web \
    && chmod +x /usr/local/bin/clippster-web && mkdir /data && chown node:node /data
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/usr/local/bin/clippster-web"]

FROM media AS development
ENV NODE_ENV=development PORT=8090 HOST=0.0.0.0 WEB_DATA_DIR=/data
WORKDIR /repo/apps/web
COPY --from=dependencies --chown=node:node /repo/apps/web/node_modules ./node_modules
COPY apps/web/ ./
COPY packages/shared-types/ /repo/packages/shared-types/
COPY packages/email-composer/ /repo/packages/email-composer/
COPY server/priv/email/ /repo/server/priv/email/
COPY packages/clip-export/ /repo/packages/clip-export/
COPY packages/api-client/ /repo/packages/api-client/
COPY packages/cloud-sync-schema/ /repo/packages/cloud-sync-schema/
COPY client/src/ /repo/client/src/
COPY client/public/ /repo/client/public/
RUN ln -s /repo/apps/web/node_modules /repo/node_modules
EXPOSE 5175 8090
CMD ["node", "scripts/dev.mjs"]

FROM media AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 WEB_DATA_DIR=/data
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/apps/web/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
