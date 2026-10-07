# SM Durcharbeit catalog

2026-10-07 — local implementation, not pushed or deployed.

The SM navigation cluster stays **Fragebögen**. The existing page at
`/admin/sm/fragebogen` is labelled **Standartfragebogen**; the separate
`/admin/sm/durcharbeit` page owns its workspace and editor entry points.
Both pages use the complete SM editors, including all ten question types,
subtitles, answer subtitles, images, comments, conditional logic, OOS metadata
and once-per-market questionnaire settings. There is no per-question
SMDurcharbeit flag or Ja-only counter.

## Storage and compatibility

The API accepts `scope=standard` or `scope=SMDurcharbeit`. New Durcharbeit
module and questionnaire roots use the `smdurcharbeit_` stable-code namespace;
existing database constraints require lowercase stable codes. All roots without
that namespace stay standard. The namespace is assigned only on creation and
cannot be changed through the authoring API.

No new columns, migration, backfill, record moves or changes to existing IDs
are required. Versioned module/questionnaire links, assignment references,
answers and submission snapshots continue using the existing foreign keys.
Unscoped workspace reads still return the full catalog for existing consumers;
the two authoring pages explicitly request their own scope. Writes default to
standard for backward compatibility. Cross-scope edits, deletes and module
references are rejected. Existing deletion safeguards remain in place.

Creating or activating a questionnaire does not change the current global
selection in Verplanung. SM continues to use its existing single central
questionnaire selection; either catalog can supply it. Concurrent separate
standard and Durcharbeit campaigns are outside this page change.

## Verification

- Backend `test:SMDurcharbeit`: real authoring and visit routes against fresh
  disposable PGlite with synthetic users, markets, assignments and answers.
- All question types and special metadata round-trip; standard IDs, links and
  global selection stay unchanged; wrong-scope writes roll back; used-module
  and assigned-questionnaire deletion protections remain; completed visit
  configuration and answers survive later authoring edits.
- 35 focused integration and SM dashboard/answer regression checks passed.
- Actual admin pages on isolated 3037/4037: toolbar actions, complete module
  controls, scoped saves, questionnaire composition, once-per-market setting,
  reload persistence and standard catalog isolation.
- Frontend production build and backend TypeScript build passed without
  production environment files.

No production connection or data was used for agent verification. Human
localhost 3000/4000 uses the restored environment and normal authentication
and editing, via `createApp()` without starting any scheduler.
