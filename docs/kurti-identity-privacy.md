# Kurti: IDs at the model boundary

Implemented 20 October 2026 for GM, SM, GM Admin and SM Admin. This extends the SM Kurti implementation in [sm-kurti.md](sm-kurti.md).

## Follow-up: employee experience and transparency

The follow-up in [kurti-ai-transparency.md](kurti-ai-transparency.md) supersedes the employee mention workflow described in this original release record. SMs/GMs use the ordinary input and their automatically authenticated own ID; they never need @. Admins keep the compact mention picker. A `[user:UUID:first]` greeting is resolved to the first name only in the browser. Names are still withheld from provider requests. New AI disclosures and reporting rules are additive; the original verification below records the preceding release.

## Original release: intended experience

Type `@` and select a person in the compact composer list. It shows a round initial avatar and one name per row, with the best prefix match selected. Arrow keys move, Enter selects without sending, Escape dismisses, and a second Enter sends. Clicking/tapping also selects. Employees can select themselves; internal full admins can select users they already administer. Customers cannot access either chat or directory.

The selected name remains readable in the composer and optimistic bubble. The wire message contains `[user:UUID]`. The model answers with the same token; the browser resolves it in messages, tables, charts and export titles. Machine IDs, links, series keys and export filters retain their values. An unavailable identity stays an ID rather than guessing a name. Editing within or pasting over a selected name removes its identity association; selection through `@` is required again.

## Provider boundary

`backend/src/lib/kurti-identity.ts` is shared by both route factories. It reads an internal, request-local identity dictionary; that dictionary is never included in a model request. The separate `/people` endpoints and reply `people` data serve authorized browsers only.

Before each provider call:

- Current account names, first/last names and supported spelling variants are replaced throughout instruction text, user/history text, live context and every tool round.
- Explicit person-name fields and snapshots are replaced even when their historical names differ from the current account. Structured person rows retain their user ID.
- Direct contact fields and photo storage/file identifiers are withheld. Narrative comments, notes, message bodies and free-text answer values from research tools are withheld, including third-party names that are not in the account directory.
- Person lookup uses selected IDs. Name-search tool attempts are rejected. Legacy internal name-based filters can resolve an authorized ID inside the server without exposing that name to the model. GM exports normalize selected identity filters to `gmUserIds`.
- Pre-change conversations remain readable in Spark and keep their existing TTL, but are excluded from future model history. New exchanges carry an internal identity-policy marker. No old records are rewritten.
- Strict tool schemas, function names, IDs, role enums and opaque encrypted reasoning remain structurally intact. Provider errors do not log echoed request text.

In admin chat, a known account name typed without a selected mention receives a local response asking for `@`; that input does not go to OpenAI. Forged, unavailable or malformed mention IDs are rejected. The identity rule is prepended prominently to every employee/admin system prompt. Named real-person examples in those prompts have been generalized.

## Model

All four surfaces explicitly use `KURTI_MODEL = "gpt-6-luna"`, Responses API, low reasoning, `store: false`. This deliberately supersedes any old `OPENAI_KURTI_MODEL` environment override. The legacy environment field is still accepted, with its default updated, to avoid an unrelated configuration migration. No new secret or deployment setting is required.

Official model contract checked: <https://developers.openai.com/api/docs/models/gpt-6-luna>.

## Scope and limits

This is pseudonymization and data minimization, not a legal compliance certification. User IDs remain personal data. No names are placed in provider-side lookup tables or token mappings.

An absolute guarantee against every arbitrary name in unrestricted natural-language input is not technically established by an account dictionary. Unknown third-party names, novel misspellings or obfuscations typed directly into chat can escape automatic detection. The composer and privacy notice instruct users to select people with `@` and avoid names/sensitive private text. Do not describe this implementation as complete anonymous processing or guaranteed EU AI Act compliance. The tests establish removal of registered identities and structured identity/snapshot fields in the covered paths.

Historical visit answers/photos, employee assignments, business rows and schema are unchanged. There is no migration or business-data backfill in this release. Human localhost remains normal authenticated app use.

## Verification

Use an empty environment and the disposable migrated synthetic fixture; never load production `.env` files or test against production/human localhost.

The regression suite covers both employee roles and both admin workspaces, every SM research query, multi-round function calls, existing chart/export behavior, scoped directories, unauthorized IDs, legacy history, Unicode/accents/emoji, collisions, contact/free-text redaction, canonical export IDs, mention editing and display substitution. It checks captured outbound provider bodies, including the selected model and `store: false`.

The production frontend build is exercised against the isolated 3038/4038 preview. Browser checks use SM phone 390×844, GM iPad 834×1194 and admin laptop 1440×900. They verify Enter selection versus sending, readable messages, ID-only message payloads, captured provider requests, exports/reload/workspace switching and absence of uncaught page errors. Screenshots are inspected, including compact picker states. A GM flex sizing defect discovered during that inspection is corrected so both navigation panels occupy their intended half of the shared sliding container.

Final verification: 49 regression/privacy tests, 4 existing GM tool-routing tests and 1 navigation contract passed (54 total). The combined migrated-DB suite was run with test-process concurrency 1; an earlier parallel run hit an existing PGlite concurrent-correction fixture failure, which passed with the serialized runner. The final browser run captured 14 model requests with no synthetic staff names, tested phone tap selection, arrow navigation, Enter selection/sending and Escape dismissal, and reopened an actual generated XLSX. No page errors occurred. Frontend and backend builds passed.

Visual follow-up: the picker matches the requested compact WhatsApp-style list. Chat containers use clipping instead of scrollable hidden overflow so focusing the new editor during the sliding animation cannot shift the GM conversation out of view. Suggestion navigation scrolls only its own list.
