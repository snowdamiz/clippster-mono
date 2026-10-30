# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-bookworm-slim AS dependencies
# Keep the filesystem root distinct from Vite's /workspace/ URL base.
# Matching them causes shared Vue style requests to lose their @fs prefix.
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --workspaces=false --no-audit --no-fund

FROM dependencies AS source
COPY apps/web/ ./
COPY packages/profile-design/ /repo/packages/profile-design/
COPY packages/shared-types/ /repo/packages/shared-types/
COPY packages/email-composer/ /repo/packages/email-composer/
COPY server/priv/email/ /repo/server/priv/email/
COPY packages/clip-export/ /repo/packages/clip-export/
COPY packages/api-client/ /repo/packages/api-client/
COPY packages/cloud-sync-schema/ /repo/packages/cloud-sync-schema/
COPY packages/app-tour/ /repo/packages/app-tour/
COPY client/src/ /repo/client/src/
COPY client/public/ /repo/client/public/

FROM source AS build
RUN npm run typecheck && npm run build

# Reproduce the web CI checks without any host/root/client node_modules.
# Run from apps/web with: npm run verify:ci --workspaces=false
FROM source AS verify
COPY package.json tsconfig.json /repo/
COPY client/package.json client/tsconfig*.json /repo/client/
COPY scripts/dev-setup*.mjs /repo/scripts/
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
RUN test ! -e /repo/node_modules && test ! -e /repo/client/node_modules \
    && npm run typecheck --workspaces=false \
    && npm test --workspaces=false \
    && node --test ../../scripts/dev-setup.test.mjs \
    && npm run build --workspaces=false \
    && npm run test:e2e --workspaces=false

FROM node:24-bookworm-slim AS media
ARG TARGETARCH
# On Cloudflare Containers, tigrisfs mounts media from R2 and Litestream replicates the database there
# (scripts/container-entrypoint.sh). Checksums are from each project's release.
ARG TIGRISFS_VERSION=1.2.1
ARG LITESTREAM_VERSION=0.5.17
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core python3 python3-venv ca-certificates tini util-linux fuse3 curl \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir 'yt-dlp[default,curl-cffi]==2026.8.19' \
    && rm -rf /var/lib/apt/lists/* \
    && case "$TARGETARCH" in \
         amd64) tigrisfs_sum=9fd6e7a9f3e7d86571ea55c66459205e94dfa5f6a25887d7e95c0a46f7641ed4 litestream_arch=x86_64 litestream_sum=cfb371176d164437ae869f8351cfde49bd1804ae71c61923f75c9cba9c9c006d ;; \
         arm64) tigrisfs_sum=f446e4cdf23b896ccad2efe9de0499e20f93dc44f4e7d8b38b07b257877aa185 litestream_arch=arm64 litestream_sum=f8ca4a050095c1efbda2c4365172e61bf9d955ea0d9ac42f448b52e51819baa5 ;; \
         *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
       esac \
    && curl -fsSLo /tmp/tigrisfs.tar.gz "https://github.com/tigrisdata/tigrisfs/releases/download/v${TIGRISFS_VERSION}/tigrisfs_${TIGRISFS_VERSION}_linux_${TARGETARCH}.tar.gz" \
    && echo "$tigrisfs_sum  /tmp/tigrisfs.tar.gz" | sha256sum -c - \
    && curl -fsSLo /tmp/litestream.tar.gz "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${litestream_arch}.tar.gz" \
    && echo "$litestream_sum  /tmp/litestream.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/tigrisfs.tar.gz -C /usr/local/bin tigrisfs \
    && tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream \
    && rm /tmp/tigrisfs.tar.gz /tmp/litestream.tar.gz
COPY apps/web/litestream.yml /etc/litestream.yml
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
COPY packages/profile-design/ /repo/packages/profile-design/
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
ARG APP_REVISION=development
ENV APP_REVISION=$APP_REVISION
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 WEB_DATA_DIR=/data
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/apps/web/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
