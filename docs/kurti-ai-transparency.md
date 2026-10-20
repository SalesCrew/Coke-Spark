# Kurti: implemented transparency and safeguards

Implementation record: **20 October 2026**. Covers GM, SM, GM Admin and SM Admin. This describes the implemented product and its verified technical behaviour; it is not a legal compliance certification.

## Capabilities and access

Kurti explains Coke Spark navigation, saved operational records and existing calculations. Employees receive their own context. Authorised internal full admins can research their workspace and create the existing tables, charts and Excel exports. Person-level IPP, visits, hours and saved bonus comparisons remain available through the existing read tools.

Worker IDs come from the authenticated session. Workers have no admin research-tool registry. The admin route requires the existing internal full-admin role; employee and customer sessions are denied. Each advertised tool is checked against the active workspace allowlist before dispatch. Existing functions validate their arguments and permissions. Kurti has no generic SQL, arbitrary-code or business-write tool.

The interface, @ picker, layout, dashboards, numerical formulas, questionnaire answers, photos and assignments retain their existing behaviour. Creating a permitted chart, export specification or chat-memory row is separate from changing a business record.

## Visible AI disclosure

All four chats display the KI badge and the notice above the input:

> KI kann Fehler machen. Prüfe wichtige Angaben in Coke Spark.

The information panel explains the assistant's purpose, reporting limits, OpenAI transmission, ID handling and chat expiry, with privacy and contact links. It supports keyboard opening, Escape, contained focus, outside dismissal and focus return. The notice stays on the chat background, outside the composer container.

The existing Kurti videos and chat controls remain in place.

## Person references and personal text

Admins choose people through the compact @ list. The browser encodes a selected person as `[user:UUID]`, while showing the name in the input and conversation. Replies, tables, chart labels and export titles resolve authorised references in the browser. Machine IDs, URLs, series keys and export filters keep their original values. An unavailable person remains an ID rather than a guessed name.

Employees use the ordinary input without @. Their own authenticated ID is supplied automatically. A `[user:UUID:first]` greeting is resolved to the first name only in the browser.

Before every provider call, a request-local identity dictionary replaces known account names and supported variants. Structured person-name fields, historical name snapshots and direct contact fields are replaced or withheld. Research comments, notes and free-text answer bodies are minimised. Name-to-ID mappings and the browser directory are not sent to OpenAI.

Local rules also recognise explicit personal introductions, title-prefixed names, bare lists of four or more title-case names, email addresses and labelled phone numbers. Known Spark metrics, retailer names, calendar terms and ordinary question/command words are preserved by these rules. An admin input requiring person selection receives the existing @ guidance before any provider call. Workers' recognisable personal text is redacted while own-data questions continue normally.

The same boundary applies to current text, eligible history, instructions and every tool round. Older stored text is not rewritten. Pre-boundary history is excluded from model input. Forged, unavailable and malformed person references are rejected.

These rules are targeted minimisation, not a universal natural-language name detector. Unknown names and obfuscations outside the supported patterns are not reliably recognised. IDs remain personal data. The UI tells users to avoid private and sensitive free text.

## Factual reporting

Shared operating instructions require saved facts and established calculations, the metric, period, filters and source for comparisons, and honest treatment of incomplete coverage. Missing data is unknown rather than automatically zero. Existing backend calculations and report results retain their values.

Numerical sorts describe recorded values, not a person's competence, effort, honesty or overall work quality. Different assignments, workloads and missing data can affect comparisons. No new composite employee score is introduced.

Unsupported personal judgments and recommendations on hiring, dismissal, discipline, promotion or compensation are outside Kurti's operating purpose. Explicit requests covered by the local policy rules are handled before provider/tool calls. Reporting saved bonuses and explaining established formulas remain supported. These language rules are distinct from the server's authentication and authorisation boundaries.

## Provider requests and chat retention

All four chats use **gpt-6-luna**, foreground Responses requests and `store: false`. One shared request budget covers admin tool rounds and retries. The backend allows approximately five minutes, with a response margin for the Railway proxy; the browser transport allows a small additional margin. Disconnects cancel provider work. Failed provider exchanges do not save or refresh conversation memory.

Worker history remains active for **15 minutes**; admin history for **8 hours**, refreshed by a successful saved exchange. GM and SM admin workspaces remain separate. Expired messages are excluded from reads and model history, then removed on read/save and through the existing cleanup scheduler. A support read does not extend a worker's expiry. Successful local clarification and policy replies are saved exchanges.

`store: false` disables Responses application-state storage for this request path. It does not by itself mean zero provider retention. OpenAI documents application-state and abuse-monitoring retention separately. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Operations and user guidance

The shared server-side emergency switch and content-free Kurti audit events are documented in [kurti-operations.md](kurti-operations.md). User guidance is provided in [kurti-user-briefing.md](kurti-user-briefing.md).

Chat responses and person-directory responses carry `Cache-Control: private, no-store`. There is no retention migration or historical-data rewrite in this implementation.

## Implementation references

- Backend identity and local privacy rules: `backend/src/lib/kurti-identity.ts`, `kurti-personal-text.ts`.
- Access, provider calls and chat integration: `backend/src/routes/gm-kurti.ts`, `admin-kurti.ts`.
- Operating instructions: `backend/src/lib/kurti-operating-policy.ts` and the four role prompts.
- Deadline, emergency configuration and audit events: `backend/src/lib/kurti-request-deadline.ts`, `kurti-settings.ts`, `kurti-observability.ts`.
- Browser-only person display: `src/lib/kurti-identity.ts`, `KurtiMessageInput.tsx`, `AdminKurtiPanel.tsx`.
- Visible disclosure: `src/components/kurti/KurtiDisclosure.tsx`.

## Executed verification

The backend's `npm run test:kurti-safeguards` runner starts its child process with an isolated environment. Actual route, identity, memory and reporting source is loaded with explicit replacements for configuration, authentication, database, storage and provider I/O. Database integration uses migrated disposable PGlite fixtures and synthetic users and records.

**52 backend checks passed**, covering all four chats, normal replies, ID references, local personal-text handling, old-history filtering without rewriting storage, research tools, numerical results, charts, exports, role/workspace boundaries, chat expiry, cancellation, timeouts, emergency disable/resume and audit metadata. Provider-error tests use the installed OpenAI SDK's actual error class while replacing all provider calls. Audit checks include error request IDs, malformed identifier rejection, listener cleanup and logging failure.

**5 frontend identity/navigation checks passed**, covering mention editing, browser-only name display, chart/export identity preservation, first-name greetings and SM navigation guidance. No frontend component or user workflow is changed by this safeguard update.

The backend TypeScript production build passed.

Verification does not connect to a production database, the human localhost app or live OpenAI, and does not start application/job entry points.
