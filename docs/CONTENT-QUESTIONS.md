# Content questions for the business owner

The supplied FinFam recruitment material contains business rules and
financial/reward figures. Per the project ground rules, implementation must
not silently pick a version when the source material contradicts itself.

**Nothing in this list has been implemented.** Each item below blocks the
corresponding stage and must be confirmed before the affected content is
coded into `src/config/content.ts` or the stage services.

## 1. "Established Member" savings threshold — CONFLICTING FIGURES

The source material defines an *Established Member* with **different savings
thresholds in different sections**.

- **Where it appears:** reward/policy sections of the recruitment material.
- **Why it matters:** the threshold determines eligibility language and
  reward communication on the landing page, in the Responsibility & Reward
  policy (offer stage), and possibly in assessment content.
- **Decision needed:** which figure is authoritative?
- **Status:** ⛔ Not implemented. The landing page shows a neutral notice
  ("Reward figures are being finalised") until this is resolved
  (`src/config/content.ts` → `rewardsPending: true`).

## 2. Reward structure figures — PENDING

Reward/commission figures exist in the source material but the full reward
structure (amounts, conditions, payout timing) has not been supplied as one
consistent set.

- **Decision needed:** the confirmed reward structure for the Staff Member role.
- **Status:** ⛔ Not implemented. Same placeholder mechanism as above.

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

---

**Rule going forward:** when new source material contains contradictory
figures, add a numbered section here instead of choosing one. Implementation
waits for confirmation.
