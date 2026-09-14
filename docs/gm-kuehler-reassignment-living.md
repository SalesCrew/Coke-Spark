# GM Kühlerinventur: completion after reassignment

## Incident and safety boundary — 2026-09-14

Denise's 08:23:31 Vienna reassignment moved 78 assignment rows / 53 markets
from Alexander Felsberger to Pascal Wunder in `2026_Coca-Cola Kühlerinventur`.
Railway confirmed HTTP 200 at 08:23:42. The original 34 submitted sessions,
196 answer records and 27 active photos (all with storage objects) still existed.
No submitted session or answer was changed by the reassignment.

The old status reader grouped submissions by their original author but rendered
only current assignment owners. Consequently Alex's completed slots disappeared
when Pascal became responsible. The UI then disabled opening those visit details.
The GM progress reader had the same author/assignee mismatch.

This fix must not rewrite visits, answers, authors, photos, time entries or personal
GM performance/bonus history. No database migration or production repair is needed.
SM and non-Kühler completion behavior remain unchanged.

## Implemented semantics

- `campaign_market_assignment_history` is the existing immutable transfer evidence.
- Only `campaign_gm_reassignment` events for the same Kühler campaign and market
  project completion responsibility. Cross-campaign migrations are not inferred.
- A completed session follows transfers at/after its submitted timestamp in order.
  Its `gmUserId`, answer contents and all other original data remain unchanged.
- Duplicate history rows from one atomic transfer are deduplicated. Simultaneous
  swaps advance once, not repeatedly. Later transfers and transfers back are replayed.
- Each session belongs to exactly one current responsibility pool, not every GM
  assigned to the same market. New independent assignments cannot reuse it.
- The existing cooler/occurrence allocator then assigns each session once, oldest
  first. Repeat rounds, different coolers and legacy unit-less visits stay separate.
- Admin date filters apply after occurrence allocation, preserving visit numbers.
- GM completion covers the campaign lifecycle for Kühler, not just a RED month.
- Deleted/draft sessions and deleted sections/units remain excluded by the reader.
- All queries are scoped to the caller's active campaign/market assignments and
  load completion metadata only; other GMs' answer APIs are not opened up.

## Consumers

`loadKuehlerAssignmentProgress` and `buildKuehlerAssignmentProgress` are shared by:

1. Admin campaign market-visit status (including the exact submitted session link).
2. GM progress / remaining cooler visits.
3. GM assigned-market list completion summary.
4. GM market detail / questionnaire-start completion summary.

Admin row ownership remains Pascal for filtering/planning; opening the original
session and exports still identify Alex as the actual author. Existing history and
export readers already read submitted sessions independently of current GM ownership.

## Existing data edge cases — do not "repair" automatically

- ERTL GmbH, Süduferstraße 241, has two submitted sessions for one planned cooler
  occurrence. Both remain stored/exportable; only one completes the planned slot.
  Thus this incident has 34 stored questionnaires but 33 matching completed slots.
- Physical coolers can imply more rendered slots than stored assignment targets:
  the incident snapshot rendered 85 slots for 78 targets. The existing allocator's
  rule is preserved; targets are not rewritten.
- Late submissions by a former GM after transfer do not follow an earlier event.
  They retain their author and remain in history; no invented reassignment occurs.

## Verification / rollout status

- Added deterministic regression coverage for author preservation, batch duplicates,
  chains/returns/swaps, unrelated GMs/campaigns/markets, drafts, late submissions,
  repeat occurrences, date filtering, legacy sessions and extra submissions.
- Production verification must be SELECT-only, replaying snapshots through the pure
  shared calculation. Never execute mutating integration tests against production.
- `npm run build`: passed.
- `npm run test:kuehler-reassignment`: 24/24 passed (12 new regressions and
  12 existing repeat-visit tests). New tests are also included in `npm test`.
- `npm test`: 145/149 passed. Four failures are unrelated, in unchanged code:
  one default-pause expectation in `admin-zeiterfassung.shared.test.ts` and three
  RED-calendar anchor/boundary expectations in `red-monat.shared.test.ts`.
- SELECT-only production-snapshot replay through the actual new shared helper:
  53 markets / 78 assignment rows / 34 stored submissions; old matching gave 0
  completed slots, fixed matching gives 33 completed + 52 pending. All 33 session
  links are unique and retain the original author. Snapshot inputs are unchanged.
- No mutating production test or database repair was executed. No frontend change
  is required; existing clients consume the corrected completion metadata.
- Deployment: backend commit `f29e62b` pushed on 2026-09-14. Railway production
  deployment `21b7c20c-77e1-4d6a-95bf-53f3cde80fb3` was confirmed successful and
  active in the Railway UI. No migration or production data mutation was needed.
