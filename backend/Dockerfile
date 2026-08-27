# PayBridge backend — production image.
#
# Debian slim, not alpine: Prisma's query engine binary is built against glibc.
# Alpine's musl libc needs an extra `binaryTargets` entry in schema.prisma to
# match; staying on glibc means the schema doesn't need to know it's in Docker.
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma's query engine links against libssl and probes for it with the
# `openssl` CLI at `prisma generate` time. node:20-bookworm-slim doesn't ship
# it, so without this Prisma silently guesses a version — which can pick an
# engine binary that doesn't match what's actually on the box and fail at
# runtime instead of at build time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Installed before the rest of the source so this layer only rebuilds when
# dependencies actually change, not on every code edit.
#
# `npm install`, not `npm ci`: matches backend/render.yaml's existing
# buildCommand. package-lock.json is currently out of sync with
# package.json (missing a couple of optional transitive deps), which `npm
# ci` refuses to tolerate but `npm install` reconciles automatically.
COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

# Matches backend/render.yaml's startCommand: apply any pending migrations,
# then start. Runs on every container start, which is safe — a migration
# that's already applied is a no-op.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
