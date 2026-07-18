# syntax=docker/dockerfile:1.7

FROM node:20.19-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm --workspace shared run build && npm --workspace server run build

FROM build AS migrator
ENV APP_ENV=production \
    NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy", "--schema", "server/prisma/schema.prisma"]

FROM build AS prod-deps
RUN npm prune --omit=dev

FROM node:20.19-bookworm-slim AS runtime
WORKDIR /app

ENV APP_ENV=production \
    NODE_ENV=production \
    PORT=4000 \
    PROCUREX_SERVER_ENV_FILE=.env

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/shared/dist ./shared/dist

RUN mkdir -p \
      /app/server/.data/documents \
      /app/server/.data/bid-documents \
      /app/server/.data/profile-images \
      /app/server/.data/official-documents \
    && chown -R node:node /app

USER node
EXPOSE 4000
CMD ["npm", "--workspace", "server", "run", "start"]
