# Coke Spark DSGVO Retention, DSAR, Breach and Export Policy

Date: 2026-06-30

This document is the internal operational rule behind the in-app privacy notices for GM/SM, Admin, and Kunde users. It does not replace final legal review, customer contracts, processor agreements, or employee-law review, but it removes the previous open-ended retention language.

## Official Baseline

- GDPR Art. 5 requires storage limitation, purpose limitation, data minimisation, accuracy, integrity/confidentiality, and accountability.
- GDPR Art. 12-22 require facilitated data-subject rights, including access, rectification, erasure/restriction where legally possible, portability, and objection. Normal response deadline is one month.
- GDPR Art. 30 requires records of processing activities where applicable.
- GDPR Art. 32 requires risk-appropriate technical and organisational security.
- GDPR Art. 33 and 34 require breach assessment, supervisory authority notification where required, and affected-person notification where high risk exists.
- Austrian USP guidance for Arbeitszeitaufzeichnungen says employers must record begin/end of work, daily/weekly working time, rest periods and pauses; employees must be instructed and records must be controllable; employees can request a copy/inspection of their time records.
- Austrian USP guidance states working-time records must generally be kept for one year, but other legal rules may require longer retention.
- Austrian tax/accounting retention practice under BAO Section 132 is seven years for books, records and related evidence. Coke Spark therefore keeps time/KM/diäten/payroll-relevant records for seven years when they feed accounting, reimbursement, payroll or audit evidence.
- The Austrian Datenschutzbehörde provides Data Breach reporting channels and explains that Art. 33 GDPR notification must be made without undue delay and, where possible, within 72 hours after awareness.

Primary references:

- GDPR: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679
- EDPB security guidance: https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en
- USP Arbeitszeitaufzeichnungen: https://www.usp.gv.at/themen/mitarbeiter-und-gesundheit/urlaub-und-arbeitszeit/weitere-informationen-zu-urlaub-und-arbeitszeit/arbeitszeitaufzeichnungen.html
- DSB Data Breach reporting: https://dsb.gv.at/eingabe-an-die-dsb/-meldung-data-breach
- DSB controller obligations: https://dsb.gv.at/rechte-pflichten/ihre-pflichten-als-verantwortlicher

## Retention Table

| Data category | Coke Spark retention rule |
| --- | --- |
| GM/SM account and profile | For the active assignment. After offboarding, disable login immediately and anonymise Spark profile data within 30 days after operational handover unless open review, claims, legal duty or legal hold applies. |
| Admin/Kunde accounts and permissions | For the active access period. Deactivate immediately once no longer needed. Delete or anonymise profile data within 30 days after handover unless audit/security/legal hold applies. |
| Market visits, questionnaire answers, comments, tags, visit status | 3 years after the relevant campaign year or RED year ends. Afterwards delete personal links or anonymise if only aggregate statistics are still needed. |
| Visit photos, photo metadata, photo tags | 3 years after the relevant campaign year or RED year ends. Afterwards delete the storage object and metadata unless a claim, proof requirement, customer complaint or legal hold applies. Obviously private or sensitive accidental photos are reviewed for earlier deletion/restriction. |
| Workday sessions, pauses, additional time, travel time, start/end KM, time corrections | 7 years after the calendar year ends when used for payroll, diäten, reimbursement, accounting or audit evidence. Pure transient drafts without evidence value are cleaned earlier. |
| Time-change requests | 7 years when they affect working time, KM, payroll, reimbursement or accounting records. |
| Answer-change requests | 3 years with the related visit/campaign history, unless a dispute or customer claim needs longer retention. |
| IPP, KPI, bonus and prämien metrics | 7 years if payout, accounting or payroll evidence is affected; otherwise 3 years for quality/reporting history. |
| Auth, audit and security logs | 24 months. Incident-relevant logs are retained until investigation closure and then up to 3 years or under legal hold. |
| Telemetry and frontend/backend error details | Detailed event data 90 days. Aggregated technical statistics max 12 months. |
| Excel/photo/ZIP exports | Working copies only. Delete after purpose is complete, normally within 30 days, unless placed in an approved protected evidence/customer-reporting location with its own retention period. |
| Employee agreement acceptances and privacy-notice evidence | Active assignment plus 3 years, longer only for dispute, audit or legal hold. |

Legal hold always overrides normal deletion until the hold is released. After a legal hold ends, the normal retention rule is applied again.

## DSAR / Data-Subject Request Process

Supported request types:

- Auskunft / access.
- Berichtigung / rectification.
- Löschung / erasure where legally possible.
- Einschränkung / restriction.
- Widerspruch / objection.
- Data export / portability where applicable.

Process:

1. Log the request date, requester, channel, request type and owner in Spark under `/admin/datenschutzanfragen`.
2. Verify identity and role before disclosing data.
3. Scope the data in Spark and relevant processors/exports.
4. Check legal blockers: work-time duties, accounting retention, customer reporting proof, claims, audit/security logs or legal hold.
5. Respond within one month. If complex, document the reason and inform the requester about an extension allowed by GDPR.
6. Apply correction, deletion, anonymisation or restriction where legally possible.
7. Document the final decision, date, responder and evidence delivered in the DSAR request record.

Spark support:

- `/admin/datenschutzanfragen` stores the request, type, subject, requester, owner, one-month deadline, optional extension, identity check, decision notes, legal blockers, response status and a processing history.
- The data-package check summarizes Spark categories for the subject user so the responder can review what may be included before anything leaves the system.
- The data-package check is a working aid, not an automatic disclosure. Rights of third parties, statutory retention and customer confidentiality still need a human decision.

Work-time requests:

- GM/SM users can inspect their own time data in Spark.
- They may request corrections through the GM Zeiterfassung request flow.
- Original time values and approved replacements must remain auditable.
- Employees may request a copy/inspection of working-time records according to Austrian work-time rules.

## Breach / Incident Runbook

Trigger examples:

- Accidental export to the wrong recipient.
- Lost device containing exports.
- Unauthorized account access.
- Publicly exposed photo or answer data.
- Suspicious admin/Kunde export or privilege abuse.
- Storage bucket or signed URL misconfiguration.

Process:

1. Contain the issue immediately: revoke access, disable user/session, rotate key, remove link or stop export where needed.
2. Preserve evidence: logs, request IDs, affected accounts, exported filenames, timestamps, storage paths and screenshots.
3. Assess affected data categories, number of people, confidentiality/integrity/availability impact and risk to individuals.
4. Decide whether DSB notification under Art. 33 GDPR is required. If required, notify without undue delay and where possible within 72 hours after awareness.
5. If not all facts are available within 72 hours, send staged information and continue investigation without undue delay.
6. Notify affected individuals under Art. 34 GDPR if the breach is likely to result in a high risk to their rights and freedoms.
7. Remediate, document root cause, and record follow-up measures.

## Export Governance

Exports are high risk because data leaves Spark's controlled UI.

Rules:

- Only export for a concrete work purpose.
- Use the smallest practical filter scope.
- Do not include time/KM/payroll/bonus/security data in Coke/Kunde exports.
- Do not store exports permanently on private devices, unmanaged cloud drives or unprotected messengers.
- Delete working-copy exports within 30 days after purpose completion.
- Store longer evidence only in approved protected locations with access control.
- Export actions should be logged by user, time, endpoint/page, filter scope and purpose where technically feasible.
- Admin/Kunde access should be reviewed periodically.

## Technical Follow-Ups

These items remain recommended hardening work:

- Enable Supabase leaked-password protection.
- Enforce MFA for admin accounts where feasible.
- Rotate old or exposed secrets and review environment-variable access.
- Review Supabase Storage bucket policies and signed URL TTLs periodically.
- Add a dedicated `export_access_logs` table for sensitive Excel/photo exports if export auditing must be stronger than current HTTP/action logs.
- Create scheduled retention/anonymisation jobs once the business confirms the above periods with counsel/accounting.
