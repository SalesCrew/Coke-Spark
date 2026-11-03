# GM questionnaire recovery

Assigned module IDs survive delayed or partial catalogues in both questionnaire editors. Saving stays disabled while assigned modules are unavailable. The existing Save action shows backend conflicts without closing the editor. Questionnaire updates include the server's `updatedAt` version; stale saves and accidental empty replacements are rejected. A deliberate removal of all selected modules is explicit in the save payload.

Start errors retain the backend message and code and appear directly above Starten in the modal footer, outside the scrollable past-visits list. The rest of the dashboard/card layout is unchanged.

When resuming an existing GM draft, the visit page performs a read, an explicit quarterly-recovery POST, and a fresh read if fields were recovered. The same visit ID and its existing fields remain in use. The backend recognizes the current quarter's server-designated `Distributionsziel Qn/YYYY` modules in Standard/Flex/Billa independently of bonus mappings. Untouched missing fields can reuse eligible historical answers by the same GM, market and technical question. Saved blanks, zero, invalid values, comments, deleted rows and existing photos remain intact. Submitted historical records are not repaired or rewritten. Other modules keep their RED-month behavior.

No schema migration or historical backfill is required. See [backend implementation and verification](../backend/docs/gm-questionnaire-recovery.md).

Validation used only synthetic data: 33 focused backend tests, both production builds, and browser checks of the real Standard/Flex editors with empty/partial then loaded catalogues, a stale-save conflict through the isolated API, frontend GET/POST/GET recovery through the real isolated backend, and visible start feedback with a long visit history. Admin was checked at laptop dimensions and GM at tablet dimensions. No production-connected localhost or production application endpoint was used for testing.
