# SM dashboard — metric definitions, formulas and component plan

Last updated: **2026-10-16, Europe/Vienna**.

Status: **implemented locally after the subsequent dashboard implementation request**. The formulas below remain the business contract. See [implementation and verification](sm-dashboard-redesign-living.md). No production data, migration or deployment was used for implementation verification.

## 1. Source, priority and purpose

Sources:

1. [Coke meeting of 2026-10-15, 15:00](../meetings/2026-10-15/meeting.md), meeting ID `coke-2026-10-15-1500`.
2. Kilian's detailed follow-up in this chat on **2026-10-16**, beginning “allright im gonna give you all numbers we need”. This is a clarification after the meeting, not part of its original transcript.
3. [Central meeting history](../meetings/meeting.md).
4. Kilian's two supplied paper photos on 2026-10-16: `1-Photo-1.jpg` (calculation) and `2-Photo-2.jpg` (printed +13.43% card with the handwritten explanation “vom ganzen mehr”). These were supplied to check that the definition matches the paper. Kilian then explicitly confirmed: **“this is +13,4% nicht the % change to before and after … it’s how many % are more there.”** This final clarification settles D5 as the added share of the whole, not relative growth.

Kilian's explicit later definitions take precedence over earlier unresolved interpretations. Preserve the original meeting decisions as history; do not edit its verbatim transcript to match a later clarification.

Purpose: provide one recallable reference for every requested dashboard value, its counting unit, denominator, plain-language meaning, source and display. Illustrative values such as **852, 135, 599, 17.6%, 76.3% and around 99%** explain calculations. They are **not production measurements, targets, defaults, expected test outcomes or hardcoded display values**.

**Kilian resolved the three requested clarifications in the follow-up replies on 2026-10-16:**

- D2 must keep the **same percentage as the existing “Märkte mit OOS”**. Static inspection of the current aggregator shows that this is a **distinct-market rate**, not a visit or category rate. Preserve that denominator and numerator.
- D3 is the cumulative count of affected categories across visits. Repeated visits count again here.
- D5 was initially interpreted from the 70% → 77% = 10% reply as relative growth. **The paper and Kilian's explicit final clarification settle the rule: D5 is the recovered share of all category checks, i.e. the absolute percentage-point gain.** Display it as the added share of the whole, e.g. **+13.4%**, and add it to 82.4% to obtain about 95.8%. The relative interpretation is retained below as comparison/history, not the selected headline formula.
- Basistätigkeiten: **Ja = 1, Nein = 0, Teilweise = 0.5**.

All three business choices are settled. The D5 interpretation changed after the requested paper comparison and Kilian's explicit confirmation: **current numeric reference = the paper's +13.43 recovered share, or +13.4 rounded to one decimal**. The earlier 70% → 77% relative-growth interpretation is superseded as the headline definition. Preserve the earlier source and the reason for the correction in the change history.

## 2. Shared scope: every number reacts to every selected filter

All numbers must use the **same selected reporting period and Region, Handelskette, Markt and SM filters**, including combined filters and reset. Cards, averages, tables and exports must not use different populations.

Start from one consistent collection of valid, completed market visits. Derive distinct markets, actual visiting SMs, ZE work time and question/category observations from that same collection.

- A market visited multiple times contributes one distinct market but multiple visits.
- A person who completes multiple visits contributes one distinct SM.
- Current directory ownership must not reattribute an earlier visit to a different person. Use the person who actually completed that historical visit.
- Corrections/revisions of the same logical visit or answer must not count as additional visits or additional category checks. Use the current valid reporting revision.
- Planned, cancelled, unfinished, deleted or invalidated records must not silently become completed visits.
- Joining several answers or several ZE revisions to one visit must not multiply its visit count or duration.
- This is the normal SM dashboard. Dedicated Durcharbeit-only markets are excluded; genuine Stammmärkte shared with Durcharbeit remain. Keep the previously approved Standard reporting scope; do not pull Durcharbeit answers into normal totals merely because a market is shared.
- GM reporting and its original per-card controls remain outside this specification's changes.

**Date-boundary detail still to bind during implementation:** the follow-up requires a consistent filtered timeframe but does not choose a new reporting timestamp, such as visit date versus submission date. Do not change existing date semantics implicitly. In particular, do not independently filter visits by one date and their ZE rows by another, then present incompatible totals.

### Plain-language counter names

These are explanatory names, not database columns or an approved migration:

| Name | Meaning |
| --- | --- |
| `visits` | Number of completed visits in the selected scope |
| `visitedMarkets` | Number of different market IDs among those visits |
| `marketMinutes` | Sum of actual ZE work minutes spent in those markets |
| `activeSMs` | Number of different actual visiting SM IDs among those visits |
| `observedMarkets` | Number of different selected markets with at least one valid classified OOS detection observation; current D2 denominator |
| `marketsWithOos` | Number of those different markets with at least one found OOS observation in the selection; current D2 numerator |
| `visitsWithOos` | Number of visits with any affected OOS category; a distinct counting unit, not the confirmed D2 headline |
| `categoryChecks` | Number of eligible OOS category observations across those visits |
| `foundCategoryCases` | Number of visit × category observations with OOS found |
| `fixedCategoryCases` | Number of the found category cases subsequently counted as fixed |

## 3. Activity component: six requested values

### A1 — Besuchte Märkte

**Meaning:** how many different markets were actually visited in the selected period and filters.

**Easy formula:** collect the market IDs from the completed visits, remove duplicates, then count them.

`visitedMarkets = count of different visited market IDs`

Example: market A is visited 5 times and market B is visited 3 times. The result is **2 besuchte Märkte**, not 8.

This resolves the meeting's earlier question about all matching markets versus visited markets: **use visited markets**. An assigned but unvisited market contributes zero to this value.

### A2 — Marktbesuche

**Meaning:** all valid completed market visits in the selected scope, including repeated visits to the same market.

`visits = count of completed visits`

In the A/B example above: **8 Marktbesuche**. This is a visit count, not a count of people or distinct markets.

### A3 — Besuche / Markt

**Meaning:** the average number of visits per visited market.

**Easy formula:** total visits divided by different visited markets.

`Besuche / Markt = visits ÷ visitedMarkets`

Kilian's illustration: `852 ÷ 135 = 6.3111…` → display **6,3 Besuche / Markt**.

Do not average regional averages or individual SM averages. Add the underlying visit and market data for the selected scope first, then calculate the ratio. Distinct markets must be deduplicated across the whole selection.

### A4 — Leistungsstunden

**Meaning:** cumulative actual hours spent working in the visited markets, **from ZE (Zeiterfassung)**.

**Easy formula:** add the actual in-market work minutes and divide by 60.

`Leistungsstunden = marketMinutes ÷ 60`

Example: actual ZE work durations of 30, 45 and 75 minutes sum to 150 minutes → **2,5 hours**.

- Use actual market work time, not a scheduled/paid 45-minute allowance multiplied by visits.
- Travel, breaks and unrelated activities do not belong in “hours spent in markets”. Bind to the appropriate ZE visit-work duration; do not add every employee time entry.
- Include the effective accepted time revision once; do not sum original and corrected durations.
- Scope the ZE durations to the same selected visits and actual visiting SMs.

The business source is now settled as ZE. The exact field/revision linkage and handling of missing records still require a source-level implementation check. No production query is needed or authorized by this document.

### A5 — Stunden / Besuch

**Meaning:** average actual hours per completed visit. This is **per visit**, not the sum of hours per distinct market.

**Easy formula:** total actual market hours divided by total completed visits.

`Stunden / Besuch = Leistungsstunden ÷ visits`

Example: 150 market hours and 100 visits → **1,5 hours per visit**.

Use total ZE minutes at full precision, then divide by 60 and the visit count. Do not round each duration or each worker's average before aggregation.

**Conservative implementation policy:** show the sum of documented actual ZE with its coverage, and withhold Stunden/Besuch when any selected visit lacks current actual ZE. Do not silently use zero, planned minutes, or a denominator containing only timed visits. This is an implementation choice rather than a new user-supplied business decision.

### A6 — Merchandiser

**Meaning:** number of different SMs who actually completed a market visit in the selected timeframe and filters.

`Merchandiser = count of different visiting SM IDs`

Example: Anna completes 10 visits, Berta completes 5, and Cora has no completed visit in the selection → **2 Merchandiser**.

Do not count all registered SMs, assigned people without visits, names as identities, or the same person once per market. An SM who is now inactive may still count in a historical period in which they performed a valid visit.

## 4. Activity-card design plan

This is a plan for one cohesive component, **not six unrelated KPI cards**. The calculated performance metrics in section 5 are more important and should receive stronger visual emphasis.

### Content and grouping

Suggested quiet title: **Besuchsübersicht**. The title is proposed UI wording, not a separately confirmed business term.

```text
Besuchsübersicht

Besuchte Märkte       Marktbesuche        Leistungsstunden       Merchandiser
135                   852                [actual ZE hours]      [distinct SMs]

────────────────────────────────────────────────────────────────────────────
6,3 Besuche / Markt                      [actual average] Stunden / Besuch
Marktbesuche ÷ besuchte Märkte            Leistungsstunden ÷ Marktbesuche
```

Only 135, 852 and 6.3 are linked illustrative values here; other cells deliberately have no invented values.

- Four base figures across the top: markets, visits, hours, people.
- Two derived averages below, each in a half-width area; use a quiet divider to show that these are calculated from the figures above.
- Keep labels above values. Put `h` next to hours, not inside unrelated labels.
- Keep the existing SM dashboard font, neutral white surface, border/radius, spacing and alignment conventions. No new font, palette, dependencies, colored card edges, decorative icon blocks or status pills are needed.
- Use one card's internal spacing and subtle separators rather than nested cards for each number.
- Base numbers should be easy to scan but quieter than the six important performance values below. Approximately 22–24px for base figures and smaller derived values is a starting design proposal, not a rigid product-wide token change.
- Do not repeat all selected filters as another pill row: the existing toolbar already states them.

### Placement and laptop behavior

- Keep the existing compact single-row filter toolbar, including reset.
- Place the activity component directly below the toolbar as one full-width summary.
- Place the more important calculated metrics next, grouped consistently with the existing category/chain/region sections. Their exact arrangement is a later implementation decision; no second dashboard redesign is authorized by this plan.
- At ordinary admin laptop widths (1280, 1440, 1600), maintain four clear top columns and two average areas without cropped values or labels.
- If the available **laptop window** is narrower, reflow inside the same card to a two-by-two base grid and retain the averages below. Do not shrink text until unreadable or redesign the admin UI for phones.
- Retain tabular numerals and German formatting, e.g. `6,3`, `1.500`, `99,0 %`.

### States and interactions

- Any filter change refreshes the card and every calculated value from the same scope.
- Initial load: a skeleton matching the four base/two average structure, not six bouncing independent cards.
- Refresh: a clear busy state; do not present old totals as if calculated for newly selected filters. Exports must not knowingly mix a stale payload with new filter labels.
- Empty selection: real counts are zero; averages without a denominator show `—`.
- Failure: show a retry state, not zero values masquerading as a successful result.
- Missing ZE coverage: communicate incompleteness locally without an oversized warning banner or invented duration.
- Explain each average through its short caption or accessible help. Tooltips must not be the only place where the counting unit is discoverable.

This section is design planning only. Rendered proof is required when the component is actually implemented, using disposable synthetic data rather than the human production-connected localhost.

## 5. The six important calculated metrics

### D1 — Durchgeführte Basistätigkeiten

**Business question:** of the relevant basic-work answers, how often was the work recorded as completed?

Kilian describes a high percentage, often around 99%. That is context, **not a target the software should force or a value to fill when data is missing**.

#### Confirmed three-level weighting

Map relevant answers explicitly to:

- **Ja — Basistätigkeiten wurden durchgeführt** → credit 1.
- **Nein — Basistätigkeiten wurden nicht durchgeführt** → credit 0.
- **Teilweise — Basistätigkeiten wurden teilweise durchgeführt** → credit 0.5.

**Easy formula:** give each Ja one point, each Teilweise half a point and each Nein zero; divide the total points by the number of qualifying answers, then multiply by 100.

`Basistätigkeiten (%) = (Ja + 0.5 × Teilweise) ÷ (Ja + Teilweise + Nein) × 100`

Example: 6 Ja, 2 Teilweise, 2 Nein → `(6 + 1) ÷ 10 × 100` = **70%**.

This is an **answer-based completion rate**, not automatically the percentage of visits where every task was completed. If one visit has several qualifying task questions, each eligible question observation contributes according to the agreed weighting.

If there are no Teilweise answers, the same formula simplifies to `Ja ÷ (Ja + Nein) × 100`. Example: 990 Ja and 10 Nein = **99%**. This is a special case of the confirmed formula, not an alternative scoring policy. Kilian explicitly reaffirmed the meeting's half-credit rule in his clarification reply.

#### Module-creation configuration requirement

On the **SM admin module editor**, add **Basistätigkeiten configuration next to the existing OOS configuration**. Kilian explicitly clarified that its presentation and interaction must mirror the existing OOS setup: the administrator configures the semantic status of an answer using the same familiar setup pattern. For Basistätigkeiten, the available statuses are **Ja, Teilweise, Nein**, with weights **1, 0.5, 0**.

**These are administrator-assigned reporting values, not required answer wording.** A participant continues to see and submit the question's actual answer. The configured semantic value is saved alongside that answer, as reporting metadata, so the dashboard can select and aggregate it just as it selects OOS outcome metadata.

Example mappings, independent of the displayed question/answer wording:

| Answer shown to the SM | Status assigned in the module editor | Reporting credit |
| --- | --- | ---: |
| “Alle Preise kontrolliert” | Ja | 1 |
| “Nur einen Teil kontrolliert” | Teilweise | 0.5 |
| “Heute nicht durchgeführt” | Nein | 0 |

The formula's words **Ja / Teilweise / Nein refer to these stored statuses**. They do not mean counting raw answer strings with those exact words. “All checked”, “Erledigt”, or any other wording can contribute to Ja when the administrator explicitly mapped it that way.

Expected lifecycle:

`Create/edit a question of any type → configure Basistätigkeiten beside OOS → assign Ja/Teilweise/Nein to its answer representation → save/publish the mapping → submit the original answer with its configured semantic metadata → filter those outcomes into the dashboard formula.`

The status selector is part of **admin module creation**, not an extra compulsory Ja/Nein question shown to the employee. Reuse OOS setup's visual treatment, disclosure/activation pattern, answer-row placement, custom selector behavior and save/reload feedback. Do not introduce a separate scoring wizard, a different-looking configuration panel, or a requirement to rename answers.

- An administrator can give a question/answer an explicit semantic stamp for basic work completed, not completed or partly completed, with the confirmed weights 1, 0 and 0.5.
- OOS roles and basic-work roles are distinct. They must not overwrite one another or share scoring rules accidentally.
- The user requires this capability on **all question types**, not only questions whose type happens to be Ja/Nein and not only the subset currently showing an OOS selector. Single Choice and other answer forms must support explicit answer-to-status mapping through the familiar setup pattern.
- Map by stable question/version/answer identities. Do not infer membership from a question containing the word “MHD”, from answer display text alone, or from whichever answer option appears first.
- A relevant question observation should not count twice simply because it has several selected options with the same stamp. Multiple selected options with conflicting stamps need an explicit resolution rule.
- Types without fixed option lists remain in scope. Their answer representations need an explicit binding to the configured metadata, integrated into the same setup, rather than silently disabling Basistätigkeiten by type. The precise adapters for text, numbers, matrix answers and photos are implementation design work; do not invent automatic text interpretation, numerical thresholds or unstated default statuses. The requirement of all-type availability is settled.
- Only explicitly configured, eligible answered observations contribute. Unmapped, unanswered and not-applicable states are not silently labelled Nein. The exact exclusion/coverage policy and weighting of combined versus separate task questions still need final confirmation.
- Existing OOS mappings, published questionnaires and saved historical answers remain intact.
- Persist/reload the new configuration through authoring and preserve the reporting meaning with the appropriate published-version/visit snapshot. Save the mapped outcome alongside the submitted answer as semantic metadata, without replacing its raw value. The dashboard must be able to identify those mapped answers and their 1/0.5/0 values reliably; a label visible only in the editor is insufficient. Exact field/table design and any additive migration are separate implementation work.
- Decide explicitly whether reporting older answers should be supported via a reviewed version-specific mapping. Do not retroactively stamp or rewrite old answers, guess historic meanings, or promise historical availability merely because a new question is configured today.

### D2 — Märkte mit OOS / “Min. 1 OOS pro Kategorie aufgefunden”

**Confirmed clarification:** “its the same % as Märkte mis oos now.” Preserve the existing **Märkte mit OOS** percentage rather than introducing the earlier proposed visit-based percentage.

**Easy formula:** different checked markets where OOS was found, divided by all different markets with a valid OOS check, multiplied by 100.

`Märkte mit OOS (%) = marketsWithOos ÷ observedMarkets × 100`

Static source reference: `backend/src/sm-dashboard.shared.ts`, `summarize`, currently computes `affectedMarketRate` using `percentage(marketsWithOos, observedMarkets)`. This was established from source only, without a production query.

Example: 17 different markets have OOS among 100 different checked markets → **17%**.

- A market with OOS in all four categories contributes **one affected market** to this numerator.
- Repeated visits to the same market do **not** count that market more than once here. If any valid visit in the selection finds OOS there, the market is affected for the selected period.
- Preserve the current denominator of **observed/checked markets**, not all registered markets and not automatically every visited market. A visited market without a valid classified OOS detection observation is not silently treated as OOS-free.
- Use **OOS found**, not OOS fixed. Fixing the problem does not remove the fact that it was found during the visit.
- This is distinct from D3's cumulative category count, and distinct from the category-based rate used to calculate availability.
- Keep the familiar label **Märkte mit OOS**, or explicitly explain the counting unit if the display wording changes. Do not label a distinct-market percentage as a visit percentage.

The earlier wording about “% of visits” is preserved as historical clarification context; Kilian's explicit reference to the current metric settles the implementation requirement.

### D3 — Häufigkeit vorgefundener OOS

**Meaning:** the number of affected visit × category observations, not a percentage and not a count of missing product units.

`Häufigkeit = foundCategoryCases`

Kilian's example:

1. Visit market A; one category has OOS → add **1**.
2. Visit market B; all four categories have OOS → add **4**.
3. Total → **5 OOS category cases**.

Visit market A again and find OOS in one category → add another 1, total **6**. Repeated visits count again even when the market ID is unchanged.

For each visit and each of the four categories, count at most one found case. Ten missing products in one category, or two detection questions confirming the same category issue, do not create ten or two category cases.

With complete four-category observations: `0 ≤ foundCategoryCases ≤ 4 × visits`.

### D4 — OOS-Behebungsquote

**Meaning:** of the found OOS category cases, what share were fixed?

**Easy formula:** fixed category cases divided by found category cases, multiplied by 100.

`OOS-Behebungsquote (%) = fixedCategoryCases ÷ foundCategoryCases × 100`

Kilian's example: find OOS 10 times, fix 9, cannot fix 1 → **90%**.

- This renames/clarifies the existing dashboard's **OOS behoben** percentage.
- Fixes must match a found case in the **same visit and category**. A fix from another visit, category or month cannot repair this denominator.
- Count at most one fixed case for each found visit × category case.
- Existing meeting rule: **vollständig behoben and teilweise behoben both count fully as fixed**. Preserve the original raw answer for later detail; no separate partial/full dashboard split was requested.
- This full counting of partial OOS remediation is different from half credit for partially completed Basistätigkeiten.
- No found cases means the quote has no denominator: display `— / kein OOS gefunden`, not an invented 100% success rate.

### D5 — Steigerung der Warenverfügbarkeit

**Final confirmed rule: match the supplied paper.** This value is the share of **all category checks** that the SM recovered through OOS remediation during the selected visits. Kilian explicitly says it is **+13.4% of the whole added back**, not the relative percentage change from before to after. Mathematically it is the absolute difference between two availability percentages, measured in **percentage points**.

The paper has two stages: first detect OOS; then attempt to fix it. It shows **82.4% before**, **+13.43 recovered points**, and **about 95.8% after**. Its printed “+13.43%” and handwritten “vom ganzen mehr” refer to the share of the whole recovered. There is no additional division by the before value in that paper calculation.

**Easy formula:** fixed category cases divided by all category checks, multiplied by 100.

`Steigerung (percentage points) = fixedCategoryCases ÷ categoryChecks × 100`

Equivalent:

`Steigerung (points) = after availability (%) − before availability (%)`

And, using consistently defined category rates:

`Steigerung (points) = category OOS rate (%) × remediation rate (%) ÷ 100`

Paper example: `17.6 × 76.3 ÷ 100 = 13.4288` → **+13.43 percentage points**.

Then `82.4 + 13.4288 = 95.8288%` after availability, or **95.8%** to one decimal.

**Paper-style display:** `+13,4 %` to one decimal, or `+13,43 %` to two, with explanation **“Anteil aller Kategorieprüfungen, der durch OOS-Behebung zurückgewonnen wurde”**. The percent refers to the share of the whole recovered. When explaining the arithmetic addition to before availability, call the difference percentage points. Do not display the relative-growth value of 16.30% under this label.

**Do not substitute D2's distinct-market rate for the category OOS rate.** The paper divides cumulative category cases by category checks (`visits × 4` when complete). The existing “Märkte mit OOS” percentage uses distinct markets and must remain a separate metric. Similar displayed percentages in an illustration do not make those denominators interchangeable.

#### Earlier relative interpretation — comparison, not the paper's formula

Kilian's earlier example **70% before → 77% after = 10% better** is a correct example of relative growth:

`relative growth (%) = (after − before) ÷ before × 100`

This gives `(77 − 70) ÷ 70 × 100 = 10%`, while the absolute paper-style gain is `77 − 70 = 7 points`. Kilian's final clarification explicitly rules out that relative formula for D5; for this smaller example the selected added share would be +7% of the whole, not +10%.

Applied to the paper's values, relative growth would be `13.4288 ÷ 82.4 × 100 = 16.297087…%`. **Displaying +16.30% would not reproduce the supplied paper's +13.43 card.** The earlier version of this specification chose that relative formula after the clarification reply; the paper comparison exposed that mismatch and this version corrects the main D5 definition to the paper's formula.

No previous-month comparison is involved in either calculation: both compare detection and remediation within the same selected visits.

### D6 — Warenverfügbarkeit nach OOS-Behebung

**Meaning:** initially non-OOS category observations plus the found cases that were counted as recovered, as a share of all category checks.

**Easy formula:** take the percentage that had no OOS initially, then add **D5's paper-aligned percentage-point gain** from fixing OOS.

`After availability (%) = before availability (%) + gain in percentage points`

Equivalent formula directly from counts:

`After availability (%) = (categoryChecks − foundCategoryCases + fixedCategoryCases) ÷ categoryChecks × 100`

Or:

`After availability (%) = 100 − category OOS rate (%) + gain in percentage points`

For comparison only, a relative-growth rate would require multiplication: `after availability = before availability × (1 + relative growth (%) ÷ 100)`. It is not the D5 headline specified by the paper comparison.

Using the rounded illustrative rates:

`100 − 17.6 + 13.4288 = 95.8288%` → **95.8%** to one decimal, or **95.83%** to two decimals.

This is a **derived category-based availability indicator**. The system does not count every SKU or physical unit, and partial remediation counts fully. A shelf story explains the intended business benefit; it does not turn the underlying observations into an exact physical shelf-fill measurement.

## 6. Supporting numbers needed to calculate the display

These helpers are not additional headline KPI cards unless explicitly requested.

### 6.1 Category OOS rate — different from the confirmed affected-market rate

`Category OOS rate (%) = foundCategoryCases ÷ categoryChecks × 100`

This is the **17.6% kind of percentage used in Kilian's 3408-check calculation**.

The two-visit example makes the distinction explicit:

| Observation | Value |
| --- | ---: |
| Visits | 2 |
| Categories checked, assuming all four on both visits | 8 |
| Found cases: 1 category on the first visit, 4 on the second | 5 |
| Different checked markets, when the visits are at different markets | 2 |
| Different affected markets | 2 |
| Confirmed D2: Märkte mit OOS | `2 ÷ 2 × 100 = 100%` |
| Visits with any OOS | 2 |
| Visit-based OOS percentage | `2 ÷ 2 × 100 = 100%` |
| Category-based OOS percentage | `5 ÷ 8 × 100 = 62.5%` |

These numbers describe the same visits correctly but answer different questions. `5 ÷ 2 = 250%` is **not** the percentage of visits with OOS. The total found category count alone cannot tell us how many visits were affected.

Repeated visits can also separate the market and visit percentages: visit market A three times and find OOS on only one of those visits; visit market B once and find none. D2 is **1 affected market / 2 checked markets = 50%**, whereas the separate affected-visit rate would be **1 / 4 = 25%**. Preserve the existing **50% market-based result** for D2, as Kilian requested. Category checks remain a third denominator for the availability calculation.

### 6.2 Category checks

With all four categories applicable and answered in every selected visit:

`categoryChecks = visits × 4`

Kilian's illustration: `852 × 4 = 3408 checks`.

**Implementation policy:** count only applicable visit × category observations with a valid present/absent detection outcome. The calculation help and export expose the actual category-check count. Unanswered, unmapped and not-applicable categories do not become “no OOS” merely to preserve `visits × 4`. Four checks per visit apply only when all four were actually documented. This is a conservative implementation choice; no historical answers are filled or reinterpreted.

### 6.3 Before availability — helper, not a separate headline card

`Before availability (%) = (categoryChecks − foundCategoryCases) ÷ categoryChecks × 100`

Equivalent: `100 − category OOS rate (%)`.

The meeting explicitly did not request another standalone before-work availability KPI. Calculate it to explain the after value and gain. “Before/after” refers to work during the same selected visits, not a comparison with a previous calendar month.

### 6.4 Fixed case count

`fixedCategoryCases = count of found visit × category cases recorded as fully or partly fixed`

This count supports the remediation quote and both availability formulas. It may appear as an explanatory numerator, e.g. “457 von 599 Fällen”, without becoming an additional independent headline KPI.

## 7. Arithmetic corrections to the illustrative story

Kilian explicitly said the supplied values were for explaining the formulas. Preserve the intended calculation but do not hardcode inconsistent rounded numbers.

| Original illustrative statement | Checked interpretation |
| --- | --- |
| `852 × 4` | Exactly **3408** checks. |
| “17.6% of 3408 is 599” | Exactly **599.808**; approximately 600. If the actual count is 599, its exact rate is **17.576291…%**, which rounds to 17.6%. Rounded percentages do not reconstruct exact counts. |
| “in 2209 Abfragen there is NO OOS” | For 3408 total and 599 affected, subtraction gives **2809**, not 2209. |
| “2209/3408 is 82.4%” | **2809/3408 = 82.423708…%**. The 82.4% explanation is consistent with 2809, not 2209. |
| `17.6% × 76.3%` | **13.4288 percentage points** of all checks are recovered. Compute the product of percentage numbers divided by 100. |
| Paper-aligned D5 versus the earlier relative interpretation | D5 is **+13.43 points**. The separate calculation `13.4288 ÷ 82.4 × 100 = 16.297087…%` is relative growth and does not match the paper's headline. |
| `82.4 + 13.4288` | **95.8288%**, rounding to **95.8%**, not 95.9%, at one decimal. Different unrounded source counts could produce a different rounded result; the examples are not real observations. |
| `70% → 77%` | **+7 percentage points**, equivalent to **+10% relative growth**. These cannot share one unqualified unit label. |

### One fully consistent integer-count illustration

If we choose 852 visits, 3408 category checks, 599 found category cases and 457 fixed category cases **solely as a synthetic example**:

| Calculation | Result |
| --- | ---: |
| Initially no-OOS category observations | `3408 − 599 = 2809` |
| Category OOS rate | `599 ÷ 3408 × 100 = 17.576291…%` |
| Before availability | `2809 ÷ 3408 × 100 = 82.423708…%` |
| Remediation rate | `457 ÷ 599 × 100 = 76.293823…%` |
| D5 availability gain | `457 ÷ 3408 × 100 = 13.409624… points` |
| After availability | `(2809 + 457) ÷ 3408 × 100 = 95.833333…%` |
| Relative growth, for comparison only | `457 ÷ 2809 × 100 = 16.269134…%` |

The 13.409624-point gain differs slightly from 13.4288 because this table uses exact integer counts, whereas the earlier illustration multiplies rounded rates. **Compute from raw counts and round only for display.** The number of affected visits cannot be inferred from this table; their distribution across categories is not given.

### Smaller walkthrough for easy recall

Use 100 visits, all four categories assessed, 80 found category cases, 60 fixed cases:

```text
100 visits × 4 categories = 400 category checks
80 of the 400 checks found OOS                      → 20% category OOS rate
60 of those 80 cases were fixed                     → 75% remediation rate
400 − 80 = 320 checks had no OOS initially           → 80% before availability
60 recovered checks ÷ 400 checks                    → +15 percentage points (D5)
80% before + 15 points recovered                    → 95% after availability
(95 − 80) ÷ 80 × 100                               → +18.75% relative growth (comparison only)
```

Do not label that 20% as D2's affected-market percentage unless the distinct-market distribution independently produces that value. D5 is the recovered +15 points; the separate relative-growth result of 18.75% is not the paper-aligned headline.

## 8. Display rules, zero cases and integrity

- Display whole counts as integers; display averages/percentages consistently using German decimal formatting. One decimal for visit averages is supported by the 6.3 illustration. Final precision for hours and calculated performance percentages remains a presentation choice; keep full precision internally.
- When there are no visits: visited markets = 0, visits = 0, actual visiting SMs = 0; both visit-based averages show `—`. Zero work hours are valid only if the scope is genuinely empty or complete known data sums to zero, not when ZE data is missing.
- With no qualifying Basistätigkeiten answers: show `— / keine zugeordneten Antworten`, not 0% or 99%.
- With no category checks: category rates, before/after availability and category-based gain are unavailable (`—`).
- With category checks but no OOS found: before and after availability are 100%, D5 is 0 points, and remediation rate is `— / kein OOS gefunden`.
- With no valid observed markets: D2 is `—`, not a percentage built from visits, an empty denominator or the whole market directory.
- With no remediation answer for a found case: do not silently claim it was fixed. Whether to display a conservative lower bound or withhold derived metrics with incomplete evidence needs a clear coverage policy.
- Relative growth is undefined if before availability is zero. Paper-aligned D5 remains defined when category checks exist: for example, all checks initially OOS and all fixed gives before 0%, after 100%, D5 +100 points.
- `fixedCategoryCases` must never exceed `foundCategoryCases`; case counts must never exceed eligible category observations. Surface invalid data rather than clamping a broken formula into a plausible-looking percentage.
- Labels, help text, units and export column names must identify whether the denominator is visits, markets, answers, category checks or found cases.
- Existing lower category, chain and region views remain. Their counts/quotes must be recalculated from each group's underlying eligible observations, not by averaging displayed percentages. Chain/region rows include market and visit counts as agreed in the meeting. Do not add a new basic-work breakdown not requested by the user.

## 9. Open decisions and implementation boundary

### Reuse existing work without merely renaming a different metric

Some reporting inputs already exist. Reuse existing completed-visit and distinct-visited-market counters, OOS answer snapshots, filter controls and ZE sources when their semantics match the definitions above. Do not rewrite working unrelated flows just to introduce the new card.

The current SM dashboard source has a **distinct-market affected rate** (`marketsWithOos / observedMarkets`). Kilian explicitly confirmed retaining it for D2. Reuse it without silently replacing it with a visit or category percentage. Likewise, validate whether an existing found-case counter deduplicates at visit × category rather than at question level before reusing it for D3.

For D4, preserve original partial/full answers and existing configuration/snapshots. The specified KPI counts partial fixes fully; applying that reporting definition must not rewrite the underlying historical answer or globally change other dashboards' scoring semantics.

### Clarifications answered by Kilian on 2026-10-16

1. **D2:** preserve the existing **Märkte mit OOS** percentage. The current source counts distinct affected markets / distinct observed markets, not visits. D3 remains cumulative affected categories across repeated visits.
2. **D5:** Kilian explicitly confirms the paper interpretation: **recovered category cases / all category checks × 100**, displayed as the added share of the whole, e.g. **+13.4%**. It is not the relative percentage change. The earlier 70% → 77% relative-growth interpretation is superseded, with its history preserved.
3. **Basistätigkeiten:** **Ja = 1, Nein = 0, Teilweise = 0.5**, explicitly confirmed. The binary-only interpretation is not the selected policy.

D2, D5 and Basistätigkeiten are settled by explicit replies. The separate technical details below remain implementation work.

### Technical/product details not decided by this document

- Exact eligible basic-work questions, per-question versus per-module weighting, non-choice answer adapters and conflicting multi-choice interpretations.
- Missing/unanswered/not-applicable observation coverage and no-ZE handling.
- Exact canonical ZE revision linkage and reporting date semantics.
- Whether and how historical answers without an original basic-work stamp should participate, with explicit version-aware configuration and no answer rewrite.

### What a later build must connect

Module configuration → saved/published semantic mapping → visit answer meaning → filtered reporting counters → the four-plus-two activity component and six calculated metrics → consistent category/chain/region views and exports.

Any implementation must retain historical identities and raw answers, keep the GM side unchanged and use disposable synthetic data for tests. Writing this plan does not authorize a migration, production verification query, backfill, data repair or deployment.

## 10. Change log

- **2026-10-16:** Created from Kilian's detailed follow-up. Resolved market count as distinct visited markets; pinned actual time source to ZE; recorded six activity metrics, six important calculated metrics, authoring configuration requirements and a cohesive activity-card plan. Explicitly separated visit prevalence from category frequency/rate and relative growth from percentage-point gain. Corrected arithmetic without treating illustrative values as real data. Three material clarifications requested; no application or data changes made.
- **2026-10-16 — Clarification replies applied:** Kilian chooses the existing Märkte mit OOS percentage (verified statically as distinct affected / observed markets), reaffirms cumulative category frequency, defines headline improvement as relative before/after growth (70 to 77 = 10%), and confirms Ja 1 / Nein 0 / Teilweise 0.5. Updated all metric definitions, examples and open-question status accordingly. The 13.43 intermediate point gain is retained and the relative final calculation is shown separately. Earlier provisional interpretations remain in the history, not as competing current rules. No code or data changes.
- **2026-10-16 — Authoring/answer-metadata behavior clarified:** Kilian requires Basistätigkeiten to look and work like the existing OOS setup in module creation, on all question types. An administrator maps each answer representation to Ja/Teilweise/Nein independently of its wording; that semantic value is saved alongside the submitted answer and used for dashboard aggregation. Clarified that the formula counts these mapped statuses, not literal answer text, and that this adds no compulsory employee-facing Ja/Nein question. Existing OOS configuration and original answers remain separate and intact. Documentation only.
- **2026-10-16 — Supplied paper compared with the spec:** New photos show `17.6 × 76.3 / 100 ≈ 13.43`, followed by `82.4 + 13.43 ≈ 95.8`, and a printed +13.43% card annotated as a share “vom ganzen”. This does not match the then-current relative D5 formula, which would return about 16.30%. Corrected the main D5 reference to the paper's recovered share / absolute percentage-point gain and updated dependent examples and zero rules. The earlier relative interpretation and Kilian's 70→77=10 example are preserved as history/comparison; no false claim that these are the same formula. D2's distinct-market percentage remains unchanged and separate from the category-level input needed by the paper. No application or data changes.
- **2026-10-16 — Kilian explicitly confirms the paper rule:** “this is +13,4% nicht the % change to before and after … it’s how many % are more there.” D5 is definitively the recovered share of all category checks. Retained the paper-style percent display with an explanation that it is a share of the whole; relative-growth interpretation is superseded, not still pending. Formula and all dependent descriptions aligned. Documentation only.


## 12. Local implementation contract — 2026-10-16

- The upper panel receives one typed `overview` payload from the same submitted/current/reporting-available cohort and filters as the rest of the SM admin dashboard. Related reads use one repeatable-read, read-only transaction. No production connection was queried for verification.
- All ten SM question types expose Basistätigkeiten configuration beside the existing OOS configuration. Choice, yes/no, yes/no multi, multiple and Likert map their options; matrix maps its columns. Text supports exact trimmed-text rules; numeric/slider support non-overlapping inclusive ranges. Photo supports an explicit “at least one committed photo” mapping. Non-choice inputs can have an explicitly configured fallback for other answered values. None infer the business meaning from a word such as “Ja”.
- One answered applicable question contributes at most one observation. If several mapped selections conflict, the lowest configured credit wins. Unmapped selections do not contribute a separate observation; unanswered/hidden/unmapped questions are excluded. Mapping rules and these policies are visible in the authoring UI.
- The versioned question config stores `basicActivity`. On save the server derives `basic_activity_yes`, `basic_activity_partial` or `basic_activity_no` from the frozen submission question and writes the existing `sm_question_answers.metric_outcome_code` field. Raw answer text, number, option code and JSON stay unchanged. No new schema column or migration is needed.
- Initial answers, photo commits/removals, comment edits, approved employee corrections, admin corrections and monthly Durcharbeit carry-over use the frozen mapping. Corrections append versions; historical answer values and prior metadata stay intact. Existing historical questions without a mapping remain unmapped. There is no backfill.
- OOS upper metrics deduplicate valid detection observations to visit × category. Multiple found detection questions in a category are only resolved as a whole when their found observations are fixed; undocumented remediation earns no credit. Full and partial remediation count fully in the new upper KPIs. Existing lower bar-chart code and legacy calculation contract are retained.
- Leistungsstunden sums effective current actual ZE minutes / 60, including only in-market time. If some visits have no current ZE, show the documented partial total and its coverage; Stunden/Besuch is unavailable until coverage is complete. No planned-duration fallback is used.
- D5 is **fixed category cases / valid category checks × 100**. Exact integer example: `457 / 3408 × 100 = 13.4096…`, displayed **+13,4 %**. No division by before availability. Rates are calculated from raw counts and rounded at display time.
- Excel contains the same twelve upper values, units, numerators, denominators, selected filters and coverage. Percentage cells use numeric Excel percentage formatting. Export and print refuse stale results while a new filter request is pending or has failed.
- Local synthetic preview: `http://127.0.0.1:3037/admin/sm/dashboard`, backend `4037`. The human production-connected `3000/4000` app is not used for agent tests.

- **2026-10-16 — Implementation follow-up:** Built the separate activity/performance UI and its typed calculations; added versioned Basistätigkeiten authoring and answer metadata for all ten types. D5 stays the paper's recovered share of the whole. Verified with disposable synthetic data; no production queries or changes. Detailed results and the independently reproduced baseline test limitation are in the living implementation record.
