# SM dashboard filters — 2026-10-15

Status: implemented locally; not pushed or deployed. No schema migration or production access.

## Approved scope

- Remove the questionnaire-type selector from the SM admin dashboard.
- Keep the existing custom controls, dates, cards and dashboard layout. Place the wider Markt control between Handelskette and Shelf Merchandiser.
- Region, chain, market and SM options respect the other selected dimensions. The most recent selection takes priority; retain compatible selections and clear incompatible ones.
- Apply the same combined query to the existing summary, category, chain and region calculations. The existing workbook exports that returned payload.
- Keep Durcharbeit-only markets out of this standard dashboard. Keep genuine Stammmärkte that also occur in Durcharbeit.
- Leave GM filters, employee dashboards, answers, historical assignments and questionnaire configuration unchanged.

## Market and SM relationships

The default admin API scope is now `standard`; the frontend sends that scope explicitly. The existing explicit `SMDurcharbeit` API scope remains supported. Standard results use standard questionnaire submissions; a Durcharbeit submission on a shared market does not enter the standard totals.

Registry membership alone is insufficient to exclude a market. Existing standard membership is recognized from a weekly service schedule, a nondeleted standard assignment, or nondeleted standard submission history. These membership checks are independent of the reporting period, so a shared Stammmarkt remains selectable in an empty period. No membership flags or records are rewritten.

SM choices include the market's current directory owner, effective noncancelled assignments in the reporting period, and original submitters of current, reportable submissions in that period. A later reassignment therefore does not hide or reattribute earlier visits. Unvisited directory markets remain available. Names are labels; filtering and deduplication use stable IDs.

The backend returns market relationships along with faceted choices. The frontend uses those relationships to update the existing dropdowns immediately and reconciles selections if a date/directory change invalidates them. Each facet ignores its own value while respecting the other dimensions, allowing alternatives within the chosen context.

## Verification

All verification used an empty environment and disposable synthetic databases; neither production environment files nor the normal human localhost app were used. Synthetic questionnaire creation, visit start, OOS answers and submit routes populated the disposable database. Subsequent dashboard GETs were checked against byte-for-byte business-record snapshots.

- Frontend: 9 helper/skeleton tests passed, including bidirectional facets, historical SM links, latest-selection precedence, stale selections, duplicate names and retained date bounds.
- Backend: 38 scoped tests passed, including the actual dashboard router, positive OOS counts, combined filters, date bounds, unvisited markets, three shared-market cases, Durcharbeit-only exclusions, permissions, frozen visits, and phone dashboard regressions.
- Backend and frontend TypeScript checks passed.
- An optimized frontend build passed against `origin/master` plus only these frontend changes, with an explicitly synthetic backend URL and no environment files. This also checks compatibility with the already-shipped changes outside this task.
- Browser: custom dropdown combinations, keyboard selection and Escape, reset, empty results and the filtered workbook were checked on the synthetic preview. Laptop widths 1280, 1440 and 1600 had no page overflow; Markt remained wider than the adjacent controls. No admin mobile testing.
- The filtered workbook contained one Spar/Nord visit, matching all on-screen cards and tables.
- Scoped lint passed with the existing `react-hooks/set-state-in-effect` rule disabled for the existing fetch effect. Its synchronous loading/error state lines are unchanged from HEAD; no global lint configuration was modified.

Preview: `http://127.0.0.1:3037/admin/sm/dashboard`, synthetic backend `4037`. Disposable login: `sm-admin@preview.test` / `preview`.

Standalone preview entry point: `backend/tests/sm-dashboard-filters-preview.ts`; it rejects production configuration through the underlying fixture and starts no scheduled jobs.

Production data/configuration, deployments, and empirical production query performance were not verified. Other meeting requirements (new KPIs, basic-work scoring, time aggregation and availability/lift presentation) remain separate work.

## Follow-up: compact single-row toolbar

At Kilian's request, reduced date controls from 138px to 106px and capped Markt at 260px (about 29% below the previous 366px wide-laptop rendering). Markt remains wider than the other dropdowns, which cap at 180px. Removed the toolbar's two-row breakpoint; the reset action stays right-aligned in the same row. Other responsive dashboard rules and all filter/query logic are unchanged.

Checked 1280px, 1440px and 1600px laptop widths: all seven controls share the same vertical position, neither date nor reset text clips, and there is no page overflow. Region-to-market filtering and reset still work. The updated optimized frontend build passed. This follow-up changes toolbar CSS only; no additional test suite or production access was needed.
