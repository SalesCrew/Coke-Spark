# Durcharbeit SM assignment controls

In Durcharbeit Märkte, open a market and use Standard-SM at the top of the detail drawer. The custom, searchable dropdown selects a real active SM account; SM speichern saves its name and both account IDs automatically. This default applies to untouched automatic monthly work. Original spreadsheet source fields, normal-market controls and existing physical visits retain their behavior.

In Durcharbeit Verplanung, each open monthly target has SM wechseln. The dialog names the selected month, offers active SMs and Marktstandard verwenden, and requires a short reason. A temporary choice is shown as a small “Nur [Monat]” line alongside the SM name. It applies only to that target, campaign and month. Later months and new campaigns use the market default; the expired month's assignment stays recorded for history.

Active drafts and completed monthly visits cannot be switched. Drafts must first be completed or explicitly discarded using the existing workflow. Saving a monthly substitute leaves the registry default and historical answers/photos/times untouched. Permission checks and optimistic versions protect both save paths. No migration or automatic backfill is required.

The release was verified with 45 distinct targeted native PostgreSQL checks across the new owner flow and existing automatic planning, import, campaign editing, transitions, reporting and photo preservation. The dedicated flow also passed nine initial in-memory checks. Browser checks on the independent 3037/4037 synthetic preview covered default editing, monthly selection, saving, restoring defaults, following-month ownership and employee visibility. Local screenshot evidence is under `outputs/sm-durcharbeit-owner-edit/`.

Frontend/backend TypeScript and the clean application builds are required before release. New component lint checks are clean; the shared market workspace retains the two existing set-state-in-effect lint findings at its dropdown reset and virtualized list reset, reproduced on the unchanged baseline. They are outside this change.

Backend protocol, preservation and release details: [owner editing](../backend/docs/SMDurcharbeit-owner-edit.md).
