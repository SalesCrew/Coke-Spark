# SM Fotoarchiv

Local implementation only. No production queries, data changes, environment access or push.

The SM admin opens **Fragebögen → Fotoarchiv** at `/admin/sm/fotoarchiv`. The visual layout follows the GM archive: compact summary/filter panel, grid and list views, photo detail viewer and the existing header Photo Export action. GM code and GM archive behavior are unchanged.

Filters: all questionnaire types, Standardfragebogen or Durcharbeit, SM, market, questionnaire, visit date range and text search. Durcharbeit is determined from the questionnaire catalog scope, including overrides in ordinary SM markets; it is not inferred from the market registry. Individual filter choices load separately from photos. Images use staged, batched private URLs and lazy image loading. Skeletons, empty/error states and manual refresh are included.

`/admin/sm-photos` exposes authenticated reads to `admin` and `sm_admin`. Metadata uses frozen visit/question/section names and address snapshots. The archive includes current submitted visits, current answered photo answers, applicable questions, non-deleted files and IDs actually referenced by that answer. Drafts, deleted/invalidated records, superseded answers and staged unreferenced files do not appear. Archived templates/markets or staff changes cannot erase existing archive rows. Original photos and previous answers remain in FB Management history.

No schema change, migration, backfill, bucket change or copying of photos is required. The API joins existing SM tables only. It never reads GM photo tables. It returns no storage paths or bucket names. Signed URLs are issued only after rechecking requested photo IDs against the same archive visibility rules, expire after ten minutes, use private/no-store responses and refresh in the open UI. Storage failures show an unavailable preview and retry action.

Photo details show the visit date, SM, market/address, questionnaire/version, module, question and file metadata. The existing FB Management page accepts a validated submission link and opens that visit without changing its data.

Photo Export exports the complete filtered selection as a ZIP, separated into Standardfragebogen and Durcharbeit folders, with a CSV manifest. Original bytes are downloaded only on request. Export is bounded to 250 photos / 150 MB; larger selections ask the user to narrow filters. Missing photos fail the export instead of silently returning an incomplete ZIP. Signed URLs and storage secrets are never included in the manifest. Account changes stop further download work and prevent saving a ZIP; responses from requests already in flight are discarded.

Verification uses the isolated in-memory PGlite fixture and synthetic photo storage on 3037/4037. The fixture refuses production configuration and never imports application schedulers. Test evidence and browser screenshots are recorded below when complete.

## Verified locally — 7 October 2026

94 automated checks passed: 78 integration/export/catalog/override/storage/timing checks and 16 management/visibility/safety/subheading checks. The tests submit real synthetic photo answers through the existing visit routes, then query the actual archive endpoints. They cover type filters (including Durcharbeit in ordinary markets), combined date/SM/market/questionnaire/search filters, pagination, facets, export matching, permissions on every endpoint, ID-only signing, partial storage results, signing exceptions and the actual eight-second timeout, Vienna midnight, historical snapshots, superseded/draft/hidden/deleted/staged photos and oversized export handling. A 251-photo fixture checks all nine pages without duplicates, the exact 250-photo export boundary and every public database table before/after archive reads. ZIP tests inspect original bytes, separate type folders, CSV escaping, filename safety, failed-file handling, parallel download limits and account-switch cancellation. The installed Supabase SDK response shape was checked against a synthetic fetch implementation.

Backend TypeScript and optimized frontend Webpack builds passed. Browser verification covered actual employee photo upload, required-photo validation, reload persistence, removal of a draft photo, manual visit submission, Durcharbeit override in an ordinary market, admin visibility, combined filters, empty/reset states, grid/list/detail views, keyboard focus trapping and the completed-questionnaire link. Controlled preview faults verified metadata/facet/signing errors and recovery, missing previews, staged loading, stale-response rejection after fast filter changes, three-page navigation and page clamping after a result set shrinks.

Three defects were fixed during verification: export started additional parallel downloads after an account switch; manually typed visit times used an empty date; and a refresh could leave the archive on a page beyond the new result count. Regression checks and the final preview/build passed after the fixes. No production database changes were made.

The browser reported successful five-photo and filtered two-photo ZIP generation. The in-app browser did not expose a saved download file; ZIP contents and original bytes were independently checked through the actual archive API and automated export helper. Live Supabase bucket permissions/CORS were deliberately not probed. See [the verification report](sm-photo-archive-verification.md) for the coverage and limits.

The preview stays available at http://127.0.0.1:3037/admin/sm/fotoarchiv with the synthetic backend on 4037. Demo admin: `sm-admin@preview.test` / `preview`. Preview images are generated shelf illustrations in loopback memory; no external storage or real photos are used. Restarting this backend resets its synthetic records. Human 3000/4000 and production data are untouched.

Screenshots:
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/16-sm-fotoarchiv.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/17-sm-fotoarchiv-details.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/18-sm-photo-e2e-receipt.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/19-sm-photo-e2e-archive.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/20-sm-photo-unavailable-recovery.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/21-sm-photo-loading.jpg`
- `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/outputs/sm-durcharbeit-ui/22-sm-photo-final.jpg`

Export tradeoff: the browser prepares the ZIP in memory, so selection is limited to 250 photos / 150 MB. The photo list remains paginated and does not load full original bytes until preview/export needs them. The archive displays current answers; historical photo revisions remain accessible through FB Management.
