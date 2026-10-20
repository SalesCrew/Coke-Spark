# SM photo upload recovery — 2026-10-20

## Scope and behavior

The matching production trace showed successful upload signing/preflights, intermittent missing photo PUTs from Android Chrome, successful 8.5–9 MB transfers from the same phone, and later successful smaller desktop replacements. The visit ultimately submitted. This established the failing transfer boundary; it did not prove whether the original interruption came from reception or the phone's file provider.

The SM visit uploader now:

- Reads a newly selected file into independent bytes before waiting for network calls. Large new JPEGs are reduced to a maximum 2560-pixel edge at JPEG quality 0.9 only when the result is smaller. Small photos, PNG/WebP transparency and all already saved photos are left unchanged; decode/optimization failure falls back to the stable original bytes.
- Retries network failures, timeouts, HTTP 408/429 and server failures up to three attempts with a short backoff. Permanent validation/authorization failures are not retried indefinitely.
- Keeps one storage path and prepared payload through retries. A duplicate-object response after a lost successful upload is reconciled through the existing server commit, which checks the owned path.
- Commits each successful photo immediately. A later failed photo cannot undo earlier successful files. Lost commit responses retry the idempotent commit rather than uploading again.
- Retains unsuccessful jobs in the current page, supports retry without selecting those files again, and retries when connectivity returns. An old unused signed URL is renewed after a prolonged disconnect.
- Shows a compact inline waiting state with retry and “Nur gespeicherte behalten”. That second action drops only unsuccessful local jobs after refreshing the authoritative saved photos; it sends no photo deletion or cleanup request.
- Reconciles stale local errors with server-saved photos before navigation/submission. Actual required-photo and required-comment validation remains in force. Pending questions hidden by questionnaire rules do not block submission or auto-upload in the background.
- Pins a retained job to its initiating account, including during refresh/retry. Transfer failure telemetry records stage, size and error name without signed URLs, file names, image bytes or credentials.

The existing visit ID, submission ID, question snapshots, answers, photo metadata and historical file links are not repaired or rewritten by deployment. There is no migration, backfill, import, bulk cleanup or new server job. The backend submodule pointer advances only to the already deployed answer-version fix `a399750f90fddbb84d9459e6abb786aa4a529654`; this release requires no new backend deployment.

## Verification

All tests use an empty environment, disposable PGlite, the actual SM API routes and loopback synthetic photo storage. No production connections, environment files, human localhost ports or application job entry points are used.

- Nine focused unit tests cover independent file bytes, bounded automatic retries, retained failed-file recovery, ambiguous successful uploads, commit retries, permanent errors, identity changes, unreadable gallery files and renewal of old signed URLs.
- Sixteen focused/regression tests pass including existing comment mapping, paused-visit ownership and SM time correction tests.
- The real SM page was exercised with Playwright Chromium at a 390 × 844 touch viewport, both in development and using the optimized production build. A synthetic historical visit with a saved answer/photo and an already-open follow-up were created first. The browser recovered automatically after two failed photo transfers; a 9,206,314-byte selected JPEG became a 3,257,672-byte upload. An earlier file remained committed when the next file exhausted retries; retry recovered that retained file. A lost successful PUT response produced one photo record. Reconnection automatically resumed another retained file, including a deliberately delayed final refresh that reproduces a reconnect arriving while the failed queue is still finishing. Dismissing an unsuccessful file issued no DELETE requests. A stale local error did not prevent valid saved photos from proceeding.
- That same follow-up visit submitted with its original visit/submission IDs, six visible photos, the same saved text answer and an unchanged historical graph. The original historical photo's SHA-256 stayed identical. No uncaught browser errors or horizontal overflow were observed.
- TypeScript and the optimized production build pass with synthetic loopback configuration.

Fixture: `tests/sm-photo-upload-preview.mts` on 4038. Frontend preview: 3038 with `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4038`. Browser test: `tests/sm-photo-upload-browser.mjs`, using a local Playwright installation (or its path via `PLAYWRIGHT_MODULE`). Focused unit command: `npm run test:sm-photo-upload` with production variables absent.

## Limits and rollout

The browser verification uses desktop Chromium with a phone-sized touch viewport, not the employee's actual Android device or network. Failed file bytes remain in the current page; closing/reloading the page or an unreadable gallery file can require selecting only those unsaved files again. Already committed answers/photos remain available in the same visit. An old open tab must load the new frontend release to receive the new uploader; users must resume the existing visit rather than discard/start over.

Only deployment state/aliases are checked on Vercel after publishing. No agent smoke test, business endpoint request or database verification is performed against production.

Implementation references: [Blob byte snapshots](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [image decoding and orientation](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [Supabase standard uploads and duplicate-object behavior](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
