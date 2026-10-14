# SM Durcharbeit campaign market editing

Published and paused monthly campaigns now support `Märkte bearbeiten`. Select individual registry markets, filter by chain/name/address/SM, and include or exclude the filtered set. `Nur diese Märkte` explicitly replaces the selection. Draft select-all now uses the complete filtered set, independently of pagination.

Changes can apply to one calendar month or that month and all remaining campaign months. A server preview shows the actual active/excluded totals, new markets, protected visits and overlaps before saving. Archived campaigns and past months cannot be changed through this editor.

## Preservation and concurrency

- Existing campaign-market, monthly-target, owner, visit and submission IDs remain intact. Exclusion changes monthly eligibility to `waived`; it never deletes a market or visit.
- Current drafts and completed visits keep their eligibility. The preview identifies these protected targets. Untouched later months can still be excluded.
- Existing answers, photos, physical visit records, worked-time revisions and past monthly state remain unchanged.
- Newly included markets require an active SM and must belong to the dedicated Durcharbeit registry. They get targets only in the selected months, without a historical backfill.
- Apply acquires the same campaign lock as visit writers, recalculates the preview token, rejects stale state, and saves target changes and audit events in one transaction.
- SM ownership now resolves automatically from the dedicated registry ID. No manual campaign assignment editor is provided. Physical visits and past months retain their recorded owners; see [automatic planning](sm-SMDurcharbeit-automatic-planning.md).
- Excluded targets disappear from the SM's open queue and progress denominator. An explicit toggle retains access to excluded rows; past-month visibility remains unchanged.
- No schema migration, production repair or automatic data update is required or performed. The authorized code release is recorded in [automatic planning](sm-SMDurcharbeit-automatic-planning.md).

## Verification (2026-10-13)

All testing used clean process environments, disposable synthetic databases and photo storage. Nine market-edit checks passed on native PostgreSQL, including a 324 SPAR / 100 Billa roster, protected drafts/completions, exclusions, re-inclusion, new markets, overlap confirmation, stale previews, authorization, archive/past-month rejection, no-op saves, extensions, and unchanged answers/photos/times/history. One hundred registry ownership changes also preserved stored targets and revisions on reads, with started/completed visits pinned and open rows automatically visible to their saved SM.

The complete current verification record is in [automatic planning](sm-SMDurcharbeit-automatic-planning.md).

## Local review

Isolated frontend: `http://127.0.0.1:3037/admin/sm/durcharbeit-verplanung`.
Isolated backend: `http://127.0.0.1:4037`.
Synthetic login: `sm-admin@preview.test` / `preview`; employee: `sm@preview.test` / `preview`.

For a SPAR-only correction: choose the campaign, open `Märkte bearbeiten`, select the desired month/scope, filter SPAR, choose `Nur diese Märkte`, review the totals and protected visits, and save.

SMs are already linked in the market registry. Campaign creation and market editing show these names without a manual owner selector. Selecting/publishing markets is sufficient to expose required visits to their saved SM when the campaign is active.
