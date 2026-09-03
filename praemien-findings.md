# Praemien Findings

## Goal Of The New Page

Create an admin page `Prämien` for building quarterly reward logic in a cleaner, more useful way than the current GM reward display. The new builder should move from the current percentage-based reward framing to a point-based quarter model, while still reusing the existing answer-level `boni` values already authored in the questionnaire system.

## Current GM Reward Surface

### GM dashboard entry point

- [src/app/(dashboard)/gm/page.tsx](src/app/(dashboard)/gm/page.tsx)
- The GM dashboard renders:
  - `GMStatusCard`
  - `BonusCircles`
  - `BonusDetailModal`
- The reward area is currently mocked with `BONUS_GOALS`:
  - `Schütten/Displays`
  - `Distributionsziel`
  - `Flexziel`
  - `Qualitätsziele`
- Each goal is expressed as a percentage, not as points.

### Bonus circles

- [src/components/dashboard/BonusCircles.tsx](src/components/dashboard/BonusCircles.tsx)
- `BonusCircles` shows the 4 categories as connected rings with percentages inside.
- `calcBonus(goals)` converts the average percentage into a euro reward:
  - `>= 95` => `1100`
  - `>= 80` => `880`
  - `>= 70` => `550`
  - otherwise `0`
- The card footer shows `Dein Bonus: X€`.
- This is a compact teaser, not a configuration UI.

### Bonus detail modal

- [src/components/dashboard/BonusDetailModal.tsx](src/components/dashboard/BonusDetailModal.tsx)
- The modal contains the most complete current reward explanation:
  - quarter label derived from current date (`Q1` to `Q4`)
  - threshold track with 4 nodes (`0€`, `550€`, `880€`, `1100€`)
  - current bonus highlight
  - category breakdown bars
  - improvement hint toward the next threshold
- Important current business framing:
  - the GM reward is based on the average of the 4 category percentages
  - the threshold track is quarter-oriented and very readable
  - the modal language is explanatory, not authoring-oriented

### GM status card

- [src/components/dashboard/GMStatusCard.tsx](src/components/dashboard/GMStatusCard.tsx)
- `praemie` is only displayed as a result (`Bonus QTD`), not configured there.
- The card pairs `IPP` and `Bonus QTD` side-by-side, which is useful context for the future admin page.

## Current Bonus Data Model In Admin

### Shared type system

- [src/types/fragebogen.ts](src/types/fragebogen.ts)
- `Question.scoring` is already the central hook for reward logic:
  - `Record<string, ScoringWeight>`
  - `ScoringWeight` supports:
    - `ipp?: number`
    - `boni?: number`
- Scoring key semantics:
  - answer option text for choice questions
  - `"__value__"` for numeric questions

This means the app already stores reward weights on individual answer outcomes. The future points-based `Prämien` page should build on this instead of inventing a second unrelated scoring source.

## Where Bonus Values Are Authored

### Module editors

- [src/components/admin/ModuleEditor.tsx](src/components/admin/ModuleEditor.tsx)
- mirrored in:
  - [src/components/admin/FlexModuleEditor.tsx](src/components/admin/FlexModuleEditor.tsx)
  - [src/components/admin/BillaModuleEditor.tsx](src/components/admin/BillaModuleEditor.tsx)
  - [src/components/admin/SpezialfrageEditor.tsx](src/components/admin/SpezialfrageEditor.tsx)
- `QuestionScoringSection` exposes `IPP` and `Boni` inputs.
- Choice questions:
  - one row per answer option
  - per-option editable `ipp` and `boni`
- Numeric questions:
  - factor model via `"__value__"`
  - `Wert × <ipp>` and `Wert × <boni>`

This is the key authoring flow the user referred to as the place where bonus values are set. Those `boni` values are the best existing source for the future point system.

## Where Bonus Values Are Surfaced In Admin

### Questionnaire summaries and lists

- [src/app/admin/fragebogen/page.tsx](src/app/admin/fragebogen/page.tsx)
- mirrored in:
  - [src/app/admin/flexbesuche/page.tsx](src/app/admin/flexbesuche/page.tsx)
  - [src/app/admin/billa/page.tsx](src/app/admin/billa/page.tsx)
  - [src/app/admin/kuehlerinventur/page.tsx](src/app/admin/kuehlerinventur/page.tsx)
  - [src/app/admin/mhd/page.tsx](src/app/admin/mhd/page.tsx)
- Current read-only visualization:
  - option pills like `IPP 2`, `Boni 1.5`
  - numeric factors like `IPP ×2`, `Boni ×1.5`
  - section-level pills indicating whether a question has IPP and/or Boni scoring

Important implication:
- bonus metadata already exists at question and answer level
- what is missing is a central page that aggregates, organizes, and explains quarter reward logic

## Current Storage And App Architecture

### Questionnaire/module storage

- [src/context/ModuleContext.tsx](src/context/ModuleContext.tsx)
- [src/context/FragebogenContext.tsx](src/context/FragebogenContext.tsx)
- Modules and Fragebögen are currently stored in client-side React context state.
- No persistent backend model exists yet for reward programs or quarter definitions.

### Admin navigation and route placement

- [src/components/ui/AdminSidenav.tsx](src/components/ui/AdminSidenav.tsx)
- Navigation currently has:
  - a `Fragebögen` group
  - a second general admin group (`Mitarbeiter`, `Statistiken`, `Einstellungen`)
- The user asked for `Prämien` outside the questionnaire-themed block, below it.
- The cleanest IA fit is a new nav item in the second group, likely above `Mitarbeiter`.

### Admin page title handling

- [src/app/admin/layout.tsx](src/app/admin/layout.tsx)
- `pageTitle` is currently route-based and does not yet know about `/admin/praemien`.
- The new page will need a route-aware title branch.

### Admin root redirect

- [src/app/admin/page.tsx](src/app/admin/page.tsx)
- Root admin still redirects to `/admin/fragebogen`.
- No special change is implied by the request, but it matters that `Prämien` will be a sibling admin route, not the default landing page.

## Existing UI Patterns Worth Reusing

### High-quality admin page shell

- [src/app/admin/fbmanagement/page.tsx](src/app/admin/fbmanagement/page.tsx)
- Large white cards, subtle borders, soft shadows, compact filters, anchored overlays.
- Very strong reference for:
  - dense information cards
  - comparison summaries
  - professional SaaS admin surfaces

### High-quality creation flow shell

- [src/app/admin/fbmanagement/neu/page.tsx](src/app/admin/fbmanagement/neu/page.tsx)
- Strong reference for:
  - structured multi-step creation flow
  - section headers and helper copy
  - elegant date picker and selection cards
  - red gradient primary buttons with glossy inset/ring treatment

### Existing reward modal design language

- [src/components/dashboard/BonusDetailModal.tsx](src/components/dashboard/BonusDetailModal.tsx)
- Good design ingredients to transplant into admin:
  - threshold track / progress logic
  - current-state summary
  - breakdown by pillar
  - “what is missing until next threshold” explanation

## Key Product Gaps The New Page Must Solve

The current app can:
- assign `boni` values to answers
- show a GM-facing reward teaser and modal

The current app cannot:
- define a quarter reward program as an admin object
- map a quarter to multiple campaigns/questionnaires clearly
- show all four pillars and all bonus-relevant questions in one place
- simulate or explain how answer-level `boni` values roll up into a quarter reward
- switch from percentage framing to a points model

## Strong Planning Implications

### A successful `Prämien` page should likely include:

- quarter selector / creator
- high-level reward definition card
- 4-pillar structure editor or overview
- campaign/questionnaire source mapping
- bonus-relevant question explorer
- points roll-up / threshold preview
- GM-facing preview panel
- warning states for missing scoring, empty pillars, or duplicate coverage

### The most important architectural decision

The page should treat existing `question.scoring[*].boni` values as the source inputs, and the new quarterly reward builder as the orchestration layer on top of them.

That keeps the mental model clean:
- questionnaire editors define answer-level reward points
- `Prämien` defines how a quarter groups, weighs, previews, and explains them

## Conclusion

The app already contains:
- a GM-facing 4-pillar reward explanation
- a questionnaire-level bonus value system
- strong admin UI patterns for polished creation/configuration surfaces

The missing piece is a dedicated admin orchestration page that connects those three layers into one coherent quarter builder for `Prämien`.

## Implementation Update — Distributionsantworten im Kalenderquartal (03.09.2026)

The runtime behavior for already answered distribution questions is now defined independently from reward-wave activation and reward calculation:

- only exact `Distributionsziel` source mappings receive quarter-long answer reuse;
- the source must be a valid answer from a submitted visit by the same GM in the same market for the same question ID;
- the newest qualifying answer is inserted as the filled, editable answer in a newly created visit, including its comment;
- the boundary is the `Europe/Vienna` calendar quarter, not the RED month and not the wave start/end interval;
- a wave that spans two calendar quarters can identify the same distribution questions in both quarters, but no answer crosses from the earlier quarter into the later one;
- all other questions retain the existing RED-month behavior;
- draft/active wave configuration may identify the relevant question IDs without activating a wave or changing bonus calculation.

The implementation performs current-snapshot validation before copying an answer, so a changed question type or no-longer-valid option leaves the new question empty. Existing draft visits are not retroactively rewritten. No schema or production-data mutation is required.

The maintained source of truth is [`docs/gm-distribution-quarter-answer-persistence-living.md`](docs/gm-distribution-quarter-answer-persistence-living.md).
