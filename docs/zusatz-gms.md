# Zusatz-GMs

Zusatz-GMs use the normal `gm` role and the same sign-in, market assignments,
campaigns, cooler workflows, time tracking and personal results as regular GMs.
`users.is_supplemental_gm` is a reporting classification, never a permission role.

## Account management

Create and edit the classification in **Gebietsmanager**. New accounts default
to **Regulärer GM**. Zusatz-GM cards have an amber marker and label. Regular
cards and the existing page/dashboard layouts retain their original design.
Imports default to regular GMs. Account inactivity and the Billa filter remain
independent of this classification. No automatic January conversion is applied.

## Historical separation

A database trigger copies the current classification onto each new visit as
`visit_sessions.is_supplemental_gm_snapshot`. Caller-supplied values are ignored.
The snapshot remains immutable when the visit is submitted, corrected, reassigned
or the account changes classification. Switching to a regular GM affects new
visits; earlier Zusatz-GM visits remain separate permanently. Existing recorded
visits receive the regular default; the migration does not rewrite answers,
photos, times, assignments, roles, RED months or historical results.

## Dashboard and exports

The GM admin dashboard excludes supplemental visit snapshots **before** selecting
latest answers, market owners, denominators, averages, placements, activity or
availability. It also excludes them from the date metadata and removes current
Zusatz-GMs and markets with exclusively supplemental submitted history from its
filter choices. Shared markets remain selectable. A stale filter cannot bypass
visit exclusion. Per-card filters and individual chain rows are preserved.

Whole-GM RED IPP uses the same source exclusion. Mixed-budget market archives
are bypassed for the screen and calculated from eligible original answers;
clean archives are reused. Whole-GM corrections affecting a mixed-budget market
period are not apportioned: that dashboard view uses the regular-work calculation.
The stored archives, personal IPP and corrections remain unchanged.

Bonus amounts are whole GM/wave results. The dashboard keeps the entire GM/wave
separate if it contains supplemental submitted work, including after conversion,
or the GM is currently supplemental. This also applies to closed wave snapshots.
The actual Prämien workspace, configuration and payouts are unchanged.

Operational directories and exports include Zusatz-GMs. The dashboard export
explicitly reloads inclusive datasets and bonus totals instead of exporting the
screen's smaller cohort. Its metadata explains this difference. Availability
export counts are checked against their included answer audit. The GM directory
export adds the GM classification as a column.

## Migration and verification

`backend/supabase/migrations/20261029184231_gm_supplemental_budget.sql` adds only
two default-false columns and an immutable snapshot trigger in a dedicated
private schema. Its transaction has a three-second lock-acquisition timeout.
Existing indexes support reads; there is no index build holding the DDL lock.
Apply the schema before releasing the backend, followed by the frontend.

Verification uses disposable PGlite databases, synthetic identities and explicit
I/O substitutes, with no production environment files. Tests cover actual admin
CRUD and role restrictions, snapshot stamping/immutability, conversion, mixed
market calculations, inclusive exports, live and closed bonuses, archived IPP,
whole-GM corrections, normal dashboard filters and availability audits.

The isolated preview runs the real frontend and account/dashboard routes on
3037/4037. It uses simulated authentication and in-memory synthetic data. Its
fixtures are never application entry points. The browser flow verifies creation,
editing, save and reload at laptop widths.
