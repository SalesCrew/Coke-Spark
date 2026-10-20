# Kurti operations

Implemented **20 October 2026**, safeguard version `2026-10-20.1`. Applies to GM, SM, GM Admin and SM Admin.

## Emergency availability control

The backend accepts the server-only setting `OPENAI_KURTI_ENABLED`.

| Setting | Behaviour |
| --- | --- |
| Omitted, or `true`, `1`, `yes`, `on` | Normal Kurti operation. |
| `false`, `0`, `no`, `off` | New chat submissions return HTTP 503 with `kurti_temporarily_unavailable`, before identity lookup, context loading, provider calls or chat-memory writes. |

String settings ignore surrounding whitespace and letter case. Invalid or empty values fail configuration validation. The default is enabled. Changing the backend environment requires a restart/redeployment to load the setting.

Authentication, role checks and worker agreement checks still apply when disabled. Existing history and authorised saved exports remain accessible through their normal endpoints. The history response reports `configured: false`. Disabling does not delete chats or business records. Setting the flag back to true restores submissions without replacing history. This is a backend operator setting, not a new product control.

Already-running turns retain their existing shared deadline. The configuration switch governs submissions accepted by the running backend process.

## Operational audit event

Each authenticated chat submission reaching the route emits one `kurti_turn_completed` event when the HTTP response finishes or the connection is cancelled. It uses the existing backend logging transport.

| Field | Content |
| --- | --- |
| `action` | `kurti_chat`. |
| `workspace`, `audience` | `gm` or `sm`; `admin` or `worker`. |
| `model`, `safeguardVersion` | `gpt-6-luna`; `2026-10-20.1`. |
| `requestId` | A UUID correlation ID, or null if the supplied request ID does not match the accepted format. |
| `result`, `statusCode`, `durationMs` | Route outcome, HTTP status and elapsed duration. A cancelled connection is recorded as 499. |
| `providerCalls` | Responses SDK invocations, including explicit admin rate-limit retries. An SDK-internal retry is part of its invocation. |
| `toolCalls` | Number of tool-call requests encountered, including rejected unavailable tools. |
| `providerRequestIds` | Up to ten distinct, format-validated OpenAI request IDs from SDK responses/errors. |

Outcomes distinguish answered requests, local @ guidance, local policy handling, disabled service, configuration errors, invalid input, busy requests, forbidden references, timeout, cancellation, provider errors, empty responses and other errors.

The event includes no prompt, answer, history, tool arguments/results, names, employee IDs, email addresses, IP addresses, user agents, credentials or person-name mapping. Provider identifiers are accepted only in the bounded `req_…` format. This dedicated event is separate from the backend's existing HTTP logs and their metadata.

The response listeners remove themselves after the first completion. A log-transport failure does not replace the response or interfere with request cleanup. Audit events do not create a database table, lengthen chat expiry or change existing logging-retention settings.

## Investigation using the audit

Locate `kurti_turn_completed` by the backend request ID and timestamp, then correlate with the existing HTTP request log. A provider call count of zero distinguishes a locally handled reply from a model-backed exchange. For a provider-backed request, the recorded OpenAI request IDs provide a correlation reference without copying customer content.

The event is metadata evidence, not a capture of the outbound prompt or a transcript. It does not establish that arbitrary free text is anonymous.

For an incorrect KPI answer, retain the request ID, timestamp, metric, period, filters and source view needed to reproduce the discrepancy. Use synthetic data for agent verification. Do not copy complete private conversations or production datasets into test fixtures.

## Existing data handling

Worker chat expiry is 15 minutes and admin chat expiry 8 hours after the last successful saved exchange. The emergency switch does not alter those periods. Existing answer/photo history, visits, assignments, dashboards and saved report calculations retain their normal behaviour.

Operational logs use the backend's existing logging configuration; full chat text is not added to those logs by the audit event. Provider storage controls remain foreground Responses with `store: false`. [OpenAI request correlation](https://developers.openai.com/api/reference/overview), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
