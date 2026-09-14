# Content questions for the business owner

The supplied FinFam recruitment material contains business rules and
financial/reward figures. Per the project ground rules, implementation must
not silently pick a version when the source material contradicts itself.

**Nothing in this list has been silently resolved.** Each item below blocks
the corresponding content and must be confirmed before the affected copy is
changed in `src/config/`.

## 1. "Established Member" savings threshold — CONFLICTING FIGURES

The source material defines an *Established Member* with **different savings
thresholds in different sections**.

- **Where it appears:** reward/policy sections of the recruitment material.
- **Why it matters:** the threshold determines eligibility language and
  reward communication on the landing page, in the Responsibility & Reward
  policy (offer stage), and possibly in assessment content.
- **Decision needed:** which figure is authoritative?
- **Status:** ⛔ Unresolved. Neither figure is published anywhere. The
  landing page shows a neutral notice ("Reward figures are being finalised",
  `src/config/content.ts` → `rewardsPending: true`) and orientation section
  5 (`reward-structure` in `src/config/orientation.ts`) uses the same
  treatment — it names the threshold as *being confirmed* without a number.

## 2. Reward structure figures — PENDING

Reward/commission figures exist in the source material but the full reward
structure (amounts, conditions, payout timing) has not been supplied as one
consistent set.

- **Decision needed:** the confirmed reward structure for the Staff Member role.
- **Status:** ⛔ Unresolved. Same "being finalised" treatment as above on the
  landing page and in orientation section 5. No reward mechanics are
  described beyond "rewards are attached to the role's responsibilities".

## 3. Support contact channels — PLACEHOLDER

`src/config/site.ts` currently uses `recruitment@finfam.example` as the
support email. The real inbox (and any WhatsApp channel, once WhatsApp
automation is planned) must be supplied.

- **Decision needed:** official support email + channel strategy.
- **Status:** ⚠️ Placeholder in place, clearly marked with `TODO(business)`.

## 4. Role details — PLACEHOLDER

Responsibilities and expectations on the landing page
(`src/config/content.ts`) are scaffold placeholders marked
`TODO(business)`. Replace with the official content during the Welcome/Jobs
stage planning.

- **Status:** ⚠️ Generic, clearly-flagged placeholder copy.

## 5. Official vision/mission wording — ORIENTATION

Orientation section 1 ("About FinFam") is built strictly from the supplied
brief: the name (Financially Blessed Family), the government-registered
digital cooperative ecosystem, and the save / grow / prosper purpose. The
brief asks for vision and mission statements, but no official wording was
supplied, so none was invented.

- **Decision needed:** the official vision/mission statements (or
  confirmation that the purpose language now in place is sufficient).
- **Affects:** orientation section 1 copy (`src/config/orientation.ts`) and
  any assessment questions that touch FinFam identity.
- **Status:** ⚠️ Purpose-level content in place; no invented corporate
  claims.

## 6. Assessment retry policy / maximum attempts — INTERIM BEHAVIOUR

The supplied material says a candidate scoring below 70% "may retry or may
be disqualified according to policy". That is not specific enough to be a
final rule, and the stage brief forbids inventing one.

- **Decision needed:** may a failed candidate retake? How many attempts are
  allowed? Is there a waiting period? Is repeated failure a
  disqualification?
- **Interim behaviour (implemented, clearly labelled in the UI):** retakes
  ARE allowed with no attempt cap. This is controlled by two values in
  `src/server/assessment-content.ts` (`ASSESSMENT_POLICY.allowRetakeAfterFailure`
  and `.maxAttempts`), so the confirmed policy is a config change — not a
  rewrite. The failed-result screen and the status page both state that the
  final retake policy "is being finalised".
- **Status:** ⛔ Unresolved policy; ⚠️ safe interim behaviour in place.

## 7. Unanswered questions at submission — INTERIM BEHAVIOUR

The source material does not say whether submission requires all 30 answers
or allows gaps.

- **Decision needed:** require every question answered (Option A), or allow
  submission with unanswered questions scored as incorrect (Option B)?
- **Interim behaviour (implemented):** Option B — submission is allowed and
  each unanswered question is scored as incorrect. The confirmation modal
  states the exact unanswered count and this consequence in plain language
  before the candidate can submit. Changing to Option A is a small change
  in `submitAssessment` + `ASSESSMENT_POLICY` (a
  `allowSubmissionWithUnanswered` flag already exists).
- **Status:** ⛔ Unresolved rule; ⚠️ clearly-communicated interim behaviour.

## 8. Insight/explanation visibility — NOT SHOWN (deliberately)

Every question has an insight/explanation. The source material does not say
when (if ever) candidates may see them.

- **Decision needed:** show explanations after submission? For all questions
  or only incorrect ones? Before submission (they reveal the answer, so
  almost certainly not)?
- **Interim behaviour (implemented):** insights are shown to NO ONE —
  they are server-only, are not included in any candidate-facing response,
  and no review screen exists. Rationale: while the retake policy is
  unresolved, showing answers after submission would leak the answer key
  across attempts. When the business confirms the policy, a post-submission
  review screen can be added safely (the data is already persisted).
- **Status:** ⛔ Unresolved; insights withheld pending the retry decision.

## 9. Question randomization — NOT IMPLEMENTED

- **Decision needed:** should each attempt receive a shuffled question
  order?
- **Interim behaviour (implemented):** the supplied config order is used,
  snapshotted per attempt (`AssessmentAttemptQuestion.position`), and never
  reshuffled on refresh or resume. The schema stores positions, so
  per-attempt shuffling can be added later without a migration.
- **Status:** ⚠️ Stable order in place; randomization deliberately not
  added for its own sake.

## 10. "₦500 cashback after first savings deposit" — UNCONFIRMED CLAIM

The source material mentions a ₦500 cashback benefit, but it has not been
confirmed as official FinFam policy.

- **Decision needed:** is the ₦500 cashback a real, current member benefit?
  Under what conditions?
- **Status:** ⛔ Unresolved. It is NOT encoded anywhere — not on the landing
  page, not in orientation content, and NOT in any assessment question,
  option or insight. If confirmed later, it must be added consistently
  across all three surfaces.

## 11. Reference recovery verification — INTERIM BEHAVIOUR

The unified journey includes a "Forgot your application reference?" flow
(`/continue/recover`). The source material does not specify how a candidate
should prove their identity when recovering a lost reference.

- **Decision needed:** what verification is required before a reference is
  revealed (e.g. email/OTP code, phone verification, support contact with
  manual identity checks)? Is revealing the reference at all acceptable,
  or should recovery always route through a human support channel?
- **Interim behaviour (implemented):** the candidate must supply the FULL
  name, email AND phone exactly as entered on the application; only the
  reference number is revealed — never application details, NIN/BVN/bank
  details or documents. Every mismatch (unknown email, wrong name, wrong
  phone) returns the SAME neutral "no matching application" message, so
  responses cannot be used to enumerate applications. No email/SMS
  verification infrastructure exists in the portal.
- **Known limitation:** anyone who knows all three application details can
  retrieve the reference. The reference is a lookup key (see §13), not an
  authentication token, but the business should confirm this trade-off.
- **Status:** ⛔ Verification policy unresolved; ⚠️ enumeration-safe interim
  behaviour in place (`src/server/services/journey.ts` →
  `recoverApplicationReference`).

## 12. Completed-stage history — READ-ONLY RECORDS ONLY

Once a stage is completed it cannot be re-entered as an active workflow
(one-way progression). Whether candidates should eventually get richer
read-only history pages (e.g. re-reading orientation sections after
completion) has not been specified.

- **Decision needed:** should completed stages be viewable as read-only
  records (orientation content, answered questions)? Which stages, and with
  what detail?
- **Interim behaviour (implemented):** the unified journey shows completed
  stages as non-clickable ✓ entries. The ONLY record view available is the
  submitted assessment result (`/assessment/[reference]` renders the
  persisted score read-only — no answers, no insights, no retake from a
  passed state). Orientation content is not re-openable once completed.
- **Status:** ⛔ Unresolved; current behaviour is deliberately conservative.

## 13. Candidate identity model — REFERENCE AS LOOKUP KEY

The portal has no login/accounts. The application reference (FF-XXXXXX) is
a lookup key the candidate holds — it identifies the journey but does not
authenticate its holder. This matches the supplied material (no account
system was specified), but it is worth an explicit business decision.

- **Decision needed:** is reference-only access acceptable for the whole
  journey? If later stages expose more sensitive actions (agreement
  acceptance, appointment letters, staff activation), does the business
  want an additional verification step (e.g. OTP at those stages) or a
  full account system?
- **Interim behaviour (implemented):** reference-only access everywhere;
  all candidate-facing data is limited to what the candidate already knows;
  stage mutations are guarded by server-side state, not by client trust.
- **Status:** ⛔ Unresolved; revisit before Stage 3 (agreement) ships.

## 14. Reference expiration — NONE IMPLEMENTED

References do not expire and applications do not lapse. Whether stale
applications (e.g. abandoned at orientation for months) should be expired,
archived or re-activated has not been specified.

- **Decision needed:** do application references expire? What happens to
  candidates who never complete orientation/assessment?
- **Status:** ⛔ Unresolved; no expiration logic exists.

---

**Rule going forward:** when new source material contains contradictory
figures, add a numbered section here instead of choosing one. Implementation
waits for confirmation.
