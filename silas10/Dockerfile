# Silas 10 — imagem para a VPS (Hostinger).
# O sistema roda no workerd (runtime da Cloudflare) via Wrangler em modo local:
# banco D1 (SQLite) e arquivos R2 ficam persistidos no volume /data.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_CF_FETCH_ENABLED=false \
    HOME=/home/node

RUN mkdir -p /app /data /config && chown node:node /app /data /config
WORKDIR /app
USER node

COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .
RUN npm run build

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/api/brands').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "scripts/vps-start.mjs"]
