FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/web/package.json ./apps/web/
COPY apps/kiosk/package.json ./apps/kiosk/
COPY packages/shared/package.json ./packages/shared/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/viewer-core/package.json ./packages/viewer-core/
COPY . .

RUN pnpm install --frozen-lockfile --filter @xplor/admin... --filter @xplor/web...

ARG VITE_PUBLIC_WEB_URL=https://v.xplor.ma
ENV VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL

RUN pnpm --filter "@xplor/admin..." run build
RUN pnpm --filter "@xplor/web..." run build

RUN test -f apps/admin/dist/index.html
RUN test -f apps/web/dist/index.html

FROM caddy:2-alpine

COPY --from=build /app/apps/admin/dist /srv/admin
COPY --from=build /app/apps/web/dist /srv/web
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
