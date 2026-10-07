# Availability dashboard and export reconciliation

Availability uses the historical visit/question snapshots, rather than the current questionnaire catalog. No stored answers, visits, assignments, or schema are rewritten.

| Output | Calculation |
| --- | --- |
| Right-hand Top/Mediocre/Bad chart | Count for the answer / all counted answers × 100 |
| Left-hand availability chart | (Top × 100 + Mediocre × 50 + Bad × 0) / all counted answers |
| Weekly Excel percentages | Same answer counts; formulas linked to the answer audit sheet |
| REWE/SPAR totals | Pool answer counts across the included chains; never average chain percentages |

Availability is assigned to the visit-start date in Europe/Vienna. Historical rows without a start time use the submission date, explicitly marked in the audit. Late submissions can consequently move between historical weeks. The campaign export's date range follows the date displayed in its visit rows. Other dashboard metrics retain their existing submission-date rules.

Only submitted, non-deleted visits and visible, applicable availability questions are eligible. Select the latest stored answer per recorded question, then the latest answer per visit/question across campaign sections. Invalid, skipped, unanswered, conflicting or unrecognized ratings are excluded. An empty duplicate snapshot cannot erase a recorded answer. Later unknown availability metadata is reported rather than guessed. Historical rating codes and structured top-level selections are supported; sub-options are not interpreted as ratings.

The original FB Management answer columns remain. Historical availability questions are added even if they were removed from the current catalog; duplicated or hidden observations do not receive an X. Exported visits remain accessible when current market assignments are removed. The added sheets list counted/excluded answers, weekly counts/percentages, and the calculation rules.

Dashboard export fetches an answer audit with the same intervals and card filters. If counts changed after the chart loaded, it requires a refresh before exporting. Campaign export is restricted to its selected campaigns; comparisons need matching dates, campaigns, markets, GMs and availability types. It cannot repair charts or formulas in already edited external Excel files; use the new weekly sheet as their source.

Campaign exports fetch answers afresh instead of reusing previously opened visit details. This avoids exporting stale edits, at the cost of those export reads. The normal dashboard payload does not include answer audit rows; only export requests opt in. Availability adds a bounded historical-snapshot query to dashboard calculations so its date/visibility/answer rules can remain separate from other metrics.

The weekly audit removes duplicate observations caused by overlapping dashboard intervals. Group/all counts use COUNTIFS; individual chain counts use SUMPRODUCT with EXACT so chain spelling/case and literal wildcard characters do not change the totals when Excel recalculates.

## Isolated verification

Run tests with a clean environment, without loading any production environment file. `test:gm-availability` exercises real dashboard/campaign HTTP queries against disposable PGlite databases, then the frontend counting/export code and XLSX serialization. Databases reject writes during verification; stored answers are compared before and after. Existing GM dashboard tests cover the original chart/filter contracts.

Browser verification uses a copied workspace with no environment files on 3037/4037. No application/job entry point, production connection or normal human localhost is used. Synthetic rows include late submissions, mixed campaigns, removed catalog questions/assignments, invalid answers, hidden questions, structured selections and year-boundary dates.

No migration or deployment is part of this change. Production-size query performance and the exact historical screenshot percentage are not claimed as verified by synthetic checks.
