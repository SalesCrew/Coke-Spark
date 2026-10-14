# Historical date ranges in admin Zeiterfassung

The main page previously sent neither `from` nor `to`. Its existing backend therefore returned today minus 30 days through today; on 14 October 2026 this excluded everything before 14 September. The RED calendar dialog manages calendar years and does not select the time tracking page's range.

The page now has Von/Bis controls using the existing admin calendar. Both day sessions and GM aggregates receive the same explicit, inclusive range and Europe/Vienna timezone. The initial range preserves the existing 30-day default. Letzte 30 Tage resets it. Existing search, edits, calculations and export period controls retain their behavior.

Both responses publish together. Changing dates hides previous rows while loading. Earlier success/error/loading callbacks cannot overwrite the newer selection; an edit completing in a previous range cannot refresh that older range. Failed requests show Erneut laden, which retries the selected range. The calendars prevent an end date before the start date.

## Data and release scope

Only the frontend page and a small range/request helper change at runtime. No backend code, RED calendar algorithms, period IDs, schema, historical records or calculations change. No migration, backfill, production query or production smoke test is required or performed. Production deployment is confirmed using platform deployment metadata.

## Isolated verification

Run with a clean environment and installed frontend/backend dependencies:

```sh
env -i PATH="$PATH" node backend/node_modules/tsx/dist/cli.mjs --test tests/zeiterfassung-range.test.ts tests/zeiterfassung-range.integration.test.ts
env -i PATH="$PATH" node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Do not source any production environment file. The integration fixture rejects production database configuration, creates the actual Drizzle schema in disposable in-memory PGlite, seeds synthetic users/days/pauses/training/RED periods, and mounts the actual backend GET routes with explicit I/O replacements. Write jobs and external calls throw. After seeding, the database is read-only and the preview rejects time tracking mutations.

Automated checks cover the original September cutoff, August history, same-day and inclusive boundary selections, December/January boundaries, empty periods, authentication, exclusion of draft/deleted sessions, agreement between both views, stale responses/errors, and late edit refreshes. A fingerprint of every database table matches before and after verification.

Browser verification on the independent 3037/4037 preview covers August day rows (3 days / 4 GM-days), August GM totals (22h 30min and 3h 45min), reset, a delayed previous range, disabled invalid end dates, empty results, and synthetic failure/retry. Request evidence confirms identical date ranges on both actual GET routes; the database fingerprint stays unchanged. Synthetic screenshots and the request/fingerprint receipt are local under `outputs/zeiterfassung-range/` and are not part of the release.

The independent backend preview entry point is `tests/zeiterfassung-range-preview.ts`. Start it through the backend's tsx runner with a clean environment; it binds only to 127.0.0.1:4037. Never start the normal backend entry point for verification. Human localhost:3000/4000 remains separate.

## Practical limit

The backend loads all entries in the selected bounded range. Very broad ranges can load more slowly. This fix intentionally keeps the existing queries/calculations and does not redesign or remap historical data.
