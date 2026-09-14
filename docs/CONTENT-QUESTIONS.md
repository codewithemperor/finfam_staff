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
| §21 | Canonical role-title presentation on the appointment letter (added during Stage 4 planning) |
| §22 | Appointment reference numbering format & sequence policy (added during Stage 4 planning) |
| §23 | Appointment effective-date semantics (added during Stage 4 planning) |
| §24 | Appointment signatory format (added during Stage 4 planning) |
| §25 | Signature/logo assets for generated letters (added during Stage 4 planning) |
| §26 | Appointment email delivery — Stage 4 MVP or later (added during Stage 4 planning) |
| §27 | Separate appointment acknowledgement vs Stage 3 acceptance (added during Stage 4 planning) |
| §28 | December 2026 confirmation requirements — future rule, NOT to be built (added during Stage 4 planning) |

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

## 21. Canonical role title on the appointment letter — UNRESOLVED (Stage 4 planning)

The supplied material contains four designations. Where each appears today:

- **"Remote Staff"** — the appointment designation used by the official
  Provisional Letter of Appointment (Sep 1, 2026), including its subject
  line ("Provisional Letter of Appointment – Remote Staff").
- **"Marketing & Customer Care Executive" / "FinFam Growth Ambassador"** —
  the functional role titles in the earlier recruitment material and in the
  agreement (v1.0/v1.1 "Your role" section).
- **"Staff Member"** — the generic title used by the application form and
  journey copy.

- **Planning proposal (NOT implemented):** the appointment letter uses
  **"Remote Staff"** as its appointment designation — that is what the
  authoritative Stage 4 document itself says — optionally with one sentence
  connecting it to the functional role the candidate was recruited for. No
  portal-wide renaming happens in Stage 4.
- **Decision needed:** the exact canonical presentation on the letter
  (Remote Staff only / both titles / another approved formulation), and
  eventually one canonical title portal-wide (§4).
- **Status:** ⛔ Unresolved; planning-stage question.

## 22. Appointment reference numbering — UNRESOLVED (Stage 4 planning)

The official sample letter carries reference **FFL/HR/PLA/012**. The
recruitment reference (FF-XXXXXX) and the appointment reference are
different concepts and must never be conflated.

- **Planning proposal (NOT implemented):** server-generated sequential
  appointment references in the official format `FFL/HR/PLA/{NNN}`
  (zero-padded, growing beyond 3 digits naturally), allocated from a
  transactional singleton counter so concurrent issuances can never
  collide. Candidates never supply it.
- **Decision needed:** is `FFL/HR/PLA/` the permanent prefix? Should the
  portal sequence continue after the sample's 012, start at 001, or use a
  different scheme (e.g. a year component)? Is the numbering per-letter-type
  or global?
- **Status:** ⛔ Unresolved; planning-stage question.

## 23. Appointment effective date — UNRESOLVED (Stage 4 planning)

The sample letter is dated September 1, 2026 (a source-document date, not a
rule for future letters).

- **Planning proposal (NOT implemented):** one server-set `issuedAt` field
  (the portal issuance moment), printed as the letter date. No
  `effectiveDate` column until its meaning is confirmed — the two must not
  be silently conflated.
- **Decision needed:** should the appointment take effect at the issue date,
  at the agreement acceptance date, at a fixed resumption/commencement date
  set by HR, or another defined date?
- **Status:** ⛔ Unresolved; planning-stage question.

## 24. Appointment signatory — UNRESOLVED (Stage 4 planning)

The earlier recruitment material names **Tosin Eboh — President, FinFam**
and **Mosunmola Esther Afolami — Global Executive Secretary, FinFam**. The
supplied appointment letter closes with **"Management, FinFam"**.

- **Decision needed:** the official Stage 4 signatory format for generated
  appointment letters (named officers / "Management, FinFam" / another
  approved formulation).
- **Status:** ⛔ Unresolved; planning-stage question. Nothing is silently
  chosen; the plan defaults to the supplied letter's "Management, FinFam"
  pending confirmation.

## 25. Signature / logo assets for generated letters — UNRESOLVED (Stage 4 planning)

- **Decision needed:** do generated appointment letters require real
  signature images or the FinFam Multipurpose Cooperative Society Limited
  logo? No such assets have been supplied, so none are invented; the letter
  ships text-only until assets exist.
- **Status:** ⛔ Unresolved; planning-stage question.

## 26. Appointment email delivery — Stage 4 MVP or later? (Stage 4 planning)

The original recruitment brief says appointment letters should eventually
reach the candidate's registered email. No email infrastructure exists in
the portal (the support inbox itself is still a placeholder, §3).

- **Planning recommendation (NOT implemented):** defer automatic email to a
  later integration phase; the Stage 4 view/download experience must not
  depend on email delivery.
- **Decision needed:** ship email in the Stage 4 MVP or later? Which
  provider/sender identity?
- **Status:** ⛔ Unresolved; planning-stage question.

## 27. Separate appointment acknowledgement? (Stage 4 planning)

Earlier recruitment material mentions an "Accept and Download" step for the
appointment letter. The candidate has already explicitly accepted the
Responsibility & Reward Agreement (stage 3) — the harder, auditable
decision.

- **Planning recommendation (NOT implemented):** no second acceptance.
  Issuing and viewing the letter is sufficient for the MVP; adding another
  accept step would duplicate the stage 3 decision without new information.
- **Decision needed:** does the business require a separate appointment
  acknowledgement (e.g. an "Accept and Download" click recorded on the
  appointment)?
- **Status:** ⛔ Unresolved; planning-stage question.

## 28. December 2026 confirmation requirements — FUTURE RULE ONLY (Stage 4 planning)

Extends §20: the appointment is provisional and subject to performance
review, with confirmation expected in December 2026 upon meeting the stated
requirements. The requirements are NOT supplied.

- **Explicitly out of scope for Stage 4:** no confirmation workflow, no
  scheduled December action, no automated confirmation, and no conflation
  of *provisional appointment* with *staff activation* or *final
  confirmation* — three distinct concepts.
- **Status:** ⚠️ Partially confirmed (existence + timing); requirements
  pending from the business before anything is built.

---

**Rule going forward:** when new source material contains contradictory
figures, add a numbered section here instead of choosing one. Implementation
waits for confirmation. When a question is resolved, mark it with the
authoritative source and keep it here as the audit trail.
