# Boni question selection — active campaigns

The question picker now offers shared-bank questions only when they are linked
to the current questionnaire of a campaign running today in Europe/Vienna.
An active, always-on campaign qualifies. Scheduled campaigns qualify only inside
their inclusive start/end dates, including campaigns whose stored status is
still `scheduled`. The questionnaire's editorial status does not override use
by a running campaign.

Standard, Flex, BILLA, Kühler, MHD and GM Durcharbeit module and Spezialfrage links
are supported. Deleted questions, questionnaires, modules, links and campaigns
are excluded. A shared question appears once, without multiplying its scores.
Spezialfragen additionally respect their own configured period. The response
is private and uncached.

Previously saved bonus sources remain unchanged when a campaign ends. The
picker keeps them in a separate, initially collapsed section; they cannot be
newly assigned through the active picker. Saving unrelated edits preserves
their IDs, weights, counting rules and filters. Existing values, calculations,
closed snapshots and history retain their existing behavior. No schema change,
production data operation or payout-rule repair is part of this release.

Validation: 14 checks passed, including disposable PGlite HTTP/save/history
integration, all six campaign sections, deletion and date gates, Vienna
summer/winter midnight boundaries, shared-question deduplication, timed
Spezialfragen, and existing 80-source calculations/goal rules. A separate
browser run exercised the actual React picker and HTTP router with PGlite:
selection, bulk selection, save/reopen, retained sources, campaign expiry,
disabled new inactive assignments and mobile layout. Backend compilation and
frontend type checking passed. All checks used a clean environment without
production environment files or connections; the normal application entry
points were never started for testing.
