# ─────────────────────────────────────────────────────────────────────────────
# NOTE: the previous version of this file ran `npm ci` before copying the repo
# in, which meant `postinstall` (prisma generate && npm run build && prisma
# migrate deploy) fired with no prisma/schema.prisma or src/ present yet —
# every stage would fail. Fixed here by:
#   1. Passing --ignore-scripts to every npm ci, so postinstall never runs
#      implicitly during install.
#   2. Running `prisma generate` and `npm run build` as explicit, ordered
#      steps instead.
#   3. NOT running `prisma migrate deploy` at build time at all — migrations
#      need a live DATABASE_URL, which a Docker build should never depend on
#      (build should work with zero network access). Migrations run at
#      container *start* instead, via docker/entrypoint.sh.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
# openssl: Prisma's query/schema engines are dynamically linked against it and
#   crash at runtime on vanilla Alpine ("Could not parse schema engine
#   response") without it.
# python3/make/g++: bcrypt ships a native binding with no musl-linked
#   prebuilt for this platform, so npm falls back to compiling it from
#   source during `npm ci` — without these it fails at *runtime* instead
#   of at install time ("Cannot find module .../bcrypt_lib.node").
# Both confirmed by actually running the built image, not assumed.
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app
COPY package*.json .npmrc ./
COPY prisma ./prisma

# ─── Development ────────────────────────────────────────────────────────────
FROM base AS development
RUN npm ci --ignore-scripts
# --ignore-scripts also skips bcrypt's own install script (the one that
# actually compiles its native binding), not just this project's postinstall
# — rebuild it explicitly, now that build tools are present.
RUN npm rebuild bcrypt --build-from-source
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ─── Build ──────────────────────────────────────────────────────────────────
FROM base AS builder
RUN npm ci --ignore-scripts
RUN npx prisma generate
COPY . .
RUN npm run build

# ─── Production ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache openssl python3 make g++
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json .npmrc ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts
RUN npm rebuild bcrypt --build-from-source
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
