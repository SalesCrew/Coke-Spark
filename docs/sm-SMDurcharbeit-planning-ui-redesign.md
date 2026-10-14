# SM Durcharbeit Verplanung: admin UI refinement

## Scope and safety

Keep campaign creation, publication, month selection, market inclusion/exclusion, monthly SM overrides, protected visits, results, export and audit history. This is a frontend presentation change. No schema changes, production queries or production data writes. Verify only on the disposable synthetic preview at 3037/4037. The production-connected local app is for the user's manual review only; its backend must start without scheduled jobs. The initial request held the release for manual review; the user subsequently approved pushing this redesign on 14 October 2026.

## App research and diagnosis

Read the deslopify skill and inspected the rendered normal SM Verplanung and current Durcharbeit Verplanung, plus their components and shared admin controls.

- Normal Verplanung uses compact 32px controls, restrained borders, a light gray outer table frame and a white inner surface. Durcharbeit currently has larger separate cards and a second toolbar below the page header. Use the established density and containment to make the pages feel related.
- Campaign identity, dates and actions spread over a tall card. Group them in a compact campaign header with localized dates and an explicit text status; retain every existing action and its permission checks.
- The month selector is separated from the table filter, while the table header contains little context. Bring month and market status into one toolbar, with the existing completion/exception/visit counts immediately below it. Keep these counts tied to the selected month.
- The campaign list becomes another full-width block at intermediate widths. Use a compact existing custom campaign dropdown when the side-by-side layout cannot fit; retain the full list on wide admin screens.
- Reports and history should use the same section headers and borders as the workspace. Preserve lazy loading, filtering, export and history pagination.

## Implementation

1. Add a scoped CSS module for this workspace and its report/history surfaces; reuse the existing admin dropdown and calendar components, icons, typography and button finish.
2. Refine campaign navigation, header, draft creation and monthly market table without changing request payloads, endpoints, locking or history rules.
3. Align report/history headers and disclosure indicators. Preserve all meaningful explanatory copy and statuses.
4. Verify laptop layouts at full and narrower window widths, keyboard focus, dropdowns/dialogs, campaign creation, monthly selection, exceptions, SM switching, result filters and audit expansion on synthetic data.
5. Run scoped lint, TypeScript and a clean environment build. Then start frontend 3000 and backend 4000 for human manual use with background write jobs excluded from backend startup.

## Regression boundaries

Do not touch GM filters, sidebar behavior, normal Verplanung, customer permissions, calculation semantics, backend data contracts or historical records. Table comparison remains a table with a labeled local scroll region when the laptop window is narrowed. Never hide actions solely to make a screenshot sparse. No dependency additions or production migrations.

## Device scope clarified by the user

Admin UI is verified on laptops. SM employee UI is for phones; GM employee UI is for iPads. Stop mobile admin verification. This refinement changes only the admin Durcharbeit workspace.

## Verification and local review

- Clean frontend TypeScript check and production build passed without production environment files.
- Scoped React/TypeScript lint passed for all four changed TSX components; no backend files changed.
- Seven existing selection, target-state and serialized report-export regression tests passed in a clean environment.
- Rendered full laptop (1440×1000 and 1280×800) and narrower laptop window (960×900) states. Inspected campaign/header/table geometry, monthly counts, future-month controls, report results and audit history.
- In the synthetic preview, created and reloaded a campaign draft using only filtered SPAR markets, saved a monthly SM override and a single-month market exclusion; both reloaded correctly. The next month controls, market-edit preview, modal dropdowns, Escape dismissal and focus return remained functional.
- Human frontend is running on 3000 and backend on 4000 in a separate local runtime copied from the latest production source plus only this UI patch. Private configuration stays outside source control. The backend bootstraps createApp directly and never starts index.ts or its schedulers. Agent checks did not access this production-connected app.
- Initial local review involved no push, migration or production data changes. Cross-browser and assistive-technology conformance were not assessed.

## Approved release

On 14 October 2026 the user approved pushing this frontend refinement. Release only the four workspace/report/history/editor TSX files, their scoped CSS module and this document. The backend revision, database schema, business data, historical records and all unrelated pending changes remain outside this patch. Production verification is restricted to Git and Vercel deployment metadata.
