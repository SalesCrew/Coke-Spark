# Durcharbeit: abgeschlossene Besuche prüfen

## Scope and design

Requested and reviewed locally on 2026-10-19; production deployment subsequently authorized by the user. No migration or production-data operation is required.

The campaign/month workspace keeps its existing sidebar, month selector, neutral panels and blue controls. A compact switch selects Monatsziele or Abgeschlossene Besuche. The latter lists each submitted physical visit, including follow-ups. Search and SM/market filters work within the selected campaign month. A focused right-hand review panel shows the original questionnaire snapshot, answers, comments, photographs and per-answer history; authorized administrators can correct answers with a reason.

GM FB Management was inspected for the review/edit behavior. SM's existing typed editor and correction protocol are reused instead of introducing a second answer implementation. The new view deliberately uses the Durcharbeit workspace design. Standard SM/GM pages retain their existing controls and appearance.

## Contracts

- API: `/admin/sm-smdurcharbeit-campaigns/:campaignId/review/:reviewMonth` and `/:submissionId`, `/history`, `/corrections`, `/photos/upload-url`.
- Server checks campaign/month membership and submitted/current/nondeleted status inside the same transaction as detail/history/correction operations. Cross-campaign, cross-month, draft and standard submissions cannot be inspected or edited through this route.
- Customer grants use `sm_durcharbeit_verplanung`: read to inspect, update to correct. Existing FB Management permissions are unchanged.
- The list follows campaign month membership, not an extra visit-date filter, so corrected visit timestamps outside that month do not hide its records.
- Search is case-insensitive and literal. It includes snapshot names/address/postcode/city, IDs, questionnaire/version, campaign/month, visit date, target market metadata, current saved answer values/comments/question text and selected answer labels. Unselected answer labels and superseded answers do not match.
- Pages use stable date + submission-ID keyset ordering, 40 records at a time. Search is server-side across all records, not just the loaded page. Facets are bounded to 2,000 combinations with a visible fallback to search.
- Corrections retain immutable question snapshots, original answers, photos, visit times and attribution. Existing validation, conditional visibility, photo receipts, optimistic concurrency and retry tokens remain in force. A reason is mandatory; failures do not report success.
- This review panel corrects answers. Visit-time editing stays in the existing management/time workflows.
- Account changes clear the review; campaign/month changes reset its context. Dirty edits require explicit discard.

## Verification

Disposable synthetic database and HTTP integration tests cover completed-only lists, snapshot questions/photos, answer/metadata/date search, selected versus unselected option labels, SM/market filters, planning read/update permissions, cross-context denial, invalid input, audited correction/retry/conflict handling, repeat visits, pagination and corrected timestamps outside the campaign month. Existing management regression suite covers every typed answer family, comments, conditions, photos, rollback and concurrency.

Laptop browser verification uses the isolated optimized frontend on 3037 and disposable backend on 4037. Human localhost 3000/4000 is not used for agent tests. The normal human backend imports `createApp` directly and never starts `index.ts` or scheduled jobs.

## Comment history refinement before release

The user observed a single comment appearing as dozens of progressive versions. The SM comment dialog previously forwarded every keystroke into the visit's 280 ms choice-answer autosave. It now keeps typing local until Übernehmen; closing cancels unconfirmed text. Both the visit and activity correction callers consume the complete final comment once.

For existing history, the readable view groups consecutive comment-only prefix edits by the same user ID within 90 seconds between saves. It preserves distinct answer/state changes, explicit corrections, different users, cleared comments, unrelated text replacements and later edits. Raw audit rows, stored versions, original answers and pagination cursors remain untouched. The UI labels actual/current/original states rather than suggesting a technical autosave version number counts user changes. Grouping also works when older raw pages are appended.
