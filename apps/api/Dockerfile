# Étape 1 : Build
FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /build
COPY . .

RUN pnpm install --frozen-lockfile --filter @xplor/api...
RUN pnpm --filter @xplor/api build
RUN pnpm --filter @xplor/api deploy --prod /out

RUN if [ ! -d "/out/prisma" ]; then cp -r apps/api/prisma /out/prisma && cd /out && npx prisma generate; fi

RUN test -f /out/dist/main.js && \
    test -f /out/node_modules/@xplor/i18n/dist/index.js && \
    test -f /out/prisma/schema.prisma && \
    test -d /out/prisma/migrations

# Étape 2 : Production
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out /app

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
