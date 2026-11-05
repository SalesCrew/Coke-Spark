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

Bonus amounts are whole GM/wave results. All bonus readers use the same regular-GM cohort,
including administration, previews, employee summaries, cumulative totals, leaderboards,
legacy scores, dashboard cards and statistical exports. A currently supplemental account
is excluded even before it has a visit. A converted GM's entire wave remains separate when
it contains a submitted supplemental snapshot. Closed snapshots and stored entries retain
their original values. Only their reporting projection and displayed ranking are filtered.
Stale/manual attempts to submit bonus values for an excluded GM are rejected. Legacy bulk
score saves preserve excluded entries.

## Reporting correction of 5 November 2026

The previous implementation excluded visit snapshots on the dashboard but left the
bonus administration inclusive. Dashboard exports explicitly requested the inclusive
cohort. Visits created before account classification could also have regular snapshots
while their account was now marked Zusatz-GM.

Reporting now requires both a regular visit snapshot and a currently regular GM
account before selecting the latest answers, denominators, ownership or aggregates.
Legacy dashboard inclusion flags cannot bypass this rule. Dashboard metadata, filters,
availability audits and Excel output use the same scope. Shared markets still remain
selectable.

Admin IPP lists and drilldowns recompute mixed archived periods for reporting from
eligible original answers. Clean archives remain usable. Stored archives and correction
events retain their original values. Kurti's visit, answer, photo, campaign, IPP, bonus
and work-time analytics use the regular reporting cohort. Work-time statistics exclude
an entire day containing a supplemental visit, including after conversion, because a
complete workday cannot be divided reliably between budgets.

Operational directories, assignments, original visit/answer/photo records, timekeeping
records and raw operational exports retain Zusatz-GMs. Their accounts continue to use
the ordinary GM workflow. This distinction concerns reporting and bonus eligibility.

The correction uses the existing classification and snapshot columns. It needs no new
migration, backfill, deletion or changes to bonus rules/targets. Regression checks use
synthetic PostgreSQL fixtures and the real HTTP routes, including forced legacy inclusion,
read-only preview, cumulative and frozen rewards, stale edits, retained original snapshots,
Kurti aggregates and a generated XLSX checked against the filtered dashboard.

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
