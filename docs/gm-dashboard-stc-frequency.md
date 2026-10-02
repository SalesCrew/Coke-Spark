# GM Dashboard STC frequency rules

Rules supplied by the user on 2026-10-02 apply to the market's configured `visit_frequency_per_year` (planned visits/year), not the number of completed visits in the selected reporting interval.

| STC | Minimum visits/year | Maximum visits/year |
| --- | ---: | ---: |
| Gold | 12 | 24 |
| Silver | 8 | 10 |
| Bronze | 6 | 7 |

Both bounds are inclusive. Frequency 11, values below 6 or above 24, and missing frequencies are unclassified. They remain included when no STC is selected; they do not match any of the three STC choices.

The existing STC dropdown on each card filters the shared read-only dashboard query, intersecting with chain, market, GM and region selections. Availability, activity/RED, placement, competitor and IPP results therefore share the same eligible market set. Whole-GM cached/archived IPP cannot override an STC subset. Clearing STC restores the unfiltered frequency selection. No styling or layout changes were made.

The API reports `stcApplied` accurately. Excel exports include the frequency ranges and whether each card's STC filter was applied.

## Verification

- 42/42 dashboard unit/component/HTTP/PGlite checks passed; no failures or skipped checks.
- The new synthetic HTTP case covers all six boundaries, frequency 11, other out-of-range/missing values, repeated visits, empty intervals, combined chain/market/GM/region selections, and the whole-GM IPP override guard.
- Synthetic market, user, visit, question, answer, option and scoring rows were compared before/after queries to verify read-only behavior.
- Backend production TypeScript build and optimized frontend production build passed.
- Checks ran in a fresh disposable source copy with zero `.env*` files, a whitelist child environment and synthetic local endpoints. No production connection or production data was used for verification.
- User explicitly authorized production deployment. Confirm release through Railway/Vercel commit/status/alias metadata only; no production application/database smoke tests, migrations or data updates.
