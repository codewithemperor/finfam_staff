# Content questions for the business owner

The supplied FinFam recruitment material contains business rules and
financial/reward figures. Per the project ground rules, implementation must
not silently pick a version when the source material contradicts itself.

**Status convention.** Every item below carries an explicit status. Resolved
items are kept in this document as an audit trail — they are marked with the
authoritative source that closed them, never silently deleted.

**Reconciliation note (post-Stage 3).** The official **Provisional Letter of
Appointment** dated **September 1, 2026** (Ref: **FFL/HR/PLA/012**) was
supplied after Stage 3 shipped. It is the current authoritative business
reference for the compensation/reward information. It resolved the long
standing reward ambiguity (§1, §2, §15) and the agreement content was
version-bumped **v1.0 → v1.1** accordingly (see §10, §17, §20 below for the
open edges).

**Stage 4 note.** The Provisional Appointment (stage 4) shipped with the
explicit MVP business defaults approved for this stage (see the "Stage 4 MVP
decisions" block below and §21–§28). Each default is documented so it can be
changed later WITHOUT affecting historical appointments: issued letters pin
their content version (`src/config/appointment.ts`, immutable registry) and
their own snapshot (name, role, reference, issue date).

## Status index

### ✅ RESOLVED

| Item | Confirmed by | Where recorded |
| --- | --- | --- |
| Established Member savings threshold — **₦5,000** (₦2,000 vs ₦5,000 conflict closed) | Appointment letter (Sep 1, 2026) | §1 |
| Reward formula — **Established Members × ₦650 + applicable target bonus** | Appointment letter (Sep 1, 2026) | §2, §15 |
| Bonus tiers — 0–99 → ₦0 · 100–199 → ₦10,000 · 200+ → ₦20,000 | Appointment letter (Sep 1, 2026) | §2 |
| **Non-cumulative** bonus rule — only one tier applies per month | Appointment letter (Sep 1, 2026) | §2 |
| Monthly target — **200 Established Members** (a target, not a ceiling) | Appointment letter (Sep 1, 2026) | §2 |
| Payment timing — month end, or latest during the first week of the following month | Appointment letter (Sep 1, 2026) | §2 |
| Referral link is **tracking-only** — the link itself does not generate commissions | Appointment letter (Sep 1, 2026) | §2 |
| Privacy rule — never request a member's account balances or login details | Appointment letter (Sep 1, 2026) | §2 |

All of the above are published in Agreement **v1.1** (`src/config/agreement.ts`).
Candidates who already accepted v1.0 keep v1.0 on their record.

### ⚠️ PARTIALLY RESOLVED

| Item | Confirmed | Still open | Where recorded |
| --- | --- | --- | --- |
| Annual recognition / year-end rewards | Existence + effective December 2026 | Eligibility criteria, reward details (to follow before Q4) | §20 |
| December 2026 confirmation | Appointment is provisional, subject to performance review; confirmation expected Dec 2026 | The actual confirmation requirements (recorded as a future business rule only — NOT implemented) | §20 |
| Agreement wording | All v1.1 facts are from the appointment letter | Final business/legal sign-off on the wording, incl. the new "Important conditions" section | §18 |

### 🏷️ STAGE 4 MVP DECISIONS (explicitly approved for this stage; changeable without touching historical appointments)

| Item | MVP decision USED in Stage 4 | Still open after Stage 4 | Where recorded |
| --- | --- | --- | --- |
| Official appointment designation | **Remote Staff** (follows the official letter; descriptive text may explain the functional role but never replaces the designation) | One canonical title portal-wide (§4) | §21 |
| Appointment reference format | **FFL/HR/PLA/NNN**, server-controlled transactional sequence, zero-padded ≥3 digits, unique/monotonic; sequence initialised at 12 so the first system-issued letter is **013** (012 = the supplied sample letter, which is NOT stored in the database) | Is the prefix permanent? Numbering scope per-letter-type vs global | §22 |
| Letter date | **`issuedAt`** — the server-issued timestamp prints as the letter date; no hard-coded dates, no separate `effectiveDate` column | Effective-date semantics for future HR policy | §23 |
| Signatory | **"Management, FinFam"** text-only closing (follows the latest official letter; named officers from older material are NOT used) | Named signatory alignment (Tosin Eboh / Mosunmola Esther Afolami vs "Management") | §24 |
| Signature / logo | No signature images (none exist; none invented); no logo invented | Supply official signature/logo assets | §25 |
| Email delivery | **Out of scope** — the portal alone provides access to the appointment; no provider/queue/template built | Provider, sender identity, timing of the integration stage | §26 |
| Acceptance step | **No second acceptance** — stage 3 already records the explicit, auditable agreement acceptance; the appointment is an issued record, not a decision form | Whether the business ever wants a recorded acknowledgement | §27 |

### 🏷️ STAGE 5 MVP DECISIONS (approved and implemented; see §29–§32)

| Item | MVP decision IMPLEMENTED in Stage 5 | Where recorded |
| --- | --- | --- |
| Activation rule | **Option E — explicit in-portal self-activation** (no manual admin approval; zero-manual-intervention goal preserved). Opening the stage only records entry; activation requires the explicit checkbox + confirm action | §29 |
| Status flow | `APPOINTMENT_ISSUED → ACTIVATION_PENDING` (lazy entry on open) `→ APPROVED_STAFF` (explicit action); direct API activation from `APPOINTMENT_ISSUED` preserves the ENTERED event | §29 |
| Staff ID format | **`FF-STF-NNNN`** — approved for MVP. Server-generated, unique, sequential, zero-padded ≥4, immutable, never client-supplied, never `count(*)` | §30 |
| Sequence | `StaffIdSequence` singleton `STAFF_ID`, seeded at 0 → first ID `FF-STF-0001`; atomic `UPDATE…RETURNING` inside the activation transaction | §30 |
| Staff entity | One `Staff` model (also the activation record — no separate StaffActivation); `candidateId @unique`; snapshots: staffId, version, roleTitle (from Appointment), appointmentReference, activatedAt; no personal data duplicated | §6/§7 of the Stage 5 brief |
| Access model | **Reference-only access retained** for the MVP — an explicitly accepted limitation; activation is the most consequential reference-only action; OTP/auth is a recommended future hardening phase | §31 |
| Reversibility | **Activation is one-way.** No deactivate/revoke/reassign workflow (future administrative/business process) | §32 |
| Role snapshot | Designation snapshotted FROM the issued Appointment at activation ("Remote Staff" for the current version) | §8 of the Stage 5 brief |
| APPROVED_STAFF meaning | Recruitment complete + staff activated; onboarding (Stage 6) still follows; December 2026 confirmation NOT implied | §17 of the Stage 5 brief |
| WhatsApp / ID card / revocation / email | All deferred — Stage 6 or later | §19/§20 of the Stage 5 brief |

### ⛔ STILL UNRESOLVED

| # | Item |
| --- | --- |
| §3 | Support contact channels (email/WhatsApp placeholder) |
| §4 | **Canonical role title** — "Remote Staff" (appointment letter) vs "Marketing & Customer Care Executive / FinFam Growth Ambassador" (recruitment material) vs portal's generic "Staff Member" |
| §5 | Official vision/mission wording |
| §6 | Assessment retry policy / maximum attempts |
| §7 | Unanswered questions at submission |
| §8 | Insight/explanation visibility |
| §9 | Question randomization |
| §10 | ₦500 cashback claim (still unconfirmed — not encoded anywhere) |
| §11 | Reference recovery verification |
| §12 | Completed-stage read-only history |
| §13 / §19 | Identity model for consequential actions (reference-only access, OTP question) |
| §14 | Reference expiration |
| §16 | Decline policy (portal remains accept-only by decision; the underlying reversal/deadline policy is still open) |
| §17 | Re-acceptance policy for future agreement versions |
| §21 | Canonical role-title presentation portal-wide (the appointment letter itself now uses "Remote Staff" — see Stage 4 decisions) |
| §22 | Appointment reference format permanence & numbering scope (format `FFL/HR/PLA/NNN` from 013 is now implemented — see Stage 4 decisions) |
| §23 | Appointment effective-date semantics for future HR policy (`issuedAt` prints as the letter date — see Stage 4 decisions) |
| §24 | Named signatory alignment ("Management, FinFam" is implemented — see Stage 4 decisions) |
| §25 | Signature/logo assets for generated letters (letters ship text-only — see Stage 4 decisions) |
| §26 | Appointment email delivery — deferred from Stage 4; provider/sender identity still open |
| §28 | December 2026 confirmation requirements — future rule, NOT to be built |
| §29 | Staff activation trigger — ✅ RESOLVED by Stage 5 approval: Option E (explicit in-portal self-activation) implemented |
| §30 | Staff ID format — ✅ RESOLVED by Stage 5 approval: `FF-STF-NNNN` from 0001 implemented (future format changes never modify assigned IDs) |
| §31 | Identity verification for activation — 🏷️ Stage 5 MVP decision: reference-only access retained, explicitly accepted; OTP remains a recommended future hardening phase |
| §32 | Activation reversibility & appointment revocation — 🏷️ Stage 5 MVP decision: one-way activation; no revocation workflow (future business process) |
| §33 | Official onboarding WhatsApp contact — number NOT supplied; honest pending copy used; wa.me link is a config-only change once supplied |
| §34 | Verification & completion gating for onboarding — MVP decision: automated operational briefing, no human verification gate, WhatsApp contact NOT a completion gate |
| §35 | Staff resources availability & identity card — no resource files or card template exist; list-only honest presentation; card deferred to a post-onboarding feature |
| §36 | Post-onboarding portal state & future Staff Portal — MVP decision: honest terminal state ("ready to begin"); staff platform features out of scope |

---

## 1. "Established Member" savings threshold — RESOLVED (₦5,000)

The source material originally defined an *Established Member* with
**different savings thresholds in different sections** (₦2,000 vs ₦5,000).

- **Where it appears:** reward/policy sections of the recruitment material.
- **Why it mattered:** the threshold determines eligibility language and
  reward communication on the landing page, in the Responsibility & Reward
  Agreement (offer stage), and possibly in assessment content.
- **Resolution:** the **Provisional Letter of Appointment dated September 1,
  2026 (Ref: FFL/HR/PLA/012)** confirms **₦5,000**. A member becomes
  *Established* when, during their first month, they (1) complete membership
  signup, (2) make their first deposit, and (3) maintain savings of not less
  than ₦5,000. The earlier ₦2,000 figure is superseded and must not appear
  in any content going forward.
- **Status:** ✅ Resolved. Published in Agreement v1.1
  (`src/config/agreement.ts` → reward structure). The landing page
  (`src/config/content.ts`) and orientation section 5
  (`src/config/orientation.ts`) still carry the neutral
  "figures being finalised" notice — those are pre-Stage-3 surfaces,
  deliberately left untouched by the Stage 3 reconciliation; aligning them
  with the confirmed figures needs a separate instruction.

## 2. Reward structure figures — RESOLVED (published in Agreement v1.1)

The full reward structure was originally unavailable as one consistent set;
Agreement v1.0 therefore named the structure without figures.

- **Resolution:** the **Provisional Letter of Appointment dated September 1,
  2026 (Ref: FFL/HR/PLA/012)** supplies the complete, self-consistent
  structure now published in Agreement v1.1 (`src/config/agreement.ts`):
  - **Core formula:** Monthly Earnings = Established Members × ₦650 +
    Applicable Target Bonus.
  - **Target bonus tiers:** 0–99 Established Members → ₦0;
    100–199 → ₦10,000; 200+ → ₦20,000.
  - **Non-cumulative rule:** bonuses are NOT cumulative — only one tier
    applies per month (worked examples from the letter: 100 members =
    ₦75,000; 200 = ₦150,000; 300 = ₦215,000).
  - **Monthly target:** 200 Established Members — a target, not a ceiling;
    members above 200 continue to earn ₦650 each.
  - **Payment timing:** monthly earnings are paid at month end, or at the
    latest during the first week of the following month.
  - **Referral tracking:** staff must use their referral link; the link is
    for tracking and does not itself generate commissions.
  - **Privacy rule:** never request account balances or login details from
    members (encoded in the Professional conduct section of v1.1).
  - **Annual recognition:** effective December 2026, details to follow
    (partially confirmed — see §20).
- **Status:** ✅ Resolved for everything listed above. No unconfirmed
  benefit claims were added — the ₦500 cashback item (§10) remains
  unconfirmed and is still not encoded anywhere.
- **Follow-up flag:** the landing page and orientation section 5 still show
  the neutral "figures being finalised" notice (see §1 — separate
  instruction needed to align those earlier-stage surfaces).

## 3. Support contact channels — PLACEHOLDER

`src/config/site.ts` currently uses `recruitment@finfam.example` as the
support email. The real inbox (and any WhatsApp channel, once WhatsApp
automation is planned) must be supplied.

- **Decision needed:** official support email + channel strategy.
- **Status:** ⚠️ Placeholder in place, clearly marked with `TODO(business)`.

## 4. Role details & CANONICAL ROLE TITLE — UNRESOLVED (now three candidate titles)

Responsibilities and expectations on the landing page
(`src/config/content.ts`) are scaffold placeholders marked
`TODO(business)`. Replace with the official content during the Welcome/Jobs
stage planning.

- **Decision needed:** the **official canonical role title** that should
  appear consistently across the recruitment application, agreement,
  provisional appointment letter, staff records, and onboarding materials.
  The supplied material now contains **three** designations that must not be
  silently reconciled:
  - **"Remote Staff"** — the appointment designation used by the official
    Provisional Letter of Appointment (Sep 1, 2026);
  - **"Marketing & Customer Care Executive" / "FinFam Growth Ambassador"** —
    the functional role titles used by the earlier recruitment material and
    the agreement (v1.0 and v1.1, with a bridging sentence to the portal's
    generic title);
  - **"Staff Member"** — the generic title used by the application form and
    journey copy.
- **Status:** ⛔ Unresolved. Nothing was renamed in the portal during the
  Stage 3 reconciliation; the agreement keeps its v1.0 role naming and the
  appointment letter's "Remote Staff" stands as the appointment designation.
  Portal-wide alignment is a business decision.

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
  option or insight. The Provisional Letter of Appointment (Sep 1, 2026)
  does not mention it, so the reconciliation did not change this. If
  confirmed later, it must be added consistently across all three surfaces.

## 11. Reference recovery verification — INTERIM BEHAVIOUR

The unified journey includes a "Forgot your application reference?" flow
(`/continue/recover`). The source material does not specify how a candidate
should prove their identity when recovering a lost reference.

- **Decision needed:** what verification is required before a reference is
  revealed (e.g. email/OTP code, phone verification, support contact with
  manual identity checks)? Is revealing the reference at all acceptable, or
  should recovery always route through a human support channel?
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
- **Status:** ⛔ Unresolved; revisited during Stage 3 planning — see §19.

## 14. Reference expiration — NONE IMPLEMENTED

References do not expire and applications do not lapse. Whether stale
applications (e.g. abandoned at orientation for months) should be expired,
archived or re-activated has not been specified.

- **Decision needed:** do application references expire? What happens to
  candidates who never complete orientation/assessment?
- **Status:** ⛔ Unresolved; no expiration logic exists.

## 15. Agreement reward figures vs. §2 — RESOLVED (₦650 CONFIRMED)

The Stage 3 planning brief described the agreement's Reward Structure
section as "Established Members × ₦650" plus an "Applicable Target Bonus".
§2 originally blocked publishing any reward figures because the supplied
material never arrived as one consistent set, and §1 blocked the
Established Member *savings threshold* (₦2,000 vs ₦5,000 conflict). Agreement
v1.0 therefore shipped with a "figures being finalised" treatment and no
encoded numbers.

- **Resolution:** the **Provisional Letter of Appointment dated September 1,
  2026 (Ref: FFL/HR/PLA/012)** confirms the full structure: ₦650 per
  Established Member, the ₦5,000 threshold, the 0–99 / 100–199 / 200+ bonus
  tiers (₦0 / ₦10,000 / ₦20,000), the non-cumulative one-tier-per-month
  rule, the 200-member monthly target, the payment timing, the
  referral-tracking rule, and the December 2026 annual-recognition note.
- **Status:** ✅ Resolved. This was a meaning-bearing content change, so the
  agreement version was bumped **v1.0 → v1.1** (why: compensation and
  Established Member definitions were formally confirmed by the Provisional
  Letter of Appointment dated September 1, 2026). Accepted v1.0 records
  were not touched — see §17.

## 16. Agreement decline & reversal policy — ACCEPT-ONLY (decision recorded; underlying policy still open)

The shipped state machine reserves `OFFER_DECLINED` with candidate-facing
copy, which implies the portal could record a decline. The decline policy
itself was never supplied.

- **Decision made:** the business directed Stage 3 to ship
  **Accept-only** — no `declinedAt` column, no decline API, no decline UI,
  no decline transition. The earlier interim proposal (self-service decline)
  is superseded and nothing was implemented. `OFFER_DECLINED` remains an
  unused enum value reserved for a future business decision, and its
  journey mapping keeps `stageCompleted: false` so a decline could never
  advance the journey.
- **Still open (policy):** (a) may a candidate ever decline through the
  portal, or must declines go through a human channel? (b) Is a recorded
  decline reversible — by whom, and how? (c) Is there a deadline for
  responding to the agreement?
- **Status:** ⛔ Policy unresolved; ⚠️ accept-only behaviour in place by
  explicit instruction.

## 17. Agreement versioning & re-acceptance — NOT SPECIFIED (v1.0 → v1.1 now live)

Agreement acceptance records the exact content version accepted (auditable).
What happens when the agreement content changes AFTER candidates have
accepted an older version has not been specified.

- **Decision needed:** if FinFam issues agreement v1.1 or v2.0, must
  candidates who accepted v1.0 re-accept? Does an already-accepted journey
  pause until re-acceptance, or do new versions apply only to candidates
  who have not yet accepted?
- **Interim proposal (now in effect):** new versions apply only to
  candidates who have not yet accepted; existing acceptances of older
  versions remain valid and auditable; no re-acceptance flow exists until
  the business asks for one. This was exercised for the first time by the
  v1.0 → v1.1 bump: the two accepted v1.0 records (FF-E9KUVN, FF-WVA24D)
  remain untouched on v1.0, and new acceptances pin v1.1.
- **Status:** ⛔ Policy still to be confirmed by the business; the interim
  proposal is now live behaviour, not just a plan.

## 18. Agreement wording approval — LEGAL/BUSINESS SENSITIVE

The acceptance acknowledgement sentence and the agreement's section wording
are business- (and possibly legally-) sensitive statements the candidate
formally accepts. No employment-contract or legal language may be invented
by implementation.

- **What changed in v1.1:** the reward structure now carries the figures
  confirmed by the Provisional Letter of Appointment (Sep 1, 2026); a new
  concise **"Important conditions"** section was added containing only
  letter-confirmed terms (provisional participation, performance review,
  December 2026 confirmation expectation); one letter-confirmed privacy rule
  was added to Professional conduct. No termination, probation, deduction,
  reversal, or confidentiality language was invented. The acknowledgement
  sentence is unchanged from v1.0.
- **Decision needed:** who approves the final wording of the agreement
  (including the new "Important conditions" section) and the acknowledgement
  sentence before it is treated as final?
- **Status:** ⛔ Unresolved. v1.1 contains only content supportable from the
  supplied FinFam material; the acknowledgement sentence follows the Stage 3
  brief's suggested wording and is flagged for approval.

## 19. Identity model for consequential actions — REFERENCE-ONLY (§13 revisited)

Stage 3 introduces the first consequential, hard-to-reverse action of the
journey (agreement acceptance) behind the same reference-as-lookup-key
access model documented in §13. The portal does not authenticate its users.

- **Decision needed:** is reference-only access acceptable for agreement
  acceptance, or should this stage require an additional verification step
  (e.g. OTP to the application email/phone) first? The same question applies
  to every later stage (appointment letters, activation).
- **Interim behaviour (in effect):** the reference-only access model is used
  consistently (no new verification infrastructure in Stage 3); the weakness
  is documented, not worsened — the agreement API exposes no new personal
  data. The version echo in the accept payload protects against
  stale-version submissions, not against reference holders (that would
  require authentication).
- **Status:** ⛔ Unresolved; flagged for explicit business sign-off.

## 20. Annual recognition & December 2026 confirmation — PARTIALLY CONFIRMED (new)

The Provisional Letter of Appointment (Sep 1, 2026) confirms two future
items whose detailed rules are NOT yet supplied:

- **Year-end recognition / rewards.** Effective December 2026, top
  performers and community builders may be eligible for year-end rewards.
  The existence and timing are confirmed; the eligibility criteria and
  reward details are to follow before Q4. Agreement v1.1 states only the
  confirmed fact. Do not invent eligibility criteria.
- **December 2026 confirmation.** Participation is provisional and subject
  to performance review, with confirmation expected in December 2026 upon
  meeting the stated requirements. The requirements themselves are not
  supplied. This is recorded as a **future business rule only** — the portal
  implements NO confirmation workflow, and this must not be built as part
  of any stage until the business specifies it.

- **Status:** ⚠️ Partially confirmed; details pending from the business
  before Q4.

---

## 21. Canonical role title on the appointment letter — STAGE 4 DEFAULT USED ("Remote Staff"); portal-wide title still open

The supplied material contains four designations. Where each appears today:

- **"Remote Staff"** — the appointment designation used by the official
  Provisional Letter of Appointment (Sep 1, 2026), including its subject
  line ("Provisional Letter of Appointment – Remote Staff").
- **"Marketing & Customer Care Executive" / "FinFam Growth Ambassador"** —
  the functional role titles in the earlier recruitment material and in the
  agreement (v1.0/v1.1 "Your role" section).
- **"Staff Member"** — the generic title used by the application form and
  journey copy.

- **IMPLEMENTED (Stage 4 default):** the generated appointment letter uses
  **"Remote Staff"** as its official appointment designation — snapshotted
  per appointment (`appointments.roleTitle`) — and the opening paragraph
  describes the functional responsibility without renaming the role.
- **Still open:** one canonical title portal-wide (§4). Nothing outside the
  appointment letter was renamed in Stage 4.
- **Status:** 🏷️ Stage 4 default applied; portal-wide alignment pending.

## 22. Appointment reference numbering — IMPLEMENTED (FFL/HR/PLA/NNN from 013); format permanence still open

The official sample letter carries reference **FFL/HR/PLA/012**. The
recruitment reference (FF-XXXXXX) and the appointment reference are
different concepts and are never conflated.

- **IMPLEMENTED (Stage 4):** server-generated sequential appointment
  references in the official format `FFL/HR/PLA/{NNN}` (zero-padded to at
  least three digits, growing naturally beyond that), allocated from a
  transactional singleton row (`appointment_sequences`, atomic
  `UPDATE … RETURNING` inside the issuance transaction) so concurrent
  issuances can never collide; the unique constraint on
  `appointments.appointmentReference` is the final backstop. Candidates
  never supply it and it is never derived from `count(*)`.
- **Initial sequence (documented assumption):** the sample's 012 is treated
  as the most recently existing appointment — the sample itself is NOT
  written into the database — so the first system-issued letter is
  **FFL/HR/PLA/013**. The sequence may skip a number if a transaction rolls
  back after allocation; monotonicity and uniqueness are the guarantees.
- **Still open:** is `FFL/HR/PLA/` the permanent prefix? Numbering
  per-letter-type or global? Any future year component?
- **Status:** 🏷️ Stage 4 default applied; format permanence pending.

## 23. Appointment effective date — STAGE 4 DEFAULT USED (letter date = issuedAt); semantics still open

The sample letter is dated September 1, 2026 (a source-document date, not a
rule for future letters).

- **IMPLEMENTED (Stage 4 default):** one server-set `issuedAt` field (the
  portal issuance moment) prints as the letter date. No hard-coded dates —
  September 1, 2026 belongs to the sample document only. No `effectiveDate`
  column exists; the two are NOT silently conflated — the distinction is
  deliberately left unmodelled until HR defines it.
- **Still open:** should the appointment take effect at the issue date, at
  the agreement acceptance date, at a fixed resumption/commencement date
  set by HR, or another defined date? A column can be added later without
  touching issued rows.
- **Status:** 🏷️ Stage 4 default applied; effective-date policy pending.

## 24. Appointment signatory — STAGE 4 DEFAULT USED ("Management, FinFam"); named-officer alignment still open

The earlier recruitment material names **Tosin Eboh — President, FinFam**
and **Mosunmola Esther Afolami — Global Executive Secretary, FinFam**. The
supplied appointment letter closes with **"Management, FinFam"**.

- **IMPLEMENTED (Stage 4 default):** generated letters close with the
  text-only **"Management / FinFam"** (APPOINTMENT_SIGNATORY_LINES in
  `src/config/appointment.ts`). The named officers from older recruitment
  content are NOT used.
- **Still open:** the official signatory format going forward (named
  officers / "Management, FinFam" / another approved formulation). Changing
  it means appending a new content version — issued letters are untouched.
- **Status:** 🏷️ Stage 4 default applied; signatory confirmation pending.

## 25. Signature / logo assets for generated letters — STAGE 4 SHIPS TEXT-ONLY; assets still missing

- **IMPLEMENTED (Stage 4 default):** no signature images are rendered and
  none were invented (no fake, generated, or handwritten signatures); the
  letter closes with plain text. No logo was invented or recreated; if the
  business later supplies the official FinFam Multipurpose Cooperative
  Society Limited logo, it can be added to the letterhead rendering as a
  new content version.
- **Still open:** do generated letters require real signature images or the
  official logo? Assets have not been supplied.
- **Status:** 🏷️ Text-only shipped; official assets pending.

## 26. Appointment email delivery — DEFERRED (Stage 4 MVP decision)

The original recruitment brief says appointment letters should eventually
reach the candidate's registered email. No email infrastructure exists in
the portal (the support inbox itself is still a placeholder, §3).

- **Stage 4 MVP decision:** email delivery is OUT OF SCOPE. No provider
  integration, sending, templates, jobs, retries, queues or SMTP were
  built. The candidate accesses their appointment entirely through the
  recruitment portal (journey CTA → read-only letter → print/save as PDF).
- **Still open:** which provider/sender identity, and when the email
  integration stage happens.
- **Status:** 🏷️ Deferred by Stage 4 decision; provider pending.

## 27. Separate appointment acknowledgement? — NO (Stage 4 decision)

Earlier recruitment material mentions an "Accept and Download" step for the
appointment letter. The candidate has already explicitly accepted the
Responsibility & Reward Agreement (stage 3) — the harder, auditable
decision.

- **IMPLEMENTED (Stage 4 decision):** no second acceptance. There is no
  accept-appointment checkbox, signature requirement, acknowledgement API
  or duplicate confirmation modal. The appointment is a formal ISSUED
  record: the candidate views/prints it; only stage 3 records a decision.
- **Still open:** whether the business ever wants a recorded acknowledgement
  on the appointment itself (it can be added without touching issued
  letters).
- **Status:** 🏷️ Resolved for the Stage 4 MVP by decision; revisit only if
  the business asks.

## 28. December 2026 confirmation requirements — FUTURE RULE ONLY

Extends §20: the appointment is provisional and subject to performance
review, with confirmation expected in December 2026 upon meeting the stated
requirements. The requirements are NOT supplied.

- **Stage 4 treatment:** the confirmed statement IS included in the
  appointment letter content (v1.0, "Provisional appointment" section) —
  strictly as words on the letter. NO confirmation workflow was built: no
  confirmation model, status, cron task, scheduled action, reminder,
  automatic approval, performance calculator, confirmation API or page.
  *Provisional appointment*, *staff activation* and *final confirmation*
  remain three distinct concepts.
- **Status:** ⚠️ Partially confirmed (existence + timing); requirements
  pending from the business before anything is built.

---

**Stage 5 note.** Staff Activation (stage 5) is IMPLEMENTED with the approved
MVP decisions below; the sections record what was settled and what stays
open.

## 29. Staff activation trigger — RESOLVED (Stage 5 approval: Option E)

The recruitment brief says the end state is "Applicant → Approved FinFam
Staff" but does not say WHAT precisely flips a provisionally appointed
candidate into approved staff. Candidate options evaluated during Stage 5
planning: (A) automatic on appointment issuance — rejected (stages 4 and 5
are deliberately separate); (B/C/D) WhatsApp-based or internal manual
verification — conflicts with the zero-manual-intervention goal or requires
integrations that do not exist; (E) the candidate reviews the activation
screen and explicitly activates their staff profile in the portal, with
WhatsApp/onboarding contact belonging to stage 6.

- **Stage 5 planning recommendation:** Option E — explicit in-portal
  activation (`APPOINTMENT_ISSUED → ACTIVATION_PENDING → APPROVED_STAFF`),
  one COMPLETED StageEvent, Staff ID assigned in the same transaction.
- **Resolution:** APPROVED and IMPLEMENTED (Stage 5). Opening the
  activation page records `ACTIVATION_PENDING` + one ENTERED event only;
  the explicit checkbox + confirmation action (server-validated literal
  acknowledgement + version echo) transitions to `APPROVED_STAFF`. A
  direct API activation from `APPOINTMENT_ISSUED` records the ENTERED
  event first so the trail stays ordered. No manual administrator
  approval exists.
- **Status:** ✅ Resolved by approval; implemented as approved.

## 30. Staff ID format — RESOLVED (Stage 5 approval: `FF-STF-NNNN`)

The original brief says approved staff receive a Staff ID; no format was
supplied anywhere in the material.

- **Stage 5 planning proposal (MVP default, NOT yet confirmed):**
  `FF-STF-NNNN` (e.g. `FF-STF-0001`) — unique, server-generated from a
  transactional singleton sequence, never client-supplied, never from
  `count(*)`, immutable once assigned. Alternatives: `FINFAM/STAFF/0001`
  or a scheme the business already uses offline.
- **Resolution:** APPROVED and IMPLEMENTED (Stage 5). Format
  `FF-STF-NNNN`; `StaffIdSequence` singleton (`STAFF_ID`) seeded at 0 so
  the first portal-issued ID is `FF-STF-0001`; atomic `UPDATE…RETURNING`
  allocation inside the activation transaction; unique-constraint
  backstop. Already-assigned IDs are immutable forever — a future format
  change may not modify them.
- **Status:** ✅ Resolved by approval; implemented as approved.

## 31. Identity verification for activation — MVP DECISION (reference-only retained)

Extends §13/§19. Activation is the most consequential reference-only action
yet: it creates the staff identity, assigns the Staff ID and completes the
recruitment state machine. The portal has no authentication, and no OTP/SMS
infrastructure exists.

- **IMPLEMENTED (Stage 5 MVP decision):** the reference-only access model is
  retained — an explicitly accepted limitation, not an accidental omission.
  No OTP, email verification, passwords, sessions, accounts or magic links
  were built. No new personal data is exposed (identity facts only). The
  consequence of the limitation is process-level, not financial.
- **Still open (recommended for a future security hardening phase):**
  stronger verification (e.g. OTP to the application email/phone) for
  consequential stages.
- **Status:** 🏷️ Accepted MVP limitation by decision; hardening
  recommended later.

## 32. Activation reversibility & appointment revocation — MVP DECISION (one-way)

No supplied material describes how to deactivate a staff member or revoke a
provisional appointment, and the portal has no revocation workflow for any
stage.

- **IMPLEMENTED (Stage 5 MVP decision):** activation is one-way in the
  candidate portal — no deactivate, revoke-Staff-ID, withdraw, revert,
  revoke-appointment, reassign or delete workflow exists. Any future
  revocation/termination/deactivation process is an administrative/business
  workflow outside this recruitment MVP.
- **Status:** 🏷️ Resolved for the MVP by decision; future business process.

## 33. Official onboarding WhatsApp contact — UNRESOLVED (number not supplied)

The supplied onboarding material instructs staff to contact the designated
FinFam onboarding team via WhatsApp within 24 hours of receiving the
appointment letter, using a scripted first message — but the actual
onboarding WhatsApp number was never supplied in any material.

- **Stage 6 planning recommendation:** onboarding content ships with
  `whatsappNumber: null` and honest pending copy ("Your official staff
  onboarding contact will be provided here once confirmed."). The scripted
  message text from the material IS used verbatim as an instruction (what
  to send), but no number, no wa.me link, no disabled fake button and no
  invented contact is rendered until the business supplies the real one.
  Once supplied, it is a config-only change that enables a "Contact
  Onboarding Team" wa.me link with the pre-filled message — no WhatsApp
  API integration is needed or planned.
- **Impact:** portal onboarding remains completable without the number
  (the WhatsApp contact is a real-world follow-up action — see §34). The
  business should supply the number before real staff reach onboarding so
  the handoff is actionable.
- **Status:** ⛔ Unresolved — awaiting the official number.

## 34. Verification & completion gating — MVP DECISION (automated briefing, no human gate)

The onboarding material says the onboarding team "may confirm" identity,
appointment status, assigned staff details and communication-channel
access — which conflicts with the recruitment goal of zero manual
intervention.

- **IMPLEMENTED (Stage 6 MVP decision):** portal onboarding is an
  automated operational briefing + resource handoff. Facts the portal can
  verify from persisted records (identity created at activation, issued
  appointment, assigned Staff ID) are shown from those records;
  communication-channel access is presented as an external real-world
  instruction and does NOT block portal completion. No "I have contacted
  the onboarding team" self-confirmation is captured, and no admin
  approval / verification queue / onboarding-officer dashboard exists.
  Portal completion requires: all seven onboarding steps reviewed + the
  single final operational acknowledgement. Daily reporting is explained
  only — the reporting system itself is a future staff-platform product.
- **Status:** 🏷️ Resolved for the MVP by approval.

## 35. Staff resources & identity card — MVP DECISION (list-only; card deferred)

The business material lists resources staff receive: FinFam Identity
Card, branded shirt design, customisable marketing flyers, orientation
and training materials, customer education materials, approved marketing
guidelines and reporting instructions. No resource files exist in the
project (public/ contains only the site logo), and no ID-card template
or spec exists.

- **IMPLEMENTED (Stage 6 MVP decision):** the resources step LISTS what
  staff may receive with honest "provided through the onboarding/support
  channel" copy; no downloadable files, placeholder cards or dead links
  are fabricated. The FinFam Identity Card is NOT built in Stage 6 and is
  NOT required before onboarding can complete — it remains a
  post-onboarding staff feature (future generator/resource feature). If
  real files are supplied later, their access control must be assessed
  before exposure: the portal's reference-only access model (§31) means
  private staff materials raise the consequence of reference leakage.
- **Status:** 🏷️ Resolved for the MVP by approval; asset supply remains open.

## 36. Post-onboarding portal state & future Staff Portal — MVP DECISION

No supplied material describes what the portal shows after onboarding
completes, or whether a staff portal will follow.

- **IMPLEMENTED (Stage 6 MVP decision):** the completed portal shows the
  honest terminal state on the unified journey — Approved Staff, Staff
  ID, recruitment complete (all six stages ✓), onboarding completed with
  its date, "You are ready to begin your FinFam assignment." No next
  stage, no fake Staff Portal link. Completed onboarding is closed:
  revisiting /onboarding/[reference] redirects to the unified journey; no
  read-only archive page in this MVP. The daily reporting system, staff
  dashboard, ID-card generator, commission/payroll and any other
  staff-platform features are out of scope and belong to a separate
  FinFam Staff Platform / Operations roadmap — there is no Stage 7 in
  this recruitment journey.
- **Status:** 🏷️ Resolved for the MVP by approval; Staff Portal question
  remains open for the business to plan.

## 37. Mailjet sender address — UNRESOLVED (deployment requirement)

The Mailjet transactional notification service (cross-cutting platform
service, implemented after Stage 6) sends from `MAILJET_FROM_EMAIL`.
Mailjet only accepts sends from a **validated/authorized sender** (or
domain) in the owning account, and no confirmed FinFam transactional
sender address has been supplied.

- **IMPLEMENTED (configuration only):** the service reads
  `MAILJET_FROM_EMAIL` / `MAILJET_FROM_NAME` from the environment; nothing
  is hard-coded. Until a validated sender exists, deployments keep
  `NOTIFICATIONS_ENABLED=false` (the safe default): lifecycle emails queue
  as `NotificationDelivery` rows but no network send is attempted.
- **OPEN:** the business must supply the official sender address (and
  validate it in Mailjet), then set `NOTIFICATIONS_ENABLED=true` plus the
  credentials in the deployment environment.
- **Status:** ⏳ Unresolved — deployment requirement, config-only change
  when supplied.

## 38. Inbox delivery events / bounce handling — DEFERRED (MVP semantics)

The notification service records `SENT` when **Mailjet accepts the
transactional send request** — it deliberately does NOT claim inbox
delivery. Bounces, spam complaints, deliveries and opens require Mailjet
event webhooks (plus a receiving endpoint and replay-safe processing).

- **IMPLEMENTED (MVP):** honest status model `PENDING / SENT / FAILED`;
  `FAILED` rows keep a safe error code and a bounded retry budget
  (`NOTIFICATIONS_MAX_ATTEMPTS`, default 3) re-drivable via the notification
  service by a protected future worker. No cron exists in this project —
  recurring retry scheduling is a deployment concern.
- **DEFERRED:** provider event webhooks, bounce/complaint handling and a
  delivery-status dashboard are future work; they can be added without
  schema changes (`providerMessageId` + status model already exist).
- **Status:** 🏷️ Deferred by MVP decision; documented in README →
  "Transactional notifications (Mailjet)".

## 39. Stage 7 — Staff Portal Foundation: open business questions — PLANNING ONLY (no implementation)

Stage 7 (Staff Portal Foundation & Secure Account Access) has been PLANNED,
not implemented (see the Stage 7 planning deliverable in the task log,
worklog.md Task 9). The plan explicitly defers these business decisions —
implementation must not begin until they are confirmed:

1. Exact Staff Account creation moment (plan recommends: onboarding completion).
2. Authentication method (plan recommends: email OTP; magic link / password / external provider are the alternatives).
3. Official Staff Portal domain/base URL for links and cookies.
4. Confirm staff use their registered email as the login identifier (Staff ID stays an identity reference, never a credential).
5. Confirm account access requires onboarding completion.
6. Account suspension authority and workflow (who suspends, via what interface).
7. Recovery policy beyond OTP resend (lost-email path is currently offline/admin).
8. Whether completed Staff retain reference-based recruitment access long-term (plan: keep, do not break links; retire later only deliberately).
9. Which resource assets exist for the portal (none supplied yet — §35).
10. Whether the ID card becomes a Staff Portal feature (deferred in §35).
11. Whether Daily Reporting is the next module after the foundation.
12. Whether earnings/commission visibility is planned for staff.
13. Who will administer Staff accounts (no admin portal exists).
14. Whether multiple staff roles/permissions will exist.
15. Session duration/security requirements (plan proposes 7-day sessions, rotation on login).

- **Status:** ⏳ Unresolved — Stage 7 is PLANNING ONLY; nothing is implemented.

---

**Rule going forward:** when new source material contains contradictory
figures, add a numbered section here instead of choosing one. Implementation
waits for confirmation. When a question is resolved, mark it with the
authoritative source and keep it here as the audit trail.
