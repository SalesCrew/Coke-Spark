# SM dashboard — ten full-width design options

Date: 2026-10-16. Scope: visual proposals only, standalone preview, no production requests, no app changes or push.

## Brief and reference reading

Kilian requests five equally considered alternatives for Besuchsübersicht and five for Leistung im Markt. He confirmed that the missing third screenshot means the six performance metrics. Reference 1 is the older colored five-card row: meaningful red/green states, small icon containers and slim progress tracks. Reference 2 is the new activity card: four base metrics and two averages. The current performance panel is a subdued 3×2 white matrix. The desired exploration has more visual character within the established admin UI, without changing the data contract.

Read deslopify, composition/visual-language and implementation/verification guidance. Audience: frequent admin users on laptops. Context: compact Inter typography, white surfaces on cool grey, restrained borders and 12px corners; Coke red for interaction and OOS findings, green for completion/remediation, neutral activity totals. Avoid decorative progress tracks for raw counts or implied trends. Color supplements labels and numbers. All proposals are full-width components, never five scaled thumbnails across the page.

Every option keeps exactly the six relevant values. Base figures are black; units and German decimal formatting stay consistent. All performance proposals preserve market-based prevalence, cumulative category frequency, remediation, recovered share of the whole and final availability. Before availability is supporting context, not a seventh KPI. There are no new data queries, migrations, changes to historical records or new production routes.

## Shared synthetic comparison data

25 distinct markets, 71 visits, 116 actual in-market hours and 9 merchandisers. Averages: 71/25 = 2.8 visits/market; 116/71 = 1.6 hours/visit. Four valid category observations per visit: 284 checks, 50 found cases, 38 fixed cases, 11 affected markets. Basic tasks: 70 yes and one partial out of 71 = 99.3%.

Performance: 44.0% markets with OOS; 50 cumulative found category cases; 76.0% remediation; 82.4% availability before; +13.4% recovered share of all checks; 95.8% availability after. Calculate from integer counts and round only on display. These are illustrative numbers, not a production extract. A separate empty-data mode checks unavailable percentages and honest zero counts.

## Activity alternatives — planned before implementation

### A1 · Kennzahlenzeile

- **Philosophy:** one concise operational report, four equally important base figures.
- **Composition:** an integrated white card; header above four quiet columns, large baseline-aligned totals. Attach each average directly beneath its numerator column (visits and hours), so related facts are read together rather than on opposite sides of a footer.
- **Expression:** neutral figures and dividers, quiet blue supporting averages, no icon repetition or decorative bar. Target about 200px high.
- **Why choose it:** most direct scan of all four base totals with obvious denominator relationships.
- **Tradeoff / watch:** keep lower supporting lines balanced despite only two calculated values; no fake placeholders used to fill the other columns.
- **Proof required:** all six values, aligned totals, complete German labels at 1280/1440/1600, empty mode, full-width screenshot and critique.
- **Implementation / critique:** A1 rendered at 1440×950. All four source figures share a baseline; averages stay attached to visits/hours. Its restraint is deliberate: the rightmost team note gives context without an empty average placeholder. This is the neutral editorial option, not a recoloring of the old card grid.

### A2 · Zusammenhänge

- **Philosophy:** explain reach, repeated work and effort through their relationships.
- **Composition:** a broad markets/visits block with the 2.8 ratio joining them, a time block with the 1.6 hours/visit ratio, and a compact team block. Connections use typography and alignment rather than unsupported chart shapes.
- **Expression:** subtle blue relational surfaces, black source totals, restrained labels. Three unequal zones show that a ratio belongs to its inputs. Target 210–230px.
- **Why choose it:** averages feel attached to the work rather than extra footer statistics.
- **Tradeoff / watch:** asymmetric space must not make the SM count disappear; preserve all four source metrics and readable units.
- **Proof required:** same six values and laptop widths, ratio meaning without fake causality, empty mode, screenshot and critique.
- **Implementation / critique:** A2 rendered at 1440×950. The markets→visits relationship and averages occupy one band; effort has its own ratio and the team retains a complete source figure. The connecting arrow expresses the explicitly labeled ratio, not growth. The team icon was kept small and neutral so it does not compete with source totals.

### A3 · Besuche im Fokus

- **Philosophy:** make completed visits the operational anchor, because both averages depend on this count.
- **Composition:** a larger visit total in a softly accented left block; the other three totals sit together above two averages on the right. One coherent surface, rather than a hero plus unrelated cards.
- **Expression:** very light Coke-red anchor surface, black 71, restrained neutral fields and blue average accents. Target about 220px.
- **Why choose it:** stronger visual entry point and a clear distinction between total work and its context.
- **Tradeoff / watch:** the lead metric is a deliberate priority; the other three totals must remain substantial and never become tiny metadata.
- **Proof required:** all six metrics, visual balance at each laptop width, no false delta/trend, empty mode, screenshot and critique.
- **Implementation / critique:** A3 rendered at 1440×950. The 71-visit anchor is clearly prioritized while markets/hours/team remain substantial. A faint red source block gives character without coloring the activity figures themselves. Kept its anchor narrow and the average strip on the right so it remains a compact admin component rather than a hero.

### A4 · Arbeitszeile

- **Philosophy:** dense everyday monitoring, occupying less vertical space without losing any value.
- **Composition:** four compact horizontal label/value cells under a thin heading. Small coherent icons establish reading anchors; the two averages sit immediately below their base values inside the same cells. No second global footer.
- **Expression:** pale neutral/blue group surfaces and short blue average labels; black numeric totals, thin separators. Target 150–180px.
- **Why choose it:** the calculated performance section moves higher on the screen while the full activity overview remains readable.
- **Tradeoff / watch:** compact does not mean low contrast or 8px text. Long labels must wrap without misaligning source totals or averages.
- **Proof required:** all six metrics, shortest deliberate layout, 1280 label wraps and keyboard controls outside the component, empty mode, screenshot and critique.
- **Implementation / critique:** A4 rendered at 1440×950. Horizontal label/value alignment and the small blue/grey icons produce the shortest activity option (roughly 147px in its first render). Both averages remain near their numerators. The tradeoff is denser supporting text; laptop-width review must keep the hours figure and label from colliding.

### A5 · Zwei Perspektiven

- **Philosophy:** distinguish scope from intensity: how much happened, then what one market or visit typically required.
- **Composition:** four base totals in a calm 2×2 area on the left; two larger averages stacked in a lightly tinted right column. Shared card heading, internal group labels “Umfang” and “Im Durchschnitt”.
- **Expression:** an editorial two-part board, black volume figures and blue averages. The right surface supplies character through grouping, not an extra border on every value. Target 240–260px.
- **Why choose it:** the most explicit separation between source totals and derived measures.
- **Tradeoff / watch:** intentionally taller; ensure it remains a component in an admin dashboard rather than a marketing hero.
- **Proof required:** exact six metrics and group semantics, balanced columns at 1280–1600, empty mode, screenshot and critique.
- **Implementation / critique:** A5 rendered at 1440×950. The source totals are readable as a 2×2 operational board, while a pale blue average column establishes a genuinely different grouping. Both averages are substantial without introducing unsupported targets or deltas. This intentionally uses more height than A4; the distinction remains part of the choice.

## Performance alternatives — planned before implementation

### P1 · Klare Signale

- **Philosophy:** refine the colored reference into a concise row of six independently scannable metrics.
- **Composition:** six full-height white cards across the available width; consistent label, value, denominator and a small semantic icon. Thin colored top edges reference the earlier UI; true percentage tracks appear only for valid percentage metrics. Raw OOS frequency has a count label, not a fake full progress bar.
- **Expression:** red for findings, green for work and improvement, a neutral count where appropriate. Target 200–220px; labels may use two lines at narrow laptop widths.
- **Why choose it:** closest continuity with the colored cards Kilian liked.
- **Tradeoff / watch:** six columns are dense. Check the long availability labels carefully; retain adequate internal width and readable details.
- **Proof required:** six metrics, exact denominators, no fake track for count, before/after helper, all laptop widths, empty mode, screenshot and critique.
- **Implementation / critique:** P1 rendered at 1440×950. Six top-edged white cards preserve the colored reference and align values and tracks. Red findings and green outcomes are explicit in labels. Frequency has a unit explanation instead of a fake percentage track. The long labels fit without hiding wording; a narrow-laptop check remains important for this dense direction.

### P2 · Von Befund zu Wirkung

- **Philosophy:** tell the availability story in two stages: work/detection/remediation, then the recovered share and final availability.
- **Composition:** four compact measures across the top. A full-width availability band below relates the +13.4% gain to 95.8% after, with a slim segmented whole showing 82.4 before +13.4 recovered +4.2 remaining. Before is a helper, not a separate headline card.
- **Expression:** controlled red/green cues above; a light green lower surface and three labeled segments that sum to the whole. Target 280–310px.
- **Why choose it:** makes the hardest formula visually understandable without presenting relative percentage growth.
- **Tradeoff / watch:** explanatory chart must not become decorative or imply product/SKU coverage beyond category observations.
- **Proof required:** all six headlines, mathematically correct segments, count-based gain, all widths, empty mode, screenshot and critique.
- **Implementation / critique:** P2 rendered at 1440×950. The four supporting KPIs form a calm row, while gain/after share a light green band. Verified the whole visually as 82.4% already available +13.4% recovered +4.2% remaining; the labels explain each segment. The before figure remains chart context, and +13.4 is not presented as relative growth. Kept the band slim so the explanation does not overwhelm the two outcome values.

### P3 · Drei Blickwinkel

- **Philosophy:** group the measures by business question instead of making six unrelated boxes.
- **Composition:** three equal panels for Tätigkeiten (basic/remediation), OOS-Befund (affected markets/frequency), and Warenverfügbarkeit (gain/after). Each holds two substantial metrics with a shared contextual heading and quiet separator.
- **Expression:** green, red and emerald role cues; color concentrated in group headers and values, with a slightly stronger final availability surface. Target 280–310px.
- **Why choose it:** the clearest conceptual grouping while maintaining equal prominence of all six metrics.
- **Tradeoff / watch:** a grouping is not a timeline: avoid arrows suggesting remediation happens before detection.
- **Proof required:** six visible values, understandable group headings, exact denominators, all widths, empty mode, screenshot and critique.
- **Implementation / critique:** P3 rendered at 1440×950. Group headings communicate three business questions rather than an implied process order. Two equally substantial values in each panel remain directly comparable. Kept red/green tints concentrated in headers and the final availability panel; omitted extra progress tracks to avoid repeating P1’s philosophy.

### P4 · Ergebnis im Fokus

- **Philosophy:** lead the eye to the outcome that the work produces, keeping its supporting evidence immediately adjacent.
- **Composition:** the five supporting metrics occupy a deliberate three-over-two arrangement on the left; a larger availability-after panel on the right contains before context and the observation basis. Gain remains its own headline on the left; do not duplicate it as another headline.
- **Expression:** white evidence cells with meaningful red/green numerals; pale emerald final panel with a stronger 95.8% figure. Target 285–315px.
- **Why choose it:** most decisive visual prioritization of the final result.
- **Tradeoff / watch:** “after” may dominate too strongly; keep gain and remediation clearly legible, no generic promotional hero treatment.
- **Proof required:** all six metrics, unambiguous before/after context, equal meaningful source visibility, widths, empty mode, screenshot and critique.
- **Implementation / critique:** P4 rendered at 1440×950. The final 95.8% receives a larger pale-green result panel; all five supporting values remain clear in a three-over-two evidence layout. Before availability sits only in the result footnote. Kept the gain as an independent headline and avoided repeating it inside the result block.

### P5 · Auswertungsblatt

- **Philosophy:** deliberate report density and aligned comparisons, with color marking meaning rather than dividing the page into cards.
- **Composition:** one broad white surface, two columns and three generous rows. Each metric has a colored semantic marker, label and numerator beside a strongly aligned value. Thin rules carry structure; restrained percentage tracks reinforce eligible values without becoming the main UI.
- **Expression:** an editorial report with black structure, red findings, green outcomes and a softly emphasized gain/after row. Target 260–290px.
- **Why choose it:** reads as a finished admin report, a different philosophy from six separate KPI cards.
- **Tradeoff / watch:** paired positions do not imply equal denominators; each keeps its own plain-language explanation.
- **Proof required:** all six metrics, aligned units and row rhythm, real percentage tracks only, all widths, empty mode, screenshot and critique.
- **Implementation / critique:** P5 rendered at 1440×950. Aligned number columns and three report rows create a different reading rhythm from P1/P3. The gain/after row is lightly emphasized; count frequency has no fake track. The two-dimensional order and independent denominator text remain visible. Final review will increase the smallest explanatory text rather than sacrificing readability for density.

## Preview behavior and completion evidence

Standalone static server, no credentials, no database imports, no fetch/API requests. Reuse the bundled Inter font locally. Component tabs, five option selectors, full-width gallery, empty-data mode, per-component selection and a combined dashboard view are functional. Choice is stored only in this preview's local browser storage and is not applied to the application. All five alternatives receive the same dataset, labels and verification checklist.

Build sequentially: A1 → render/review → A2 → render/review → A3 → render/review → A4 → render/review → A5 → render/review; then P1 through P5 under the same process. Record specific critiques and refinements here. Final audit must prove ten distinct full-width options, selectable independently, both groups intact in the combination, laptop layout and honest empty states. Screenshot evidence is not a claim that one design is objectively preferred.


## Final refinements and verification — 2026-10-16

Each of the ten directions was implemented and visually reviewed individually before continuing to the next. The final shared review increased metric labels to 10–10.5px and explanatory captions to 9–9.5px instead of shrinking German wording. Darkened denominator text and the availability legend; preserved each direction's composition and meaningful red/green cues. Corrected empty-result color precedence in P3/P4 so unavailable outcomes do not appear green. The most compact activity direction remains about 148px high; the report-style performance direction is deliberately taller (about 302–320px) after readability refinements.

Verification used the full-story checklist for this specific standalone preview: UI selection → local preference → component rendering. No API/database layer exists in this story. The static server starts with a clean environment, imports only Node standard libraries, serves local assets and sets `connect-src 'none'`. It does not load app environment files, auth, database code or scheduled jobs. Human localhost:3000/4000 was not used for agent verification. No production query, mutation, migration or deployment was performed.

- All ten directions were checked at 1280, 1440 and 1600 laptop widths, with the sidebar expanded for the narrower content area. All six values remained visible in each direction; no horizontal page overflow or overflowing component elements were detected in these 30 layout checks. Final galleries at all three widths and individual screenshots at 1440 are saved below.
- Both full-width galleries show exactly five alternatives. The five activity designs share the same six activity values; the five performance designs share the same six headline values. P4 additionally emphasizes the previously documented availability-before figure as supporting context, not an extra KPI.
- Empty mode checked in all ten: real zero counts, unavailable hours/averages/percentages as dashes, no NaN/Infinity, no invented progress tracks. P3/P4 empty dashes have the same neutral color as the other performance options.
- End/Home/left/right keyboard navigation changes the selected variant and restores tab focus. The gallery leaves an option in the keyboard tab order. Sidebar and data-mode controls retain focus after rerender.
- Chose A3 plus P2 through the UI, opened “Mein Entwurf”, verified both component identities and all twelve values, reloaded and verified persistence. “Auswahl zurücksetzen” restores A1/P1. Test choices were reset rather than left as an imposed recommendation.
- Fourteen standalone JavaScript modules passed syntax checks. Synthetic arithmetic checks confirmed affected-market and category-check denominators remain distinct, +13.4 is recovered share of the whole, before + gain = after, and the three segments sum to 100 before rounding. Browser console returned no messages during final verification.

### Review links and artifacts

Run/open: <http://127.0.0.1:3047/>. The static server is left running for Kilian. `#aktivitaet/alle` and `#leistung/alle` open the two full-width galleries; `#kombination` shows the independently chosen pair. Selection only affects this preview's local browser preference.

Source: `outputs/sm-dashboard-design-options/`. Restart if needed with a clean Node environment and `node outputs/sm-dashboard-design-options/server.mjs`; no install/build or app server is required.

Evidence is in `outputs/sm-dashboard-design-options/screenshots/`:

- `a1-1440.png` through `a5-1440.png` — the five individual activity options.
- `p1-1440.png` through `p5-1440.png` — the five individual performance options.
- `activity-all-1280.png`, `activity-all-1440.png`, `activity-all-1600.png` — full-width activity galleries.
- `performance-all-1280.png`, `performance-all-1440.png`, `performance-all-1600.png` — full-width performance galleries.
- `performance-empty-1280.png` and `combined-a3-p2-1440.png` — empty and combination evidence.
- `layout-checks.json`, `empty-checks.json`, `interaction-checks.json` — DOM observations from the rendered standalone preview.

At the end of the initial exploration no option had been applied to the real dashboard. The subsequent selection is recorded below. The next implementation can use Kilian's independently selected activity/performance pair; it should keep the existing filter wiring, data contracts and lower dashboard charts.


## Selected direction and next exploration — 2026-10-16

Kilian selected **A3 · Besuche im Fokus** for Besuchsübersicht. Apply that presentation to the real SM admin dashboard, preserving live filtered values, fallback counts, loading, actual-time coverage notes, exports and all lower charts. The normal human localhost:3000/4000 receives only this selected activity design after isolated synthetic verification. No cloud release or database work is requested.

For performance, Kilian selected **P4 · Ergebnis im Fokus** as the outer layout. Keep the five supporting values in the left three-over-two grid and availability after in the right result panel. Build five new interior treatments in a separate local preview; leave the original P4 available in the first chooser. The new preview always shows chosen A3 above the performance layout. No candidate is applied to the real performance component yet.

### R1 · Vorher / Nachher

- Retain P4's outer grid. In the result panel show the final percentage followed by two horizontal bars, each on the same 0–100% scale: availability before and after. Label both directly, with the recovered +13.4% of the whole stated underneath. Put small true percentage tracks below eligible evidence values; raw frequency stays a count.
- Purpose: the requested visual comparison is immediately readable without mathematical interpretation or a cropped axis. Watch: before and after are category observations, not measured SKU stock; gain is not relative percentage growth.
- Proof: all six headline metrics, accurate bar lengths, no count progress bar, clear labels at laptop widths and empty state.

### R2 · Bestand + Zugewinn

- Keep the outer grid, use a single integrated whole in the result panel: 82.4% already available, 13.4% recovered, 4.2% remaining OOS. Place the 95.8% headline beside the final-availability label and use a compact legend with numeric shares below the bar. Evidence cells pair a quieter top label with a strong number and one denominator line.
- Purpose: show exactly where the improvement comes from and how it adds to before. Watch: do not introduce a seventh headline or imply the 13.4 value is relative growth.
- Proof: precise segments sum to 100 before rounding, before+gain=after, full labels, same six headline values, neutral empty state.

### R3 · Zwei Messpunkte

- Preserve the same P4 regions. Use two concentric rings on a full 100% scale in the right result panel: the before observation in grey, the after observation in green, with the after value centered. A direct legend names both stages and a small gain line states recovered share. Supporting values retain their own labels and denominators; count has no ring.
- Purpose: a compact visual comparison with a different emphasis from bars. Watch: ring size and center typography must not make before/after ambiguous or squeeze the existing evidence grid.
- Proof: equal scales, accessible description, exact percentages, 1280–1600 readability and no phantom rings in empty mode.

### R4 · Kategorie-Bilanz

- Keep the grid and convert only the result panel's contents into an aligned numerical balance: available category observations before, newly recovered observations, final available observations. Final availability remains the substantial percentage headline. Evidence cells use aligned labels and figures with denominator explanations.
- Purpose: the most auditable version, connecting percentage KPIs to the actual count basis. Watch: supporting counts are explanatory context, not extra headline metrics or a new dashboard formula.
- Proof: 234 before +38 recovered =272 available out of284; 12 remain OOS; final95.8%, gain+13.4%, absent-data labels remain honest.

### R5 · Drei Zustände

- Keep P4's regions, but make the result panel a concise typographic sequence: before → recovered share → after, with after visually dominant. Use a thin shared 0–100% scale and labeled stage markers only as supporting context; the primary reading remains clear numbers and short stage names. Place each supporting percentage as a stronger top-right value beside its label, with the numerator below.
- Purpose: the clearest numerical story with less chart ink. Watch: don't call the recovered share relative change; avoid collisions between the close82.4/95.8 markers by keeping numeric labels in the aligned stage list.
- Proof: exact six headline values, understandable sequence, no misleading trend/time axis, full-width laptop rendering and empty state.

Build and critique R1 through R5 one at a time, using identical synthetic data, and verify their controls, full-width gallery and empty states. The comparison remains separate from the real dashboard.


## Applied selection and color exploration

Kilian selected A3 (Besuche im Fokus) and then R5 (Drei Zustände) for the real human localhost. R5's “272 von 284 Kategorieprüfungen verfügbar” footer was explicitly removed; the 0–100% scale remains. Both selected presentations were implemented in `SmDashboardOverview.tsx` / its CSS module, keeping all data wiring, ZE coverage, calculations, exports, calculation help and lower charts. Existing loading renders the same component; its test expectation now recognizes five evidence cells plus the result panel.

Verification of the selected layout: isolated optimized Next build passed, nine filter/loading checks passed, synthetic actual-app rendering at1280/1440/1600 had no overflowing upper-card elements, all six performance values stayed visible, Nord filtering changed both activity and before/gain/after correctly, and an unvisited synthetic market showed real zero counts and unavailable rates with no chart. Evidence: `screenshots/refinements/selected-*`. No production query or mutation was involved.

The two verified presentation files were backed up and installed in the human frontend source copy. Backups: `human-app/backups/sm-visits-focus-20261016-122708` and `human-app/backups/sm-three-states-20261016-123539`, each with source before-images and a SHA-256 manifest. Normal3000/4000 remains available. An attempted optimized build of the separate human copy was blocked by its existing unrelated nullable assignment ID at `src/app/(dashboard)/sm/aktivitaet/page.tsx:1348`. That page was left unchanged and the original local dev launcher was restored; this is a human-runtime limitation, not a failure of the isolated selected-layout build. No new backend or scheduled job was started.

All five R layouts were built and individually rendered at the same1440 width before selection. R1 makes the equal-scale before/after comparison explicit; R2 groups the whole and its recovered share; R3 uses paired full-scale rings; R4 connects count arithmetic to final availability; R5 prioritizes the numerical stages. All five keep the same six headline figures and P4 outer grid. Only the selected final layout received the complete three-width actual-app pass after Kilian chose it. The other four remain reference proposals.

Kilian then requested a harmonizing before color, the same color on its number, and a tight three-part legend. A blue-teal `#50758a` trial and “Vorher / Zurückgewonnen / Offen” legend were prepared in the preview and development component. The before text has a calculated4.56:1 contrast against its mint background. Before this color trial was handed off to human localhost, Kilian requested **five preset palettes plus a sixth custom palette, preview only**. Do not apply any of these new palette choices to the human app until he selects one. The already-installed A3/R5 layout remains the human baseline.

### Color-preview plan

Keep A3 and R5 composition and synthetic numbers fixed. Vary only the result panel background, before/recovered/after colors, remaining segment and text; keep OOS findings red. The before number and bar share one color, gain matches its legend swatch, and the removed count footer stays absent.

Five presets: Salbei & Petrol (mint/blue-teal), Porzellan & Olive (neutral/warm olive), Eisblau & Smaragd (cool blue/emerald), Sand & Wald (warm sand/clay/forest), Stein & Jade (cool neutral/slate/jade). Each should be distinct without changing meaning or hierarchy. Sixth option: Eigene Farben, six editable colors, live preview, direct hex input and a fitted HSL picker. No native OS color dialog. Preserve keyboard labels, focus, Escape/outside dismissal, invalid-hex feedback, reset and browser-local persistence. Selection never writes to the app or database.

Add a separate static color chooser so the original layout proposals remain available. Show each chosen palette full-width, a five-preset gallery, and clear navigation to the sixth custom option. Verify all presets preserve the figures and matching before colors, custom live changes affect the panel immediately, reset/persistence work and empty mode does not invent a chart.


### Final color scope and proof

Kilian narrowed the color exploration: keep the original green panel background, recovered green, after green, labels and other component colors fixed. Only the **before bar segment, its legend swatch and its matching before number** may change. The six-field custom palette was superseded by a **single before-color field**; the fitted HSL picker, hex editing, invalid-input feedback, reset and local persistence remain available for that one field.

The final five presets are Petrol `#50758a`, Salbei `#5b705c`, Moos `#6d7045`, Schieferblau `#5f6f87`, Eukalyptus `#4f736d`. These muted blue/green/olive accents were chosen to suit the existing mint and emerald. Their before-text contrast against `#eff8f2` ranges from4.56 to4.95:1; this is a checked color pair, not a claim of full accessibility conformance.

Rendered all five full-width final variants at the current1104px laptop window. DOM proof confirms the same mint background `rgb(239,248,242)`, recovery bar `rgb(36,147,101)`, recovery/after figures `rgb(8,123,76)` and all six metric figures in every preset. Only the before color differs and matches its bar exactly. No component overflow was found. Custom hex input changed only that same accent, persisted after reload and reset successfully. Empty mode shows five unavailable rates plus a zero count, with no chart. The original full picker was also exercised with ArrowRight, Escape/focus return and invalid-hex feedback before the scope narrowed; the same single-field picker implementation remains. Browser console was empty.

Final chooser: <http://127.0.0.1:3047/farben.html#alle>. Sixth option: <http://127.0.0.1:3047/farben.html#custom>. Source files: `farben.html`, `color-palettes.js`, `colors-app.js`, `colors.css`. Final screenshots/observations: `screenshots/colors/fixed-green-*`. The broader earlier six-field screenshots are superseded. No color choice was installed into the human app; localhost3000/4000 retains the already-installed A3/R5 layout pending Kilian's color selection. Nothing pushed and no database work.


### Expanded color exploration — 20 presets + custom

Kilian found the muted five too similar and requested twenty substantially different options, ranging from unusual/bold to classy/clean. Expanded the existing preview only to twenty before accents plus custom as option21. First ten are labeled Mutig (Elektroblau, Violett, Magenta, Himbeere, Koralle, Mandarine, Safran, Ultramarin, Türkis, Orchidee); ten are Klassisch (Mitternacht, Tintenblau, Graphit, Mokka, Aubergine, Bordeaux, Bronze, Stahlblau, Staubrosa, Zimt). The mint background, recovered green, final green and all numeric data are still fixed. Each before number matches its bar and legend swatch. The before text colors were checked against the fixed background for readability, including a slight darkening of Stahlblau.

Twenty-one swatch selectors use a three-row layout at the reviewed laptop width. The gallery shows all twenty at full component width. The selected activity overview is available in a collapsed disclosure to focus this color-choice screen on R5; it stays unchanged in the real app. Keyboard navigation includes the custom option, dynamic counts replace stale six/five labels, and hash navigation preserves the comparison scroll position. Custom hex/HSL editing and local persistence remain available.

Verification: syntax passed for palette data and chooser. Rendered gallery has20 unique before colors and21 selectors; each matches its bar, every background/recovered/after color is identical, the six figures are identical and no component overflow was detected at the actual1104px laptop viewport. Inspected vivid Magenta and restrained Graphit individually. Keyboard End moved to custom with focus retained; custom editing changed only before color and left the mint/green unchanged. Reset worked. Console was empty. Evidence: `screenshots/colors/twenty-presets-*`. No application source/runtime, production data, deployment or human-localhost color choice was changed in this expansion.


### Five additional orange options

Added options21–25 at Kilian's request: Signalorange `#c04c00`, Goldorange `#a96900`, Kürbis `#b85614`, Aprikose `#a9653a`, Gebranntes Orange `#914625`. The twenty earlier presets remain; custom is automatically option26. Reviewed the rendered orange gallery and Signalorange individually. All five match their before number to their bar, with the same mint and recovery/result greens. Selector/gallery counts show26/25 correctly; palette syntax passes. No production or human-app change. Direct review: <http://127.0.0.1:3047/farben.html#c21>.


### Five light orange options

Kilian requested lighter oranges as well. Added26–30: Pfirsich `#f4a177`, Aprikose hell `#f6b26b`, Mango `#f3a33c`, Cantaloupe `#ef9669`, Pastellmandarine `#ffc28a`. These intentionally include light/pastel choices rather than only darker oranges. All thirty presets remain; custom is31. Syntax and rendered selector count checked, and the peach before number/bar match while the green panel remains unchanged. Preview only. Review: <http://127.0.0.1:3047/farben.html#c26>.


### Five orange-red options

Added31–35 at Kilian's request: Zinnober `#ef4b23`, Persimone `#f3693b`, Korallorange `#f17c60`, Chiliorange `#df462e`, Tiefe Koralle `#cf5948`. All earlier presets remain; custom is36. Palette syntax and rendered selector count checked; Zinnober's before number and bar match, with the mint background unchanged. Preview only. Review: <http://127.0.0.1:3047/farben.html#c31>.


### Existing app Coke red

Added36 · Coke Rot using the exact `--color-coke-red` token in `src/app/globals.css:65`: `#f40009`. Existing navigation also uses a separate red gradient; this option uses the explicitly named Coke brand token. All36 presets remain and custom is37. Before number/bar share the color, mint/recovery greens unchanged. Preview only. Review: <http://127.0.0.1:3047/farben.html#c36>.


### Soft before-to-recovery transition

Kilian requested a gradient at the before/recovered join. Added a short gradient overlay centered on that boundary in the R5 preview bar. It uses the selected/custom before color and the existing recovery green. The blend extends at most4% of the full scale to either side, capped by both adjacent shares, so it cannot enter the remaining-OOS segment or appear when either adjacent share is zero. Underlying segment widths, values, colors outside this small transition, legend and formulas are unchanged. Rendered Coke Rot confirms the red-to-green gradient, approximately16px at the current bar width, with unchanged82.3944/13.3803/4.22535 shares. Applies to all presets and custom via the existing CSS variable. Preview only; no human-app or production change.


Kilian rejected the gradient immediately after reviewing it. Reverted only the gradient overlay and its inline positioning variables; restored the original clear before/recovered boundary. All color options, numbers, legend and custom control remain unchanged. Preview only.


### Selected Coke Rot and simplified result heading — 2026-10-16

Kilian selected option36 Coke Rot for the normal human localhost. Applied the canonical `--color-coke-red` (`#f40009`) to the before number, before bar segment and its legend swatch. The selected mint background, recovered/final greens, compact three-part legend and sharp segment boundary remain. Removed the shelf icon and shortened the visible panel heading to “Warenverfügbarkeit”; it occupies one line. The accessible section name and individual before/recovered/after labels retain the full meaning. Calculations and data wiring are unchanged. The standalone R5 preview reflects the same simplified heading.

Verification used the isolated synthetic app only: optimized frontend build including TypeScript passed, all four existing dashboard loading checks passed, and actual-app laptop rendering at1280/1440 confirmed one-line heading, no icon or overflowing panel content, matching red number/bar, fixed mint/recovery colors and no gradient overlay. Screenshots: `outputs/sm-dashboard-design-options/screenshots/colors/selected-coke-header-1280.png` and `selected-coke-header-1440.png`.

The two component files were installed into the human frontend only after verifying its previous SHA-256 handoff manifest and matching the isolated build snapshot. Before-images and manifest: `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/runtime/human-app/backups/sm-coke-red-header-20261016-131650`. Existing frontend3000 supports live source updates; backend4000 was left running. No agent navigation, HTTP requests, business-data reads or writes against the human app; no cloud push/deployment.
