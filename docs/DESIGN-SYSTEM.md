# FinFam Design System

The portal should feel like a **real financial-services recruitment product**:
professional, calm, structured, human. If a visual element has no
functional or communication purpose, it does not belong in the interface.

## Brand color

FinFam green lives in **one place**: the `--accent` CSS variable
(`src/app/globals.css`). Everything green in the UI derives from it. To
rebrand, change:

```css
:root {
  --accent: #0c7a43;          /* FinFam green */
  --accent-foreground: #ffffff;
}
```

Green is used for: primary CTA, active/selected states, focus rings, progress,
success states. **Nowhere else.** The interface is white + neutral surfaces +
dark text + green accents.

## Token system

Semantic tokens are CSS variables (HeroUI v3 theme) mapped into Tailwind
utilities via `@theme inline` in `src/app/globals.css`:

| Token                   | Utility                       | Use                          |
| ----------------------- | ----------------------------- | ---------------------------- |
| Primary                 | `bg-primary`, `text-primary`  | CTAs, active states          |
| Primary foreground      | `text-primary-foreground`     | Text on primary              |
| Background              | `bg-background`               | Page canvas (white)          |
| Surface                 | `bg-surface`                  | Subtle grouped blocks        |
| Surface elevated        | `bg-surface-elevated`         | Overlay surfaces             |
| Foreground              | `text-foreground`             | Primary text                 |
| Muted foreground        | `text-muted-foreground`       | Secondary text               |
| Border / Divider        | `border-border`, `bg-divider` | Hairlines                    |
| Success/Warning/Danger  | `bg-success`, etc.            | Status only                  |
| Info                    | `bg-info`                     | Informational accents        |
| Disabled                | `text-disabled`, etc.         | Disabled controls            |

Never hard-code hex values in components. Never use one-off greens.

## Typography

Manrope only (400 body, 500 labels/navigation, 600 subheadings/buttons,
700 headings). Headings and body are plain semantic elements (`h1`–`h3`,
`p`) styled with Tailwind classes — HeroUI components are reserved for
interactive/compound UI. Page titles use `PageHeader`.

## Layout

```
PageShell
 ├─ SiteHeader        brand + nav + Apply CTA (h-16, border-b)
 ├─ main#main-content flex-1 → PageContainer (py-10/12)
 └─ SiteFooter        mt-auto (sticks to viewport bottom on short pages)
```

- `PageContainer size`: `narrow` (max-w-2xl, forms/flows), `default`
  (max-w-5xl), `wide` (max-w-6xl).
- Pages never invent their own margins; they compose `PageShell` +
  `PageContainer`.
- Mobile-first; content single-column, two-column grids from `md:` up.

## Components — usage rules

Library: **HeroUI v3** (`@heroui/react`). Do not rebuild what it provides;
do not use a component just because it exists.

| Element     | Rule                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `Button`    | Actions only (submit, copy, confirm). One primary action per section.     |
| `ButtonLink`| Navigation CTAs. Same visual recipe via `@heroui/styles buttonVariants`.  |
| `Alert`     | Information that must stay visible (rules, warnings, next steps).         |
| Toast       | Short-lived feedback after an action. Never policy info or validation.    |
| Modal       | Small decisions in context (added when first needed, e.g. decline offer). |
| Drawer      | Reserved for mobile navigation when nav outgrows the header.              |
| Tabs        | Only for parallel content — never sequential recruitment stages.          |
| Stepper     | `RecruitmentProgress` — the single representation of the journey.         |
| `Chip`      | Status badges via `StatusBadge` (soft variant only).                      |
| Spinner/`Skeleton` | Pending states; skeletons preview the expected shape.              |

## Forms

Exemplar: `src/components/forms/apply-form.tsx`.

- Plain `<form noValidate>` — accessible, predictable, no native bubbles.
- HeroUI `TextField` composition: `Label` (always visible) + `Input` +
  `Description` (when it helps) + `FieldError`.
- Required fields marked with a visible `*` (plus `aria-hidden`).
- Validation: shared zod schema (`src/lib/validation/*`) parsed on the
  client for immediate feedback and **re-parsed on the server** — the server
  never trusts the client.
- Server field errors map back onto the same fields (e.g. duplicate email).
- Submit button: `isPending`, disabled against double submits, verb-first
  label ("Submit application" → "Submitting application…").

## States

- **Loading** — route-level `loading.tsx`; per-feature `Skeleton` previews.
- **Errors** — human-readable, actionable, in-page (Alert or panel).
  Technical details go to server logs only.
- **Empty** — explain what's missing, why it matters, what to do. Concise.

## Accessibility

- Semantic landmarks (`header`, `main#main-content`, `nav`, `footer`).
- Visible focus rings (HeroUI `--focus` = accent; verified 2px outline).
- `aria-current="step"` + sr-only state words on the stepper.
- Colour contrast: zinc-900 on white, white on #0c7a43 — AA at minimum.
- Touch targets ≥ 40px on mobile; full-width primary actions on small screens.

## Anti-slop checklist (apply before every review)

No gradients, no glassmorphism, no glow, no floating blobs, no emoji UI, no
fake stats/testimonials, no marketing buzzwords, no decorative motion, no
cards-inside-cards. Whitespace is acceptable. Every element must answer:
*"what functional or communication purpose does this serve?"*
