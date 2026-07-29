import { PrismaClient } from "@prisma/client";

/*
 * Single Prisma client instance reused across hot reloads in dev.
 *
 * WHY the client is cached on globalThis: `tsx watch` re-evaluates this
 * module on every save. Without the cache, each reload would open another
 * connection pool against Neon — whose pooled endpoint has a hard connection
 * ceiling — and the process would leak them until Postgres started refusing.
 *
 * WHY the cache is keyed on the constructor: the cached instance is built from
 * the GENERATED client, and `prisma generate` after a schema change replaces
 * that generated code. A plain `??` cache happily keeps serving the old
 * instance, which has no delegate for the model you just added — the symptom is
 * `undefined is not an object (evaluating 'prisma.newModel.create')` against a
 * schema that is definitely correct, "fixable" only by restarting the server.
 * Storing the constructor we built from lets us notice it changed and rebuild.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaCtor?: typeof PrismaClient;
};

const cached =
  globalForPrisma.prisma && globalForPrisma.prismaCtor === PrismaClient
    ? globalForPrisma.prisma
    : undefined;

export const prisma =
  cached ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaCtor = PrismaClient;
}
