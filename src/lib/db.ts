import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Server-only Prisma client.
 *
 * Never import this file from a client component. UI code talks to the API
 * layer; the API layer talks to services; services talk to the database.
 *
 * Prisma's built-in query/error logging is intentionally off: handled
 * business rejections (e.g. duplicate email → 409) must not surface as
 * scary "prisma:error" entries, and unexpected failures are already logged
 * with context by the API layer (src/lib/api/response.ts).
 */
export const db = globalForPrisma.prisma ?? new PrismaClient();

// Reuse the client across hot reloads in development to avoid exhausting
// database connections.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
