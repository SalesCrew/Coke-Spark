# SM Durcharbeit — standalone SM exchange helper

Date: 2026-10-16. The user authorized production deployment after reviewing the normal localhost. No production query, business-data mutation or migration is part of this release. Work was first isolated on codex/sm-durcharbeit-bulk-transfer, then copied into the normal localhost at the user's request. The narrow helper patch preserves the active checkout's unrelated work.

## User correction and final scope

The first local draft added selection checkboxes to the existing tables and offered remaining-campaign transfers. The user rejected this scope. Those table changes and the remaining-campaign option have been removed. Both existing pages retain their rows, layout, controls and single-market editors. Each receives only one **SM austauschen** button opening the separate helper.

- **Durcharbeit Märkte:** exchange the default SM on one market, selected markets, or all markets of one source SM. Save the current display name and both existing assignment IDs together.
- **Durcharbeit Verplanung:** exchange the SM only for the selected campaign and selected calendar month. The helper cannot change any other month or the market default. The new API rejects a supplied future-scope field.
- The screenshot's people are SMs. No GM pages or regular market pages receive this feature.
- Employee visibility, visit eligibility, anytime access rules, visit execution, saved answers, photos, times, imports and existing campaign management are not redesigned or changed by this feature. Existing historical protections remain in place.

## UI plan

Reuse existing compact admin buttons, white dialog, neutral borders, typography, custom searchable AdminDropdown and subtle blue Durcharbeit actions.

The helper opens in **Alle Märkte eines SM** mode: source SM → replacement SM, reason, count, review, save. **Einzelne Märkte auswählen** provides search and a checkbox list entirely inside the window for a single market or any selected subset. The page tables receive no selection state, checkboxes, colouring or extra section. Campaign name/month are fixed context, not a new timeframe control. Escape closes the helper and restores focus to its trigger.

An authoritative read-only preview shows exact changes and protected targets before save. Source choices include inactive owners; replacement choices are active SMs. Stale state fails atomically and requires another preview.

## Minimal data path

Only new helper endpoints are added. Existing single-owner handlers and employee visit handlers are unchanged. No schema changes are needed.

- Campaign transaction: lock the campaign and selected month targets in stable order, validate current state/destination, append existing owner revisions and audit events, update only eligible selected targets in that month.
- Begun drafts, completed visits and waived targets remain protected. Historical records and other campaign/month targets are unchanged.
- Market defaults: use the existing planning lock and expected timestamps; update the dedicated registry ID, market SM ID/name and timestamp together. Preserve imported raw fields and explicit monthly substitutions.
- Preview tokens bind input and current state. Wrong-domain rows, inactive recipients, duplicate IDs, stale state and permission failures do not partially save.
- Dedicated existing customer permissions protect the new routes; normal market permission does not grant dedicated access.

## Verification

All checks use a fresh disposable synthetic DB, synthetic accounts/photos and clean environment. No production environment file, scheduler or normal application backend entrypoint is used. The earlier disposable preview DB was discarded after the user correction.

- Corrected bulk-transfer integration suite plus existing single-owner integration suite: **20 passed, 0 failed**. Covers single/selected/all-source changes, month-only boundaries, rejection of future scope, other campaigns/default isolation, protected visits, employee visibility and subsequent answer/photo submission, history preservation, stale conflicts, wrong-domain rows and permissions.
- Frontend and backend TypeScript checks passed after the correction. Scoped lint passed for the shared helper, campaign integration and DTO.
- Browser at 1280×800: existing campaign table has the original five columns and zero added checkboxes. Helper all-source preview identifies 48 eligible October changes and two protected targets; save succeeds. November remains unchanged. Selecting two markets inside the window previews exactly two November changes.
- The dedicated market page likewise has zero added table checkboxes; the helper previews and saves all 50 synthetic default assignments, updating their displayed SM names.
- The final corrected frontend optimized Webpack build passed with all 64 routes using synthetic public settings and no production environment files. Backend production TypeScript compilation and scoped lint also passed. The first release-build attempt found local before-image TSX files under outputs; moving those preserved backups outside the project resolved that artifact-only issue without changing application code.
- Existing legacy market/planning UI harness tests have six baseline failures (missing mocked page-access hooks and obsolete navigation-key expectation); the same failures were reproduced against unchanged HEAD sources. Those unrelated tests and runtime paths were not modified.

## Normal localhost delivery

The user's port 3000 was serving a separate copied frontend under project-context/Coke Spark/runtime/human-app/frontend. Its Durcharbeit route still imported the old weekly SmVerplanungWorkspace, whereas the current application source imports SmSMDurcharbeitCampaignWorkspace. That stale runtime copy also lacked the helper. The affected route, admin layout and their local dependency closure were synchronized from current source; only 36 differing/new source files were copied, with before-images recorded in the task's local output folder. Environment files were not copied or displayed.

Normal frontend localhost:3000 and backend localhost:4000 are running with normal human authentication and save behaviour. The backend uses the existing human launcher calling createApp directly; index.ts and scheduled jobs are not started. No agent HTTP requests or database verification queries were made against that production-connected app. The human can use SM austauschen on both Durcharbeit pages. Campaign swaps are selected-month-only; market swaps change the default.

Agent verification used separate synthetic 3038/4038 services. These temporary services are stopped after delivery. All verification writes were disposable synthetic data.

## Production release

The release adds only the standalone helper, narrow API endpoints and synthetic tests. Existing pages, visit execution/access, current campaign management and historical data paths are preserved. No migration, import, backfill, real swap, campaign activation or authenticated production smoke test is included.

Backend commit: e533ca5c791ed2481ecf4237752f7bcbbc1e51f0 in SalesCrew/Spark-Backend. Deploy backend first, wait for Railway SUCCESS for this exact commit, then release the frontend and backend Git pointer to SalesCrew/Coke-Spark. Confirm the exact frontend commit is READY and assigned to coke-spark.vercel.app using hosting metadata only.

The initial terminal Git account and connected GitHub app rejected code writes. The user clarified that the existing CapoVerse account must be used. Its configured login is CapoVerse-1; account-scoped Git authentication used that existing saved login without changing the default account or printing/persisting credentials. The exact backend commit was successfully pushed to master and Railway deployment 06179943-fd2e-48bd-aab7-b227778afadf reached SUCCESS at 2026-10-16 09:27:37 UTC. Frontend release follows that confirmed backend deployment. No production database operation was performed.

Rollback, if needed, restores the preceding application commits without changing production schema or business rows. Existing single-market editing stays available.
