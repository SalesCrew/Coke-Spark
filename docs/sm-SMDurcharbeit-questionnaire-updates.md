# Durcharbeit questionnaire updates — 2026-10-19

## Confirmed problem

Campaign months retain a published questionnaire version, whose module links are also frozen. Saving a module publishes a new module version but does not publish another questionnaire version. The admin card resolves stable module IDs to current module contents, so its display can look newer than the actual campaign graph. Pinned Durcharbeit starts intentionally retain retired question roots in the selected historical graph. Refreshing the phone does not change those server links.

## Intended behavior

On Durcharbeit Verplanung, the selected active/future campaign month shows a compact update prompt when either a newer questionnaire version exists or its modules have newer published versions. Reads do not publish or assign anything. A review dialog compares current/new question totals and added/removed/changed questions, identifies the month and states that existing visits retain their original snapshots. Confirmation adopts the newest contents of the same questionnaire for new visits in that selected month. If module-only edits have not yet been packaged, confirmation first creates a new published questionnaire version using the latest published module versions. No change happens on dismissal.

## Implementation boundaries

- Existing storage and version links suffice; no migration or backfill. Deployment does not adopt a new version for any real campaign.
- New read-only preview and explicit PATCH confirmation use existing SM campaign read/update permissions.
- Confirmation coordinates with SM authoring and visit starts, checks campaign revision and a content/state-bound preview token, and records an audit event.
- Closed months, ended/archived campaigns and unavailable or empty candidate contents cannot change. A current month may update even after visits have started because only its future-start version pointer changes.
- Existing drafts resume their original graph. Completed answers/photos/times remain unchanged. Existing follow-up reuse already matches exact question-version IDs, so changed/new questions start blank while unchanged questions may carry over safely.
- Other campaign/month assignments are unchanged. GM and standard-SM authoring are unchanged.

## Verification plan

Use only disposable synthetic DBs and explicit isolated routes. Cover module-only changes/deletions, newer published questionnaires, cancellation/no-op, protected history, resume/new start/follow-up, stale previews/revisions, wrong campaign/month, concurrent starts, invalid/unavailable versions and customer permissions. Build frontend/backend and inspect the prompt/confirmation on laptop widths; employee verification uses phone dimensions. No production-connected app tests or environment files.

## Visual plan (deslopify)

Keep the existing laptop admin composition, table, month selector and actions. Put one neutral white update row directly below the monthly toolbar; no coloured card background, stripe, badge or decorative icon. Lead with “Neue Fragebogenfassung verfügbar”, then current/new question totals and the questionnaire name. The only action is “Änderungen ansehen”. The row appears only when action is relevant or a read failed.

The review dialog reuses the page's typography, neutral borders, 7px buttons and compact spacing. A quiet campaign/month line anchors context. Two aligned columns compare the assigned and new versions and question totals; a single compact line summarizes added/removed/changed questions. Explain that confirmation applies to new visits for this month, with the number of existing drafts/completed visits retained. Use “Beibehalten” and the existing blue “Neue Fassung übernehmen” action. Escape/dismissal retains the current version and restores focus. Check stale/error, read-only, empty/no-update and confirmation states at laptop widths. Source history and production remain untouched until an authorized human confirms through the shipped UI.

User authorized code deployment after isolated verification. This does not authorize automatically adopting versions on production campaigns.

## Verification results — 2026-10-19

- Native disposable PostgreSQL 16, no production configuration: **48 passed, 0 failed, 0 skipped** across questionnaire-update, monthly-concurrency, owner-edit, report and transition integration suites. Covers module-only deletions/edits, explicit publication/adoption, current-month/new-visit submission, unchanged drafts and completed photo/answer graphs, follow-up reuse by exact question version, independent campaigns/months, permissions, stale previews, start/adoption races and competing confirmations.
- Disposable PGlite regression: campaign-market editing passed. The broader monthly suite retains its previously recorded dated-profile assignment assertion failure (`SMDurcharbeit-monthly.integration.test.ts:281`, expected 1, actual 0); unrelated to this patch.
- Frontend production build and backend production TypeScript build passed. Scoped React/TypeScript lint passed without warnings.
- Laptop browser: 1440×1000 and 1280×800; review, dismissal, Escape/focus restoration, confirmation, success and independent campaign notice inspected. Optimized production build also exercised against the disposable API.
- SM phone: 390×844; a new visit after adoption renders **V2 / 4 questions**, including the updated graph. Existing seven-question drafts/history are retained by the integration suite. No real visits were opened or changed.
- Existing frontend target-view, market-selection and report-export checks passed. Six older market/planning UI checks fail identically at unmodified production baseline `b1a3f39` (obsolete customer-access mocks and old page-key expectations); these were not changed as part of this feature.

## Release

Backend commit: `1dbb72c` (`Allow reviewed adoption of latest Durcharbeit questionnaire by month`). No migrations or business-data adoption are part of deployment. Roll back frontend first, then backend if needed; any human-confirmed questionnaire publications and visit snapshots remain immutable.
