# Étape 1 : Build
FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /build
COPY . .

RUN pnpm install --frozen-lockfile --filter @xplor/worker... --filter @xplor/api
RUN pnpm --filter "@xplor/worker..." run build
RUN pnpm --filter @xplor/worker deploy --prod /out

# Copie prisma depuis apps/api
RUN mkdir -p /out/prisma && cp apps/api/prisma/schema.prisma /out/prisma/schema.prisma
RUN cd /out && npx --yes prisma@6.19.3 generate --schema prisma/schema.prisma

RUN test -f /out/dist/main.js && \
    test -f /out/node_modules/@xplor/shared/dist/index.js && \
    find /out/node_modules -path '*/.prisma/client/index.js' | grep -q . && \
    test -d /out/node_modules/sharp && \
    test -d /out/node_modules/ioredis

# Étape 2 : Production
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out /app

USER node

CMD ["node", "dist/main.js"]
