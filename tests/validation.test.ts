/**
 * FinFam flow test — REGISTRATION VALIDATION & REFERENCE GUARDS.
 *
 * The entry point and the lookup paths, from the adversarial side:
 * malformed registrations (422 with field errors), duplicate email (409),
 * unknown/malformed references (neutral 404s that never leak), reference
 * recovery (all three details must match) and the PII-safe status view.
 *
 * Requires the dev server (`bun run dev`) — see tests/helpers/api.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { OPEN_POSITION } from "@/config/content";
import {
  apiRequest,
  assertServerUp,
  BASE_URL,
  expectFail,
  expectOk,
  REFERENCE_PATTERN,
} from "./helpers/api";
import { cleanupTestCandidates, db, uniqueEmail } from "./helpers/db";

const fullName = "Validation Test Candidate";
const phone = "0803 000 0003";
const city = "Kano";

let email = "";
let reference = "";

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(email ? [email] : []);
  if (removed > 0) {
    console.log(`[validation] cleanup: removed ${removed} test candidate(s)`);
  }
});

function submit(overrides: Record<string, unknown>) {
  return apiRequest("POST", "/api/applications", {
    fullName,
    email,
    phone,
    city,
    roleTitle: OPEN_POSITION.title,
    consent: true,
    ...overrides,
  });
}

describe("Registration validation", () => {
  it("registers one valid candidate for later lookups", async () => {
    email = uniqueEmail("validation");
    const data = expectOk<{ referenceNumber: string }>(
      await submit({}),
      200,
      "valid registration",
    );
    reference = data.referenceNumber;
    expect(reference).toMatch(REFERENCE_PATTERN);
  });

  it("rejects an empty payload (422 with field errors)", async () => {
    const error = expectFail<unknown>(
      await apiRequest("POST", "/api/applications", {}),
      422,
      "VALIDATION_ERROR",
      "empty payload",
    );
    expect(error.fields).toBeTruthy();
    expect(error.fields?.email).toBeTruthy();
    expect(error.fields?.consent).toBeTruthy();
  });

  it("rejects a malformed email (422, email field)", async () => {
    const error = expectFail<unknown>(
      await submit({ email: "not-an-email" }),
      422,
      "VALIDATION_ERROR",
      "bad email",
    );
    expect(error.fields?.email).toBeTruthy();
  });

  it("rejects a malformed phone number (422, phone field)", async () => {
    const error = expectFail<unknown>(
      await submit({ phone: "call-me" }),
      422,
      "VALIDATION_ERROR",
      "bad phone",
    );
    expect(error.fields?.phone).toBeTruthy();
  });

  it("rejects a name with digits (422, fullName field)", async () => {
    const error = expectFail<unknown>(
      await submit({ fullName: "Test 123" }),
      422,
      "VALIDATION_ERROR",
      "bad name",
    );
    expect(error.fields?.fullName).toBeTruthy();
  });

  it("rejects a missing consent (422, consent field)", async () => {
    const error = expectFail<unknown>(
      await submit({ consent: false }),
      422,
      "VALIDATION_ERROR",
      "no consent",
    );
    expect(error.fields?.consent).toBeTruthy();
  });

  it("rejects a role that is not open (422, roleTitle field)", async () => {
    const error = expectFail<unknown>(
      await submit({ roleTitle: "Chief Wizard" }),
      422,
      "VALIDATION_ERROR",
      "closed role",
    );
    expect(error.fields?.roleTitle).toBeTruthy();
  });

  it("rejects a duplicate email with a conflict (409)", async () => {
    const error = expectFail<unknown>(
      await submit({ fullName: "Different Name Same Email" }),
      409,
      "CONFLICT",
      "duplicate email",
    );
    expect(error.fields?.email).toBeTruthy();
  });

  it("rejects a non-JSON body with a clean 400", async () => {
    const response = await fetch(`${BASE_URL}/api/applications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
      signal: AbortSignal.timeout(20_000),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Reference lookup guards", () => {
  it("returns a neutral 404 for an unknown but well-formed reference", async () => {
    const error = expectFail<unknown>(
      await apiRequest("GET", "/api/journey/FF-M4M4M4"),
      404,
      "NOT_FOUND",
      "unknown reference",
    );
    expect(error.message).toMatch(/couldn't find/i);
  });

  it("returns a neutral 404 for a malformed reference (no leak)", async () => {
    expectFail<unknown>(
      await apiRequest("GET", "/api/journey/hello-world"),
      404,
      "NOT_FOUND",
      "malformed reference",
    );
  });

  it("normalises a lowercase reference for a real candidate (200)", async () => {
    const data = expectOk<{ referenceNumber: string; status: string }>(
      await apiRequest("GET", `/api/journey/${reference.toLowerCase()}`),
      200,
      "lowercase journey lookup",
    );
    expect(data.referenceNumber).toBe(reference);
  });

  it("exposes the status view without leaking sensitive PII", async () => {
    const data = expectOk<{ referenceNumber: string; status: string; fullName: string }>(
      await apiRequest("GET", `/api/candidates/${reference}`),
      200,
      "candidate status",
    );
    expect(data.referenceNumber).toBe(reference);
    expect(data.status).toBe("APPLICANT");
    // The candidate's own name is part of the status view by design (it is
    // what they already know); phone, email and city are deliberately excluded.
    expect(data.fullName).toBe(fullName);
    const raw = JSON.stringify(data);
    expect(raw).not.toContain("test.example.com");
    expect(raw).not.toContain(phone);
    expect(raw).not.toContain(city);
  });
});

describe("Reference recovery", () => {
  it("reveals the reference only when all three details match", async () => {
    const data = expectOk<{ referenceNumber: string }>(
      await apiRequest("POST", "/api/recruitment/recover-reference", {
        fullName,
        email,
        phone,
      }),
      200,
      "recovery with matching details",
    );
    expect(data.referenceNumber).toBe(reference);
  });

  it("returns the same neutral 404 when any detail mismatches", async () => {
    const error = expectFail<unknown>(
      await apiRequest("POST", "/api/recruitment/recover-reference", {
        fullName,
        email,
        phone: "0803 999 9999",
      }),
      404,
      "NOT_FOUND",
      "recovery with wrong phone",
    );
    expect(error.message).toMatch(/couldn't find|no matching/i);
  });
});

describe("Registration persistence", () => {
  it("stored the application exactly once with the server-decided role", async () => {
    const candidate = await db.candidate.findUnique({
      where: { referenceNumber: reference },
      select: {
        status: true,
        applications: { select: { roleTitle: true, status: true } },
      },
    });
    expect(candidate?.status).toBe("APPLICANT");
    expect(candidate?.applications).toHaveLength(1);
    expect(candidate?.applications[0]?.roleTitle).toBe(OPEN_POSITION.title);
    expect(candidate?.applications[0]?.status).toBe("SUBMITTED");
  });
});
