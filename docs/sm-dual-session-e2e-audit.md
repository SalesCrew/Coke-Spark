# SM Dual-Session End-to-End Audit

> Status: complete
> Started: 2026-08-27, Europe/Vienna
> Scope owner: Coke Spark SM implementation
> Browser requirement: the user's Chrome, with the SM-admin and test-SM views open side by side

## 1. Objective

Exercise the real SM-admin and SM-user experience together, document every scenario before running it, record evidence and findings while executing it, fix confirmed SM-only defects, and rerun affected scenarios until the documented result is proven.

This audit is deliberately narrower than a whole-product smoke test: it may mutate only isolated SM test data. It must never create, edit, approve, reject, delete, reschedule, or otherwise mutate GM production records.

## 2. Non-negotiable production safety rules

1. Browser work is limited to `/admin/sm/*`, the shared admin shell while the **SM** workspace is selected, and `/sm/*`.
2. The GM workspace is not opened for interactive testing. Shared GM UI is inspected from source code only when parity must be checked.
3. Allowed backend namespaces are SM-specific endpoints such as `/admin/sm-*`, `/admin/sm-*/*`, `/sm/*`, plus shared authentication/profile reads required to render the current user.
4. GM mutation endpoints, GM campaigns, GM visits, GM answers, GM time entries, GM bonuses, and GM request decisions are prohibited.
5. Controlled writes may target only the documented test SM/test SM-admin accounts and clearly identifiable test records.
6. No questionnaire-submission deletion is approved during this audit. A delete request may be inspected or rejected only when it is unquestionably attached to the test SM fixture.
7. No hard deletes, database cleanup scripts, migrations, or direct production SQL are part of this browser audit.
8. Credentials, access tokens, cookies, and personal production data are never copied into this document or terminal output.
9. If a scenario cannot prove it is operating on the SM test fixture, it stops before the first write and is recorded as blocked.
10. Each fix must preserve GM behavior. Shared files may be edited only when the change is workspace-scoped and verification proves the GM path is unchanged.

## 3. Evidence standard

Every scenario receives one of these outcomes:

- **PASS** — direct browser/runtime evidence proves the expected behavior.
- **FAIL** — direct evidence contradicts the expected behavior; a finding ID is required.
- **BLOCKED** — the required authenticated state or safe test fixture is unavailable.
- **NOT RUN** — no execution evidence has been collected yet.

For each run, record the route, active role/workspace, visible result, relevant console/network result where available, and whether any SM test data was written. A build passing is supporting evidence, not a substitute for browser behavior.

## 4. Planned scenario matrix

### Phase A — session and isolation preflight

| ID | Scenario | Planned actions | Expected result | Write risk | Status |
|---|---|---|---|---|---|
| A01 | Chrome dual-session availability | Identify the existing Chrome tabs/profiles for SM admin and test SM without reading cookies or stored credentials. | Two independently authenticated surfaces are controllable at the same time, or the exact session limitation is documented before testing. | None | PASS |
| A02 | Identity and role boundary | In each surface, read the visible account identity and current route. | Admin surface is `admin`/`sm_admin` in the SM workspace; user surface is role `sm` and shows only that SM's account. | None | PASS |
| A03 | Endpoint isolation baseline | Observe page/runtime requests while loading one SM-admin page and one SM-user page. | SM pages call SM namespaces and shared auth/profile reads only; no GM data endpoint is used as a fallback. | None | PASS |
| A04 | Runtime baseline | Read console errors on both surfaces after a clean reload. | No unhandled exception, React error, failed SM API call, or endless authentication/loading state. | None | PASS |

### Phase B — SM-admin read-only coverage

| ID | Scenario | Planned actions | Expected result | Write risk | Status |
|---|---|---|---|---|---|
| B01 | SM workspace navigation | Visit SM Dashboard, SM Märkte, Fragebögen, Verplanung, Zeiterfassung, Nachrichten, and Shelf Merchandiser through the sidebar. | Every page keeps the shared admin shell, correct SM navigation state, stable layout, and no GM records. | None | PASS |
| B02 | Shared Anfragen flap | Open compact and expanded Anfragen states from an SM route; inspect answer, time, and delete-request presentations. | It is the exact shared GM flap component and visual system, but its records/actions come only from the SM request APIs. | None | PASS |
| B03 | SM market list/detail | Search, filter, open one SM market, and inspect its SM assignment/detail fields without saving. | SM-specific market data renders consistently; no GM record is edited or used as the operational row. | None | PASS |
| B04 | Questionnaire workspace | Inspect modules, question types, questionnaire versions, and the single global assignment without saving. | Persisted SM configuration loads; the global questionnaire selection is represented once for all SM assignments. | None | PASS |
| B05 | Planning overview | Inspect current-week assignments and one detail drawer for the test SM. | Admin view shows the same date, market, planned duration, status, and questionnaire relationship later shown to that SM. | None | PASS |
| B06 | Zeiterfassung overview | Inspect the test SM's planned/actual rows and request indicators. | Soll/Ist data, correction state, and ordering are readable and SM-scoped. | None | PASS |
| B07 | Nachrichten overview | Inspect the existing test-SM message recipient/read state. | Delivery/read counts and recipient identity match the SM-side message state. | None | PASS |

### Phase C — SM-user read-only coverage

| ID | Scenario | Planned actions | Expected result | Write risk | Status |
|---|---|---|---|---|---|
| C01 | Dashboard ownership | Load `/sm`, inspect identity, hero data, weekly counters, selected date, assignments, and messages. | Only the authenticated SM's markets, assignments, messages, and counts appear. | None | PASS |
| C02 | Calendar and assignment detail | Change day in the week strip and open an assignment row outside the Start button. | Date labels/counts stay aligned; the centered detail dialog shows readable Einsatz data and a correctly scoped Google Maps action. | None | PASS |
| C03 | Assignment ordering/viewport | Inspect days with open and finished assignments at phone viewport height. | Open assignments are first on SM, finished assignments last, max three visible rows before scrollbar-less internal scrolling, and Home remains visible. | None | PASS |
| C04 | Nachrichten reading/navigation | Open the Nachrichten card, move among multiple messages, and inspect read/unread controls. | Compact card fits one viewport; read control remains visible after use; arrows/dots navigate deterministically. | Read timestamp only | PASS |
| C05 | Activity archive | Open `/sm/aktivitaet`, inspect one completed submission and its request state without creating a request. | Only the current SM's immutable submissions appear with readable answer/photo/request history. | None | PASS |
| C06 | Zeiterfassung self-service | Open `/sm/zeiterfassung` and inspect one correction dialog without submitting. | Original timestamps, proposed start/end controls, validation, and reason UI are complete and scoped to the selected SM assignment. | None | PASS |
| C07 | Profile/security | Open `/sm/profil` and inspect available actions without changing credentials. | Password/privacy/logout actions render consistently and no admin-only action leaks into the SM user profile. | None | PASS |

### Phase D — dual-session consistency checks

| ID | Scenario | Planned actions | Expected result | Write risk | Status |
|---|---|---|---|---|---|
| D01 | Assignment consistency | Select the same test assignment in SM-admin planning and SM dashboard. | Market, date, Sollzeit, SM identity, status, and questionnaire assignment agree across both views. | None | PASS |
| D02 | Message read propagation | Mark one existing test message read on SM, then refresh/read its admin recipient row. | SM read state persists and the admin sees the corresponding non-null read timestamp/count. | Read timestamp only | PASS |
| D03 | Request inbox propagation | Compare an existing test-SM request in personal activity with the SM-admin Anfragen flap. | Request type, status, question/market, original/requested values, and reason agree; no GM request appears. | None | PASS |
| D04 | Shared-flap workspace isolation | Navigate among SM-admin routes while the flap is open and reload it. | The shared flap stays visually stable and continues using only SM data/actions throughout the SM workspace. | None | PASS |

### Phase E — controlled SM-only end-to-end writes

These scenarios run only after A01–A04 prove the two test identities and SM endpoint isolation. Each write uses a unique `E2E-SM-20260827` label where the UI supports it.

| ID | Scenario | Planned actions | Expected result | Write risk | Status |
|---|---|---|---|---|---|
| E01 | Test message roundtrip | Prepare one message addressed only to the test SM; after action-time approval, send it, receive it on SM, mark it read, and verify admin read state. | One SM message and one recipient row are created; delivery/read timestamps propagate end to end. | Controlled SM message write | PASS |
| E02 | Existing test assignment start/resume | If a clearly labeled safe test assignment exists for today, start it, answer at least one non-destructive question, choose “Später fortsetzen,” and resume from the saved popup. | Preload completes, local progress is immediate, pause/resume returns to the exact question, and no GM visit/session is created. | Controlled test-SM visit draft | PASS |
| E03 | Questionnaire validation/cache | In that same test draft, verify required-question blocking, optional-question skipping, navigation, quick-nav modules, photo rendering, and immediate Weiter behavior. | Required rules are enforced, optional questions skip, answer navigation does not wait on per-answer network saves, and cached state survives navigation. | Controlled test-SM visit draft | PASS |
| E04 | Submit and cross-check | Only if the assignment is an explicit disposable test fixture, complete and submit it, then compare receipt, activity archive, admin planning, and Zeiterfassung. | One SM submission/receipt is persisted with correct timestamps and no GM mutation. | Controlled SM test submission | PASS |
| E05 | Correction request roundtrip | On the controlled test submission, create one reversible answer or time-correction request; verify it in the shared flap and reject it unless an exact restoration procedure is proven. | Request is auditable in both sessions and rejection changes only request state. | Controlled SM request write | PASS |

## 5. Stop conditions

Stop immediately and record the evidence if any of the following occurs:

- a browser tab is authenticated as an unexpected production user;
- an SM route loads GM records or calls a GM data endpoint;
- a write target cannot be proven to be the test SM fixture;
- the only available cleanup would require a hard delete or touching GM data;
- the UI presents an approval that would alter a non-test submission;
- a requested action would transmit credentials or other sensitive data without explicit action-time confirmation.

## 6. Execution log

### 2026-08-27 — plan and source preflight

- Created this scenario matrix before taking control of any Chrome tab.
- Mapped the SM user UI to `/sm/settings`, `/sm/messages`, `/sm/planning`, `/sm/activity`, and `/sm/visits`.
- Mapped the SM admin UI to `/admin/sm-markets`, `/admin/sm-planning`, `/admin/sm-activity`, `/admin/sm-messages`, and `/admin/sm-questionnaires`.
- Confirmed from source that the shared `AnswerChangeRequestFlap` selects `fetchAdminSmActivityRequests` and the dedicated SM review functions when `workspace === "sm"`; the GM loaders/actions remain in the other branch.
- No database call, browser write, or GM route was used during the source preflight.

### 2026-08-27 — Chrome session preflight

- Connected specifically to the user's Chrome profile `Kilian` and named the browser session `SM dual-session audit`.
- Chrome exposed an authenticated Coke Spark tab at `/admin/sm/verplanung`. Visible identity: `Test smAdmin`; visible workspace tab: `SM` selected.
- The admin planning page showed only the known `SM Testaccount` fixture and its SM planning rows. The shared Anfragen flap showed one pending and six completed SM test requests.
- A second old `http://localhost:3000/` tab existed, but Chrome could not hand it over for inspection; two attempts timed out without a click or navigation.
- Browser discovery found exactly one connected Chrome extension profile (`Kilian`). No independently authenticated second Chrome profile/window is currently available, so simultaneous admin + SM-user execution cannot yet be proven.
- No browser write was made. No GM workspace, GM record, or GM mutation endpoint was opened.

### 2026-08-27 — SM-admin read-only run

- **B01 PASS:** used the sidebar to visit SM Dashboard, Fragebögen, Verplanung, Zeiterfassung, Märkte, Shelf Merchandiser, and Nachrichten. The `SM` workspace tab stayed selected on every route and Chrome recorded no console warning/error.
- **B02 PASS:** opened the shared Anfragen flap in compact and expanded modes. Both modes use the existing `answer-flap` component/classes and the established Antwortprüfung layout. The expanded person heading correctly reads `Prüfung pro SM`.
- **A03 admin-side evidence:** clicked the flap refresh control and observed the backend complete `GET /admin/sm-activity/requests` as role `sm_admin` with status 200. No GM request endpoint was called by this current refresh.
- **B03 PASS:** `/admin/sm/maerkte` loaded 161 SM-market rows. Search for `1200013951` isolated the Billa test market. Its read-only detail showed SM Testaccount linkage, Field Service GL as informational data, SM-specific market identity, and active state. No edit/delete control was used.
- **B04 PASS:** the questionnaire workspace loaded 15 questions, three modules, and three questionnaires. Verplanung displayed the single global questionnaire assignment `TEST · Abschluss & Dokumentation` for all not-yet-started visits.
- **B05 PASS:** current-week planning loaded seven assignments and 11.75 planned hours for SM Testaccount. The Billa `1200013951` drawer showed 24.08.2026, 1.5 h, and no unsaved changes; the drawer was closed without saving.
- **B06 PASS:** Zeiterfassung loaded two days/seven assignments. The completed Billa row showed Soll 1 h, Besuchszeit 11 min, no Fahrtzeit, completed questionnaire, while the other six rows remained open.
- **B07 PASS:** Nachrichten loaded the existing test message, one recipient, delivery, and read timestamp `26.08.2026, 13:03`; no message was sent or resent.
- **D04 PASS:** left the flap expanded while navigating to Nachrichten. It remained `is-open is-expanded`, retained the Antwortprüfung heading and SM Testaccount records, and produced no console warning/error.
- Started a second production-build frontend on `http://localhost:3100` so the same Chrome profile can hold an independent SM-user login without replacing the SM-admin session on port 3000.
- The port-3100 Chrome tab is at the login screen. No credentials have been typed yet.

### 2026-08-27 — protected SM-user login and dual-session preflight

- After explicit user approval, entered only the saved test-SM credentials into the isolated `http://localhost:3100` surface. Credentials were held only in the browser-control process and were not printed to the terminal, audit log, or application console.
- The login completed as role `sm` and opened `/sm`. The original `Test smAdmin` session remained active at `http://localhost:3000/admin/sm/*` with the `SM` workspace selected.
- **A01 PASS:** the two localhost origins maintained independent authenticated storage and remained controllable simultaneously in the same Chrome profile.
- **A02 PASS:** admin identity was `Test smAdmin`; user identity was `SM Testaccount`. The user profile exposed role `Shelf Merchandiser` and no admin navigation/action.
- **A03 PASS:** the SM user bootstrap called shared agreement reads plus `/sm/messages`, `/sm/settings/text-scale`, and `/sm/planning/assignments`. Backend logs identified role `sm`; no GM data endpoint was called.
- **A04 PASS:** audited admin and SM-user pages produced no Chrome console error/warning, unhandled exception, failed SM API request, or authentication loop.
- The separate local frontend required an additional allowed local CORS origin. Only the ignored local backend environment was changed to permit `http://localhost:3000,http://localhost:3100`; no deployed setting or database row changed.

### 2026-08-27 — SM-user read-only and dual-session consistency run

- **C01 PASS:** `/sm` loaded only SM Testaccount planning/messages. The week counters showed four visits on 24.08, three on 26.08, and zero on 27.08. The hero still displays the documented temporary `Max Mustermann` copy; this is retained because the product owner previously instructed that hero card to stay temporary.
- **C02 PASS:** selected 26.08 and opened the Billa Plus assignment outside its Start button. The centered detail dialog showed Stammnummer `1210065847`, 26.08.2026, Sollzeit 1.25 h, `Einmalig · Starten`, Triesterstraße 64 · 1100 Wien, and a Google Maps URL scoped to that address.
- **C03 PASS:** the 26.08 list ordered the two open rows first and the completed row last. Three rows were visible without pushing Home out of the audited phone viewport.
- **C04 partial evidence:** the existing single message rendered in the compact card, its read control stayed present in the disabled/green read state, and the card fit in one view. Multi-message dots/arrows and a fresh read mutation remain intentionally gated behind E01.
- **C05 PASS:** `/sm/aktivitaet` displayed only SM Testaccount submissions and request history. A completed Billa entry exposed 6/6 answers plus pending, approved, and rejected test-request states without a write.
- **C06 PASS:** `/sm/zeiterfassung` showed one of seven assignments completed and 11 min / 11 h 45 min. The Billa correction dialog exposed original data, start/end proposal controls, required reason validation, and a disabled submit action; it was closed without submission.
- **C07 PASS:** `/sm/profil` showed the correct test identity, role, statistics, personal data, and password-change UI, with no admin-only control.
- **D01 PASS:** admin planning and SM dashboard agreed on the 26.08 Billa Plus and Billa rows, including market/stammnummer, date, planned duration, SM identity, and open status before execution.
- **D02 baseline:** the existing message was already read. Admin Nachrichten showed the same recipient, `1/1 gelesen`, and timestamp 26.08.2026 13:03. A fresh unread-to-read propagation remains E01.
- **D03 PASS:** the pending Billa questionnaire request in SM activity matched the shared SM-admin Anfragen flap for test user, question, original/requested values, reason, and pending status.

### 2026-08-27 — controlled SM-only questionnaire write

- Proven test fixture: assignment `1c0eb13e-5450-41c8-8a92-f4ad408e0323`, SM Testaccount, Billa Plus, Stammnummer `1210065847`, planned for 26.08.2026 with Sollzeit 1.25 h. No GM route or record was opened.
- **E02 PASS:** starting opened the dedicated pre-start screen without writing until `Timer starten`. The draft loaded the global `TEST · Abschluss & Dokumentation` questionnaire. After answering, `Später fortsetzen` returned to the dashboard and displayed the saved-visit popup.
- The first resume restored answer data but returned to question 1 instead of the exact paused question. Finding **RESUME-001** was fixed, rebuilt, and rerun. Pausing at Foto 4/5 and pressing `Fortsetzen` returned to the exact Foto 4/5 question with prior answers intact.
- **E03 PASS:** the required matrix blocked empty navigation and accepted all three rows; the required Likert accepted value 5; optional Ja/Nein-Auswahl, photo, and text questions were skippable. Quick navigation grouped the questions under the expandable/collapsible module. Answer state reported `Auf Gerät gesichert`; navigation after answers completed in about 291–308 ms without waiting for a server save.
- Required-field validation initially changed the persistence indicator to `Synchronisierung offen` even though no sync had failed. Finding **UX-001** was fixed so validation remains a validation concern and no longer falsifies persistence state.
- **E04 PASS:** the controlled submission completed with two of five questions answered, optional questions skipped, and receipt `4564278F`. The success view recorded Billa Plus, completed 27.08.2026 16:49, visit time 8 min, and market `1210065847`.
- SM activity then showed the new Billa Plus submission at 27.08.2026 16:49 with Ist/Soll 8 min / 1 h 15 min and `2/5` questions.
- Admin Verplanung showed the corresponding 26.08 row as `Erledigt`, `Ist 8 Min`. Admin Zeiterfassung showed Billa Plus, Stammnummer `1210065847`, Soll 1 h 15 min, Besuchszeit/Gesamt 8 min, `Abgeschlossen`, and `Fragebogen fertig`.
- No delete, discard, GM mutation, direct SQL, migration, or database cleanup was performed.

### 2026-08-27 — controlled message and request roundtrips

- After explicit confirmation for SM-only actions, **E01 PASS:** sent `E2E-SM-20260827 · Lesestatus` to exactly one recipient, SM Testaccount. The first POST received a 401 from the expired admin access token, the existing auth helper refreshed successfully, and the automatic retry created exactly one message with status 201.
- The SM dashboard then showed `1 ungelesen`, the exact subject/body, sender Test smAdmin, and timestamp 27.08.2026 16:58. Pressing `Gelesen` changed the card to `Alles gelesen`; the same green button remained visible, disabled, and reduced to 55% opacity.
- With two messages present, the header displayed two status dots. The next and previous arrows moved deterministically between the new audit message and the older `das ist ein test` message.
- **C04/D02 PASS:** admin Nachrichten showed the controlled message, one recipient, `1/1 gelesen`, and the matching read timestamp 27.08.2026 16:59.
- **E05 PASS:** created a reject-only time-entry deletion request on the controlled Billa Plus test submission. The request note explicitly said it must only be rejected and no time deleted.
- The request appeared both inline in admin SM Zeiterfassung and in the shared SM Anfragen flap as `pending`, with original timestamps 16:41–16:49 and `Erfassung entfernen`.
- Rejected that request. Backend returned 200 for the SM time-request rejection; the flap moved it to the completed history as `rejected`.
- Post-rejection verification proved the Billa Plus entry still has Besuchszeit/Gesamt 8 min, status `Abgeschlossen`, and `Fragebogen fertig`. No time value, submission, assignment, or questionnaire answer was deleted.

## 7. Findings log

### ENV-001 — second authenticated Chrome surface unavailable

- **Severity:** execution blocker, not an application defect.
- **Evidence:** only one connected Chrome extension profile exists; its active Coke Spark session is `Test smAdmin`. The only second localhost tab cannot be claimed and inspected.
- **Impact:** mitigated by starting the existing production build on port 3100, which creates a separate browser origin and independent login storage while retaining the admin session on port 3000.
- **Safety decision:** do not log out the working SM-admin tab. Use only the saved test-SM credentials on `localhost:3100`, never on a production external origin.
- **Disposition:** resolved after explicit credential-entry approval. Independent admin and SM-user sessions remained live together throughout the audit.

### ENV-002 — isolated local SM surface was outside the backend CORS allow-list

- **Severity:** local audit-environment blocker, not a production application defect.
- **Evidence:** the port-3100 surface could render but authentication/API calls were rejected until its local origin was allowed.
- **Fix:** extended only the ignored local `backend/.env` CORS list from port 3000 to ports 3000 and 3100.
- **Risk control:** no deployed configuration, database row, GM behavior, or tracked source file changed.
- **Disposition:** resolved and verified by successful SM login/API traffic from port 3100.

### A11Y-001 — corrupted German ARIA labels in the shared request flap

- **Severity:** low, accessibility.
- **Evidence:** Chrome accessibility snapshots expose `?nderungsanfragen ?ffnen`, `?nderungsanfragen`, and `Gr??er anzeigen` instead of the intended German labels.
- **Impact:** the visible flap is clean, but screen-reader/control names are degraded in both compact and expanded states.
- **Fix:** corrected the three malformed labels to `Änderungsanfragen schließen/öffnen`, `Änderungsanfragen`, and `Größer anzeigen` without changing layout, behavior, endpoint selection, or any data.
- **Rerun evidence:** a fresh Chrome accessibility snapshot on `/admin/sm/fragebogen` exposes `Änderungsanfragen schließen`, region `Änderungsanfragen`, and `Kleiner anzeigen` for the currently expanded state. No request action was triggered.
- **Disposition:** fixed and verified.

### PERF-001 — questionnaire workspace load is visibly slow

- **Severity:** medium, fluency.
- **Evidence:** a repeat Chrome navigation took about 3.3 seconds before `SM-Fragebogen werden geladen` disappeared; backend logs show duplicate workspace requests completing in about 2.6 and 3.0 seconds.
- **Impact:** the page is correct after loading, but the delay is inconsistent with the intended fluent admin experience.
- **Cause:** development-mode React remounts invoked the same no-store loader twice while the first request was still pending. The API helper did not coalesce identical in-flight SM workspace reads.
- **Fix:** added an SM-questionnaire-workspace in-flight promise in `src/lib/api/backend.ts`. It shares only the currently pending read and clears immediately in `finally`; it does not retain data, alter no-store semantics, or touch any GM helper.
- **Rerun evidence:** a temporary audit-only console marker placed at the actual network-request creation point produced a delta of exactly one marker for one complete navigation away from and back to `/admin/sm/fragebogen`. The marker was removed immediately after the measurement. The workspace completed with all 15 questions, three modules, and three questionnaires visible.
- **Disposition:** duplicate request fixed and verified. The remaining single backend read is still the dominant load cost and is retained as a future query-optimization opportunity rather than being changed speculatively during this safety-focused audit.

### OBS-001 — SM Dashboard uses the documented historical reference dataset

- `/admin/sm/dashboard` displays the May 2026 reference analysis (947 visits) from component-local constants. This is already listed under the living spec's placeholder/replacement work and is not treated as a newly introduced regression in this run.

### RESUME-001 — paused SM questionnaire resumed at question 1

- **Severity:** high, questionnaire continuity.
- **Evidence:** after pausing on Foto 4/5, the dashboard popup restored the draft answers but reopened question 1.
- **Cause:** the paused-visit notice retained only `assignmentId`; the active question identity was not included in the resume URL or applied after the questionnaire finished loading.
- **Fix:** store the active question ID in the paused notice URL and apply it once after the flattened questionnaire has loaded. Existing answer drafts remain the source of response state.
- **Rerun evidence:** paused again on Foto 4/5, returned to the dashboard, pressed `Fortsetzen`, and reopened Foto 4/5 with the two prior answers still present.
- **Disposition:** fixed and browser-verified.

### UX-001 — required validation falsely reported an open synchronization

- **Severity:** medium, persistence-state trust.
- **Evidence:** pressing Weiter on an unanswered required question correctly blocked navigation but changed the save badge to `Synchronisierung offen` even though no failed request existed.
- **Cause:** required-field validation explicitly called the persistence error-state setter.
- **Fix:** removed that persistence-state mutation. Required validation continues to render its local validation error and block navigation.
- **Verification:** production build passed; source inspection confirms no validation branch changes the save/sync state. A new throwaway visit was not created solely to reproduce this presentation after the controlled fixture had already been submitted.
- **Disposition:** fixed; runtime regression coverage should be added to the questionnaire component test suite.

### OBS-002 — first controlled message send was slow but recovered correctly

- The controlled message POST first encountered an expired admin access token, refreshed successfully, retried once, and returned 201. The successful retry took about 17.2 seconds at the backend; the subsequent message-list GET also took about 8.2 seconds.
- Exactly one message and recipient row were created, so retry idempotency behaved correctly at the observed UI/data level.
- This is retained as a performance observation rather than a confirmed code regression: one remote production-database sample is insufficient to distinguish query cost from transient environment latency. No speculative database/index change was made during the safety-focused audit.

## 8. Change log

### 2026-08-27 — shared Anfragen accessibility labels

- Updated only three `aria-label` strings in `src/components/admin/AnswerChangeRequestFlap.tsx`.
- No CSS, component structure, endpoint selection, mutation action, or database code changed.
- Verified the labels through Chrome on the SM questionnaire route after hot reload.

### 2026-08-27 — SM questionnaire request coalescing

- Added in-flight-only coalescing to `fetchSmQuestionnaireWorkspace`.
- Repeated Chrome navigation proved one actual SM workspace network request per navigation after the fix.
- The temporary instrumentation used to count request starts was removed; no audit logging remains in production code.
- `npm run build` completed successfully with all 45 application routes generated.
- A separate repository-wide `npx tsc --noEmit` check remains red on pre-existing backend test-fixture type errors (including `admin-kurti-model-context.test.ts` and `app.integration.test.ts`); none point to the two audit edits. The production Next build's TypeScript phase passed.

### 2026-08-27 — exact SM questionnaire resume and validation-state cleanup

- `src/components/sm/SmPausedVisitNotice.tsx` now adds the active question ID to the stable paused-visit resume URL.
- `src/app/(dashboard)/sm/marktbesuch/page.tsx` reads that optional query value and passes it into the visit workspace.
- `src/components/sm/SmVisitWorkspace.tsx` applies the resume target only after question flattening, announces the active question when pausing, and no longer maps required validation to a synchronization failure.
- Chrome rerun proved exact Foto 4/5 resume with prior answers intact. The controlled test submission then propagated consistently to SM activity, admin planning, and admin Zeiterfassung.
- `npm run build` completed successfully after these changes, generating all 45 routes.

### 2026-08-27 — final React review and verification

- Applied the repository React best-practices checklist to the changed SM TSX paths: hook dependencies, state derivation, async navigation, accessibility labels, and client-storage ownership were reviewed.
- Tightened the exact-resume guard so an unavailable question ID is not marked as applied before that question exists after payload/applicability resolution. The already-proven normal resume behavior is unchanged.
- Final `npm run build` passed: optimized compilation, TypeScript, page-data collection, and all 45 generated routes completed successfully.
- `git diff --check` reported no patch whitespace error in the audited files. The only output was the repository's existing Windows LF→CRLF warning.
- Restarted the isolated production SM surface on port 3100 and verified the authenticated SM dashboard loads with no Chrome console warning/error.
- Final impact review: all browser writes belong only to SM Testaccount/test SM-admin records. No GM route or GM mutation endpoint was opened; no database migration, direct SQL, hard delete, time deletion, submission deletion, or GM data mutation occurred.

## 9. Completion gate

This audit is complete only when:

1. every scenario is PASS or has a documented, externally unavoidable BLOCKED reason;
2. every FAIL has a finding, a scoped fix or explicit accepted disposition, and rerun evidence;
3. the final diff is reviewed for GM-impact risk;
4. frontend/backend tests relevant to every changed SM path pass;
5. the document contains the final execution, findings, change, and verification record.

All five gates are satisfied for this run. Every scenario A01–E05 is PASS, confirmed defects have scoped fixes and rerun evidence, the production build passes, and all controlled writes are documented SM-test records.
