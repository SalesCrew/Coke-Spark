# SM Durcharbeit UI review — 2026-10-09

## Scope and data boundary

This pass refines the recent local monthly-campaign work. All browser evidence comes from 3037/4037, with disposable synthetic data. No production environment, connection, query, migration, deployment or historical record is involved. The original GM controls and normal human localhost are untouched.

Latest user correction: the summary is a normal dashboard component below the calendar, not part of the fixed Home dock. It fills the available height, keeps its full-page link, and does not move when Home expands. On short phones the overview/calendar region scrolls independently, leaving room for the 160px summary and the closed Home button.

## Research digest

The recurring problem in generated interfaces is weak product hierarchy: every item receives similar emphasis, repeated containers stand in for organization, and visual polish hides incomplete states. This is a useful review lens rather than a claim that all AI-created interfaces look the same.

- [Design deslop reference](https://github.com/dammyjay93/interface-design/blob/main/.claude/commands/design-deslop.md): inspect the rendered composition first, then inspect the changed code. Give the main task precedence; restrict accents to meaningful actions/status; reuse established controls and preserve behavior.
- [Impeccable](https://impeccable.style/): provides design vocabulary and anti-pattern guidance for agents. Adopt the principles relevant to this existing app rather than imposing its demo aesthetics.
- [NN/g: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/): favor relevant information and clear signifiers; disclose detail when needed. Minimalism should preserve discoverability, not hide useful actions.
- [DesignCoder research](https://arxiv.org/abs/2506.13663): investigates hierarchy-aware generation and self-correction. It supports reviewing structure and rendered output; it does not establish that any particular visual style is universally superior.
- [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): check actual interactive areas and readable text, rather than treating tiny pale text as visual refinement. The AA target minimum is 24 CSS pixels with exceptions; primary mobile actions in this pass aim for at least 40–44 pixels.

## Findings and decisions

| Before | Change | Purpose |
| --- | --- | --- |
| Full monthly market list on Home can extend behind the fixed menu | Responsive month/progress card in the dashboard; full list at `/sm/durcharbeit` | Every market stays accessible without coupling the card to menu expansion |
| Filters and campaign details compete with today's visits | Filters move with the full list; one current-month summary remains on Home | Progressive disclosure without removing functionality |
| 8–10px text and faint metadata on recent screens | Readable title/body/meta hierarchy and stronger contrast | Reduce squinting, preserve dense admin layouts |
| Repeated blue icon tiles and nested question boxes | Restrained blue actions/status, neutral rows and spaced sections | Clarify content hierarchy without decorative containers |
| One-off navigation markup | Reuse the current SM Home menu through a small shared navigation component | Same menu, inbox and logout behavior on both routes |

## Behavior that must stay intact

Current-month counts exclude waived targets. Search does not alter total progress. Market rows keep start, resume, follow-up, closed-month history and unavailable-state rules. Reassigned users cannot navigate to a former owner's receipt. Future/closed months cannot start new work. Owner-scoped fetching, delayed-response guards, month rollover, periodic refresh, pagination, answers, inherited-photo provenance and historical time revisions remain wired to their existing APIs. No backend or schema changes are needed.

## Verification

Completed locally with synthetic fixtures:

- Frontend TypeScript check passed; scoped lint of the 12 new/refined view and hook files passed; both repository diffs passed whitespace checks.
- Target action/progress, account-switch transport, paused ownership and actual-time regressions: 21 passed. Existing SM dashboard/loading/date/identity regressions: 17 passed.
- Browser Home at 470×853: compact entry height 64px, bottom 781px, menu top 789px; both fully visible, no horizontal overflow. The same 8px separation holds for the expanded menu.
- At 390×844 and 320×568, compact entry, list and inbox remain inside the viewport. The small-phone inbox initially exposed insufficient reserved height; the SM inbox now respects a Home-only CSS variable for the additional dock space. The expanded Kurti panel is also capped only on SM Home: at 320×568 the entry is at 64–128px, the panel at 136–544px, and its composer remains visible. No message was sent; the synthetic backend does not implement Kurti, so this verifies panel geometry rather than chat service behavior. The existing GM menu path is unchanged.
- Keyboard Return opens Home navigation; Escape closes the inbox. Opening/closing preserves two unread synthetic messages. No read receipt was submitted.
- Full page has three current targets, progress 1/3, and usable whole-row links. Searching Park produces one row while progress stays 1/3. November shows 0/3 and planned rows with no Start links. Start preparation and its back button return to the correct page.
- A synthetic manual follow-up exercised the actual new-page → start → inherited-answer → retained-photo flow. Discarding that isolated draft left the two earlier submitted visits, one completed monthly target, one original photo and 20 actual minutes unchanged in the admin report. Production was never involved.
- Admin 1100×840 breakpoint: campaign list, targets, lazy monthly results and audit history render correctly. Results remain 1/3 (33.3%) coverage, 2 visits, 20 minutes, 1 photo original and 100% Ja for the one answered required market. The extension dialog was opened and cancelled without saving.
- Recent monthly time rows use readable 13px market / 11px metadata, plain status text and original/current history; original dated-row styling remains unchanged. Visit exit language refers to a visit for monthly targets, and historical/photo provenance remains visible.

Screenshots are in `outputs/sm-ui-review/cleanup/`. They are explicitly synthetic preview evidence, not production screenshots. Both preview services remain available; no backend source/schema changes, production query, migration, push or deployment occurred during this pass.

## Follow-up: inline responsive card

This replaces the fixed 64px entry described in the initial verification above. TypeScript, scoped lint of the two changed components and whitespace checks passed again. On 390×844 the inline card is 198px high and ends at 752px, with Home starting at 780px. At 320×568 it contracts to 160px, ends at 476px and Home starts at 504px. There is no horizontal overflow. The short-screen overview scrolls to expose the full calendar; opening Home changes only the menu geometry and leaves the card at 316–476px. It is not a descendant of the fixed menu. Clicking the card still opens the full Durcharbeit page. No domain logic or data writes changed.
