# Kurti: transparent assistance and factual reporting

Implementation and research date: **20 October 2026**. Applies to GM, SM, GM Admin and SM Admin. This is an engineering assessment and organisational handoff, **not a finding of full AI Act or GDPR compliance**.

## Intended purpose and retained capabilities

Kurti explains Coke Spark navigation, saved operational records and established calculations. Employees receive their own context. Authorised internal full admins can query their workspace through fixed server functions and create the existing tables, charts and exports. Preserved capabilities include person-level IPP/visit/time/bonus comparisons, metric sorting, existing formulas, role-specific research and relevant active-chat support access.

A ranking means recorded values sorted for a named metric, period and filters, with source and coverage. It does not establish overall work quality. Different assignments, workloads and missing records can explain differences; the assistant must not invent a cause. No new composite employee score is introduced. Existing reporting algorithms, numerical values, questionnaire answers/photos, visits, assignments, dashboard controls and export calculations are unchanged.

Unsupported employee judgments and recommendations about hiring, dismissal, discipline, promotion or compensation are outside the intended purpose. Reporting saved bonus values and explaining established bonus formulas remains supported. Asking for the “worst employee” leads to a factual metric comparison or a request to choose a metric, not an adopted judgment.

## What changed

| Area | Implemented behaviour | Evidence |
|---|---|---|
| Employee identity | SM/GM retain the ordinary composer; no mention picker or @ requirement. Authenticated own ID is explicitly supplied in instructions. Known account names are redacted without requiring selection. | `backend/src/routes/gm-kurti.ts`, `kurti-identity.ts`; `CollapsibleMenu.tsx` |
| Admin identity | Existing compact @ picker and canonical IDs remain. Foreign/unavailable IDs cannot expand access. Browser-only name mapping also supports first-name greetings via `[user:UUID:first]`. | `AdminKurtiPanel.tsx`, client/server `kurti-identity.ts` |
| Shared instructions | All four prompts identify Kurti as AI; require evidence, unchanged formulas, honest coverage, untrusted-input handling and factual metric sorting; disallow unsupported judgments and personnel/pay recommendations. Human-biography presentation removed. | `kurti-operating-policy.ts`, all four role prompts |
| Local explicit-request handling | Clear personnel/trait requests are answered locally, before provider/data-tool calls; metric-based sorts and bonus explanations pass through. “Worst/best employee” without a metric asks for one. | `kurtiRestrictedRequestReply`, both route factories |
| Visible disclosure | KI badge beside the existing title; exact persistent notice above input; top-right information control. Existing videos, identity, navigation, chat controls and message/artifact layouts preserved. | shared `KurtiDisclosure.tsx` |
| Information panel | Keyboard opening, Escape, focus containment/return, outside dismissal; purpose, limits, OpenAI transmission, role/ID behaviour, expiry, privacy/contact links. | shared `KurtiDisclosure.tsx`, synthetic browser checks |

The local language classifier covers explicit patterns, not all possible meanings or obfuscations. System instructions reduce semantic risk but cannot guarantee every generated answer. It is not described as an access-control or legal boundary. The isolated provider double validates integration and exact outbound payloads; it does not prove the live model will always comply.

## Server boundaries and data flow

Authentication and agreement checks happen before worker chat access; employee IDs come from the authenticated principal, never a user-supplied context ID. The worker has no research tool registry. The admin route requires the existing internal full-admin role; employee/customer sessions are rejected. Advertised workspace tool allowlists are checked before dispatch, and the existing fixed functions validate arguments and roles. No generic SQL, arbitrary code execution or business-write tool is added. Creating an authorised chart, export specification or chat-memory row is distinct from changing business records. Window preferences retain their existing behaviour.

Before each OpenAI Responses call, a request-local internal dictionary replaces known account names and supported variants. Structured person-name/snapshot fields and direct contacts are withheld/replaced; research comments, notes and free-text answer bodies are minimised. The dictionary and authorised browser name mapping are not sent to OpenAI. Provider history includes only exchanges marked for the identity boundary; older messages remain human-readable with their existing expiry and are not rewritten. Employee history excludes the now-obsolete local @ help reply.

Relevant user messages, eligible active history, instructions, own live context or authorised tool results still go to **OpenAI**. IDs remain personal data. Unknown third-party names, new misspellings or obfuscations in unrestricted user text are not reliably detected. Users must avoid private/sensitive text; this implementation must never be represented as guaranteed anonymous processing or an absolute name detector.

All four routes keep `gpt-6-luna`, foreground Responses API and `store: false`. The SDK uses the default endpoint; the code does not establish EU-only processing, a signed processor agreement, a particular organisation's training opt-in, Modified Abuse Monitoring or Zero Data Retention approval. These require account/contract confirmation, not inference from an API flag.

OpenAI distinguishes application state, abuse-monitoring logs and other retention. `store: false` is not a promise of zero provider retention. Default abuse-monitoring retention can be up to 30 days, with documented exceptions; approved controls can alter this. Extended prompt caching can involve separate retention. No project-specific provider setting was inspected or changed for verification. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Spark chat retention

Existing worker memory remains active for **15 minutes**; admin memory for **8 hours**, refreshed by a successful saved exchange. GM and SM admin workspace histories remain separate. Expired rows are excluded from model/history reads and purged on read/save and by the existing approximately one-minute scheduler. Cleanup failures can delay physical removal; this is not an exact-second deletion or a backup/provider deletion guarantee. A permitted support read of active employee chat does not extend its TTL. Unsuccessful provider exchanges do not save/refresh conversation memory; successful local clarification/safeguard replies are saved exchanges.

No retention migration, backfill, historical-row rewrite or production data operation is part of this change. Privacy pages retain the existing contact **datenschutz@merch.at** and correct employee identity instructions. The information panel links to `/datenschutz/gm`, `/datenschutz/sm` or `/datenschutz/admin` as appropriate.

## Current official AI Act sources and dates

Research used current primary Commission/AI Act Service Desk material on 20 October 2026. The Commission records the AI Omnibus entering into force on **27 July 2026**, Annex III high-risk requirements applying from **2 December 2027**, and regulated-product requirements from **2 August 2028**. Do not use the superseded August 2026 timeline for Annex III employment systems. [Commission AI Act timeline](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai).

The consolidated Service Desk text identifies amendments against the 27 July 2026 consolidation. Direct EUR-Lex ELI pages returned an access/challenge page during research; no claim is made to have read their complete content. The Commission's high-risk guideline page still labels its material **draft/non-binding**, even though it was updated on 19 October 2026. Do not describe that draft as an adopted binding rule. [Classification guidance](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-high-risk-systems).

### Currently applicable duties versus recommendations

**Transparency:** Article 50's interaction disclosure applies from **2 August 2026**. The visible KI label and notice identify AI during interaction; the information panel supplements them. Accessible first-interaction disclosure and any applicable machine-readable output-marking duties require assessment across the product/provider chain; this UI change alone does not establish every Article 50 obligation. The retained local videos are unchanged. Kilian withdrew the likeness/provenance follow-up; no consent, AI-generation or real-person provenance conclusion is inferred. [Commission transparency guidance](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations), [Article 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50).

**AI literacy:** Article 4 remains applicable after the 2026 amendment. Providers/deployers must support staff AI literacy in context; the amendment does not prescribe a specific “sufficient” level. Practical onboarding, examples and a record of instruction are recommended implementation measures; a label is not training. Conditional high-risk oversight training remains separate. [Commission AI-literacy FAQ, amended Article 4 section](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers).

**GDPR continues now:** decide and document the lawful purpose/basis, necessity, recipients, retention and employee information before treating technical safeguards as approval. Assess processor/subprocessor contracts and international transfers with the actual deployment/account arrangements. These are organisational checks, not facts established by this patch. [Commission GDPR guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en).

### Classification assessment: unresolved and material

**Engineering assessment:** retained person-level visits, hours, IPP and bonus comparisons can foreseeably be used to monitor/evaluate workers. That creates a material **Annex III 4(b) employment-monitoring assessment**, even though Kurti is read-only and recommendations are restricted. It cannot be dismissed by using IDs, neutral wording, human review or a disclaimer. Employee own-data assistance and admin cross-person analytics have different capabilities and need explicit scope evaluation. [Annex III 4(b)](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3).

An Article 6(3) exception is not assumed. Assess whether the actual intended use and foreseeable workflow materially influence decisions, whether a narrow/preparatory exception truly fits, and whether profiling is performed. For Annex III profiling, the exception is unavailable. A provider claiming a non-high-risk exception must document that assessment and consider the associated registration requirement. **No final classification is established here.** Existing reports were preserved rather than silently disabled to influence the classification. [Article 6](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6).

### Conditional high-risk work

If the retained system/use is classified high-risk, allocate provider duties (risk/data governance, technical documentation, quality management, conformity/registration, logging, accuracy/security and post-market monitoring) and deployer duties before the applicable deadline. This repository does not supply a complete conformity programme or approval.

For a high-risk deployment, Article 26 includes competent oversight, appropriate inputs, monitoring, workplace notice to affected workers/representatives and controlled automatic logs retained for an appropriate period of at least six months unless applicable law provides otherwise. **The present 15-minute/8-hour chat TTL is not evidence that such logging is satisfied.** Define minimal audit events, access and lawful retention separately; do not silently retain full chats longer. Incident processes and responsible people also need designation. [Article 26](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26).

A GDPR DPIA assessment is independent of the final AI Act label: examine evaluation, monitoring, dataset combination, worker context and residual risks. Complete it where processing is likely high-risk; assess Austrian authority lists and any consultation requirement. [EDPB accountability/DPIA guidance](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en).

Article 27 FRIA does **not** apply automatically to every private employer: it targets the stated public-law/public-service and specified other deployers. Confirm applicability for the actual entities/use; where relevant, coordinate with a DPIA without treating the two as interchangeable. [Article 27](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-27).

## Organisational owners and open decisions

The privacy pages identify Institut für Verkaufsförderung GmbH as controller, but this is not independent verification of the entire AI supply chain. Confirm which legal entity places/brands the application as provider, which employer/entity deploys it, and the developer/OpenAI processor/provider roles. OpenAI's model-provider role does not settle application-provider obligations.

| Owner to designate | Required confirmation / next action |
|---|---|
| Product owner + legal | Sign off intended purposes, actual person-level analytics, foreseeable decisions, classification/profiling assessment and applicable transition rules. |
| Privacy/controller | Lawful basis, Articles 13/14 notices, processor/DPA and transfer arrangements, minimisation, employee rights, deletion/backups and DPIA outcome. Existing voluntary agreement acceptance alone does not settle this. |
| Employer/HR + legal | Relevant employee/works-council information and participation requirements under applicable Austrian labour law; authorised uses and prohibited personnel decision use. No new employee decision process is authorised by this patch. |
| Technical/account owner | Confirm actual OpenAI project/organisation data controls, caching, region, training opt-in/retention, contracts and output-origin marking requirements; retain evidence without publishing secrets. |
| Operations | Named oversight/support owner, error/incident reporting, access reviews, periodic prompt/model/role regression checks; conditional high-risk audit design. |

## Practical AI literacy: short user briefing

1. Kurti is AI. It may misunderstand a question or produce a plausible wrong answer.
2. Choose a metric, time range and filters; check source, coverage and units in Spark. Missing is not zero; percentage points differ from relative growth.
3. Compare like-for-like assignments. A sorted number is not a judgment about a person's competence, honesty or effort. Do not use Kurti to decide hiring, dismissal, discipline, promotion or pay.
4. Employees ask about their own data normally. Admins use @ for a person. Do not paste private names, health data, credentials or unnecessary text. IDs are still personal data.
5. Kurti cannot change business records or grant approval. Use the real app workflow; report suspect results with metric, period and source to the responsible team, avoiding private chat copies.

These are recommended onboarding materials, not evidence that staff were trained. Record actual briefing participation and revisit when capabilities change.

## Verification and limitations

Verification uses an empty environment, a disposable migrated PGlite database, synthetic users/visits/photos and a deterministic OpenAI double. No production environment, business endpoint, human localhost, scheduled jobs or live provider is used. The exact outbound wire requests are captured locally to verify IDs/redaction and instructions. Browser checks cover admin laptop, GM iPad and SM phone because the shared employee component changed.

See the final verification record below for executed results. Passing synthetic integration/UI tests does not prove live model semantic reliability, legal classification, screen-reader conformance, contractual settings or organisational approval.

### Executed verification

- Frontend optimised Next.js production build and backend TypeScript build passed with an empty environment and no production `.env` files present in the verification checkout.
- **58** regression/privacy/policy tests passed, plus **4** existing GM tool-routing tests and **1** navigation contract (**63 total**). The routing-only check used synthetic credentials and an unreachable loopback database URL; migrated fixture tests used their own disposable database and no database environment setting.
- The real SM analytics query returned two synthetic employees with **2 and 1** submitted visits, retained **1 distinct market each**, excluded another month, and supplied unchanged counts with redacted labels through the route/model loop. Clear firing/promotion/pay and unsupported-trait requests stayed local; metric sorts, lowest-visit questions, stored bonus/formula questions and ordinary settings/confirmation questions remained available.
- Permission tests covered employee/customer denial of admin endpoints, worker own-user contexts, forged IDs and unavailable write/cross-workspace tool calls. Existing business graph checks, answer/photo versioning, corrections and withdrawal rules passed.
- Playwright passed against the isolated **3038/4038** production-build preview: SM **390×844**, GM iPad **834×1194**, admin laptop **1440×900**. It checked visible KI badges/notices, composition preserved through panel opening, Enter/Tab/Escape, outside dismissal and focus return, correct privacy links, ordinary employee inputs with no directory requests, own first-name greetings, admin mention arrows/Enter/Escape, charts, history reload, workspace isolation and a downloaded/reopened **23,759-byte XLSX**. Captured **14** deterministic provider calls contained no synthetic employee names; no uncaught browser errors occurred.
- Inspected screenshots show the existing chat headers/controls and videos retained, readable notices above the composers, and the information panel within each viewport. The browser check exposed and fixed an outside-dismissal focus issue. GM's unrelated background dashboard data is not fully seeded in this fixture; this verifies the shared chat flow, not every GM dashboard request.
- No production business connection, live OpenAI call, migration or historical data change was used. Semantic live-model guarantees, screen-reader conformance and organisational/legal approvals remain outside this evidence.
