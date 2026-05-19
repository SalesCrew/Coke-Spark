# Full-Stack Logging Coverage Checklist

## Backend request/action coverage

- [x] App-level request lifecycle logs include `action`, `result`, `statusCode`, `requestClass`, and `durationMs`.
- [x] App-level error response uses resolved status code and keeps one-error-one-log behavior.
- [x] High-volume read routes stay aggregated/suppressed (`markets`, `campaigns`, `users`, `fragebogen/modules`, selected GM reads).

## Core mutation domains

- [x] `auth`: login + refresh now emit structured success/reject/failure logs with timing.
- [x] `admin-users`: create/update/deactivate emits route-level and endpoint-level logs.
- [x] `markets`: import/create/update/delete/normalize emits structured action logs and import progress summary.
- [x] `campaigns`: create/update/delete/assign/migrate/remove/switch emits structured action logs.
- [x] `fragebogen`: mutation middleware + duplicate flows emit structured action logs with duplication context.

## Remaining route families

- [x] `gm-visit-sessions`: mutation/read completion logs + submit side-effect failure logs.
- [x] `day-session`: mutation completion logs.
- [x] `time-tracking`: mutation completion logs.
- [x] `praemien`: mutation/read completion logs + migration logs moved to structured logger.
- [x] `admin-lager`: mutation completion logs.
- [x] `ipp`: admin read action logs.
- [x] `red-month`: read + admin config action logs.
- [x] `admin-zeiterfassung`: admin read action logs.

## Side-effect libraries/schedulers

- [x] `ipp-finalizer`: run/skip/failure + queue item failures use structured action logs with timing.
- [x] `bonus-finalizer`: finalize completion + KPI recompute failures use structured action logs.
- [x] `red-month-calendar`: refresh/scheduler success/failure logs include action/result/timing.

## Frontend telemetry

- [x] Added `src/lib/clientTelemetry.ts` with sanitization + dedupe before send.
- [x] Added backend ingestion endpoint `POST /telemetry/events` with auth, sanitization, and dedupe summary.
- [x] Wired critical API action points through `authedFetch` (all mutations + selected critical reads).

## Validation

- [x] Backend type/build check passes (`npm run build` in `backend/`).
- [x] Frontend type/build check passes (`npm run build` in workspace root).
