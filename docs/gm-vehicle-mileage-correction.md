# GM vehicle changes and retrospective mileage correction

Status: implemented locally, no push/deploy. The user explicitly authorized only the schema migration on 2026-10-19. It was applied successfully; only schema/migration metadata was inspected. Production business data has not been queried or changed by the agent.

Human review: http://localhost:3000/admin/zeiterfassung, backend localhost:4000. Runtime source and safe startup scripts are under the project context runtime/gm-vehicle-mileage-20261019 folder. Import createApp directly; do not start src/index.ts. Scheduled jobs are disabled.

Applied migration ledger name: `gm_vehicle_mileage_history`; server-assigned version `20261019150046`. Local artifact SHA-256: `fd4045defce01212c10c7a69848c7ebdc6bf460b9a6df5c572cae7cb5d96e915`. Catalog checks confirm RLS, no anon/authenticated table access, two enabled safeguards, and all three indexes valid/ready. No existing kilometre values were backfilled or corrected. Production app code remains unchanged until a separately requested deployment.

## Placement and behavior

Admin → Zeiterfassung → GM day → **Fahrzeugwechsel nachtragen**, below the existing start/end readings. The existing pencils open the same correction dialog for already-corrected days.

Choose the rental-car period, enter the correct first start reading, and apply it to the period. The offset shifts each day's start/end equally, preserving daily driven distance and same-car overnight gaps. Every proposed reading remains individually editable. Missing readings and multi-vehicle days must be edited explicitly; they are never guessed. Add a second vehicle section for a change during a workday.

The preview compares effective business/private kilometres for the period plus its immediate neighbours, independent of the dashboard date filter. Saving replaces the effective day readings transactionally. Original values, segments, vehicle-boundary flags, actor, reason, batch ID and date are retained as append-only events. Work times, status, visits, pauses and extra time entries are untouched.

`Anderes Fahrzeug ab erstem Tag` marks a change before the first day. Leave it off if the first day begins in the original car and contains a later switch. `Rückwechsel nach letztem Tag` marks the return to another odometer after the period. Leave it off if the same car continues. Existing flags are retained on reopening a corrected day.

## Calculation

- One-car business distance: end reading − start reading.
- Two/multiple-car day: sum each vehicle's end − start. Never subtract across vehicles.
- Private kilometres: positive next-day start − previous-day end, only across a continuous vehicle boundary.
- Vehicle changes contribute no artificial private kilometres. Normal gaps between days in the same car remain counted.
- Unsubmitted intermediate days carrying a vehicle change also interrupt odometer continuity.
- GM/admin totals, day statistics and Zeiterfassung export driven-km cells share this calculation. The GM label now reads **Dienstliche Kilometer**, because this value is business distance.

Synthetic example: original readings 22,500→22,600 and 22,615→22,735 are corrected to 5,000→5,100 and 5,115→5,235. The 100/120 daily business distances and 15 overnight private kilometres stay intact. Both vehicle boundaries are excluded from private-km comparisons. Neighbouring days and their raw readings remain unchanged.

## GM entry

The existing “Neues Fahrzeug?” action now saves a real vehicle change. Before-work mode records the new odometer start/end and a boundary before the day. During-day mode records the original car's last reading and the new car's takeover/end readings. Repeated identical submissions do not create duplicate history. A different second correction goes through admin review.

## Data and safeguards

Migration: backend/supabase/migrations/20261019144952_gm_vehicle_mileage_history.sql.

Additive table `gm_mileage_events`, two indexes, RLS without browser/Data API grants, an append-only trigger and a guard on corrected day readings. No seed, backfill or update of existing business rows. The first event stores the previous day readings before making them effective. History cannot be updated/deleted. Subsequent corrections append events.

Apply uses a transaction, GM advisory lock and day row locks. The preview fingerprint includes affected days and neighbours. Stale previews, incomplete day sets, duplicate/foreign day IDs, open days, invalid per-car ranges and pending KM correction requests are rejected. A batch key makes retries idempotent and rejects reuse for different inputs. Legacy editors cannot overwrite corrected day readings or erase their vehicle sections. Time-only edits stay supported.

Before the migration, ordinary day readers and existing request transactions remain usable; the new correction endpoint returns a clear schema-required state rather than silently discarding history.

## Verification

All new checks use disposable PGlite databases and synthetic fixtures with no production environment loaded. Actual admin and GM route source is loaded with explicit isolated I/O replacements.

- Corrected effective readings; originals preserved; ordinary overnight distance preserved.
- Admin/GM readers reconcile; mixed-car business-distance sum.
- Idempotent retry, stale-preview rejection, pending-request rejection, invalid/incomplete scope, role rejection.
- Immutable history and guard against legacy overwrites.
- Failure on the second day rolls back the entire batch, including history.
- Missing schema fallback does not abort legacy transactions.
- Browser: admin 1440×900 and 1280×800 laptops, bulk preview, save/reopen/history. GM vehicle dialog on 1180×820 iPad landscape.

An existing `admin-zeiterfassung.shared.test.ts` default-pause test expects a 30-minute pause for a three-hour day. It fails identically on the unchanged release baseline because current code applies the default pause only at six hours. That unrelated behavior was not changed.

No agent tests or exploratory queries use the human production-connected localhost. Human app startup imports createApp directly and does not start scheduled jobs.
