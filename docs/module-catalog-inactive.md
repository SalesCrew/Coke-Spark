# GM module catalog: visual inactivity

## User-visible behavior

- Right-click a module and choose **Inaktiv setzen**.
- It moves below active modules, gains an **Inaktiv** badge, and its content fades to 55% opacity.
- It remains expandable, editable, searchable, duplicatable, and usable in questionnaires.
- Right-click it and choose **Reaktivieren** to restore the normal appearance and original catalog order.
- The marker survives page reloads. A failed save displays an error and leaves the catalog unchanged.
- Context menus and delete confirmations retain full opacity.

Applies to Standardbesuch, Flexbesuche, Billa, Kühlerinventur, MHD, and Durcharbeit. Standard/Flex/Billa share the same `main` module identity, so a shared module has one shared marker. A newly created duplicate starts active.

## Why this is separate metadata

The requested state is an admin catalog indicator, not a disabled module. `module_catalog_state` stores `(scope, module_id, inactive, updated_at)` separately from module content. The dedicated authenticated PATCH endpoint changes only this metadata. It does not update module revisions, questions, questionnaire links, submitted answers, visits, reporting, or bonus logic.

Existing module saves accept a round-tripped `catalogInactive` field but deliberately ignore it. This prevents an old editor from overwriting a newer status change. Catalog rendering uses a stable partition; underlying module order and questionnaire ordering remain unchanged.

## Deployment

Production migration: `backend/supabase/migrations/20260929140742_module_catalog_state.sql`.

Apply the additive migration before enabling the deployed action. It creates one new table and changes no existing rows. RLS is enabled; browser `anon`/`authenticated` roles have no table access. Writes go through the existing admin authentication and customer-page update permissions.

Without the migration, catalog reads still work and default to active. A status change returns a clear 503 setup error instead of pretending to save.

On 2026-09-29 the user explicitly authorized the production migration and matching backend/frontend release. The migration was applied to the Coke Spark project (`quqefecmqeienxmeueqa`), and the local migration filename matches its recorded production version. Verification confirmed zero metadata rows, the composite primary key, the four allowed scopes, RLS enabled, and no direct access for `anon`/`authenticated`. Existing modules, questionnaire links, and visits were not modified. Production rollout uses the existing `master` Git integrations; do not apply unrelated Railway staged changes or include unrelated local edits.

## Verification completed locally

- Backend HTTP + synthetic Postgres tests cover all four scopes: deactivate, read back, edit content without losing state, reactivate, and confirm questions/links/visits remain unchanged.
- Tests also cover malformed requests, unauthenticated/disallowed users, deleted/missing modules, client-role table permissions, and missing migration.
- Frontend tests cover stable sorting, reversible labels/badges, and wiring in every GM catalog while preserving edit/duplicate/delete.
- Browser check on the actual Standardbesuch catalog and ModuleEditor: inactive sorting/fading, reload persistence, editing while inactive, and reactivation restoring the original order.
- Frontend typecheck, backend build, and dashboard deployment-contract tests pass.

The browser fixture uses synthetic data only. Its status handler is the production handler against local PGlite; its module-content save is a small synthetic stand-in, not the full production content-save handler. Existing questionnaire-link/deep-copy regression tests are run separately.

## Repeatable isolated preview

Backend, from `backend`:

```powershell
node node_modules/tsx/dist/cli.mjs src/scripts/module-catalog-local-preview.ts
```

Frontend, from the repository root in a separate terminal:

```powershell
$env:NEXT_PUBLIC_BACKEND_URL='http://localhost:4018'
$env:SPARK_NEXT_DIST_DIR='.next-module-catalog-preview'
node node_modules/next/dist/bin/next dev --webpack --port 3018
```

Open `http://localhost:3018/dev/module-catalog-fixture`. The route is development-only and refuses a non-local fixture backend. The synthetic database survives browser reloads but resets when its process restarts. These fixtures never load the application's production database connector or background jobs.

Tests:

```powershell
# Root
node backend/node_modules/tsx/dist/cli.mjs --tsconfig tests/tsconfig.json --test tests/module-catalog-status.test.tsx
node --test tests/gm-dashboard-contracts.test.mjs
# Backend
node node_modules/tsx/dist/cli.mjs --test src/module-catalog-state.test.ts src/fragebogen-module-links.test.ts src/fragebogen-deep-copy.test.ts
```
