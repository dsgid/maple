# DSG self-host image: Maple's Workers (api, web, electric-sync) on alchemy's local
# runtime, fronted by a Host-header proxy (deploy/dsg/proxy.ts). See deploy/dsg/README.md.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* && npm install -g bun@1.4.4
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run alchemy:build-deps
# Real configuration arrives as container env; alchemy only needs the file to exist.
RUN touch /app/dsg.env
COPY deploy/dsg/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV MAPLE_DEV_ENV_FILE=dsg.env MAPLE_ROUTES_FILE=/app/.alchemy/routes.json PROXY_PORT=8088 ALCHEMY_LOCAL_STATE=1
VOLUME ["/app/.alchemy"]
EXPOSE 8088
ENTRYPOINT ["/entrypoint.sh"]
