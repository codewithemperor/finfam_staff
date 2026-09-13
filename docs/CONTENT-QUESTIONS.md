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
- **Affects:** orientation section 1 copy (`src/config/orientation.ts`).
- **Status:** ⚠️ Purpose-level content in place; no invented corporate
  claims.

---

**Rule going forward:** when new source material contains contradictory
figures, add a numbered section here instead of choosing one. Implementation
waits for confirmation.
