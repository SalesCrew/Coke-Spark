# SM Questionnaire Data Model

Status: production schema foundation created 2026-08-19
Migrations: `backend/drizzle/0089_sm_questionnaire_domain.sql`,
`backend/drizzle/0090_sm_questionnaire_fk_indexes.sql`, and
`backend/drizzle/0091_sm_enforce_soft_deletes.sql`

## Boundary decision

The SM questionnaire domain is independent from the GM questionnaire and campaign domain.

Reused concepts:

- reusable questions;
- reusable modules;
- ordered questionnaire composition;
- conditional show/hide rules;
- all ten question types already exposed by the SM editor;
- idempotent drafts and submissions;
- immutable runtime snapshots;
- answer history and audited correction requests.

Intentionally not reused:

- GM `standard`, `flex`, `billa`, `kuehler`, `mhd`, and `durcharbeit` table families;
- campaigns and campaign-market assignments;
- GM Spezialfragen;
- chain filters on individual questions;
- IPP, bonus, prize, and competitor scoring;
- GM photo tags and RED-survey behavior;
- GM visit sessions and GM answer-change/delete-request tables.

SM does not need six parallel questionnaire table families. Its variations are represented by exact versions of the same question → module → questionnaire graph. The six observed Coke Regalservice areas are reusable modules, not hard-coded database variants.

## Authoring hierarchy

```text
sm_questions
  └─ sm_question_versions
       ├─ sm_answer_option_versions
       ├─ sm_question_logic_rules
       │    └─ sm_question_logic_rule_targets
       └─ sm_module_version_questions
            └─ sm_module_versions
                 └─ sm_modules

sm_questionnaire_templates
  └─ sm_questionnaire_versions
       └─ sm_questionnaire_version_modules
            └─ exact sm_module_versions
```

Stable root tables provide identity across edits. Version tables contain editable wording and behavior. Published versions are locked by database triggers; editing requires a new version.

## Authoring tables

### `sm_questions`

Stable logical question identity. `stable_code` is a normalized machine key. Soft deletion removes a question from the active library without deleting any version or historical submission.

### `sm_question_versions`

Exact question content:

- version number and draft/published state;
- one of the ten supported question types;
- wording and required flag;
- reporting role;
- optional OOS category;
- possible points;
- type-specific configuration;
- metric/aggregation configuration.

Question types:

- `single`
- `yesno`
- `yesnomulti`
- `multiple`
- `likert`
- `text`
- `numeric`
- `slider`
- `photo`
- `matrix`

Metric roles:

- `none`
- `execution`
- `context`
- `oos_detection`
- `oos_remediation`
- `information`
- `free_text`

The metric role separates quality scoring from operational OOS observations. OOS questions require an explicit category.

### `sm_answer_option_versions`

Exact choice options with:

- stable code and displayed label;
- earned and possible points;
- metric outcome code such as `oos_present`, `resolved`, or `partially_resolved`;
- explicit not-applicable behavior;
- denominator inclusion;
- display order and optional configuration.

This preserves the semantic difference between `Nein`, a valid zero-point answer, and `nicht erforderlich`, which is excluded from the denominator.

### `sm_question_logic_rules`

Backend-authoritative conditions. Supported operators include equality, containment, numeric comparisons, ranges, and answered/unanswered checks. Rules can be grouped with `all` or `any` behavior and can show or hide their targets.

### `sm_question_logic_rule_targets`

One row per question targeted by a conditional rule. A trigger rejects a rule targeting its own trigger question.

### `sm_modules` / `sm_module_versions`

Stable reusable module identity plus versioned name/description. The observed Coke sections—Getränkekühler, Aktionsplatzierungen, three product shelf groups, and Information—fit here.

### `sm_module_version_questions`

Ordered exact question versions inside an exact module version. Publication requires at least one question and requires all included question versions to be published first.

### `sm_questionnaire_templates`

Stable questionnaire identity and administrative lifecycle (`active`, `inactive`, `archived`). Deactivating a questionnaire happens here; historical published versions are not rewritten.

### `sm_questionnaire_versions`

Exact deployable questionnaire versions with:

- version number;
- draft/published state;
- name and description;
- `once_per_market` behavior used by the existing UI;
- optional effective date range;
- Europe/Vienna timezone default;
- publisher and publication timestamp;
- required content hash for published versions.

SM is assignment-driven, so this table does not copy GM campaign scheduling. A future Einsatz references a published questionnaire version directly.

### `sm_questionnaire_version_modules`

Ordered exact module versions in a questionnaire. Publication requires at least one module and requires all module versions to be published first.

## Runtime snapshot hierarchy

```text
sm_questionnaire_submissions
  └─ sm_questionnaire_submission_sections
       └─ sm_questionnaire_submission_questions
            └─ sm_question_answers
                 ├─ sm_question_answer_options
                 ├─ sm_question_answer_matrix_cells
                 ├─ sm_question_answer_files
                 └─ sm_question_answer_events
```

### `sm_questionnaire_submissions`

One versioned questionnaire run for one SM and one SM market. It contains:

- exact template/version references;
- optional future Einsatz ID;
- idempotency token;
- revision/supersession relationship;
- current/draft/submitted/invalidated/cancelled lifecycle;
- questionnaire, SM, and market snapshots;
- separate visit, submission, and reporting-availability timestamps;
- resolved/answered counts;
- earned and possible execution points;
- invalidation/cancellation audit metadata.

The optional `assignment_id` is reserved for the future independent `sm_assignments` domain. It deliberately has no false foreign key to any GM table. The FK will be added when SM planning persistence exists.

Database uniqueness enforces:

- idempotent client submission tokens per SM;
- one current submission per concrete assignment;
- `Nur einmal ausfüllbar` per template and market for submitted current records.

### `sm_questionnaire_submission_sections`

Immutable module snapshots resolved for one submission. The module code, label, description, and order remain reproducible even after later authoring changes.

### `sm_questionnaire_submission_questions`

Immutable resolved question snapshots containing wording, type, requirement, metric role, OOS category, points, configuration, answer options, conditional rules, applicability decision, and applicability reason.

### `sm_question_answers`

Versioned answer source of truth. Every answer has one explicit state:

- `unanswered`
- `answered`
- `not_applicable`
- `invalidated`

Scalar text, numeric, and structured JSON values are supported. Selected option points and metric outcomes are snapshotted. Corrections create a new current answer version instead of silently overwriting the old answer.

### `sm_question_answer_options`

Selected options for single choice, yes/no, yes/no multi, multiple choice, and Likert-style choices. Codes, labels, points, and metric outcomes are snapshotted.

### `sm_question_answer_matrix_cells`

Normalized matrix cells with row/column codes and text, numeric, or selected values.

### `sm_question_answer_files`

Storage metadata for photo answers. No GM photo-tag assumptions are inherited. Storage bucket policies are intentionally not created until the SM upload API and bucket are implemented.

### `sm_question_answer_events`

Append-only answer timeline for autosave, clear, state-change, and correction events. This supports retry diagnosis and historical reconstruction.

## Correction workflow

### `sm_answer_change_requests`

One pending correction request per submitted question. It retains original and requested answer snapshots, reason, reviewer, review time, and admin note. It is independent of GM correction requests.

### `sm_questionnaire_submission_delete_requests`

One pending deletion request per questionnaire submission. Approval affects only the questionnaire submission; it never deletes the planned Einsatz, market, Soll/Ist time, or Pauschale.

## Publication safety

Database triggers enforce the publication order:

1. Choice-based question versions need at least two active options.
2. Question versions publish first.
3. Module versions require at least one published question and publish second.
4. Questionnaire versions require at least one published module and publish last.
5. Published question, option, rule, module, and questionnaire graphs cannot be updated or deleted.

A later edit therefore clones content into a new version. Historical submissions retain both exact foreign keys and complete snapshots.

## Database security

All 21 questionnaire tables:

- start with `sm_`;
- have RLS enabled and forced;
- grant no table privileges to `public`, `anon`, or `authenticated`;
- grant backend access only to `service_role`;
- use restrictive foreign keys for historical data;
- index every foreign key and the expected active-list/reporting access paths.

The 20 mutable questionnaire tables plus `sm_markets` use database-enforced
soft deletion. Direct `DELETE` and `TRUNCATE` statements are rejected, `is_deleted = true`
automatically receives `deleted_at`, and restoring a record clears
`deleted_at`. `sm_question_answer_events` is the deliberate exception: it is an
append-only audit log on which `UPDATE`, `DELETE`, and `TRUNCATE` are rejected. This is
stronger retention protection than soft deletion for audit events.

No production seed data is inserted by the migration.

## Application wiring

The authoring layer is connected at `/admin/sm-questionnaires` for admins and
SM admins. It loads the real workspace and supports create, edit, duplicate,
publish and soft-delete for modules and questionnaire templates. The UI contains
no seed or temporary questionnaire records.

Module persistence is differential. Unchanged questions reuse their published
question version; only added or changed questions get a new question version.
Removing a question soft-deletes its stable root. Saving an identical module or
questionnaire is a no-op. Exact module and questionnaire composition versions
remain immutable for historical reproducibility.

Still deferred:

1. assignment-to-published-version binding after `sm_assignments` exists;
2. SM draft autosave and final submission endpoints;
3. backend applicability and completeness validation at submission time;
4. photo storage bucket/policies only when photo upload is connected;
5. admin correction approval endpoints that create answer/submission revisions.
