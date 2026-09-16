/**
 * Answer-key resolver for the assessment outcome tests.
 *
 * The authoritative answer key lives in src/server/assessment-content.ts,
 * which is guarded by `server-only`:
 *
 * - Under `bun run test` (scripts/test.sh adds --conditions react-server)
 *   the module imports cleanly, so tests use the REAL key.
 * - Under a plain `bun test`, the `server-only` marker package throws, so
 *   the key is parsed from the source file instead (same file, same values).
 *
 * Both paths sanity-check the result against the client-safe question
 * config, so a content change that breaks the resolver fails loudly
 * instead of producing wrong pass/fail outcomes.
 */
import { ASSESSMENT_META, ASSESSMENT_QUESTION_IDS } from "@/config/assessment";

/** questionId → index (0–3) of the correct option. */
export type AnswerKey = Record<string, number>;

let cached: AnswerKey | null = null;

function sanityCheck(key: AnswerKey): AnswerKey {
  for (const questionId of ASSESSMENT_QUESTION_IDS) {
    const index = key[questionId];
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 3
    ) {
      throw new Error(
        `Answer key is incomplete/invalid for "${questionId}" — the assessment content changed; fix tests/helpers/answer-key.ts.`,
      );
    }
  }
  if (Object.keys(key).length !== ASSESSMENT_META.totalQuestions) {
    throw new Error(
      `Answer key covers ${Object.keys(key).length} questions, expected ${ASSESSMENT_META.totalQuestions}.`,
    );
  }
  return key;
}

async function tryImportServerModule(): Promise<AnswerKey | null> {
  try {
    const serverContent = (await import("@/server/assessment-content")) as {
      ASSESSMENT_ANSWER_KEY: Record<string, { correctIndex: number }>;
    };
    const key: AnswerKey = {};
    for (const [questionId, entry] of Object.entries(
      serverContent.ASSESSMENT_ANSWER_KEY,
    )) {
      key[questionId] = entry.correctIndex;
    }
    return key;
  } catch {
    // server-only marker threw (plain `bun test`) — fall back to parsing.
    return null;
  }
}

function parseKeyFromSource(source: string): AnswerKey {
  const key: AnswerKey = {};
  const pattern = /"((?:q-\d+))":\s*\{\s*correctIndex:\s*([0-3])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    key[match[1]] = Number.parseInt(match[2], 10);
  }
  return key;
}

/** Load the authoritative answer key (real module import, source fallback). */
export async function loadAnswerKey(): Promise<AnswerKey> {
  if (cached) return cached;

  const imported = await tryImportServerModule();
  if (imported) {
    cached = sanityCheck(imported);
    return cached;
  }

  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/server/assessment-content.ts", import.meta.url),
    "utf8",
  );
  cached = sanityCheck(parseKeyFromSource(source));
  return cached;
}
