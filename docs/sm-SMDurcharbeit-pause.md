# Durcharbeit pause visibility — 2026-10-19

Pausing a campaign hides its contents throughout the SM interface until an administrator explicitly selects **Fortsetzen**. It does not delete, cancel, recreate or reassign visits.

- SM monthly targets, campaign/month options and progress exclude paused campaigns. Other concurrent campaigns remain visible.
- Employee visit/target links and starts (including idempotent replay), answer/photo writes and submissions are unavailable while paused. No questionnaire contents are returned through those links.
- Employee activity, requests, time entries/history and profile totals also exclude the paused campaign. Admin management, reporting, photo records and recorded hours stay intact.
- Saved local visit notices stay stored but are hidden until the server confirms availability. Monthly visit screens require fresh authorization before painting a cached graph; the separate pending-answer queue is retained.
- Visible SM pages recheck on focus/reconnect and every 30 seconds. Open activity/time details close when their campaign disappears.
- Campaign status is persisted. Passing dates, questionnaire updates and extension cannot implicitly resume it; extension's reactivation shortcut was removed. Only explicit **Fortsetzen** resumes the campaign. Original date/month eligibility still applies after resuming.
- No schema migration, backfill or automatic changes to real campaign statuses are included.

Verification uses only disposable synthetic databases and preview 3037/4037. The pause suite compares original submission/question/answer/photo/time graphs byte-for-byte across pause, extension and resume, with a second concurrent campaign left visible. It checks direct URLs, saved drafts, start-token replay, writes, employee activity/time/profile, admin reporting and photo retention. The monthly concurrency suite exercises starts racing pause on native disposable PostgreSQL.

## Verification and release

- 40 native disposable PostgreSQL integration checks passed across pause, monthly concurrency, transitions and questionnaire adoption. The final expanded pause suite (7 checks, including all campaigns paused) also passed on native PostgreSQL.
- Disposable PGlite regression: 47 passed, 0 failed, 1 native-only skip across campaign editing, ownership, pause, adoption, reporting and transitions. Frontend target/action, market-selection and report-export checks: 7 passed.
- Backend and final frontend production builds passed, including the empty-summary and fresh start-preview guards.
- Laptop admin pause/resume confirmation and SM phone UI were exercised through the synthetic preview: pausing SPAR leaves exactly the other campaign's three rows and 0/3 progress; resuming restores six rows, the saved draft and 1/6 progress.
- Scoped lint for the new/compact pause surfaces passed. Two existing prefer-const errors and legacy warnings in the shared visit workspace reproduce at unmodified baseline b1a3f39; these unrelated lines are unchanged.
- Backend commit: `b3a297f`. This code release does not pause or resume any real campaign. No schema migration is needed.
