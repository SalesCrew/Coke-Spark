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
