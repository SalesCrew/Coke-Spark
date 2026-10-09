# SM Durcharbeit market account links — 2026-10-09

The user specifically authorized the nullable account column, followed by a separate reviewed production backfill. They clarified that no campaign should be created yet: assigned visits should become visible when the campaign starts.

- Existing production project: Coke Spark, `quqefecmqeienxmeueqa`.
- Schema ledger, already applied separately: `20261009160556_smdurcharbeit_market_sm_user_id`.
- Backfill receipt: **424 reviewed, 424 linked, zero previously linked**, all other registry fields preserved.
- Eleven distinct imported full names each matched exactly one active, non-deleted SM account. There were no unresolved names or assignment conflicts. All canonical market assignments already matched and were left unchanged.
- Exact operational SQL SHA-256: `704e27b1fa50e5550c454ee0ebfd81514448f8da627d69c0b2143c0899a5db85`.
- No campaign, target, assignment, visit, answer, photo or time record was created, activated, reassigned, updated or deleted by the backfill. Original names and all 424 separate imported market identities remain intact.

The backend campaign options use the saved Durcharbeit ID, with the existing canonical account as a fallback, to supply the initial SM selection. The unchanged campaign editor preserves explicit SM choices and existing rosters. Monthly visit ownership is determined by the published roster and month owner revisions, with existing date/month availability checks; changing a default does not rewrite historical visits or automatically move published targets. The dedicated registry continues to use its existing market write restrictions. No new market editing or automatic name rematching is introduced.

Backend commit `1dec109cb501c66df6f5821d90d340c64156b425` is deployed successfully to Railway production: `7ac3d284-41fa-431d-83fc-d344fad66349`, service `5214a3c7-67fd-4422-8141-3ccd98c80fff`, environment `28d539cb-a359-4f9a-89f5-75fc347f4133`. The preceding schema-source commit `e74ca62` is included; deploying it does not rerun the migration. This frontend commit updates the backend Git pointer and release documentation only; application UI/source is unchanged.

Thirty checks passed against a disposable native synthetic PostgreSQL instance, including guarded backfill/replay, conflicts and stale-context rollback, source-field preservation, duplicate retention, campaign-default linkage, publication-gated employee visibility and existing answer/photo/time/import flows. Backend compilation and whitespace checks passed. Production access was limited to the authorized backfill's necessary inventory/context checks and guarded transaction, then deployment metadata. No production smoke tests or application test requests were run. Private reviewed inputs/SQL, environment files, test dependencies and artifacts are not in source control.

Full implementation and operation scope: [backend account-link documentation](../backend/docs/SMDurcharbeit-market-sm-user-link.md).
