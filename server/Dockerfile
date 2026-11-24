# Build context: server/. No environment files or models enter this image.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
COPY drizzle ./drizzle
# Build an empty schema once so the API can start a guest store without replaying migrations.
RUN node --input-type=module -e "import { writeFile } from 'node:fs/promises'; import { createGuestTemplate } from './dist/db/guestDatabase.js'; await writeFile('/app/guest-template.tar.gz', new Uint8Array(await (await createGuestTemplate()).arrayBuffer()));"

# Build this target separately for one-off migrations and db:check.
FROM build AS migrations
COPY drizzle.config.ts ./
COPY scripts/check-db.ts ./scripts/check-db.ts
CMD ["npm", "run", "db:migrate"]

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV ASIGNX_GUEST_TEMPLATE=/app/guest-template.tar.gz
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/guest-template.tar.gz ./guest-template.tar.gz
USER node
CMD ["node", "dist/index.js"]
