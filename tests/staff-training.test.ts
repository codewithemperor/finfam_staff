/**
 * Stage 9 — Staff Training (end-to-end, real dev server).
 *
 * Drives REAL staff members through activation → OTP login → onboarding
 * completion, then exercises the training APIs over real HTTP with direct
 * Prisma assertions for the persistence invariants:
 *
 *   - eligibility (onboarding gate → 403 FORBIDDEN, never 401/404)
 *   - identity (session-only; hostile identity-ish body fields ignored)
 *   - overview read-only (GET /api/staff/training NEVER enrolls)
 *   - lazy enrollment (first course open creates; repeats reuse; 4-way
 *     concurrent first opens → exactly one row; version pinned "1.0")
 *   - sequential server-enforced progression (Lesson 1 current, 2–6
 *     locked; skip-ahead 422; unknown lesson 422)
 *   - locked content never exposed via ?lesson= manipulation
 *   - idempotent duplicate completion; concurrent completion → one row
 *   - exactly-once course completion latch (repeat + concurrent final)
 *   - completion has NO employment effect (Candidate/Staff/Account/
 *     onboarding/reports untouched; ZERO NotificationDelivery rows)
 *   - review after completion performs ZERO writes
 *   - cross-Staff isolation
 *   - no reference-door: unknown course ids (incl. recruitment
 *     references) are plain 404s
 *
 * Content firewall (brief §12/§55): the served course content must contain
 * NO ₦650, no commission/payroll/bonus/earnings arithmetic, no prospect
 * script, no certificate/video/XP/badge/streak/leaderboard wording, and
 * Lesson 5's reporting labels must equal DAILY_REPORT_CATEGORIES exactly.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  DAILY_REPORT_CATEGORIES,
  DAILY_REPORT_SELF_REPORTED_NOTICE,
} from "@/config/daily-report";
import { ONBOARDING_META, ONBOARDING_STEP_IDS } from "@/config/onboarding";
import {
  STAFF_FOUNDATIONS_CURRENT_VERSION,
  STAFF_FOUNDATIONS_VERSIONS,
} from "@/config/training/staff-foundations";

import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
} from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import {
  driveToActivation,
  loginAsStaff,
} from "./helpers/journey";

/* ----------------------------------------------------------------- */
/* Shared fixtures                                                    */
/* ----------------------------------------------------------------- */

const COURSE = "staff-foundations";
const LESSON_IDS = STAFF_FOUNDATIONS_VERSIONS[
  STAFF_FOUNDATIONS_CURRENT_VERSION
].lessons.map((lesson) => lesson.id);

const COURSE_API = `/api/staff/training/${COURSE}`;
const LESSONS_API = `${COURSE_API}/lessons`;

const emails: string[] = [];

interface TrainingStaff {
  email: string;
  referenceNumber: string;
  staffId: string;
  staffRowId: string;
  cookie: string;
}

/**
 * Drive a staff member all the way to a fully-onboarded, reporting-ready
 * portal identity and return their session cookie (same local pattern as
 * tests/daily-reports.test.ts).
 */
async function driveFullyOnboardedStaff(
  label: string,
): Promise<TrainingStaff> {
  const driven = await driveToActivation(label);
  emails.push(driven.email);

  const staffRow = await db.staff.findUnique({
    where: { staffId: driven.staffId },
    select: { id: true },
  });
  if (!staffRow) throw new Error(`[${label}] staff row missing`);

  const { cookie } = await loginAsStaff(driven.email, label, {
    staffRowId: staffRow.id,
  });

  // Complete onboarding through the REAL authenticated API.
  for (const stepId of ONBOARDING_STEP_IDS) {
    if (stepId === "ready") continue;
    expectOk(
      await apiRequest(
        "POST",
        "/api/staff/onboarding/steps",
        { stepId },
        cookie,
      ),
      200,
      `[${label}] onboarding step ${stepId}`,
    );
  }
  expectOk(
    await apiRequest(
      "POST",
      "/api/staff/onboarding/complete",
      { acknowledgement: true, version: ONBOARDING_META.version },
      cookie,
    ),
    200,
    `[${label}] onboarding complete`,
  );

  return {
    ...driven,
    staffRowId: staffRow.id,
    cookie,
  };
}

async function completeLessonsUpTo(
  staff: TrainingStaff,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    expectOk(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[i] }, staff.cookie),
      200,
      `[${staff.email}] complete lesson ${LESSON_IDS[i]}`,
    );
  }
}

/* ----------------------------------------------------------------- */
/* Suite                                                              */
/* ----------------------------------------------------------------- */

let staffA: TrainingStaff;
let staffB: TrainingStaff;
let staffC: TrainingStaff;
let lockedStaff: TrainingStaff;
let notificationCountBefore: number;

beforeAll(async () => {
  await assertServerUp();
  // Drive ALL fixtures FIRST so the notification baseline below covers
  // only training actions (activation/onboarding legitimately queue mail).
  staffA = await driveFullyOnboardedStaff("training-a");
  staffB = await driveFullyOnboardedStaff("training-b");
  staffC = await driveFullyOnboardedStaff("training-c");

  // A fully activated staff member who has NOT completed onboarding.
  const driven = await driveToActivation("training-locked");
  emails.push(driven.email);
  const row = await db.staff.findUnique({
    where: { staffId: driven.staffId },
    select: { id: true },
  });
  const { cookie } = await loginAsStaff(driven.email, "training-locked", {
    staffRowId: row!.id,
  });
  lockedStaff = { ...driven, staffRowId: row!.id, cookie };

  notificationCountBefore = await db.notificationDelivery.count();
}, 120_000);

afterAll(async () => {
  await cleanupTestCandidates(emails);
});

/* ----------------------------------------------------------------- */
/* Eligibility & authorization (brief §17/§18/§51)                    */
/* ----------------------------------------------------------------- */

describe("Stage 9 — eligibility & authorization", () => {
  it("responds 401 on every training route without a session", async () => {
    const overview = await apiRequest("GET", "/api/staff/training");
    expect(overview.status).toBe(401);
    if (overview.body.ok) throw new Error("expected error envelope");
    expect(overview.body.error.code).toBe("UNAUTHORIZED");

    const course = await apiRequest("GET", COURSE_API);
    expect(course.status).toBe(401);

    const lesson = await apiRequest("POST", LESSONS_API, {
      lessonId: LESSON_IDS[0],
    });
    expect(lesson.status).toBe(401);
  });

  it("responds 401 on every training route with a bogus session cookie", async () => {
    const cookie = "ff_staff_session=bogus-token-value";
    expect((await apiRequest("GET", "/api/staff/training", undefined, cookie)).status).toBe(401);
    expect((await apiRequest("GET", COURSE_API, undefined, cookie)).status).toBe(401);
    expect((await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[0] }, cookie)).status).toBe(401);
  });

  it("blocks training with 403 FORBIDDEN while onboarding is incomplete — before any enrollment exists", async () => {
    const cookie = lockedStaff.cookie;

    const enrollmentsBefore = await db.staffTrainingEnrollment.count({
      where: { staffId: lockedStaff.staffRowId },
    });

    const overview = await apiRequest("GET", "/api/staff/training", undefined, cookie);
    expect(overview.status).toBe(403);
    if (overview.body.ok) throw new Error("expected error envelope");
    expect(overview.body.error.code).toBe("FORBIDDEN");

    const course = await apiRequest("GET", COURSE_API, undefined, cookie);
    expect(course.status).toBe(403);
    if (course.body.ok) throw new Error("expected error envelope");
    expect(course.body.error.code).toBe("FORBIDDEN");

    const lesson = await apiRequest(
      "POST",
      LESSONS_API,
      { lessonId: LESSON_IDS[0] },
      cookie,
    );
    expect(lesson.status).toBe(403);

    // The gate fired before ANY lazy enrollment was created.
    const enrollmentsAfter = await db.staffTrainingEnrollment.count({
      where: { staffId: lockedStaff.staffRowId },
    });
    expect(enrollmentsAfter).toBe(enrollmentsBefore);
    expect(enrollmentsAfter).toBe(0);
  });

  it("treats unknown course ids — including recruitment references — as plain 404 (no reference door)", async () => {
    const reference = staffA?.referenceNumber ?? "FF-XXXXXX";
    const notACourse = await apiRequest(
      "GET",
      `/api/staff/training/${reference}`,
      undefined,
      staffA.cookie,
    );
    expect(notACourse.status).toBe(404);

    const lessonOnNotACourse = await apiRequest(
      "POST",
      `/api/staff/training/${reference}/lessons`,
      { lessonId: LESSON_IDS[0] },
      staffA.cookie,
    );
    expect(lessonOnNotACourse.status).toBe(404);

    const arbitrary = await apiRequest(
      "GET",
      "/api/staff/training/not-a-course",
      undefined,
      staffA.cookie,
    );
    expect(arbitrary.status).toBe(404);
  });
});

/* ----------------------------------------------------------------- */
/* Overview is read-only; enrollment is lazy (brief §24/§33/§52)      */
/* ----------------------------------------------------------------- */

describe("Stage 9 — overview & lazy enrollment", () => {
  it("overview reports NOT_STARTED and creates NO enrollment", async () => {
    const before = await db.staffTrainingEnrollment.count({
      where: { staffId: staffA.staffRowId },
    });
    expect(before).toBe(0);

    const view = expectOk<{
      courses: {
        courseId: string;
        state: string;
        completedLessons: number;
        totalLessons: number;
        version: string;
        required: boolean;
      }[];
      nonBlockingNotice: string;
    }>(await apiRequest("GET", "/api/staff/training", undefined, staffA.cookie));

    const course = view.courses.find((entry) => entry.courseId === COURSE);
    expect(course).toBeDefined();
    expect(course!.state).toBe("NOT_STARTED");
    expect(course!.completedLessons).toBe(0);
    expect(course!.totalLessons).toBe(6);
    expect(course!.version).toBe(STAFF_FOUNDATIONS_CURRENT_VERSION);
    expect(course!.required).toBe(true);
    expect(view.nonBlockingNotice).toContain("does not block");

    const after = await db.staffTrainingEnrollment.count({
      where: { staffId: staffA.staffRowId },
    });
    expect(after).toBe(0);
  });

  it("first course open creates the enrollment and pins version 1.0", async () => {
    const detail = expectOk<{
      courseId: string;
      version: string;
      state: string;
      startedAt: string;
      completedAt: string | null;
      currentLessonId: string | null;
      totalLessons: number;
    }>(await apiRequest("GET", COURSE_API, undefined, staffA.cookie));

    expect(detail.courseId).toBe(COURSE);
    expect(detail.version).toBe("1.0");
    expect(detail.state).toBe("NOT_STARTED");
    expect(detail.completedAt).toBeNull();
    expect(detail.currentLessonId).toBe(LESSON_IDS[0]);
    expect(detail.totalLessons).toBe(6);

    const row = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(row).not.toBeNull();
    expect(row!.courseVersion).toBe("1.0");
    expect(row!.completedAt).toBeNull();
  });

  it("repeat course open returns the SAME enrollment with unchanged startedAt and zero writes", async () => {
    const first = expectOk<{ startedAt: string; currentLessonId: string | null }>(
      await apiRequest("GET", COURSE_API, undefined, staffA.cookie),
    );
    const rowBefore = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });

    const second = expectOk<{ startedAt: string }>(
      await apiRequest("GET", COURSE_API, undefined, staffA.cookie),
    );
    const rowAfter = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });

    expect(second.startedAt).toBe(first.startedAt);
    expect(rowAfter!.id).toBe(rowBefore!.id);
    expect(rowAfter!.startedAt.toISOString()).toBe(
      rowBefore!.startedAt.toISOString(),
    );
    expect(rowAfter!.updatedAt.toISOString()).toBe(
      rowBefore!.updatedAt.toISOString(),
    );
  });

  it("4-way concurrent first opens create EXACTLY ONE enrollment", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("GET", COURSE_API, undefined, staffB.cookie),
      ),
    );
    for (const result of results) {
      expect(result.status).toBe(200);
    }
    const rows = await db.staffTrainingEnrollment.findMany({
      where: { staffId: staffB.staffRowId, courseId: COURSE },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].courseVersion).toBe("1.0");
  });
});

/* ----------------------------------------------------------------- */
/* Sequential progression & lesson states (brief §25/§26/§53)         */
/* ----------------------------------------------------------------- */

describe("Stage 9 — sequential progression", () => {
  it("Lesson 1 starts CURRENT; Lessons 2–6 are LOCKED with no content exposure", async () => {
    const detail = expectOk<{
      currentLessonId: string | null;
      lessons: { lessonId: string; state: string; completedAt: string | null }[];
      lesson: { lessonId: string; state: string; canComplete: boolean };
      lockedNotice: string | null;
    }>(await apiRequest("GET", COURSE_API, undefined, staffA.cookie));

    expect(detail.currentLessonId).toBe(LESSON_IDS[0]);
    expect(detail.lessons.map((lesson) => lesson.state)).toEqual([
      "CURRENT",
      "LOCKED",
      "LOCKED",
      "LOCKED",
      "LOCKED",
      "LOCKED",
    ]);
    expect(detail.lessons.map((lesson) => lesson.lessonId)).toEqual(LESSON_IDS);
    expect(detail.lesson.lessonId).toBe(LESSON_IDS[0]);
    expect(detail.lesson.state).toBe("CURRENT");
    expect(detail.lesson.canComplete).toBe(true);
    expect(detail.lockedNotice).toBeNull();

    // Locked lessons carry no completion timestamps.
    for (const lesson of detail.lessons.slice(1)) {
      expect(lesson.completedAt).toBeNull();
    }
  });

  it("skip-ahead completion is rejected with 422 and persists nothing", async () => {
    const skip = await apiRequest(
      "POST",
      LESSONS_API,
      { lessonId: LESSON_IDS[2] },
      staffA.cookie,
    );
    expect(skip.status).toBe(422);
    if (skip.body.ok) throw new Error("expected error envelope");
    expect(skip.body.error.code).toBe("VALIDATION_ERROR");

    const count = await db.staffTrainingLessonProgress.count({
      where: { enrollment: { staffId: staffA.staffRowId, courseId: COURSE } },
    });
    expect(count).toBe(0);
  });

  it("unknown lesson ids are rejected with 422", async () => {
    const unknown = await apiRequest(
      "POST",
      LESSONS_API,
      { lessonId: "not-a-lesson" },
      staffA.cookie,
    );
    expect(unknown.status).toBe(422);

    const malformed = await apiRequest(
      "POST",
      LESSONS_API,
      {},
      staffA.cookie,
    );
    expect(malformed.status).toBe(422);

    const wrongType = await apiRequest(
      "POST",
      LESSONS_API,
      { lessonId: 42 },
      staffA.cookie,
    );
    expect(wrongType.status).toBe(422);
  });

  it("a locked lesson requested via ?lesson= NEVER exposes content — the open lesson is shown with an honest notice", async () => {
    const detail = expectOk<{
      lesson: { lessonId: string; state: string; blocks: unknown[] };
      lockedNotice: string | null;
    }>(
      await apiRequest("GET", `${COURSE_API}?lesson=${LESSON_IDS[3]}`, undefined, staffA.cookie),
    );

    expect(detail.lesson.lessonId).toBe(LESSON_IDS[0]);
    expect(detail.lesson.state).toBe("CURRENT");
    expect(detail.lockedNotice).not.toBeNull();
    expect(detail.lockedNotice).toContain("not open yet");

    // The served blocks belong to Lesson 1 — never the locked lesson's.
    const serialized = JSON.stringify(detail.lesson.blocks);
    expect(serialized).not.toContain("Fraud and misrepresentation");
  });

  it("an unknown ?lesson= falls back to the current lesson", async () => {
    const detail = expectOk<{ lesson: { lessonId: string }; lockedNotice: string | null }>(
      await apiRequest("GET", `${COURSE_API}?lesson=made-up`, undefined, staffA.cookie),
    );
    expect(detail.lesson.lessonId).toBe(LESSON_IDS[0]);
    expect(detail.lockedNotice).not.toBeNull();
  });

  it("hostile identity fields in the body are ignored — ownership stays session-only", async () => {
    const hostile = await apiRequest(
      "POST",
      LESSONS_API,
      {
        lessonId: LESSON_IDS[0],
        staffId: "FF-STF-9999",
        enrollmentId: "cuid-of-someone-else",
        courseVersion: "9.9",
        completedAt: "1999-01-01T00:00:00.000Z",
        progressPercentage: 100,
        email: "attacker@example.com",
        referenceNumber: "FF-AAAAAA",
        appointmentReference: "FFL/HR/PLA/999",
        accountId: "hostile-account-id",
      },
      staffA.cookie,
    );
    // The strict schema rejects unknown keys… or the server completes
    // lesson 1 if every extra field is stripped — either way the ONLY
    // effect is staff A completing lesson 1 for THEMSELVES.
    if (hostile.status === 200) {
      const row = await db.staffTrainingLessonProgress.findFirst({
        where: { enrollment: { staffId: staffA.staffRowId, courseId: COURSE } },
      });
      expect(row!.lessonId).toBe(LESSON_IDS[0]);
      const enrollment = await db.staffTrainingEnrollment.findFirst({
        where: { staffId: staffA.staffRowId, courseId: COURSE },
      });
      expect(enrollment!.courseVersion).toBe("1.0");
    } else {
      expect(hostile.status).toBe(422);
      const count = await db.staffTrainingLessonProgress.count({
        where: { enrollment: { staffId: staffA.staffRowId, courseId: COURSE } },
      });
      expect(count).toBe(0);
    }
  });
});

/* ----------------------------------------------------------------- */
/* Completion, idempotency & concurrency (brief §28/§35/§53/§54)      */
/* ----------------------------------------------------------------- */

describe("Stage 9 — completion, idempotency & concurrency", () => {
  it("sequential completion works; duplicates are idempotent with no second row", async () => {
    const first = expectOk<{
      alreadyCompleted: boolean;
      lesson: { lessonId: string; completedAt: string };
      currentLessonId: string | null;
      completedLessons: number;
      courseState: string;
    }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[0] }, staffA.cookie),
    );
    expect(first.alreadyCompleted).toBe(false);
    expect(first.lesson.lessonId).toBe(LESSON_IDS[0]);
    expect(first.currentLessonId).toBe(LESSON_IDS[1]);
    expect(first.completedLessons).toBe(1);
    expect(first.courseState).toBe("IN_PROGRESS");

    const firstRow = await db.staffTrainingLessonProgress.findFirst({
      where: { enrollment: { staffId: staffA.staffRowId }, lessonId: LESSON_IDS[0] },
    });

    const duplicate = expectOk<{
      alreadyCompleted: boolean;
      lesson: { completedAt: string };
      completedLessons: number;
    }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[0] }, staffA.cookie),
    );
    expect(duplicate.alreadyCompleted).toBe(true);
    expect(duplicate.lesson.completedAt).toBe(first.lesson.completedAt);
    expect(duplicate.completedLessons).toBe(1);

    const rowAfter = await db.staffTrainingLessonProgress.findFirst({
      where: { enrollment: { staffId: staffA.staffRowId }, lessonId: LESSON_IDS[0] },
    });
    expect(rowAfter!.id).toBe(firstRow!.id);
    expect(rowAfter!.completedAt.toISOString()).toBe(
      firstRow!.completedAt.toISOString(),
    );

    // Complete lesson 2 as well; completed lesson 1 stays reviewable.
    const second = expectOk<{ currentLessonId: string | null }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[1] }, staffA.cookie),
    );
    expect(second.currentLessonId).toBe(LESSON_IDS[2]);

    const review = expectOk<{
      lesson: { lessonId: string; state: string; canComplete: boolean };
    }>(
      await apiRequest("GET", `${COURSE_API}?lesson=${LESSON_IDS[0]}`, undefined, staffA.cookie),
    );
    expect(review.lesson.lessonId).toBe(LESSON_IDS[0]);
    expect(review.lesson.state).toBe("COMPLETED");
    expect(review.lesson.canComplete).toBe(false);
  });

  it("4-way concurrent completion of one lesson produces ONE progress row and consistent states", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[2] }, staffA.cookie),
      ),
    );
    const successes = results.filter((result) => result.status === 200);
    expect(successes.length).toBeGreaterThan(0);
    for (const result of results) {
      expect([200, 422]).toContain(result.status);
    }

    const rows = await db.staffTrainingLessonProgress.findMany({
      where: { enrollment: { staffId: staffA.staffRowId }, lessonId: LESSON_IDS[2] },
    });
    expect(rows.length).toBe(1);

    const timestamps = new Set(
      successes.map(
        (result) =>
          (result.body as { data: { lesson: { completedAt: string } } }).data
            .lesson.completedAt,
      ),
    );
    expect(timestamps.size).toBe(1);
  });

  it("no completedAt exists before the final lesson", async () => {
    const detail = expectOk<{ completedAt: string | null; completedLessons: number }>(
      await apiRequest("GET", COURSE_API, undefined, staffA.cookie),
    );
    expect(detail.completedLessons).toBe(3);
    expect(detail.completedAt).toBeNull();

    const row = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(row!.completedAt).toBeNull();
  });

  it("the final lesson sets completedAt exactly once; repeats are idempotent", async () => {
    await completeLessonsUpTo(staffA, 5);

    const before = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(before!.completedAt).toBeNull();

    const final = expectOk<{
      alreadyCompleted: boolean;
      courseJustCompleted: boolean;
      courseState: string;
      courseCompletedAt: string | null;
      currentLessonId: string | null;
      completedLessons: number;
    }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[5] }, staffA.cookie),
    );
    expect(final.alreadyCompleted).toBe(false);
    expect(final.courseJustCompleted).toBe(true);
    expect(final.courseState).toBe("COMPLETED");
    expect(final.courseCompletedAt).not.toBeNull();
    expect(final.currentLessonId).toBeNull();
    expect(final.completedLessons).toBe(6);

    const latchedAt = final.courseCompletedAt;
    expect(latchedAt).not.toBeNull();

    const repeat = expectOk<{
      alreadyCompleted: boolean;
      courseJustCompleted: boolean;
      courseCompletedAt: string | null;
      completedLessons: number;
    }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[5] }, staffA.cookie),
    );
    expect(repeat.alreadyCompleted).toBe(true);
    expect(repeat.courseJustCompleted).toBe(false);
    expect(repeat.courseCompletedAt).toBe(latchedAt);
    expect(repeat.completedLessons).toBe(6);

    const row = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(row!.completedAt!.toISOString()).toBe(latchedAt as string);

    const progressRows = await db.staffTrainingLessonProgress.count({
      where: { enrollment: { staffId: staffA.staffRowId, courseId: COURSE } },
    });
    expect(progressRows).toBe(6);
  });

  it("4-way concurrent final actions leave ONE completedAt and ONE final state", async () => {
    // staffC has a fresh, incomplete enrollment — a TRUE concurrent final:
    // lessons 1–5 done first, then four racing lesson-6 completions.
    await completeLessonsUpTo(staffC, 5);
    const courseC = `/api/staff/training/${COURSE}`;
    const lessonsC = `${courseC}/lessons`;
    const before = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffC.staffRowId, courseId: COURSE },
    });
    expect(before!.completedAt).toBeNull();

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("POST", lessonsC, { lessonId: LESSON_IDS[5] }, staffC.cookie),
      ),
    );
    for (const result of results) {
      expect(result.status).toBe(200);
      const data = (
        result.body as {
          ok: boolean;
          data?: {
            courseState: string;
            completedLessons: number;
            currentLessonId: string | null;
            courseJustCompleted: boolean;
            courseCompletedAt: string | null;
          };
        }
      ).data;
      expect(data!.courseState).toBe("COMPLETED");
      expect(data!.completedLessons).toBe(6);
      expect(data!.currentLessonId).toBeNull();
    }
    const stamps = new Set(
      results.map(
        (result) =>
          (result.body as { data: { courseCompletedAt: string | null } }).data
            .courseCompletedAt,
      ),
    );
    expect(stamps.size).toBe(1);
    const justCompleted = results.filter(
      (result) =>
        result.body.ok &&
        (result.body as { data: { courseJustCompleted: boolean } }).data
          .courseJustCompleted === true,
    );
    expect(justCompleted.length).toBe(1);

    const rows = await db.staffTrainingEnrollment.findMany({
      where: { staffId: staffC.staffRowId, courseId: COURSE },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].completedAt).not.toBeNull();
    const finalTimestamps = await db.staffTrainingLessonProgress.count({
      where: { enrollmentId: rows[0].id, lessonId: LESSON_IDS[5] },
    });
    expect(finalTimestamps).toBe(1);
  });

  it("4-way concurrent idempotent finals on a completed course stay stable", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[5] }, staffA.cookie),
      ),
    );
    for (const result of results) {
      expect(result.status).toBe(200);
      const data = (
        result.body as {
          data?: {
            courseState: string;
            courseJustCompleted: boolean;
            courseCompletedAt: string | null;
          };
        }
      ).data;
      expect(data!.courseState).toBe("COMPLETED");
      expect(data!.courseJustCompleted).toBe(false);
    }
    const stamps = new Set(
      results.map(
        (result) =>
          (result.body as { data: { courseCompletedAt: string | null } }).data
            .courseCompletedAt,
      ),
    );
    expect(stamps.size).toBe(1);

    const rows = await db.staffTrainingEnrollment.findMany({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].completedAt).not.toBeNull();
  });
});

/* ----------------------------------------------------------------- */
/* Review after completion; isolation; employment firewall (§29/§30)  */
/* ----------------------------------------------------------------- */

describe("Stage 9 — review, isolation & employment firewall", () => {
  it("completed course stays open for review — any lesson readable, ZERO writes", async () => {
    const rowBefore = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });

    for (const lessonId of LESSON_IDS) {
      const detail = expectOk<{
        lesson: { lessonId: string; state: string; canComplete: boolean; blocks: unknown[] };
        state: string;
      }>(
        await apiRequest("GET", `${COURSE_API}?lesson=${lessonId}`, undefined, staffA.cookie),
      );
      expect(detail.lesson.lessonId).toBe(lessonId);
      expect(detail.lesson.state).toBe("COMPLETED");
      expect(detail.lesson.canComplete).toBe(false);
      expect(Array.isArray(detail.lesson.blocks)).toBe(true);
      expect(detail.state).toBe("COMPLETED");
    }

    const rowAfter = await db.staffTrainingEnrollment.findFirst({
      where: { staffId: staffA.staffRowId, courseId: COURSE },
    });
    expect(rowAfter!.updatedAt.toISOString()).toBe(
      rowBefore!.updatedAt.toISOString(),
    );
    const progressRows = await db.staffTrainingLessonProgress.count({
      where: { enrollmentId: rowAfter!.id },
    });
    expect(progressRows).toBe(6);
  });

  it("cross-Staff isolation: staff B's state is staff B's own", async () => {
    const viewB = expectOk<{
      courses: { courseId: string; state: string; completedLessons: number }[];
    }>(await apiRequest("GET", "/api/staff/training", undefined, staffB.cookie));
    const courseB = viewB.courses.find((entry) => entry.courseId === COURSE);
    expect(courseB!.completedLessons).toBe(0);
    expect(courseB!.state).toBe("NOT_STARTED");

    // Staff B completing lesson 1 must not move staff A.
    const completeB = expectOk<{ completedLessons: number }>(
      await apiRequest("POST", LESSONS_API, { lessonId: LESSON_IDS[0] }, staffB.cookie),
    );
    expect(completeB.completedLessons).toBe(1);

    const viewA = expectOk<{
      courses: { courseId: string; state: string; completedLessons: number }[];
    }>(await apiRequest("GET", "/api/staff/training", undefined, staffA.cookie));
    const courseA = viewA.courses.find((entry) => entry.courseId === COURSE);
    expect(courseA!.completedLessons).toBe(6);
    expect(courseA!.state).toBe("COMPLETED");

    const enrollments = await db.staffTrainingEnrollment.findMany({
      where: { courseId: COURSE, staffId: { in: [staffA.staffRowId, staffB.staffRowId] } },
    });
    expect(enrollments.length).toBe(2);
  });

  it("completion has NO employment effect and queues ZERO notifications", async () => {
    const candidate = await db.candidate.findUnique({
      where: { id: (
        await db.staff.findUnique({ where: { id: staffA.staffRowId } })
      )!.candidateId },
      select: {
        status: true,
        staff: {
          select: {
            staffId: true,
            roleTitle: true,
            version: true,
            activatedAt: true,
            onboarding: { select: { completedAt: true } },
            account: { select: { status: true } },
          },
        },
      },
    });
    expect(candidate!.status).toBe("APPROVED_STAFF");
    expect(candidate!.staff!.account!.status).toBe("ACTIVE");
    expect(candidate!.staff!.onboarding!.completedAt).not.toBeNull();

    // Zero new notification deliveries were caused by ANY training action
    // across the whole suite so far.
    const notificationCountAfter = await db.notificationDelivery.count();
    expect(notificationCountAfter).toBe(notificationCountBefore);
  });
});

/* ----------------------------------------------------------------- */
/* Content firewall (brief §12/§55)                                   */
/* ----------------------------------------------------------------- */

describe("Stage 9 — content & payroll firewall", () => {
  const courseContent = STAFF_FOUNDATIONS_VERSIONS["1.0"];

  it("ships exactly the six approved lessons in order", () => {
    expect(courseContent.id).toBe(COURSE);
    expect(courseContent.version).toBe("1.0");
    expect(courseContent.lessons.map((lesson) => lesson.id)).toEqual([
      "professional-representation",
      "communicating-with-prospects",
      "supporting-members",
      "approved-materials",
      "daily-reporting",
      "privacy-conduct-fraud",
    ]);
  });

  it("contains NO payroll/earnings arithmetic anywhere in the content", () => {
    const serialized = JSON.stringify(courseContent).toLowerCase();
    for (const banned of [
      "₦650",
      "₦",
      "commission",
      "payroll",
      "bonus",
      "earnings",
      "monthly earnings",
      "salary",
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it("contains NO certificate, video, gamification or assessment machinery", () => {
    const serialized = JSON.stringify(courseContent).toLowerCase();
    const banned = [
      "certificate",
      "quiz",
      "pass mark",
      "retake",
      "video",
      "badge",
      "streak",
      "leaderboard",
    ];
    for (const token of banned) {
      expect(serialized).not.toContain(token);
    }
    // Short tokens need word boundaries ("explains" must not trip "xp"),
    // and "point" is legitimate teaching language ("point members to
    // official information") — pin the gamification patterns instead.
    expect(serialized).not.toMatch(/\bxp\b/);
    expect(serialized).not.toMatch(/\b\d+ points\b/);
    expect(serialized).not.toMatch(/earn points|points (?:system|for)/);
  });

  it("contains NO invented escalation contacts or prospect scripts", () => {
    const serialized = JSON.stringify(courseContent);
    // No phone numbers, no wa.me links, no WhatsApp onboarding message
    // repurposed as a sales script.
    expect(serialized).not.toMatch(/wa\.me|whatsapp\.com/);
    expect(serialized).not.toMatch(/\+\d{3}[\d\s]{7,}/);
    expect(serialized).not.toContain(
      "Hello, I have received my FinFam Provisional Letter of Appointment",
    );
  });

  it("keeps Lesson 5 labels EXACTLY aligned with DAILY_REPORT_CATEGORIES", () => {
    const lesson5 = courseContent.lessons.find(
      (lesson) => lesson.id === "daily-reporting",
    )!;
    const serialized = JSON.stringify(lesson5.blocks);

    for (const category of DAILY_REPORT_CATEGORIES) {
      expect(serialized).toContain(category.legend);
      for (const field of category.fields) {
        expect(serialized).toContain(field.label);
        expect(serialized).toContain(field.helper);
      }
    }
  });

  it("preserves the self-reported notice verbatim", () => {
    const lesson5 = courseContent.lessons.find(
      (lesson) => lesson.id === "daily-reporting",
    )!;
    const serialized = JSON.stringify(lesson5.blocks);
    expect(serialized).toContain(DAILY_REPORT_SELF_REPORTED_NOTICE);
  });

  it("presents appointment designation and operational role as separate facts", () => {
    const lesson1 = courseContent.lessons.find(
      (lesson) => lesson.id === "professional-representation",
    )!;
    const facts = lesson1.blocks.find((block) => block.type === "facts");
    expect(facts).toBeDefined();
    if (facts!.type !== "facts") throw new Error("unreachable");
    expect(facts!.items).toEqual([
      { label: "Appointment designation", value: "Remote Staff" },
      { label: "Operational role", value: "FinFam Growth Ambassador" },
    ]);
  });

  it("links lessons 4 and 5 to Resources and Daily Reports without embedding them", () => {
    const lesson4 = courseContent.lessons.find(
      (lesson) => lesson.id === "approved-materials",
    )!;
    expect(lesson4.relatedLinks?.some((link) => link.href === "/staff/resources")).toBe(true);

    const lesson5 = courseContent.lessons.find(
      (lesson) => lesson.id === "daily-reporting",
    )!;
    expect(lesson5.relatedLinks?.some((link) => link.href === "/staff/reports")).toBe(true);
  });

  it("serves only approved content — the course API never leaks payroll wording either", async () => {
    const detail = await apiRequest(
      "GET",
      `${COURSE_API}?lesson=daily-reporting`,
      undefined,
      staffA.cookie,
    );
    expect(detail.status).toBe(200);
    const serialized = JSON.stringify(detail.body).toLowerCase();
    for (const banned of ["₦650", "commission", "payroll", "bonus", "earnings"]) {
      expect(serialized).not.toContain(banned);
    }
  });
});

/* ----------------------------------------------------------------- */
/* Session resume (brief §53)                                         */
/* ----------------------------------------------------------------- */

describe("Stage 9 — persistence across sessions", () => {
  it("progress survives logout and a fresh login", async () => {
    const fresh = await loginAsStaff(staffB.email, "relogin", {
      staffRowId: staffB.staffRowId,
    });
    const view = expectOk<{
      courses: { courseId: string; state: string; completedLessons: number }[];
    }>(await apiRequest("GET", "/api/staff/training", undefined, fresh.cookie));
    const course = view.courses.find((entry) => entry.courseId === COURSE);
    expect(course!.completedLessons).toBe(1);
    expect(course!.state).toBe("IN_PROGRESS");
  });
});
