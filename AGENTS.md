# Coke Spark working rules

The database configured by the local environment files is production and critical.

- Never use production data or production connections for tests, E2E, smoke checks, exploratory queries, fixtures, seeds, cleanup, migrations, or verification.
- Tests must use a disposable isolated database and synthetic data. Test configuration must not load the production environment files.
- Do not start application entry points that launch database write jobs for local testing.
- A request to implement, test, deploy, or roll back code does not authorize changing production data.
- Keep all environment values private and out of source control, logs, and test artifacts.

Keep the GM Dashboard’s original per-card filter controls and existing UI. The user rejected the experimental shared/global filter redesign. Chain and Market must allow multiple selections within the existing dropdowns on each card. Show each Handelskette as an individual row; Sonstige Märkte may be an extra shortcut selecting all other individual chains. Do not replace individual chain rows with REWE/SPAR groups; preserve their labels, styling, dimensions, and the dashboard layout.
