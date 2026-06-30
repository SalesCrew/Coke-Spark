# DSGVO / DSG RLS Audit

Date: 2026-06-25  
Supabase project: `quqefecmqeienxmeueqa`

## Scope

This audit covers the PostgreSQL/Supabase access boundary for Coke Spark's public app tables. It does not replace legal review, a data-processing agreement review, works-council review, or a formal DPIA. It documents the technical RLS decision for the app's current architecture.

## Official Requirements Used

- GDPR Article 5 requires lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity/confidentiality, and accountability.
- GDPR Article 25 requires data protection by design and by default.
- GDPR Article 32 requires technical and organisational measures appropriate to the risk, including ongoing confidentiality, integrity, availability, resilience, and regular effectiveness testing.
- The EDPB SME guide stresses adapting security measures to the processing context and risk.
- Austrian DSG Art. 1 § 1 gives a fundamental right to secrecy of personal data when there is an interest deserving protection.
- Austrian ArbVG § 96 / § 96a are relevant because this app includes employee time, field execution, performance, and bonus-related data.
- Austrian working-time rules require work-time records and employee/authority access, which affects retention and access processes.
- Supabase documents that grants decide whether `anon`, `authenticated`, or `service_role` can reach a table/function through the Data API, while RLS decides which rows are visible after an object is reachable.
- Supabase documents that RLS must be enabled on tables in exposed schemas like `public`, and that when RLS is enabled no data is accessible through the publishable key until policies exist.

Primary references:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://www.edpb.europa.eu/sme-data-protection-guide/secure-personal-data_en
- https://www.edpb.europa.eu/sme-data-protection-guide/process-personal-data-lawfully_en
- https://www.ris.bka.gv.at/
- https://www.usp.gv.at/themen/mitarbeiter-und-gesundheit/urlaub-und-arbeitszeit/weitere-informationen-zu-urlaub-und-arbeitszeit/arbeitszeitaufzeichnungen.html

## Current Architecture Decision

Coke Spark authorises business data in the Express backend, not in browser-side Supabase table access.

Frontend Supabase usage is limited to:

- Auth password reset / recovery.
- Auth reset-token exchange and password update.
- Auth session checks in middleware.

Backend Supabase usage is limited to:

- Supabase Auth admin/user operations.
- Private Storage signed upload/download URLs for visit photos and GM profile photos.

All app/business data is accessed through backend routes and Drizzle/Postgres using `DATABASE_URL`, with backend role checks in:

- `backend/src/middleware/auth.ts`
- `backend/src/lib/kunde-access.ts`
- route-specific GM/admin/kunde checks

Because the frontend does not need direct table reads/writes, the correct RLS posture for the current app is backend-only table access:

- `anon`: no direct `public` schema/table access.
- `authenticated`: no direct `public` schema/table access.
- `service_role`: direct access for server-side Supabase tooling only.
- backend Postgres connection: remains the normal trusted application data path.

This is stricter than writing broad `TO authenticated` policies and avoids BOLA/IDOR risk where a logged-in GM/Kunde could query unrelated rows via the Supabase Data API.

## Applied Migration

Migration:

- `backend/drizzle/0056_lock_public_tables_to_backend.sql`
- `backend/drizzle/0057_auto_force_rls_for_public_tables.sql`

Effects:

- Enables RLS on every current `public` app table.
- Forces RLS on every current `public` app table.
- Revokes `public` schema usage/create from `PUBLIC`, `anon`, and `authenticated`.
- Revokes all table, sequence, and function privileges from `PUBLIC`, `anon`, and `authenticated`.
- Grants `service_role` table/sequence/function privileges.
- Removes existing broad permissive policies.
- Sets default privileges so new public objects are not exposed to browser roles by default.
- Adds an `internal_security` event trigger that automatically enables and forces RLS on future `public` tables created by later migrations. The trigger function is not in `public`, and `anon` / `authenticated` cannot execute it.

## Table Evaluation

All 64 public tables contain business data, employee data, operational data, answer data, photos metadata, performance/bonus data, audit data, or configuration that controls access to those categories. None should be directly reachable from browser roles in the current architecture.

| Table group | Tables | Data / reuse | Correct RLS / grant decision |
| --- | --- | --- | --- |
| Identity, roles, audit, customer access | `users`, `kunde_users`, `auth_audit_logs` | Login identity mapping, roles, regions, Billa flags, customer page permissions, audit logs. Reused by every auth guard and admin/GM route. | Backend only. Browser access would expose identities/permissions and enable privilege bypass. |
| Markets, warehouse, assignments | `markets`, `market_kuehler_units`, `lager`, `lager_gm_assignments` | Market master data, cooler units, warehouse data, GM assignment data. Reused by campaigns, GM start flows, photo archive, time/diäten exports, dashboards. | Backend only. GM/Kunde/Admin views must be route-filtered and role-filtered. |
| Campaigns and campaign history | `campaigns`, `campaign_market_assignments`, `campaign_market_assignment_history`, `campaign_fragebogen_history` | Campaign definitions, schedule, active/pause state, assignment targets, history. Reused by GM visibility, FB management, exports, dashboards, active visit creation. | Backend only. Direct access could expose all campaigns or allow starts outside assigned scope. |
| Questionnaire catalog | `question_bank_shared`, `question_scoring`, `question_attachments`, `question_photo_tags`, `question_matrix`, `question_rules`, `question_rule_targets`, `question_answer_history`, `photo_tags` | Reusable question/module catalog, scoring, rules, photo tags, history. Reused by admin editors, GM questionnaire preparation, IPP/bonus calculations. | Backend only. Catalog visibility and mutation are role/page-action controlled in backend. |
| Modules and Fragebogen packages | `module_main`, `module_main_question`, `module_question_chains`, `module_kuehler`, `module_kuehler_question`, `module_mhd`, `module_mhd_question`, `fragebogen_main`, `fragebogen_main_module`, `fragebogen_main_spezial_question`, `fragebogen_main_spezial_items`, `fragebogen_kuehler`, `fragebogen_kuehler_module`, `fragebogen_mhd`, `fragebogen_mhd_module` | Questionnaire packaging by type, modules, chains, special items. Reused by campaign creation and GM visit start. | Backend only. GM gets only the resolved assigned snapshot through API. |
| Visit sessions and answers | `visit_sessions`, `visit_session_sections`, `visit_session_questions`, `visit_answers`, `visit_answer_options`, `visit_answer_matrix_cells`, `visit_question_comments`, `visit_answer_photos`, `visit_answer_photo_tags`, `visit_answer_events`, `visit_answer_change_requests` | Submitted/draft visits, answer snapshots, photos metadata, tags, comments, change requests. Reused by GM activity, admin FB management, photo archive, IPP, bonus, exports. | Backend only. Highly sensitive operational and performance data; route code scopes by GM/admin/kunde permission and campaign/market context. |
| Day sessions, time tracking, pauses | `gm_day_sessions`, `gm_day_session_pauses`, `time_tracking_entries`, `time_tracking_entry_events` | Workday start/end, KM, pauses, Zusatzzeit, timeline events. Reused by GM TimeTracker, admin Zeiterfassung, Diäten/normal exports. | Backend only. Employee work-time data must be tightly scoped and audited. |
| IPP and KPI | `ipp_market_redmonth_results`, `ipp_recalc_queue`, `gm_kpi_cache` | Performance snapshots, recalculation queue, GM KPI cache. Reused by IPP page, GM dashboard/profile, finalizers. | Backend only. Direct user reads would expose performance data across GMs/markets. |
| Bonus / Prämien | `praemien_waves`, `praemien_wave_pillars`, `praemien_wave_sources`, `praemien_wave_thresholds`, `praemien_wave_flex_scores`, `praemien_wave_quality_scores`, `praemien_gm_wave_contributions`, `praemien_gm_wave_totals` | Bonus configuration, per-GM contributions/totals, source mappings. Reused by admin Prämien, GM bonus card, finalizer. | Backend only. Bonus data is compensation/performance-sensitive. |
| RED month calendar | `red_month_calendar_config`, `red_month_years`, `red_month_periods` | Period definitions used by IPP, GM dashboard, photo/archive filters, campaigns, bonus. | Backend only. Read is low sensitivity by itself, but period config affects all higher-risk calculations and should remain API-mediated. |

## Live Verification Queries

Run these after future schema migrations or Supabase changes.

### RLS coverage

```sql
select count(*) filter (where not c.relrowsecurity) as public_tables_without_rls,
       count(*) filter (where c.relrowsecurity) as public_tables_with_rls,
       count(*) as public_tables_total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p');
```

Expected:

- `public_tables_without_rls = 0`
- `public_tables_with_rls = public_tables_total`

### Browser table grants

```sql
select grantee, privilege_type, count(*) as table_grant_count
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by grantee, privilege_type
order by grantee, privilege_type;
```

Expected:

- No rows for `anon`.
- No rows for `authenticated`.
- `service_role` has the needed server-side privileges.

### Schema privileges

```sql
select role_name,
       has_schema_privilege(role_name, 'public', 'USAGE') as has_usage,
       has_schema_privilege(role_name, 'public', 'CREATE') as has_create
from (values ('anon'), ('authenticated'), ('service_role'), ('postgres')) as roles(role_name);
```

Expected:

- `anon`: `false / false`
- `authenticated`: `false / false`
- `service_role`: `true / false`
- `postgres`: `true / true`

### Direct browser-role bypass test

```sql
begin;
set local role authenticated;
select count(*) from public.users;
rollback;
```

Expected:

- Permission denied.

### Supabase advisor

Run Supabase security advisors after migrations. In the backend-only model, `RLS Enabled No Policy` INFO notices are acceptable because the app tables are intentionally not granted to browser roles. `rls_disabled_in_public` errors are not acceptable.

## Current Live Verification Snapshot

Verified on 2026-06-25:

- 64 public tables.
- 64 public tables with RLS enabled.
- 0 public tables without RLS.
- `anon` and `authenticated` have no direct public table grants.
- `anon` and `authenticated` have no `public` schema usage/create privileges.
- `coke_spark_force_public_table_rls` event trigger is enabled for future public tables.
- `anon` and `authenticated` have no usage/execute privilege on the `internal_security.force_public_table_rls()` trigger function.
- Direct `authenticated` role read of `public.users` fails with `permission denied for schema public`.
- Backend `DATABASE_URL` read still succeeds.
- Backend build passes.
- Frontend build passes.

## Residual Datenschutz Work Outside RLS

RLS does not by itself make the whole product DSGVO/DSG compliant. Remaining items that need organisational/legal/process confirmation:

- Employee transparency notice for time tracking, visits, photos, IPP, bonus, and exports.
- Works-council / employee-consent review under ArbVG for monitoring/performance-related processing.
- Retention schedule for visit photos, answer history, time entries, audit logs, exports, and telemetry.
- DSAR process for access, rectification, erasure/restriction where legally possible.
- Data processing agreements and transfer assessment for Supabase, Railway, Vercel, and any email provider.
- Supabase Auth leaked-password protection is currently disabled and should be enabled.
- Storage bucket policies and file retention should be reviewed separately; private buckets and signed URLs are in use, but storage is not covered by public-table RLS.

## Future Rule

Do not add `grant select/insert/update/delete on public.* to authenticated` unless a feature explicitly needs browser-side Supabase Data API access. If that happens, create narrowly scoped ownership policies for the specific table only, with both `USING` and `WITH CHECK` where mutations are allowed, and verify with a bypass test.
