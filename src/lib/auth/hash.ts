import { createHash } from "node:crypto";

/**
 * sha256 hex digest — the one hashing primitive shared by Staff login-code
 * hashing and Staff session-token hashing (Stage 7). Server-side only in
 * practice; kept free of "server-only" so the backfill script (run under
 * bun with the react-server condition) can import the same chain.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
