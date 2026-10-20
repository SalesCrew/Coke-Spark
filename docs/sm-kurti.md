# SM Kurti — implementation and verification plan

## Product contract

SM phone: retain the existing Frag Kurti menu, use a dedicated authenticated SM endpoint and a concise Austrian German SM prompt. Supply only the signed-in SM's own profile, effective dated planning, current visible monthly Durcharbeit targets, saved visit progress and inbox counts. Explain Home, Aktivitäten, Durcharbeit, Zeiterfassung, Profil and Nachrichten correctly. Do not send GM data, RED-month KPIs, odometers, other employees, raw storage paths or credentials. Employee chat retains the existing 15-minute lifecycle. It cannot perform work or submit answers.

SM admin laptop: reuse the existing Kurti window, charts, visualization library and saved layout. Workspace selects the endpoint, prompt and tools; server authorization remains authoritative. Customer accounts cannot use either admin chat. GM and SM admin conversation contents stay separate, each with the existing eight-hour retention. No migration is necessary: existing user foreign keys support SM employee history, and an internal content namespace distinguishes SM histories without rewriting existing messages.

## Research tools and intended use

- App guide and module catalog: accurate navigation, supported actions, read-only limitations and KPI definitions.
- Overview: exact live counts and current monthly campaign state.
- People: search SMs, active status, travel-time capability, profile and own operational context.
- Markets: search individual chains, locations and IDs; inspect permanent Durcharbeit SM ownership separately from campaign/month overrides.
- Dated planning: effective replacement date/person/market, cancellation and completion; bounded calendar date range.
- Monthly Durcharbeit: campaign dates/status, assigned questionnaire versions, calendar periods, latest-version update preview, required/waived targets, effective owners, completion and actual follow-up visit counts; paused campaigns remain visible only to admins.
- Visits: search draft/submitted records, inspect question snapshots, saved answers/comments and available photo metadata using the same review loader as the admin UI. No rewrites, photo signing or image transfer to the model.
- Dashboard: existing canonical SM loaders and aggregators; selected date/person/market/region/chain/catalog scope, weighted basic activities, OOS and availability gain as percentage points. No invented four-category denominator or relative percentage growth.
- Times: current standard time submissions and monthly Durcharbeit time revisions, separately identified, with visit and travel minutes and date/person filters. Requests remain requests until approved.
- Questionnaires: templates, published/draft versions, modules, answer labels, OOS/basic-activity mapping and the global standard assignment; versioned visit snapshots remain authoritative for old visits.
- Answers: filterable distributions from current submitted observations, distinct visit counts and explicit observation denominators.
- Photos: available metadata via canonical visit review, with explicit sample/truncation reporting and no resurrecting withdrawn historical links.
- Requests: separate answer, deletion, dated-time and monthly-time queues, selected status and person.
- Campaign history: recorded reasons and before/after states, without changing historical business records.
- Messages: message subject and audience/read counts, no sending or read acknowledgments.
- Access: existing customer SM page grants; no passwords or auth secrets.
- Active support chat: a specific SM's still-active 15-minute history with a required support reason; reading never extends retention.
- Charts and visualizations: reuse GM admin renderers; values must come from tool results, preserve null/empty states and declared denominators.
- Excel: server-generated, bounded SM datasets in a downloadable chat card, showing filters, timestamp and truncation. No GM exports from the SM toolset.

## Invariants and release gates

All data tools are fixed parameterized queries/services, bounded and runtime validated. Internal admin role checked server-side; tools absent from the active set cannot execute. No arbitrary SQL, generic GM-tool fallback, business writes, new scheduler or migration. Model-facing business text is data, never instructions. Histories and requests are isolated per actor and workspace.

Verify actual routes with a fake OpenAI transport and disposable migrated synthetic database: worker own-scope and agreement gate, admin role gates, GM/SM tool isolation, structured multi-round calls, charts/exports, current/replaced ownership, paused campaigns, versions, snapshot answers, metadata withdrawal, date bounds and no business writes. Exercise real SM phone and SM admin laptop chat in an independent production-mode localhost preview. Build backend/frontend. Push backend first, wait for Railway; update gitlink, push frontend and wait for Vercel READY. Deployment verification uses platform metadata only, never production business queries.

## Verified implementation — 2026-10-20

- Dedicated `/sm/kurti/messages` endpoint checks SM authentication and the existing SM agreement, uses the SM prompt and only explicit authenticated-owner queries. Context includes own effective planning, visible monthly targets, current saved progress, time entries and pending request/unread counts. Paused campaigns are omitted from these contexts. Existing GM chat keeps its GM prompt and route.
- `/admin/sm-kurti/messages` exposes 26 SM research/analytics functions plus the existing visualization tools and a separate SM export preparation tool. It rejects unadvertised tool calls, arbitrary extra input, invalid IDs/calendar dates and unbounded ranges. Customer/worker accounts cannot access admin chat or exports. Error responses do not expose SQL or storage paths.
- Current visit review shares the canonical saved-answer/photo loader with an explicit option to omit row locks inside read-only snapshot transactions; editing retains its existing locking. Retained monthly time remains readable when its questionnaire is withdrawn, while the withdrawn answers are unavailable. This is separate from submitted-only dashboard hours.
- SM and GM admin histories have separate internal namespaces and expiry renewal, using existing tables and TTL cleanup. No migration/backfill/data repair/new scheduler is required. Account-bound requests and downloads stop when the signed-in principal changes.
- SM Excel datasets cover markets, planning, monthly targets, completed visits, times and answer distributions. Only validated filters are stored in chat; clicking downloads fresh authorized data. More than 5,000 rows is refused with a request to narrow filters, never silently truncated. Existing workbook styles and export card UI are reused.
- SM/admin privacy notices describe the feature, own-data scope, read-only behavior and existing 15-minute/eight-hour chat lifetimes. The immutable employee agreement text/version was not changed.

### Evidence and boundaries

42 relevant backend tests pass: new SM Kurti route/tool integration, SM answer-review/history and photo-withdrawal regressions, export/visualization regressions, existing GM routing tests and the concurrently released GM briefing tests. The new integration test executes all 26 research functions against disposable migrated PGlite, drives multi-round model calls through the actual routers, renders a metrics artifact, downloads server-derived data, rejects wrong roles/cross-workspace tools and compares the complete synthetic SM business graph before/after reads. It separately proves retained time versus withdrawn questionnaire access. Existing actual chat table migrations are applied to the fixture, including their constraints.

Backend production TypeScript build and optimized Next.js production build pass. The independent 3038/4038 preview exercises the real SM menu at 390×844 and admin at 1440×900: login, SM-only reply endpoint, admin research-to-metrics flow, downloadable Excel, restored cards after reload, and GM/SM workspace-history separation. The downloaded XLSX was reopened and checked for the synthetic market and expected headers. No uncaught browser errors or phone horizontal overflow. Screenshots were inspected for continuity with the existing UI.

The provider transport is deterministic synthetic OpenAI Responses output. No real user data, production environment files, production database/API calls or human localhost ports were used for tests. Live model wording/latency and the employee's physical phone/network are not verified by these tests. All new OpenAI calls retain the existing configured model, server-side credentials and `store: false` behavior. Implementation reference: [official function-calling guide](https://developers.openai.com/api/docs/guides/function-calling).

The release incorporates existing upstream GM weekly-briefing commits without changing their migrations or production configuration. Those migration files are not part of the SM Kurti change, and no production schema/data operation was performed here. Final deployment verification checks only Git commit/deployment metadata on Railway and Vercel.
