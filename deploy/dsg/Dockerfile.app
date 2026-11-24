# DSG self-host image: Maple's Workers (api, web, electric-sync) on alchemy's local
# runtime, fronted by a Host-header proxy (deploy/dsg/proxy.ts). See deploy/dsg/README.md.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* && npm install -g bun@1.4.4
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run alchemy:build-deps
# The web client is built once here with the public URLs inlined and served as static files by
# deploy/dsg/proxy.ts, so no Vite dev server runs (it held ~1.2 GB). Run with MAPLE_APPS="api electric-sync".
ARG PUBLIC_DOMAIN=maple.dsg.id
ENV VITE_API_BASE_URL=https://${PUBLIC_DOMAIN}/api VITE_API_PUBLIC_URL=https://${PUBLIC_DOMAIN}/api \
    VITE_INGEST_URL=https://${PUBLIC_DOMAIN}/ingest VITE_ELECTRIC_SYNC_URL=https://${PUBLIC_DOMAIN}/sync \
    VITE_STATUS_PAGE_BASE_URL=https://${PUBLIC_DOMAIN}/status VITE_MAPLE_AUTH_MODE=self_hosted
RUN bun run --cwd apps/web build
# Real configuration arrives as container env; alchemy only needs the file to exist.
RUN touch /app/dsg.env
COPY deploy/dsg/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV MAPLE_DEV_ENV_FILE=dsg.env MAPLE_ROUTES_FILE=/app/.alchemy/routes.json PROXY_PORT=8088 ALCHEMY_LOCAL_STATE=1 MAPLE_WEB_DIST=/app/apps/web/dist
VOLUME ["/app/.alchemy"]
EXPOSE 8088
ENTRYPOINT ["/entrypoint.sh"]
