# SM Fotoarchiv — isolated verification

Verified on 7 October 2026. Local work only; nothing committed, pushed or deployed.

## Verdict

All 94 automated checks passed, the actual employee-to-admin browser flows passed, and both backend TypeScript and optimized frontend Webpack builds passed. No known failing scenario remains in the tested scope. This is evidence for the application logic and UI; it does not certify untested live infrastructure or guarantee absence of every possible defect.

Two infrastructure limits remain: the in-app browser did not expose the saved ZIP download file, and production storage permissions/CORS were not queried. ZIP structure, original bytes and filtered contents were verified independently through the actual archive endpoints and export helper, and the installed Supabase SDK signing contract was tested with synthetic responses.

## Isolation and data preservation

- Disposable in-memory PGlite database; synthetic users, markets, assignments, answers and images only. Each integration fixture creates its own database.
- Existing route code and migrations run only inside that disposable database. Real auth, database and storage modules are substituted before loading the routes. No production application entrypoint or scheduled write job is launched.
- Fixtures reject production database/service-role configuration. No production `.env` file is loaded, copied or included in artifacts.
- Browser preview: frontend `127.0.0.1:3037`, synthetic backend/storage `127.0.0.1:4037`. Human `localhost:3000/4000` remains untouched.
- Archive list/facets/signing/export preserve an identical before/after snapshot of **every public table** in the isolated database. Current answer corrections retain original files and previous answers. Historic visit/question/market snapshots survive current catalog, staff and market lifecycle changes.
- This archive feature requires no schema change, migration, backfill or photo copying. The earlier local Durcharbeit feature has separate additive draft migrations; those were exercised only in the disposable fixture and were not applied to production.

## Automated coverage

| Area | Verified behavior |
| --- | --- |
| Complete visit flow | Module and questionnaire creation, assignment/override, start, saved answers, photo initialization/presigning/commit, submitted visit, archive reads and export |
| Classification | Standard and Durcharbeit; Durcharbeit questionnaire override in an ordinary market |
| Filtering | Type, SM, market, questionnaire, date boundaries, combinations, literal text search and SQL-like input; Vienna midnight |
| Pagination | Deterministic ordering; 251 real synthetic photos across nine pages; no duplicate or missing photo IDs |
| Authorization | Every endpoint rejects missing auth, employee, GM and customer access; `admin` and `sm_admin` allowed; arbitrary IDs/storage paths cannot be signed |
| Input limits | Invalid UUIDs/dates/scope/query keys, reversed date ranges, page/page-size bounds and maximum 60 IDs per signing call |
| Storage | Ten-minute URL lifetime; partial/missing objects, service exceptions, actual eight-second timeout and subsequent recovery; installed SDK response mapping |
| Visibility/history | Only current submitted/applicable/answered photo answers and referenced nondeleted files; excludes drafts, hidden questions, deleted snapshots, staged files, malformed photo answers and superseded revisions |
| Export | Full filtered selection, exact 250-photo boundary, 150 MB bounds using both metadata and actual downloaded bytes, original-byte integrity, matching manifest IDs/metadata and separate type folders |
| Export failure | Missing URL or failed original produces no partial ZIP; empty/oversized selection fetches/saves nothing |
| Export safety | CSV formula escaping, quotes/newlines, filename traversal/collision handling, URL batches 60/60/10 and at most four concurrent downloads |
| Account changes | Stops work before/while signing or downloading; no ZIP save and no subsequent parallel downloads after owner change |
| Nearby regressions | Durcharbeit catalog, assignment overrides and markets; management/employee visibility; visit timing; safety UI and question subheadings |

The focused integration/export suite reports 78 passing tests including nested subtests; the additional management/visibility/safety/subheading suite reports 16. Total: **94 passed, zero failed**. This is not a claim that every unrelated repository test was run. Opt-in tests that load a live database configuration were excluded.

## Browser checks

1. A synthetic employee completes a Standard visit. Required-photo validation prevents advancing with no photo. A generated PNG uploads through the actual chooser, survives reload and appears in the saved submission.
2. A Durcharbeit visit in an ordinary market shows the correct questionnaire identity at start, questions, review and receipt. Multiple upload works; removing one draft image leaves only the retained photo in the submitted answer and archive. Typed times submit a valid fifteen-minute visit.
3. The admin archive includes both newly submitted visits, the correct type and metadata, and no removed draft photo. Dashboard completed-visit counts agree with the synthetic submissions.
4. Type + market + SM + questionnaire filters narrow to the expected record. An excluding date range yields the empty state; empty export gives a clear error; reset restores results.
5. Grid/list views, full-image navigation and completed-questionnaire deep links work. Detail dialog Tab/Shift-Tab focus wraps, Escape closes, and focus returns to the initiating card.
6. Controlled preview-only failures cover list/facet/signing errors, missing signed URLs, visible retry/recovery and loading skeletons. A delayed Standard response cannot replace newer Durcharbeit results.
7. Three-page UI navigation works; when the response shrinks from 61 to five synthetic records, refresh automatically returns from page three to page one. The 61-row UI simulation uses memory only; separate integration tests use 251 actual synthetic saved photos.
8. Browser ZIP generation reports success for all five and filtered two photos. Saved-file handoff remains unobserved; complete ZIP contents are covered by the API-to-export tests above.

The preview-only fault router is imported exclusively by `backend/tests/SMDurcharbeit-preview.ts`, never by the production app. It is currently reset to normal mode. Restarting the preview resets all synthetic records; the final normal baseline contains five photos.

## Defects fixed during verification

- **Account switch during export:** prevent subsequent parallel fetches as soon as the owner changes, then discard in-flight results and prevent ZIP saving. Regression reproduced the unwanted four downloads and now observes one started request.
- **Typed visit times:** use today's local date when the existing timestamp is empty, rather than producing an invalid `T16:20` value. The actual employee browser flow now submits without requiring a calendar workaround.
- **Shrinking result set:** clamp archive pagination to the last valid page after a refresh. Verified in the final compiled browser preview.

No layout redesign or production data mutation was needed for these fixes.

## Reproduce locally

Run from this isolated worktree with no production environment variables or `.env` files. `node` below means the configured bundled Node runtime. These commands do not start the production backend.

```sh
node backend/node_modules/tsx/dist/cli.mjs --test \
  backend/src/sm-photo-archive.integration.test.ts \
  backend/src/sm-photo-storage-contract.test.ts \
  tests/sm-photo-archive-export.test.ts \
  backend/src/SMDurcharbeit.integration.test.ts \
  backend/src/SMDurcharbeit-einsatz.integration.test.ts \
  backend/src/SMDurcharbeit-markets.integration.test.ts \
  backend/src/sm-management.integration.test.ts \
  backend/src/sm-visit-time.shared.test.ts

node --test tests/sm-management.test.mjs \
  tests/sm-employee-visibility.test.mjs \
  tests/sm-safety-ui.test.mjs \
  tests/sm-question-subheadings.test.mjs

node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json --noEmit
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4037 node node_modules/next/dist/bin/next build --webpack
```

The running preview uses the optimized build and the synthetic fixture backend. Admin login: `sm-admin@preview.test` / `preview`; employee login: `sm@preview.test` / `preview`.

## Evidence

Screenshots are synthetic only, saved in the shared project-context output directory:

- `18-sm-photo-e2e-receipt.jpg`: completed Durcharbeit visit in an ordinary market.
- `19-sm-photo-e2e-archive.jpg`: seven photos after actual browser uploads.
- `20-sm-photo-unavailable-recovery.jpg`: missing-preview fallback and recovery control.
- `21-sm-photo-loading.jpg`: staged loading skeleton.
- `22-sm-photo-final.jpg`: final normal archive after fixture reset, five photos.

Absolute directory: `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui`.

## Operational tradeoffs

- ZIP preparation uses browser memory and is deliberately bounded to 250 photos / 150 MB. Larger exports require narrower filters.
- The archive shows current saved answers. Previous revisions and their retained originals remain available in FB Management.
- URL failures preserve metadata and provide refresh/retry. URLs refresh every eight minutes while the page is open; signed links expire after ten minutes.
- Live bucket authorization/CORS, network latency at real scale and production deployment configuration are outside this isolated verification. No production smoke test or data query was performed.
