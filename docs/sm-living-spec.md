# Shelf Merchandiser (SM) – Living Product & Architecture Spec

> Status: living document / discovery phase  
> Last updated: 2026-08-10  
> Owner: Coke Spark SM implementation  
> Rule: Read and update this file before every material SM implementation. Confirmed requirements must not be silently replaced by assumptions.

## 1. Purpose

The Shelf Merchandiser area is a separate, smaller and more straightforward operational part of Coke Spark. It sits next to the existing GM/Coca-Cola workflow, but it must not reuse GM-specific campaign, visit, questionnaire or time-tracking behavior where the SM business rules differ.

The SM flow is assignment-driven:

1. An SM is assigned to a market on a specific calendar day.
2. The assignment defines a fixed planned duration (`Soll-Zeit`), for example 1.5 hours.
3. The SM can perform the assignment at any time on that day unless future rules add a specific time window.
4. The SM completes a simpler, phone-first questionnaire.
5. The SM submits the actual duration (`Ist-Zeit`).
6. The assignment is paid using a fixed assignment allowance (`Pauschale`), not an hourly wage calculated from the submitted duration.

Example:

> Adriana Maier · Markt 1 · Donnerstag, 07.08.2026 · Soll-Zeit 1.5 Stunden

The intended result is a reliable operational flow that is simpler than the GM area while remaining fully auditable and administratively manageable.

## 2. Terminology

- **SM**: Shelf Merchandiser.
- **SM Admin**: An existing Coke Spark admin while working in the SM workspace. This is not currently a separate database/auth role.
- **Einsatz**: One planned SM assignment for one SM, one market and one calendar day.
- **Serie**: A recurring definition that produces multiple individual Einsätze.
- **Stammmarkt**: A market normally assigned to an SM as their recurring/default responsibility.
- **Soll-Zeit**: Planned duration for an Einsatz, stored in minutes.
- **Ist-Zeit**: Actual duration submitted by the SM, stored in minutes.
- **Pauschale**: Fixed payment amount for the individual Einsatz.
- **SM-Markt**: A market record in the SM market domain. It is operationally separate from a GM market, even when both refer to the same physical outlet.

## 3. Confirmed product rules

### 3.1 Separation from the GM domain

- SM is a separate project area next to the Coca-Cola GM area.
- SM users must have their own market list.
- SM planning, questionnaires, time records, dashboard and messages must be SM-specific.
- GM campaign assignments and GM day sessions must not become the source of truth for SM work.
- A shared internal market identifier connects the same physical market across GM and SM data for later cross-team reporting.
- A change in one team’s operational record must not silently mutate the other team’s record.

### 3.2 Planning

- Planning is per market and per calendar day.
- Every Einsatz belongs to exactly one SM and one SM market.
- Every Einsatz contains a fixed Soll-Zeit.
- The SM may complete the Einsatz at any time on its planned day.
- An Einsatz may be one-time or generated from a recurring series.
- Recurring series must remain editable later.
- Editing a series must preserve already completed historical Einsätze.
- SMs have configurable Stammmärkte.

### 3.3 Completion and time

- The SM completes the questionnaire connected to the Einsatz.
- The SM submits an Ist-Zeit.
- The UI must clearly compare Soll-Zeit and Ist-Zeit.
- A deviation must be visible; the exact validation/approval policy is still open.
- Payment is a fixed Pauschale per Einsatz.
- SM time reporting is separate from GM Zeiterfassung.

### 3.4 Administration

- Admins retain access to the complete GM and SM areas.
- The admin sidebar will have two top-level workspaces/menu points: **GM** and **SM**.
- Selecting GM shows GM pages; selecting SM shows SM pages.
- An admin can switch between both workspaces at any time.
- For conveinience the normal admin row will have GM selected automatically when loading page and SM admins will have the SM tab in the sidebar opened on refresh.
- Shared account/profile/security functions remain available in both workspaces.
- SM admins need a message distributor for sending messages to SM users.

## 4. User and permission model

### Existing state

- Authentication already supports the roles `admin`, `gm`, `sm` and `kunde`.
- SM users can already be created and edited through `/admin/shelfmerchandiser`.
- The backend already persists those accounts as users with role `sm` and creates their Supabase Auth access.
- There is currently no separate `sm_admin` role.

### Target decision

Use the existing `admin` role for administrators who may switch between GM and SM. “SM Admin” describes the active workspace and responsibility, not a second login role.

If limited SM-only administrators are required later, implement this through explicit page/action permissions or an admin-domain membership table. Do not create a competing authentication role without a confirmed permission matrix.

### Admin workspace state

The GM/SM workspace selector should:

- control navigation visibility only, not weaken authorization;
- remember the last selected workspace per admin across sessions;
- redirect to the first readable page in the selected workspace;
- never hide a permission error by falling back to data from the other workspace;
- keep GM and SM filters/state isolated.

The right-side `Anfragen` flap is workspace-scoped as well. GM routes may load only the existing GM questionnaire, visit-delete and time-change requests. SM routes must never load or display those GM requests; they show a separate `SM Anfragen` state and will later connect only to dedicated SM request tables/endpoints. Until that backend exists, the SM flap is an intentionally empty UI state rather than a fallback to GM data.

## 5. Target navigation

### GM workspace

The existing GM/Coca-Cola admin pages remain available as they are. Their exact grouping is outside this document unless an SM change affects shared navigation.

### SM workspace

Initial target pages:

1. **SM Dashboard** – operational overview and KPIs.
2. **Verplanung** – one-time and recurring Einsatz planning.
3. **Einsätze** – searchable assignment list and assignment detail.
4. **SM Märkte** – separate market master data and cross-team identity.
5. **SM Fragebögen** – questionnaire authoring and assignment rules.
6. **SM Zeiterfassung** – Soll/Ist and Pauschalen per Einsatz.
7. **Shelf Merchandiser** – SM account and Stammmarkt management.
8. **Nachrichten** – message distributor and delivery/read status.

Names and final order can change, but these responsibilities must remain distinct.

## 6. End-to-end workflows

### 6.1 Create and configure an SM

1. Admin creates an SM account using the existing creation page.
2. The system generates the login access as it does today.
3. Admin configures the SM’s Stammmärkte and any later SM-specific settings.
4. The SM can log in and sees only their own SM data.

### 6.2 Create a one-time Einsatz

1. Admin selects a market.
2. Admin selects an SM.
3. Admin selects the execution date.
4. Admin enters Soll-Zeit in minutes/hours.
5. Admin selects the applicable questionnaire/version.
6. Admin enters or selects the fixed Pauschale.
7. The system creates one immutable individual Einsatz record with snapshots of planning-relevant values.

### 6.3 Create a recurring series

1. Admin selects market, SM, recurrence pattern, validity range, Soll-Zeit, questionnaire and Pauschale.
2. The backend validates the rule and materializes individual Einsätze for the supported planning horizon.
3. Every occurrence receives its own ID and status.
4. Series changes support at least:
   - only this Einsatz;
   - this and future Einsätze;
   - the complete future series.
5. Completed/submitted historical Einsätze are never rewritten by a later series edit.
6. Skipped/cancelled occurrences remain auditable instead of being hard-deleted.

### 6.4 SM performs an Einsatz

1. SM opens the phone-first dashboard.
2. SM selects today’s planned Einsatz.
3. SM sees market, address, Soll-Zeit and questionnaire status.
4. SM completes the questionnaire.
5. SM enters/submits Ist-Zeit.
6. Submission validates assignment ownership, date, questionnaire completeness and allowed status transition.
7. The Einsatz becomes submitted/completed and appears in SM Zeiterfassung.

Whether the Ist-Zeit is entered manually, derived from a start/stop timer, or supports both is still open.

### 6.5 Message distribution

1. SM admin writes subject and message body.
2. Admin selects recipients: all active SMs, filters, or individually selected SMs.
3. Backend stores the message and immutable recipient rows.
4. SM sees unread/read messages on the dashboard.
5. Opening or explicitly marking a message updates that recipient’s read timestamp.
6. Admin can see delivery and read counts without exposing one SM’s private data to another SM.

## 7. Proposed data architecture

This is a draft model. Names can change during implementation, but the boundaries and invariants should remain.

### 7.1 Existing reusable data

- `users`: continue using role `sm` for SM identities.
- Supabase Auth: continue using the existing account creation/login integration.
- Existing admin identity and audit conventions should be reused.

### 7.2 SM market domain

Create an SM-specific market table instead of overloading the current GM `markets` rows.

Suggested tables:

- `sm_markets`
  - `id`
  - `internal_market_id` – shared stable business identifier used to match GM/SM records
  - name, chain, address, postal code, city, region and SM-specific fields
  - active/soft-delete/audit timestamps
- optional `market_identity_links`
  - connects `sm_markets.id` to the existing GM `markets.id`
  - records match method and verification state

The same internal ID may identify the same physical outlet across both teams, but operational row IDs remain separate.

#### 7.2.1 Authoritative Coke Spark UI rule for SM pages

The six Coke Spark screenshots supplied on 10 August 2026 are the authoritative visual reference for the SM admin area. The SM pages are not allowed to introduce a parallel dashboard language. They must reuse the current GM admin shell and components as directly as possible.

For `SM Märkte`, the design rule is especially strict: begin with the current GM `Märkte` page and adapt only the domain fields. Do not redesign the page around summary cards, statistics, pagination, a new sidebar, a new header, or a different table system.

#### 7.2.2 Exact application shell

The application shell must be shared with the current GM admin pages rather than recreated locally inside the SM feature.

Sidebar:

- The collapsed sidebar is approximately 48 px wide; the expanded sidebar is approximately 180 px wide.
- It is pure white with a single very light right divider. It does not use a tinted background or a separate boxed navigation card.
- The existing profile/account tile remains at the top. In expanded state it shows the avatar, account name and the existing soft translucent white treatment.
- Navigation is divided by the same small uppercase group labels used by GM: low-contrast grey, tightly tracked and visually secondary.
- Inactive navigation rows are white/transparent with a muted grey outline icon and grey text.
- The active row is the existing vivid Coke red rounded rectangle with white icon/text, a thin pale outline and the same soft red shadow/glow. It is not a pale-red row with red text.
- Row height, icon size, left padding and vertical spacing must be inherited from the existing sidebar component.
- The SM navigation appears as a workspace grouping inside this existing sidebar. It must not introduce `GM`/`SM` toggle buttons at the top of the page.
- For the design reference, the sidebar is expanded so the hierarchy and active `Märkte` entry can be reviewed.

Header:

- The page header is the current white horizontal header, approximately 72 px high, with the same bottom divider.
- The left edge begins immediately after the sidebar and follows the same 26 px horizontal inset.
- The title uses the current black GM page-title style and reads `Märkte`.
- The small period capsule sits directly below the title exactly like the current page. For SM it shows the currently selected planning period or calendar period; its height, calendar icon, grey border and muted text remain unchanged.
- Right-side actions reuse the current compact header buttons. Their order is `Excel Export`, `Regionen normalisieren`, `+ Markt anlegen`, `+ Importieren`.
- Neutral actions retain the current white surface, fine grey border and tiny shadow. Primary actions retain the existing dark Coke-red fill/gradient, white text, 7 px radius and white inset highlight.
- No subtitle, KPI, oversized page heading or decorative header content is added.

Page canvas:

- The background below the header is the current very light grey `Märkte` canvas.
- The market workspace starts at the same top and side offsets as the reference page.
- The floating right-side `ANFRAGEN` rail remains a global shell element and must not be redesigned by SM.

#### 7.2.3 Exact market-list container

The SM list uses the existing GM `Märkte` container one-to-one:

- A very pale grey outer shell with the same subtle border and large rounded top corners.
- A small uppercase `MÄRKTE` label in the shell header at the upper left.
- A right-aligned total count such as `149 Märkte` in the same tiny grey type.
- A white inner list surface inset by the same approximately 10 px margin.
- No KPI or summary strip between the shell header and the search/filter toolbar.
- No pagination footer. The current long, virtualized/scrolling table behaviour is retained.

#### 7.2.4 Search, filters and dropdown windows

Toolbar structure is copied from GM `Märkte`:

- Search field on the far left with the same width, grey fill, search icon and placeholder `Markt suchen…`.
- A flexible empty gap separates search from filters.
- Compact filter buttons align on the right in a single row and use the current thin outline, white fill, tiny chevron and 6–7 px radius.
- SM filters are `Region`, `Ort`, `PLZ`, `Handelskette`, `Stamm-SM`, `Stammmarkt`, `Status`, `Rhythmus` and `Nächster Einsatz`. Lower-priority filters may move into `Info` at narrower widths, following the current page behaviour.
- The dropdown window is the exact existing menu: narrow white floating panel, light border, restrained shadow, hidden/minimal scrollbar, 28–30 px option rows and no oversized menu items.
- `Alle` is the first option. The selected/hovered option uses the same low-opacity red background and red text seen in the current filters.
- Search/filter state must never change the table's core spacing.

#### 7.2.5 SM market table

The table must look almost identical to the current GM market list. Only domain columns change.

Shared row rules:

- Header labels are the same tiny uppercase grey labels.
- Rows keep the current compact height, white background and hairline horizontal divider.
- The first column keeps the chain badge, bold market display name and muted database/chain subline.
- Text sizes, weights, uppercase behaviour, column alignment and truncation are inherited from the GM table.
- Hover uses the same barely visible grey tint.
- A selected row uses the exact current pale-red fill plus 2 px red left rail; the market name turns red while secondary values remain neutral.
- The list continues behind an open drawer exactly as it does today.

SM columns, left to right:

1. `MARKT` – chain badge, market name and DB/chain subline.
2. `INTERNE ID` – the stable physical-market identifier shared with GM where available.
3. `INFO` – existing compact note/quality marker behaviour.
4. `ADRESSE` – street and house number.
5. `REGION`.
6. `PLZ`.
7. `ORT`.
8. `STAMM-SM` – currently assigned Shelf Merchandiser or `—`.
9. `STAMMMARKT` – directly visible in every row. Use a compact value: `Ja` in green for an active Stammmarkt, `Nein`/`—` in neutral grey otherwise. This must be scannable without opening the drawer.
10. `SOLL-ZEIT` – compact duration such as `90 Min`.
11. `RHYTHMUS` – compact schedule such as `Mo + Fr` or `1× / Woche`.

The table must not grow visually heavier because of the new fields. At reduced widths, `INFO`, `SOLL-ZEIT` and `RHYTHMUS` collapse before the identity, address or `STAMMMARKT` information disappears.

#### 7.2.6 Market detail drawer

The drawer is the existing GM market drawer with SM content substituted:

- Same fixed right position, width, white header, grey body, white tab strip/footer, left border/shadow and internal scrollbar.
- Same compact chain initials tile, market name, uppercase address line and square grey close button.
- Same tiny classification badges below the address.
- Same thin tab underline and red active-tab text.
- Same uppercase micro-section labels, grey label column, dark value column and horizontal section dividers.
- Same bottom-right neutral `Bearbeiten` button.

Tabs:

1. `Marktinfo`
2. `Einsätze`

`Marktinfo` sections:

- `IDENTITÄT`: Name, Name lt. DB, interne ID and optional SM external ID.
- `STANDORT`: Adresse, Postleitzahl, Ort and Region.
- `ZUORDNUNG & KLASSIFIKATION`: Stamm-SM, Stammmarkt `Ja/Nein`, Status, Soll-Zeit, Rhythmus and optional verknüpfter GM-Markt.

The `Stammmarkt` state is editable in the drawer with the same clean custom select/toggle treatment used by current market fields, but its value is also always visible in the table row.

#### 7.2.7 Create and import overlays

All overlays reuse the screenshots' existing patterns:

- `Markt anlegen` uses the same centred white modal, blurred/dimmed background, uppercase eyebrow, compact title/subtitle, tab-like market-type selector, two-column bordered form groups, existing inputs and red bottom-right save button.
- SM field labels replace GM-only fields without changing the modal geometry. Required SM fields are identity, full address, region, active status, optional Stamm-SM, Stammmarkt state, Soll-Zeit and rhythm.
- `Importieren` starts with the same compact dataset-selection window, exact header layout, progress dots, square close button and stacked bordered option rows with right arrows.
- Mapping, preview and error UI continue to use existing Coke Spark import components.

#### 7.2.8 Interaction and responsive rules

- The sidebar expands/collapses through the existing shell behaviour; the page never owns that state.
- Clicking a row opens the drawer and retains the selected-row highlight.
- Filters, drawer opening and modals use the current quiet 150–250 ms transitions.
- Full addresses and IDs retain tooltips/copy behaviour where truncated.
- Keyboard focus, status text and icons follow current shared components.
- At narrower desktop widths the sidebar can collapse and the table hides lower-priority columns exactly as the GM page does.

#### 7.2.9 Explicit design prohibitions

Do not introduce any of the following on `SM Märkte`:

- summary/KPI cards above the table;
- a GM/SM segmented switch in the content header;
- a new sidebar design, new logo tile or different navigation density;
- a separate page subtitle such as `Shelf Merchandising · Marktstamm`;
- pagination controls replacing the current scrolling list;
- oversized typography, dashboard cards, loud shadows or new color families;
- a drawer layout that differs from the GM market drawer;
- rounded pill-heavy table values.

#### 7.2.10 Second design-reference state

The corrected design reference must show:

- the expanded existing Coke Spark admin sidebar, matching the supplied screenshot proportions and navigation styling;
- the existing `Märkte` header with its period capsule and current header actions;
- the current grey market shell and white scrolling table without a summary strip;
- the same search/filter toolbar and dense row layout;
- `STAMM-SM` and `STAMMMARKT` visible directly in market rows;
- one selected row using the current pale-red selection state;
- the existing right market drawer open with SM-specific `ZUORDNUNG & KLASSIFIKATION` values;
- realistic Austrian market data and no modal open at the same time.

Design reference: **pending approval**. The generated image remains a preview until explicit approval. Only the approved image is copied into `SM UI/` and linked here.

<!-- ARCHIVED INVALID FIRST DRAFT. DO NOT IMPLEMENT. This generic draft predates the authoritative Coke Spark screenshots and is intentionally hidden from rendered Markdown.

#### 7.2.1 GM-admin visual contract for SM pages

The SM admin area must look and behave like a native continuation of the existing GM admin area. The following contract was derived from the current Märkte, FB Management, Zeiterfassung, Fotoarchiv, Fragebogen, Gebietsmanager, IPP, Prämien and related GM admin pages. SM pages must reuse these patterns rather than inventing a parallel design system.

- App canvas: `#f5f5f7`, with the existing white collapsible admin sidebar and white 80 px page header.
- Main content padding: 28 px on desktop. Primary page sections usually have 16–20 px vertical separation.
- Typography: the existing Inter/system stack only. Page title 20 px/700 with tight negative tracking. Body/control text is predominantly 10–11 px. Important values use 13–18 px, strong weight and tabular numerals.
- Section shell: subtle grey outer card using approximately `rgba(0,0,0,0.025)`, a `rgba(0,0,0,0.07)` border and 14 px radius.
- Section header: 13 px vertical and 18 px horizontal padding. Section label is 9 px, bold, uppercase, `0.09em` tracking and low-opacity black. Counts sit on the right in 10 px semibold tabular text.
- Inner surface: white card with `margin: 0 10px 10px`, 12 px radius, fine neutral border and restrained `0 1px 6px rgba(0,0,0,0.05)` shadow.
- Primary actions: Coke-red vertical gradient (`#DC2626` to `#b91c1c`), white 11 px semibold text, 7–8 px radius, 12 px Lucide icon and the same subtle inset/ring shadow used in the GM header.
- Secondary actions: white-to-`#f5f5f5` gradient, neutral text, fine ring and light one-pixel shadow. Destructive actions stay low-emphasis until confirmation.
- Inputs/search: about 28–30 px high, 7–8 px radius, `rgba(0,0,0,0.03)` idle fill, 11 px text, search icon on the left and a clear icon only when populated.
- Filter controls: compact custom dropdown buttons, not browser-native selects. Inactive filters are white with a faint border. Active filters use a soft red tint and red border/text. Active values also appear in a removable filter strip.
- Segmented controls: low-contrast grey track with white active segment, 6–8 px radii and a tiny shadow. Do not use oversized pills.
- Tables/lists: 8–9 px uppercase column labels, 50–54 px compact rows, fine horizontal separators, left-aligned identity and right-aligned numeric/status values. Hover uses a barely visible grey fill. Selected rows use soft red fill plus a 2–3 px red left rail.
- Identity badges: small chain/status badges with 3–5 px radius, muted chain-specific tint and uppercase 8–9 px text. They aid scanning but do not dominate the row.
- Detail drawers: fixed to the right, approximately 440 px wide, `#f5f5f7` body, white header/tabs/footer, subtle left shadow and 220 ms slide-in animation. Drawer sections use uppercase micro-labels and two-column label/value rows.
- Modals: centered white surface, 14 px radius, restrained layered shadow, `rgba(0,0,0,0.22–0.25)` overlay and 4 px background blur.
- Feedback: inline errors/warnings/successes use low-opacity tinted fills and borders. Loading states use layout-matched skeletons with a soft shimmer. Empty states use a 44–52 px tinted icon tile, short title and one-line guidance.
- Motion: fast and quiet—roughly 120–250 ms. Page content may fade/translate up by 8 px; drawers slide from the right. Avoid decorative motion that competes with dense admin work.
- Density rule: desktop-first and information-dense without becoming visually heavy. White space separates functional groups; large marketing-style cards, oversized type and loud gradients are not part of the admin language.

#### 7.2.2 SM Märkte page purpose

The page is the authoritative SM market workspace. It answers four questions immediately:

1. Which markets belong to the Shelf Merchandising domain?
2. Which physical GM market, if any, is linked through the shared internal ID?
3. Which active SM is responsible as Stammmarkt owner, and for what validity period?
4. What is the market's current planning state, default Soll-Zeit and next Einsatz?

The first design is a desktop admin view. Mobile execution remains on the SM side; this page is not a mobile market browser.

#### 7.2.3 Page header and actions

- Existing app header title: `SM Märkte`.
- Subline in the header: `Shelf Merchandising · Marktstamm`, using the same small muted style as other contextual header controls. There is no RED-month selector because SM planning is calendar/assignment based.
- Right-side actions, in this order:
  1. `Excel Export` as the existing neutral secondary button.
  2. `Markt anlegen` as a red primary button with plus icon.
  3. `Importieren` as a red primary button with upload icon.
- Import and create actions remain permission-gated in the backend. Export is read-only and exports the currently filtered market scope with a reconciliation sheet.

#### 7.2.4 Main market workspace

Use the same grey outer shell and white inner card as the GM Märkte page.

Grey shell header:

- left label: `SM Märkte`;
- right count: either `149 Märkte` or `37 / 149 Märkte` when filters are active;
- a small `Filter` reset button appears beside the count only while search/filter state is active.

Inside the white surface, add one compact summary strip before the toolbar. It must look like the IPP summary strip, not like a dashboard hero:

- `Märkte gesamt`
- `Aktive Stammmärkte`
- `Ohne SM-Zuordnung`
- `Ohne GM-Verknüpfung`
- `Einsätze diese Woche`

The strip uses compact white stat tiles on a faint grey inset surface. It is primarily a data-quality/operations aid. Clicking a problem count applies the corresponding table filter.

#### 7.2.5 Search and filters

Search is left-aligned and searches across all safe visible identifiers and text fields:

- market name;
- chain;
- full address, postcode and city;
- shared internal market ID;
- SM-market-specific external ID if later required;
- assigned Stammmarkt SM name.

Custom dropdown filters sit right-aligned and wrap cleanly:

1. `Kette`
2. `Region`
3. `Ort`
4. `PLZ`
5. `Stamm-SM`
6. `Zuordnung` – assigned/unassigned
7. `GM-Verknüpfung` – linked/unlinked/conflict
8. `Status` – active/inactive
9. `Rhythmus` – one-time/weekly/multiple per week/custom
10. `Nächster Einsatz` – overdue/today/this week/later/not planned

Active filters appear in a second line as small removable red-tinted chips, preceded by the filtered count. A complete reset is available in the grey shell header. Dropdowns follow the existing admin menu window style, use hidden/minimal scrollbars and never use browser-native select styling.

#### 7.2.6 Market table

The default table is virtualized because the source can grow and the admin must be able to scan it without pagination delays.

Columns, left to right:

1. `Markt` – chain badge plus market display name.
2. `Interne ID` – the shared physical-market identifier; visually emphasized enough to support reconciliation.
3. `Adresse` – street, number, postcode and city; truncate only with a native/custom tooltip showing the complete address.
4. `Region`
5. `Stamm-SM` – current valid assignment or `Nicht zugewiesen`.
6. `Soll-Zeit` – current default/planned duration, shown as `90 Min` or `1,5 Std.` according to the app-wide duration formatter.
7. `Rhythmus` – concise human-readable pattern such as `Mo + Fr`, `1× / Woche`, `Einmalig`.
8. `Nächster Einsatz` – local date plus small status cue.
9. `Status` – active/inactive and data-quality state.

Row behavior:

- Clicking anywhere on a row opens the detail drawer; it does not navigate away.
- Hover adds only the existing faint neutral background.
- Selected row uses soft red fill and a narrow red left rail.
- Inactive markets sort after active markets and render at reduced opacity, matching GM Märkte.
- Missing SM assignment is amber, missing/ambiguous identity link is red, healthy active rows stay neutral/green only at the status indicator.
- A right-click context menu offers `Markt bearbeiten`, `Stamm-SM zuordnen`, `Einsatz planen` and the low-emphasis destructive path `Markt deaktivieren…`.
- No hard delete is exposed in the default context menu. Historical assignments/submissions always retain the market snapshot and relation.

#### 7.2.7 Detail drawer

The first visual mockup opens the drawer to make the information hierarchy reviewable. It reuses the GM Märkte drawer dimensions and structure.

Drawer header:

- chain-tinted two-letter identity tile;
- market name and complete address;
- close button in a quiet grey square;
- badges for chain, region, active status and GM-link health;
- compact current owner/next-Einsatz summary on the bottom line.

Tabs:

1. `Marktinfo`
2. `SM Zuordnung`
3. `Einsätze`

`Marktinfo` sections:

- `Identität`: display name, chain/DB name, shared internal ID, optional SM external ID and linked GM market.
- `Standort`: street, postcode, city and region.
- `Shelf Merchandising`: active state, default Soll-Zeit, default recurrence/rhythm and optional default questionnaire version.
- `Datenqualität`: link state, last import/update, source file and conflicts requiring action.

`SM Zuordnung` sections:

- current Stammmarkt owner with validity start/end;
- optional deputies/additional responsible SMs if the business later confirms multiple assignments;
- assignment history, never overwritten;
- `Zuordnung ändern` action opening a focused confirmation/editor modal;
- quick action `Serie planen`, prefilled with market, current SM and defaults.

`Einsätze` sections:

- compact chronological list of planned, completed, missed and cancelled assignments;
- each entry shows date, SM, Soll/Ist, questionnaire state, Pauschale and status;
- filters for upcoming/history and status;
- selecting an Einsatz opens its detail without losing the market drawer context.

Drawer footer:

- default state: one neutral `Bearbeiten` button on the right;
- edit state: neutral `Abbrechen` plus red `Speichern`;
- identity-link changes and deactivation require a separate confirmation with an exact impact summary.

#### 7.2.8 Creation and import overlays

`Markt anlegen` opens the existing compact admin modal pattern, not a new page. Required minimum fields are shared internal ID, name/chain and full address. The backend verifies uniqueness and offers a clear conflict path if a GM or SM market with that internal ID already exists.

`Importieren` reuses the proven stepper flow from GM Märkte:

1. data source/type;
2. Excel upload;
3. column mapping and preview;
4. validation/reconciliation summary;
5. explicit import confirmation.

An SM market import never mutates GM operational fields. Identity linking is explicit and reported row by row. Failed rows stay downloadable with exact errors; successful rows are not rolled back because another row failed unless the user selected atomic mode.

#### 7.2.9 Responsive and accessibility behavior

- At narrower desktop widths, lower-priority columns (`Rhythmus`, `Soll-Zeit`) collapse into the identity subline before the table becomes horizontally scrollable.
- The detail drawer becomes a near-full-width overlay below approximately 900 px.
- All controls have visible keyboard focus and descriptive labels.
- Status is conveyed through text/icon as well as color.
- Full addresses and IDs are copyable; truncation always has a discoverable full value.
- The skeleton exactly mirrors summary, toolbar, headers and rows to prevent layout jumps.

#### 7.2.10 First design-reference state

The first generated design should show:

- expanded admin sidebar with the SM workspace visible and `SM Märkte` active;
- desktop page header and the three actions;
- compact summary strip;
- populated market table with search and filters;
- one selected market row;
- the right detail drawer open on `Marktinfo`;
- realistic German sample data;
- no modal or error state at the same time.

Design reference: **pending approval**. During design iteration the generated images remain previews. After explicit approval, the selected image will be stored under `SM UI/` and linked here as the implementation reference.

-->

### 7.3 Stammmärkte

- `sm_home_market_assignments`
  - `sm_user_id`
  - `sm_market_id`
  - validity start/end
  - optional priority/default metadata
  - soft-delete and audit fields

Do not store a single market ID directly on the user: one SM can have multiple Stammmärkte and assignments must be historically traceable.

### 7.4 Planning and recurrence

- `sm_assignment_series`
  - series definition, recurrence rule, timezone and active validity
  - default SM, market, Soll-Zeit, questionnaire/version and Pauschale
  - soft-delete/audit fields
- `sm_assignments`
  - one row per concrete Einsatz/date
  - optional `series_id`
  - `sm_user_id`, `sm_market_id`, `work_date`
  - `planned_minutes`
  - `actual_minutes`
  - fixed allowance snapshot in integer cents
  - questionnaire/version reference or snapshot reference
  - lifecycle status and submission timestamps
  - soft-delete/audit fields
- optional `sm_assignment_series_exceptions`
  - explicit skipped or overridden occurrences when required

Materialized occurrences are preferred over calculating the complete calendar only at read time. They provide stable IDs, offline-friendly mobile behavior, simple filters and safe historical edits.

### 7.5 Questionnaire domain

The real May 2026 SPOT questionnaire and its reporting behavior were inspected on 2026-08-10. Section 15 records the exact questionnaire. The target model must support that questionnaire without baking its labels or scoring into application code.

Confirmed boundaries:

- SM questionnaires are separate from GM questionnaire/campaign execution.
- They may reuse proven question-editor concepts, but must not write to GM submission tables.
- Questions and reusable answer options require stable IDs and explicit versioning.
- A published questionnaire version is immutable. A later edit creates a new version for future assignments.
- Every submitted Einsatz retains an immutable snapshot/reference for the questionnaire, section, question wording, answer option, scoring and applicability rules used at submission time.
- Removing or editing a question later must not alter historical submissions.
- Conditional questions must be resolved and validated by the backend as well as hidden or shown in the mobile UI.
- `not applicable`, unanswered and a scored zero are three different states and must never be collapsed.
- The same answer may play different reporting roles: execution score, context/applicability, OOS detection, OOS remediation or free text.
- Raw answers are the source of truth. Dashboard and export aggregates are derived and reproducible.

Suggested tables:

- `sm_questionnaire_templates`
- `sm_questionnaire_versions`
- `sm_questionnaire_sections`
- `sm_question_versions`
- `sm_questionnaire_version_questions`
- `sm_answer_option_versions`
- `sm_question_logic_rules`
- `sm_questionnaire_submissions`
- `sm_question_answers`

Each answer option needs at least a stable code, displayed label, earned/max points, metric role and any applicability/branching effect. Question-level configuration needs a type, required rule, possible points, metric role, aggregation configuration and display order.

#### 7.5.1 Admin questionnaire UI checkpoint (2026-08-10)

The independent SM questionnaire workspace now exists as a UI-only implementation at `/admin/sm/fragebogen`.

- Its visual hierarchy was derived from the source code of the existing Standard-Fragebogen page and then checked in the running Coke Spark UI. Screenshots are only a secondary visual reference.
- The SM implementation is a new component tree. It does not import or reuse the GM questionnaire page, GM module/questionnaire contexts, GM editors or GM domain data.
- It keeps the familiar three-tab structure: `Fragen`, `Module`, `Fragebogen`, including counts, search, compact type filtering, expandable module cards and questionnaire summaries.
- Header actions use the existing admin shell: `Excel Export`, `Modul erstellen` and `Fragebogen erstellen`.
- The independent SM module editor now mirrors the normal Standardbesuch editor UI and supports the full plain question toolbox: `Single Choice`, `Ja / Nein`, `Ja / Nein Multi`, `Multiple Choice`, `Likert Skala`, `Offener Text`, `Offene Zahl`, `Slider`, `Foto Upload` and `Matrix`. It includes the matching answer/configuration surfaces, required-question toggle, question import, reorder, expansion and type switching.
- The independent SM questionnaire editor mirrors the Standardbesuch module-library workflow: searchable library, selected-state feedback, right-click detail preview, expandable and reorderable module rows, name, description and `Nur einmal ausfüllbar`.
- GM-only configuration is intentionally absent: no Spezialfragen, Handelsketten filters, bonus/prämien/IPP rules, campaign rules or GM photo-tag behavior.
- The temporary preview data reflects the inspected Coke questionnaire: 6 modules, 19 questions and one questionnaire (`Coke Regalservice 2026`).
- Create, edit, duplicate, delete, search, filter and assignment interactions currently operate only in component-local state and reset after refresh. The export action is an explicit preview notice rather than a fake file download.
- No SM questionnaire database tables, API calls, Supabase mutations or production persistence are connected in this checkpoint.

#### 7.5.1 SM Zeiterfassung UI checkpoint (2026-08-11)

- `/admin/sm/zeiterfassung` is an independent SM component tree and does not import the GM Zeiterfassung page or its GM day-session logic.
- Its visual shell, day grouping, compact rows, expansion behavior, typography and `Tage` / `SM Ansicht` switch mirror the existing GM Zeiterfassung.
- The SM domain does not display or model Tagesstart, Tagesende, Anfahrt, Heimfahrt, Pausen, Kilometer or GM Zusatzzeiten.
- A day contains only the SM's planned Einsätze. Every Einsatz shows market identity, Soll-Zeit, Ist-Zeit, deviation, questionnaire state, Pauschale and operational status.
- The current checkpoint is UI-only and uses component-local temporary Einsätze. No SM time, planning, payroll or questionnaire backend persistence is implied by this screen.

#### 7.5.2 SM Verplanung UI checkpoint (2026-08-11)

- `/admin/sm/verplanung` is a new, isolated SM planning page inside the existing Coke Spark admin shell. It does not reuse GM planning logic or imply any GM campaign assignment behavior.
- The page follows the approved Coke Spark planning draft: compact week/date context in the header, existing admin-sized export and planning actions, one dense weekly planning table, day groupings, SM/market/status/type filters and a right-side planning drawer.
- The drawer supports the complete UI distinction between one-time Einsätze and recurring series, including weekday selection, validity range and Soll-Zeit. Editing a recurring occurrence explicitly affects only that occurrence, while a new series shows one unambiguous validity range instead of duplicate date controls.
- Search, filters, week navigation, real Excel export and drawer interactions are functional in component-local state. All SM, market, duration, recurrence and filter selectors use the custom Coke Spark dropdown UI with portal overlays, keyboard support and searchable long lists where appropriate.
- All planning dates use the custom Coke Spark month calendar rather than native browser date inputs. The calendar mirrors the established admin styling, renders through a viewport-aware portal above the drawer, supports month navigation, today/selected states and prevents an end date before the series start.
- This checkpoint deliberately uses temporary planning rows. It does not write SM Einsätze, series, time data or payroll values to the database; production persistence and backend validation remain a separate implementation phase.

### 7.6 Submission and time

Suggested separation:

- `sm_assignment_submissions` for completion metadata and questionnaire submission linkage.
- `sm_time_submissions` for Soll/Ist, submitter, corrections and approval state if approval is needed.
- `sm_time_change_requests` only if SMs must request corrections after submission.

An assignment may have only one active final submission. Replacements/corrections must be versioned or soft-deleted with an audit record; never overwritten without trace.

### 7.7 Pauschalen

The payable amount must be snapshotted on the Einsatz, even if a rate template is used during planning. Later changes to a default Pauschale must not change historical or already planned payments silently.

Store money as integer cents and currency explicitly. Do not use floating-point values.

### 7.8 Messages

- `sm_messages`: authored message, subject/body, author, publish state and timestamps.
- `sm_message_recipients`: one row per recipient with delivered/read timestamps.
- optional filter/audience snapshot for audit purposes.

Messages should be soft-deletable for admin visibility rules while retaining the required audit trail and retention policy.

## 8. Lifecycle and status rules

Suggested Einsatz lifecycle:

- `planned`
- `available`
- `in_progress` (only if start/stop is implemented)
- `submitted`
- `approved` (only if approval is required)
- `correction_requested`
- `cancelled`
- `missed`

Rules:

- only the assigned active SM may complete an Einsatz;
- an Einsatz cannot be submitted for a different market or user;
- questionnaire and time submission must be idempotent;
- a completed Einsatz cannot be silently changed by a series edit;
- cancelled or deleted records use soft deletion and remain auditable;
- no hard deletion of production operational data through normal UI flows;
- all dates use the business timezone `Europe/Vienna`, with timestamps stored as timezone-aware values;
- duration is stored as integer minutes.

## 9. SM dashboard target

The phone-first SM dashboard should prioritize action over analytics:

- today’s Einsätze with Soll-Zeit and status;
- next upcoming Einsätze;
- overdue/missed items requiring attention;
- direct access to market address/navigation;
- questionnaire completion state;
- Soll/Ist indication after submission;
- unread admin messages;
- simple recent-history view.

The separate admin SM dashboard should show:

- today/week planned, completed, open and missed Einsätze;
- Soll/Ist deviations;
- completion by SM, region and market;
- message delivery/read counts;
- planning gaps and recurring-series exceptions;
- payable Pauschalen for the selected period.

## 10. Current code inventory (2026-08-10)

### Already real/backend-connected

- Role `sm` exists in frontend and backend authentication.
- Login routes SM users to `/sm`.
- `/admin/shelfmerchandiser` loads, creates and updates real SM accounts through the backend.
- Generated account passwords are returned during creation.
- A Shelf Merchandiser master-data Excel export exists.

### Existing UI scaffolds or placeholders

- `/sm` dashboard exists and is phone-sized.
- `StatusCard`, `AssignmentList`, `WeekStrip` and `NachrichtenCard` provide visual direction.
- The recipient message card has unread/read visual states.
- The admin SM detail drawer contains profile and visit-looking tabs.

### Important limitations in the current code

- Dashboard status, assignments, week markets and the message are static/mock defaults.
- The admin SM visit display uses localStorage plus seed data, not authoritative backend SM visits.
- No SM-specific market tables or endpoints currently exist.
- Existing GM market/visit endpoints explicitly reject role `sm`.
- No SM planning, recurrence, Stammmarkt, questionnaire execution, time submission or Pauschale backend exists yet.
- No real admin message distributor, recipient persistence or read tracking exists yet.
- Admin navigation is currently one combined list and has no GM/SM workspace switch.
- There is no distinct `sm_admin` auth role.

These placeholders must be replaced deliberately; they must not be treated as production data sources.

## 11. Implementation sequence

1. Confirm the remaining questionnaire/scoring decisions in section 24 and keep this document current.
2. Confirm SM market import/master-data fields and cross-team identifier rules.
3. Confirm Einsatz status, Ist-Zeit entry and deviation/approval rules.
4. Add additive database schema and migrations with production-safe defaults.
5. Build backend services and authorization before connecting UI.
6. Build admin GM/SM workspace navigation.
7. Build SM market and Stammmarkt administration.
8. Build one-time and recurring planning.
9. Build phone-first SM Einsatz/questionnaire flow.
10. Build SM Zeiterfassung and Pauschale reporting.
11. Build message distributor and recipient read state.
12. Replace dashboard mock data with authoritative endpoints.
13. Add exports, audit views and end-to-end verification.

## 12. Reliability requirements

- All production migrations must be additive and safe for existing GM data.
- SM tables and services must default to denying GM/Kunde access unless explicitly required.
- Admin access must be enforced in the backend; hiding a page is not authorization.
- Every mutation must validate ownership, current state and soft-delete status.
- Recurring creation must be idempotent and protected against duplicate occurrences.
- Dates, recurrence and daylight-saving transitions must be tested in `Europe/Vienna`.
- Questionnaire and Pauschale values used by completed Einsätze must remain historically reproducible.
- Exports must reconcile against database counts and must never silently omit failed rows.
- Do not use smoke tests against the production database.

## 13. Open questions for the next requirements pass

### Questionnaire

- The required runtime types are now confirmed: informational/system fields, yes/no, scored multi-state single choice, conditional follow-up and open text. The admin editor UX and reuse rules remain open.
- Whether questions are reusable from a shared SM pool.
- Questionnaire assignment: global, market, chain, Einsatz, series or date range.
- Whether future questionnaire versions need photo/comment question types beyond the inspected SPOT form.
- Final confirmation of the MHD and partial-remediation scoring exceptions documented below.
- Submission correction/approval flow after a final answer set has been submitted.

### Planning and time

- Is Ist-Zeit manual, timer-based, or both?
- May an SM submit on a later day?
- What deviation from Soll-Zeit is allowed without admin approval?
- Does an Einsatz require explicit admin approval?
- Can an Einsatz be reassigned after its planned day or after work started?
- Are there allowed time windows in addition to the calendar date?

### Pauschale

- Is the amount entered per Einsatz, inherited from market/type, or calculated from a template?
- Is approval/export needed for payroll or invoicing?
- Are travel costs or other extras in scope?

### Markets and Stammmärkte

- Exact SM market import fields.
- Exact shared internal-ID column and uniqueness rules.
- Whether Stammmärkte have weekly patterns/default weekdays and default durations.

### Messages

- Push/email notification requirements.
- Scheduling, attachments, expiry and retention.
- Whether replies are allowed or messages are broadcast-only.

## 14. Decision log

### 2026-08-10 – Initial SM scope captured

- SM is a separate operational domain beside GM.
- SMs receive market/day assignments with fixed Soll-Zeit and fixed Pauschale.
- One-time and recurring Einsätze are required.
- Stammmärkte are required.
- SM market data is separate but linked to GM markets through a shared internal identifier.
- SM requires its own questionnaire, Zeiterfassung, dashboard and admin messaging.
- Admin navigation will switch between GM and SM workspaces while admins retain access to both.
- Existing SM account management is retained as the starting point.

### 2026-08-10 – May 2026 source material and SPOT inspected read-only

- The complete workbook `Auswertung Coke OOS Shelf Merchandising Mai26.xlsx`, both slides of `Summary Shelf Merchandising Mai 2026.pptx` and the live SPOT project `Coke Shelf Merchandising 2026` were inspected.
- SPOT was used strictly read-only; no questionnaire, report, response or configuration was changed.
- The production questionnaire, branching, answer scoring, hierarchy, rankings, time trends and visit drill-down behavior are now documented below.
- Reporting must distinguish execution quality from diagnostic OOS observations.
- Reporting must distinguish visit-weighted results from unweighted market averages.
- The supplied deck and workbook contain count and label discrepancies. These are retained as explicit data-quality decisions instead of being silently normalized.

## 15. Confirmed SM questionnaire: Coke Regalservice 2026

This section describes the live questionnaire observed in SPOT for the May 2026 wave. Labels should be stored as versioned content rather than hard-coded constants.

### 15.1 Einsatzdaten

Informational fields attached to every submission:

1. `Merchandiser:in`
2. `Einsatzdatum und Uhrzeit`
3. `Wochentag des Einsatzes`

The target system should populate identity and planned market/date from the assignment. It must retain both the actual visit date/time and the later submission/availability timestamp. In SPOT, a visit belonging to May was visible with a reporting availability timestamp of 1 June, proving that those timestamps cannot be treated as the same field.

### 15.2 Getränkekühler

1. `Sind im Markt Kühler für Getränke vorhanden?`
2. `Die Nachschlichtung der Getränkekühler wurde durchgeführt.`
3. `Eine MHD Kontrolle bei den Getränkekühlern wurde durchgeführt.`
4. `Eine Preiskontrolle bei den Getränkekühlern wurde durchgeführt.`

The presence question is context/applicability. Service activities are execution-quality questions.

### 15.3 Aktionsplatzierungen

1. `Sind im Markt Aktionsplatzierungen von Coca Cola Produkten vorhanden?`
2. `Die Nachschlichtung der Aktionsplatzierungen wurde durchgeführt.`
3. `Gab es bei den Aktionsplatzierungen ausverkaufte Produkte? OOS`
4. `Die OOS bei den Aktionsplatzierungen wurden behoben; Produkte wurden nachgeschlichtet.`

Presence gates the action-placement detail. OOS remediation is only applicable when OOS is answered with yes.

### 15.4 Regalplatzierungen Limonaden & Energy Drinks

1. Replenishment, MHD control and price control were performed.
2. Was an OOS situation present?
3. Was the OOS situation resolved by replenishment?

### 15.5 Regalplatzierungen Wasser & Near Water

1. Replenishment, MHD control and price control were performed.
2. Was an OOS situation present?
3. Was the OOS situation resolved by replenishment?

### 15.6 Regalplatzierungen Säfte & Eistee

1. Replenishment, MHD control and price control were performed.
2. Was an OOS situation present?
3. Was the OOS situation resolved by replenishment?

### 15.7 Information

1. If OOS existed, market staff were informed or an order was triggered.
2. Free-text field: `Bitte informieren Sie uns hier über Ausverkaufsituationen (OOS), große Mengen Ablaufware, Wünsche/Beschwerden des Marktes, sonstige wichtige Informationen:`

The information question is applicable when at least one OOS situation exists. The exact cross-section trigger must remain configurable and needs business confirmation before implementation.

## 16. Answer options, scoring and applicability

### 16.1 Positive yes/no execution question

- `Ja`: 4 of 4 points.
- `Nein`: 0 of 4 points.

### 16.2 Baseline service activity

Used for replenishment/MHD/price-control activity groups such as question 3.1:

- `Ja`: 4 of 4.
- `nicht erforderlich – alle Produkte ausreichend vorhanden`: 4 of 4.
- `nur teilweise möglich – zu wenig Ware vorhanden`: 2 of 4.
- `nicht möglich – zu wenig Ware vorhanden`: 0 of 4.
- `Nein`: 0 of 4.

### 16.3 OOS detection

- `Ja`: diagnostic OOS event present.
- `Nein`: no OOS event.

SPOT displays raw 4/4 for yes and 0/4 for no in the question detail, but OOS detection is not a positive performance target. A higher OOS rate is worse. The target system therefore stores the observed answer but reports it as prevalence, separately from execution quality.

### 16.4 OOS remediation

- `Ja`: 4 of 4; counts as remediated.
- `teilweise möglich – zu wenig Ware vorhanden`: 4 of 4 in the inspected SPOT configuration; counts as remediated.
- `nicht möglich – zu wenig Ware vorhanden`: 0 of 4; not remediated.
- `Nein`: 0 of 4; not remediated.

This question is only applicable after an OOS `Ja`. Its denominator is the number of applicable OOS cases, never all visits.

### 16.5 Market information after OOS

- `Ja`: 4 of 4.
- `Nein`: 0 of 4.
- `nicht erforderlich: es gab keine ausverkauften Produkte`: excluded/not applicable.

### 16.6 Observed exception requiring confirmation

For the MHD-control question 1.3, the inspected SPOT answer detail displayed both `Ja` and `Nein` as 4 of 4 points. This could be intentional non-penalizing documentation or a configuration error. Do not reproduce it blindly. Product ownership must explicitly confirm the desired target behavior.

### 16.7 Required answer-state model

Every answer needs an explicit state:

- `answered`
- `not_applicable`
- `unanswered`
- `invalidated` after an audited correction

`not_applicable` does not contribute to earned or possible points. `unanswered` blocks final submission when the resolved question is required. A valid zero-point answer remains answered and contributes its configured possible points.

## 17. Confirmed conditional flow

- Cooler presence controls whether cooler work questions are applicable.
- Action-placement presence controls whether the placement detail is applicable.
- Every OOS remediation question is shown only when its preceding OOS detection answer is `Ja`.
- Market-information follow-up is applicable only if at least one relevant OOS exists.
- The backend must calculate the resolved question set from the published rules and reject a final submission with missing required applicable answers.
- A draft retains answers when the user navigates between sections or briefly loses connectivity.
- If a controlling answer changes, now-hidden dependent answers are retained in draft history but excluded from the active final answer set unless the branch becomes active again before submission.

May 2026 evidence for conditional denominators:

- 947 completed visits existed in SPOT.
- Action placements were present for 917 of 947 visits; action detail therefore had 917 results.
- Action-placement OOS occurred in 91 cases; remediation had 91 applicable results.
- Limonaden/Energy OOS occurred in 202 cases; remediation had 202 results.
- Water/Near Water OOS occurred in 136 cases; remediation had 136 results.
- Säfte/Eistee OOS occurred in 68 cases; remediation had 68 results.
- The market-information question had 402 applicable results.
- The free-text information field had 122 results.

## 18. Score semantics: two independent reporting families

### 18.1 Execution/quality score

Execution quality measures whether the merchandiser performed the applicable service work.

Formula for any selected scope:

`execution_score = sum(earned_points for applicable score-driving answers) / sum(possible_points for those answers)`

Context questions and diagnostic OOS detection do not automatically reduce this score. One inspected visit had 26 of 28 points (92.9%) even though several OOS-detection answers displayed 0/4 for `Nein`. This proves the total cannot be reconstructed by naively summing every displayed question score.

### 18.2 Operational observations

Operational observations describe shelf reality and remediation:

- OOS prevalence per category.
- Number of OOS cases.
- Remediation rate per category.
- Full/partial/not-possible remediation distribution.
- Free-text issues and information/escalation completion.

They must remain explorable alongside the execution score without being merged into one ambiguous percentage.

## 19. Aggregation definitions

The same source answers support multiple valid views. Every UI card, chart and export column must display or document its aggregation basis.

### 19.1 Visit-weighted OOS rate

`visit_oos_rate = OOS-yes answers / applicable visit answers`

Example: SPOT May action placements used 91 / 917 = 9.9%.

### 19.2 Per-market OOS rate

For one market and category:

`market_oos_rate = OOS visits at that market / applicable visits at that market`

### 19.3 Unweighted market-average OOS rate

`market_average_oos_rate = average(market_oos_rate across eligible markets)`

This is the method represented by the supplied workbook summary. It gives every market equal weight regardless of visit frequency and therefore differs legitimately from the SPOT visit-weighted rate.

### 19.4 Visit-weighted remediation rate

`visit_remediation_rate = remediated OOS cases / applicable OOS cases`

With the current rule, `Ja` and `teilweise möglich` count as remediated.

### 19.5 Unweighted market-average remediation

For every market with at least one OOS case, calculate its remediation share; then average those market shares. Markets with no OOS are `nicht erforderlich` and excluded, not treated as zero or 100%.

### 19.6 Coverage and progress

- `planned_assignments`: concrete assignments expected in the selected period.
- `completed_assignments`: submitted, valid assignments.
- `completion_rate = completed_assignments / planned_assignments`.
- Also report distinct planned and visited markets because recurring services produce multiple visits per market.
- Visit count, market count and questionnaire count must never share an unlabeled number.

### 19.7 Time

- Store planned and actual duration as integer minutes or seconds.
- `total_actual_time = sum(actual_duration)`.
- `average_visit_duration = total_actual_time / completed_visits`.
- Never calculate the total by multiplying a rounded displayed average by visit count.

## 20. May 2026 benchmark and reconciliation evidence

### 20.1 SPOT visit-level benchmark

- 947 of 947 visits/results.
- Overall execution score: 96.4% (28,920 / 29,992 points).
- Merchandiser identity present: 945 of 947; two results lack that field.
- Einsatz date/time: 947 of 947.
- Weekday: 947 of 947.
- Cooler section: 98.8% (11,222 / 11,364).
- Action-placement section: 96.1%.
- Limonaden/Energy section: 94.4%.
- Water/Near Water section: 94.7%.
- Säfte/Eistee section: 93.9%.
- Information section: 97.5%.

Observed question-level values:

| Area/question | Applicable results | Value |
| --- | ---: | ---: |
| Cooler present | 947 | 100.0% |
| Cooler replenishment | applicable cooler visits | 99.1% |
| Cooler MHD control | applicable cooler visits | 100.0% |
| Cooler price control | applicable cooler visits | 97.1% |
| Action placement present | 947 | 96.8% |
| Action placement replenishment | 917 | 96.3% |
| Action placement OOS | 917 | 9.9% |
| Action placement OOS remediated | 91 | 94.5% |
| Limonaden/Energy baseline service | 947 | 95.7% |
| Limonaden/Energy OOS | 947 | 21.3% |
| Limonaden/Energy OOS remediated | 202 | 88.6% |
| Water/Near Water baseline service | 947 | 95.5% |
| Water/Near Water OOS | 947 | 14.4% |
| Water/Near Water OOS remediated | 136 | 89.0% |
| Säfte/Eistee baseline service | 947 | 93.9% |
| Säfte/Eistee OOS | 947 | 7.2% |
| Säfte/Eistee OOS remediated | 68 | 94.1% |
| Market informed/order triggered after OOS | 402 | 97.5% |
| Free-text information supplied | 122 | count, not a score |

SPOT chain ranking for the same wave:

| Chain | Results/visits | Execution score | ACT / TAR |
| --- | ---: | ---: | ---: |
| Adeg Strauss | 4 | 100.0% | 112 / 112 |
| Spar | 65 | 98.5% | 2,120 / 2,152 |
| Maxi Markt | 55 | 98.5% | 1,624 / 1,648 |
| Eurospar | 216 | 96.3% | 6,972 / 7,240 |
| Interspar | 432 | 96.1% | 12,946 / 13,472 |
| Billa / Billa Plus | 175 | 95.9% | 5,146 / 5,368 |

The result counts sum to 947. They are visits/questionnaires, not distinct markets.

SPOT overall execution-score trend:

| Wave | Score |
| --- | ---: |
| January 2026 | 96.192% |
| February 2026 | 96.488% |
| March 2026 | 95.592% |
| April 2026 | 96.648% |
| May 2026 | 96.426% |

SPOT operational observations:

| Category | Visit-level OOS | OOS cases | Visit-level remediation |
| --- | ---: | ---: | ---: |
| Aktionsplatzierungen | 9.9% | 91 / 917 | 94.5% |
| Limonaden & Energy | 21.3% | 202 / 947 | 88.6% |
| Wasser & Near Water | 14.4% | 136 / 947 | 89.0% |
| Säfte & Eistee | 7.2% | 68 / 947 | 94.1% |

### 20.2 Workbook benchmark

The `Märkte` sheet contains 149 market rows and four category pairs (`OOS vorhanden`, `OOS behoben`). The market-level means are:

| Category | Unweighted market-average OOS | Markets with OOS | Eligible remediation markets | Market-average remediation |
| --- | ---: | ---: | ---: | ---: |
| Aktionsplatzierungen | 7.94% | 21 | 21 | 79.37% |
| Limonaden & Energy | 20.64% | 47 | 47 | 86.70% |
| Wasser & Near Water | 13.79% | 32 | 32 | 83.44% |
| Säfte & Eistee | 6.52% | 20 | 20 | 80.00% |

Across the market-level overall cells, the average OOS is 12.38%. Across 53 markets with any OOS, the average remediation is 81.31%. Ninety-six markets had no OOS in any of the four categories.

Workbook chain/region population:

- Adeg: 1
- Billa/Billa Plus: 28
- Eurospar: 40
- Interspar: 57
- Maxi Markt: 7
- Spar: 16
- Regions: Nord 13, Ost 58, Süd 51, West 27

The workbook summary publishes rounded overall market averages of 7.9%, 20.6%, 13.8% and 6.5% OOS, with 79.4%, 86.7%, 83.4% and 80.0% remediation.

Published chain-level workbook summary:

| Chain (markets) | Action OOS / fixed | L&E OOS / fixed | Water OOS / fixed | Juice OOS / fixed | Mean OOS / fixed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Billa/Billa Plus (28) | 5.8% / 100.0% | 18.8% / 65.6% | 10.9% / 64.0% | 2.1% / 25.0% | 9.4% / 63.7% |
| Interspar (57) | 7.7% / 66.7% | 18.9% / 84.3% | 8.6% / 81.8% | 4.2% / 75.0% | 9.8% / 76.5% |
| Eurospar (40) | 14.1% / 87.5% | 21.7% / 94.4% | 20.3% / 90.0% | 8.1% / 100.0% | 16.0% / 93.0% |
| Spar (16) | 0.0% / n/a | 32.8% / 100.0% | 25.0% / 87.5% | 20.3% / 100.0% | 19.5% / 95.8% |
| Maxi Markt (7) | 1.8% / 100.0% | 12.0% / 100.0% | 7.1% / n/a | 3.6% / 100.0% | 6.1% / 100.0% |
| Adeg (1) | 0.0% / n/a | 0.0% / n/a | 0.0% / n/a | 0.0% / n/a | 0.0% / n/a |

`n/a`/`nicht erforderlich` means the chain had no applicable OOS cases for remediation in that category and must not be converted to zero.

### 20.3 Presentation benchmark

The two-slide deck reports:

- 150 Stammmärkte.
- 59 Interspar, 40 Eurospar, 15 Spar, 28 Billa Plus, 7 Maxi Markt and 1 Adeg.
- 1–3 Regalservices per market/week.
- 947 visits.
- 1,628 service hours.
- Average service duration 1.72 hours.
- 62 merchandisers.
- Monday and Friday as prioritized service days.

The displayed 1.72-hour average is rounded; `947 × 1.72` is about 1,628.84 hours. The total must therefore be derived from raw durations rather than from the rounded average.

## 21. Source discrepancies and mandatory quality controls

### 21.1 Market population discrepancy

The deck says 150 markets with 59 Interspar and 15 Spar. The workbook detail contains 149 markets with 57 Interspar and 16 Spar. This cannot be resolved from the supplied artifacts alone. Before migration, the business owner must identify the canonical market population and whether the difference is caused by late additions, exclusions or a manually maintained deck.

### 21.2 Mislabelled OOS chart

The red OOS chart on slide 1 uses the workbook values `6.5`, `13.8`, `20.6`, `7.9` beside the labels Aktionsplatzierungen, Limonaden/Energy, Wasser/Near Water and Säfte/Eistee. The correct workbook order is `7.9`, `20.6`, `13.8`, `6.5`. The values were therefore mapped to the wrong categories in the deck. The green remediation chart uses the correct category order.

### 21.3 Manual calculation risk

The supplied workbook contains very few live formulas: most row-level and summary values are pasted results. It is a reporting artifact, not a reproducible calculation pipeline.

The target system must enforce:

- one canonical metric definition per metric ID;
- chart series bound to metric IDs, never positional copy/paste;
- visible aggregation basis and denominator;
- automated reconciliation of summary totals to detail rows;
- market and visit counts shown side-by-side where recurrence exists;
- warning when identity, market, category or questionnaire mappings are missing;
- exports that fail explicitly instead of silently dropping rows;
- a report-generation path in which deck/table figures come from the same calculated dataset;
- recorded calculation version and questionnaire version for every generated report.

## 22. Reporting and drill-down requirements

The target admin reporting must support at least:

1. Period/wave selection and comparison with prior waves.
2. Two independent hierarchies:
   - HAFI/chain → region → market;
   - region → chain/market.
3. Overall and section execution scores with earned/possible points.
4. OOS prevalence and remediation by category.
5. Rankings by chain, region, market and SM, always showing the complete parent path. SPOT repeats region names at ranking depth without visible parent context; Coke Spark should avoid that ambiguity.
6. Time trends for overall score, section, individual question and operational metrics.
7. Visit list with market, visit date/time, submission time, SM, score and status.
8. Visit drill-down with every resolved question, answer, points, applicability reason and free text.
9. Distinct planned/completed visits and planned/visited markets.
10. Soll/Ist time, duration deviation and payable Pauschale.
11. Data-quality dashboard for missing SM identity, missing market link, late submission, duplicate assignment/submission and invalid conditional answers.
12. Excel exports containing raw visit rows plus clearly labelled summary sheets. Exported calculations must reconcile to the UI.

The May SPOT chain ranking at depth +2 demonstrates the required score format: chain, result count, percentage and `ACT / TAR` points. A visit overview lists the result ID, market/address, availability timestamp, score and ACT/TAR. These concepts should be preserved with Coke Spark terminology and cleaner hierarchy context.

## 23. Phone-first SM questionnaire requirements

- Open directly from the concrete planned Einsatz; market, date, Soll-Zeit and questionnaire version are already bound.
- Show one short section at a time with clear progress.
- Use large touch targets and plain answer wording.
- Apply conditional branches immediately while keeping backend validation authoritative.
- Autosave a local/server draft idempotently and support temporary offline operation.
- Never duplicate a final submission when a retry follows a network timeout.
- Distinguish `nicht erforderlich` from `Nein` visually and semantically.
- Require a review screen before final submission, including unresolved required answers and entered Ist-Zeit.
- After submission, show a durable receipt/status. Corrections require an audited admin process or a request flow, not silent editing.
- Preserve free text exactly and safely; do not convert it into a scored answer.
- Photos are not part of the inspected SPOT questionnaire. If required later, they must be introduced as an explicit versioned question type rather than assumed from the GM flow.

## 24. Remaining business decisions after research

1. Canonical market population for May 2026: 149 or 150, and the correct Interspar/Spar split.
2. Whether standard business reporting should default to visit-weighted, unweighted market-average, or show both. Recommendation: show both with explicit labels.
3. Whether `teilweise möglich` should continue counting as fully remediated for OOS reporting.
4. Whether MHD `Nein` intentionally receives full points or is a SPOT configuration error.
5. Exact trigger for the market-information follow-up when several categories can contain OOS.
6. Whether SMs use a timer, manually enter Ist-Zeit or can use both.
7. Allowed Soll/Ist deviation and any approval/correction workflow.
8. Exact assignment-level Pauschale defaults and payroll/export format.
9. Exact SM market import columns and verified shared internal market identifier.
10. Whether the report/deck should retain chain-level market averages, add visit-weighted measures, or publish both.
