# GM Wochenschwerpunkte after “Später fortsetzen”

18 November 2026. Frontend navigation/loading correction; no schema or backend
runtime changes, and no production-data operation.

## Reproduction and finding

The real questionnaire page was connected to the existing GM visit routes using
a disposable PGlite database. A published synthetic two-page PDF used the real
briefing service/routes in a second disposable PGlite database. The independent
preview ran on3037/4037, with synthetic GM authentication, no production environment
files, and browser traffic restricted to those loopback origins.

After editing an answer and choosing “Später fortsetzen”, the weekly inbox loads
again on the dashboard. With that inbox response deliberately held back, the old
menu marks Wochenschwerpunkte as disabled and discards a physical tap. No reader
opens, either before or after the response is released. The baseline screenshots
record this condition. Fast responses already allowed the reader to open. This
reproduces a timing-dependent frontend defect; it does not establish the exact
network conditions on the employee’s physical iPad.

A separate concrete defect appeared in the same flow: CollapsibleMenu and the
weekly reader used identical sibling React keys based on the account identity,
producing duplicate-key warnings during reader updates.

## Resulting behavior

- Wochenschwerpunkte remains actionable while the inbox loads. The existing reader
  opens immediately with a loading state and displays the PDF when it arrives.
- A failed inbox read has a visible retry action in the reader. Retrying from the
  menu also opens the reader in the same gesture.
- The first publication is selected when initially empty asynchronous items arrive;
  an already selected publication is retained during subsequent inbox refreshes.
- Closing during loading prevents late responses from reopening the reader.
- Known-empty inboxes retain the disabled menu state; a load that returns empty
  explains that there are no current Wochenschwerpunkte.
- Navigation and the reader have distinct, account-scoped React keys.

The draft visit stays open and resumable. Reading, retrying and closing do not
cancel, submit or edit the visit. The normal menu/PDF design, permissions, visit
save/flush behavior and photo handling are unchanged.

## Verification

The production frontend build passed. Four PDF sizing/diagnostics tests and14
real-route PGlite integration tests passed for weekly/action briefings,
permissions, immutable publications/reading history and questionnaire recovery.

Six actual-browser scenarios passed at1024×1366 and1366×1024 with touch input in
Chromium and WebKit: delayed inboxes in both engines, failed inbox plus keyboard
retry, close-before-response, empty inbox and visible in-reader retry. Each saves
an answer, leaves the questionnaire, reads/retries/closes as applicable, then
reopens the same draft with its answer preserved. Full answer and photo-reference
hashes match before and after briefing access; no visit writes occur during that
access. No page exceptions, external requests or duplicate-key warnings occurred.
Deliberate503 responses in retry scenarios produce expected network console errors.

Both delayed-inbox scenarios also passed against the optimized `next start` build,
served only on3037 with the same synthetic API on4037.

The fixture and browser regression are in:
- `tests/gm-briefings-resume-server.mts`
- `tests/gm-briefings-resume-browser.cjs`

Run only from an isolated checkout without production environment files, against
its synthetic3037/4037 app. The fixture does not import the app entry point,
production DB client or scheduled jobs. The browser regression requires the
synthetic identity marker and rejects database/Supabase environment configuration.

```sh
env -i PATH="$PATH" HOME="$HOME" node --import ./backend/node_modules/tsx/dist/loader.mjs tests/gm-briefings-resume-server.mts
env -i PATH="$PATH" HOME="$HOME" node tests/gm-briefings-resume-browser.cjs
```

No production application smoke checks, SQL, migrations or data corrections were
performed. Existing answers, photos, PDF publications and reading records are
preserved. Hosting deployment verification uses control-plane metadata only.
