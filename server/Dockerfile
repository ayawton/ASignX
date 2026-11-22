# Build context: server/. No environment files or models enter this image.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Build this target separately for one-off migrations and db:check.
FROM build AS migrations
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY scripts/check-db.ts ./scripts/check-db.ts
CMD ["npm", "run", "db:migrate"]

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
