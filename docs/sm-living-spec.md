# Shelf Merchandiser (SM) – Living Product & Architecture Spec

> Status: living document / active implementation
> Last updated: 2026-08-24
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
- **SM Admin**: A Coke Spark administrator with the database/auth role `sm_admin`. The role has the same administrative authorization as `admin`, but opens the SM workspace by default.
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

- Authentication supports the roles `admin`, `sm_admin`, `gm`, `sm` and `kunde`.
- SM users can already be created and edited through `/admin/shelfmerchandiser`.
- The backend already persists those accounts as users with role `sm` and creates their Supabase Auth access.
- The separate `sm_admin` role is applied in production and covered by backend authorization tests.

### Target decision

`admin` and `sm_admin` have the same backend permissions and can switch between the complete GM and SM workspaces. The difference is the default workspace: `admin` opens GM and `sm_admin` opens SM. The workspace selector never weakens authorization.

If limited SM-only administrators are required later, implement that through an explicit permission matrix or admin-domain membership table. Do not silently narrow the current `sm_admin` role, because it is intentionally a full administrator.

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
4. If Fahrtzeiten are enabled for the SM account, the SM sees a GM-consistent start card, can optionally enter Fahrtzeit as `hh:mm`, and chooses either server timer or manual duration later.
5. If Fahrtzeiten are disabled, the visit starts directly with a backend-owned timer and no Fahrtzeit field.
6. SM completes the published questionnaire snapshot one phone card at a time.
7. Timer visits derive Ist-Zeit from server timestamps; manual visits require an explicit `hh:mm` duration on review.
8. Submission validates assignment ownership, questionnaire completeness and allowed status transition.
9. The Einsatz becomes submitted/completed and appears in SM Zeiterfassung with a durable receipt.

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
- The implemented master-data filters are `Region`, `Ort`, `PLZ`, `Handelskette`, `Stammmarkt von`, `Field Service GL` and `Status`. `Stammmarkt von` is populated from the imported `Shelf Merchandising MITARBEITER` column. `Field Service GL` is populated from `Field Service GEBIETSLEITER` and filters by its distinct imported names.
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
8. `STAMMMARKT VON` – the imported `Shelf Merchandising MITARBEITER` name or `—`. This imported source value is authoritative for the row label. The separate app-account relation may be auto-resolved by an exact unique name match but is not used as the visible source value.
9. `STATUS` – active/inactive.

`Field Service GEBIETSLEITER` is deliberately not a table column. It is additional cross-team context available in market details and through the `Field Service GL` filter only.

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
- `ZUORDNUNG & KLASSIFIKATION`: imported `Stammmarkt von` (`Shelf Merchandising MITARBEITER`), imported `Field Service Gebietsleiter`, the optional linked SM app account, market/chain and status.

The `Stammmarkt` state is editable in the drawer with the same clean custom select/toggle treatment used by current market fields, but its value is also always visible in the table row.

#### 7.2.7 Create and import overlays

All overlays reuse the screenshots' existing patterns:

- `Markt anlegen` uses the same centred white modal, blurred/dimmed background, uppercase eyebrow, compact title/subtitle, tab-like market-type selector, two-column bordered form groups, existing inputs and red bottom-right save button.
- SM field labels replace GM-only fields without changing the modal geometry. Required SM fields are identity, full address, region, active status, optional Stamm-SM, Stammmarkt state, Soll-Zeit and rhythm.
- `Importieren` starts with the same compact dataset-selection window, exact header layout, progress dots, square close button and stacked bordered option rows with right arrows.
- Mapping, preview and error UI continue to use existing Coke Spark import components.
- A skipped row whose only problem is a missing `Flexnummer`/`Stammnummern` identity is repairable directly in the import summary. The admin enters at least one mapped identity value and retries only that original Excel row through the same idempotent import/upsert endpoint; already processed rows are not submitted again. On success, the skipped warning and counters update in place.

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

The production planning contract is defined in detail in
[`docs/sm-planning-data-model.md`](./sm-planning-data-model.md). Its central rules are:

- `sm_assignment_series` is a stable series identity; immutable `sm_assignment_series_versions` preserve every permanent definition change.
- `sm_assignments` contains one materialized row per concrete Einsatz, including occurrences generated by a series.
- Planning is linked to `sm_markets.id` and also snapshots the market `internal_market_id`/Stammnummer so later market-master edits cannot change historical planning identity.
- Every occurrence stores immutable original date, SM, market and Soll-Zeit values.
- Nullable `replacement_*` fields are the source of truth whenever populated. Effective values are resolved with `coalesce(replacement_*, original_*)`.
- Cancelling one series occurrence changes only that materialized assignment; it never deletes or cancels the series.
- Replacing the SM or date for one series occurrence changes only that occurrence.
- A permanent SM change uses an explicit `Ab diesem Einsatz dauerhaft` UI path. It creates a new series version and applies the replacement only to eligible future, unstarted occurrences. Completed, cancelled and historical occurrences remain untouched.
- `sm_assignment_events` is append-only and stores before/after snapshots for creation, replacement, rescheduling, cancellation, restoration and series-wide changes.
- `sm_assignment_time_submissions` versions submitted Ist-Zeit independently from planning. A correction creates a new current version instead of overwriting history.
- No normal planning action hard-deletes an Einsatz. Operational cancellation is a lifecycle state; technical removal is a protected soft delete.

Materialized occurrences are required rather than calculating the calendar only at read time. They provide stable IDs, safe one-occurrence cancellation, deterministic mobile access and historically reproducible edits.

Production persistence was applied on 2026-08-24 through migrations `20260824081232 sm_planning_domain`, `20260824081346 sm_planning_composite_fk_index` and `20260824082108 sm_planning_least_privilege`. Both application builds, the focused planning tests, metadata/security verification and rollback-only behavior checks passed. The production planning tables remain empty until real SM markets are imported and the first real Einsatz is created; no preview or smoke rows were retained.

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

#### 7.5.1 Admin questionnaire authoring checkpoint (2026-08-19)

The independent SM questionnaire workspace at `/admin/sm/fragebogen` is connected to the production SM questionnaire domain through authenticated admin endpoints.

- Its visual hierarchy was derived from the source code of the existing Standard-Fragebogen page and then checked in the running Coke Spark UI. Screenshots are only a secondary visual reference.
- The SM implementation is a new component tree. It does not import or reuse the GM questionnaire page, GM module/questionnaire contexts, GM editors or GM domain data.
- It keeps the familiar three-tab structure: `Fragen`, `Module`, `Fragebogen`, including counts, search, compact type filtering, expandable module cards and questionnaire summaries.
- Header actions use the existing admin shell: `Excel Export`, `Modul erstellen` and `Fragebogen erstellen`.
- The independent SM module editor now mirrors the normal Standardbesuch editor UI and supports the full plain question toolbox: `Single Choice`, `Ja / Nein`, `Ja / Nein Multi`, `Multiple Choice`, `Likert Skala`, `Offener Text`, `Offene Zahl`, `Slider`, `Foto Upload` and `Matrix`. It includes the matching answer/configuration surfaces, required-question toggle, question import, reorder, expansion and type switching.
- The independent SM questionnaire editor mirrors the Standardbesuch module-library workflow: searchable library, selected-state feedback, right-click detail preview, expandable and reorderable module rows, name, description and `Nur einmal ausfüllbar`.
- GM-only configuration is intentionally absent: no Spezialfragen, Handelsketten filters, bonus/prämien/IPP rules, campaign rules or GM photo-tag behavior.
- No preview modules, questions or questionnaires are seeded. The empty state reflects the database and authors create the first real content themselves.
- Create, edit, duplicate and soft-delete persist through `/admin/sm-questionnaires`; search and filtering remain local presentation behavior. The export action remains an explicit preview notice until the SM export contract is implemented.
- Later module edits are differential: unchanged questions keep their exact published question version, while only added or actually changed questions receive a new question version. Removed questions are soft-deleted. An unchanged save performs no authoring write.

#### 7.5.1 SM Zeiterfassung implementation checkpoint (2026-08-24)

- `/admin/sm/zeiterfassung` is an independent SM component tree and does not import the GM Zeiterfassung page or its GM day-session logic.
- Its visual shell, day grouping, compact rows, expansion behavior, typography and `Tage` / `SM Ansicht` switch mirror the existing GM Zeiterfassung.
- The SM domain does not display or model Tagesstart, Tagesende, Anfahrt, Heimfahrt, Pausen, Kilometer or GM Zusatzzeiten.
- A day contains only the SM's planned Einsätze. Every Einsatz shows market identity, Soll-Zeit, Ist-Zeit, deviation, questionnaire state, Pauschale and operational status.
- The page now loads real materialized `sm_assignments` from the bounded planning API; the former component-local temporary Einsätze have been removed.
- The current Ist-Zeit comes from `sm_assignment_time_submissions`. First submission inserts revision 1; later corrections require a reason, supersede the prior version and preserve the full time history.
- Questionnaire completion is derived from the current `sm_questionnaire_submissions` row linked through `assignment_id`.

#### 7.5.2 SM Zeitkorrektur UI checkpoint (2026-08-13)

- Completed SM Einsätze expose one compact correction action directly beside the completion state; open Einsätze do not need a request because their Ist-Zeit has not been submitted yet.
- The phone-first bottom sheet offers exactly two request types: a changed Ist-Zeit or deletion of the submitted Ist-Zeit. It never deletes the planned Einsatz, Soll-Zeit or planning record.
- A time change requires a positive, genuinely changed duration in integer minutes. Both request types require a written reason.
- Once submitted in the current UI checkpoint, the Einsatz shows `Anfrage offen`; opening it again presents the requested value and reason rather than allowing a second parallel request.
- The admin-side actual-time persistence now exists through versioned `sm_assignment_time_submissions`. A separate SM-originated approval/request workflow remains future scope and, when implemented, will use `sm_time_change_requests` linked to the immutable Einsatz and active time submission.
- Admin approval of a time change creates a new time-submission version or correction event; approval of a deletion soft-deletes only the active time submission. Neither operation may silently rewrite the Einsatz, questionnaire submission, Soll-Zeit, Pauschale or historical request snapshot.

#### 7.5.3 SM Verplanung implementation checkpoint (2026-08-24)

- `/admin/sm/verplanung` is a new, isolated SM planning page inside the existing Coke Spark admin shell. It does not reuse GM planning logic or imply any GM campaign assignment behavior.
- The page follows the approved Coke Spark planning draft: compact week/date context in the header, existing admin-sized export and planning actions, one dense weekly planning table, day groupings, SM/market/status/type filters and a right-side planning drawer.
- The drawer supports the complete UI distinction between one-time Einsätze and recurring series, including weekday selection, validity range and Soll-Zeit. Editing a recurring occurrence explicitly affects only that occurrence, while a new series shows one unambiguous validity range instead of duplicate date controls.
- Search, filters, week navigation, real Excel export and drawer interactions operate on API-loaded assignments. All SM, market, duration, recurrence and filter selectors use the custom Coke Spark dropdown UI with portal overlays, keyboard support and searchable long lists where appropriate.
- All planning dates use the custom Coke Spark month calendar rather than native browser date inputs. The calendar mirrors the established admin styling, renders through a viewport-aware portal above the drawer, supports month navigation, today/selected states and prevents an end date before the series start.
- Temporary planning rows and hardcoded SM/market directories have been removed. The page persists one-time assignments, materialized weekly/biweekly series, occurrence edits, rescheduling, one-occurrence cancellation/restoration and one-occurrence or permanent-future SM reassignment through `/admin/sm-planning`.
- Every edit displays the effective values as current truth while retaining and exposing the immutable original date, SM, market/Stammnummer and Soll-Zeit when a replacement exists.
- The permanent reassignment path is explicit: `Nur dieser Einsatz` changes one occurrence; `Ab diesem Einsatz dauerhaft` first shows a validated impact preview with effective date and affected/skipped counts.
- Planning create requests serialize only the backend contract fields; UI-only drawer discriminators never cross the API boundary. Single and series failures remain inside the drawer with an inline error instead of escaping into the Next.js runtime overlay.

#### 7.5.4 SM phone-dashboard data checkpoint (2026-08-24)

- `/sm` keeps the existing temporary hero/status card. Starting an Einsatz is intentionally not part of this checkpoint; the visible `Starten` control is disabled and has no mutation handler.
- The dashboard calendar and selected-day Einsatz list load real materialized assignments through `GET /sm/planning/assignments` in bounded 93-day windows. Component-local visit/calendar seeds have been removed.
- The backend accepts only `from` and `to`. It obtains the SM user ID exclusively from the verified access token and filters on the effective owner, `coalesce(replacement_sm_user_id, original_sm_user_id)`, so reassigned occurrences move to the correct SM dashboard without exposing another SM's data.
- Calendar counts, market name, address, Soll-Zeit and status are derived from the same authenticated response. Rescheduled occurrences use the effective date and effective market/user values while their originals remain preserved by planning.
- The dashboard message card remains end to end: inbox rows and read transitions are restricted to the authenticated SM recipient row, and `read_at` is created by the backend.

#### 7.5.5 SM Aktivitäten and questionnaire-correction UI checkpoint (2026-08-13)

- `/sm/aktivitaet` is the independent, phone-first SM counterpart to the GM activity page. It copies the proven visual hierarchy and request workflow, but does not import the GM page, GM components or GM visit/campaign data.
- The overview contains only completed SM Einsatz questionnaire submissions and shows market, date, questionnaire, Soll/Ist time, question completeness and pending-request state. Search and an `all` / `with request` switch are available.
- Opening an activity presents the immutable submitted questionnaire as read-only. Each answer exposes a correction request action; the request stores the original and requested answer snapshots plus a mandatory reason. A pending request remains visible and blocks a second parallel request for the same question.
- A separate deletion request applies only to the concrete questionnaire submission. It must never delete or alter the planned Einsatz, assignment series, market link, Soll/Ist time, fixed allowance or payroll snapshot.
- This checkpoint remains component-local preview state because the SM assignment/questionnaire backend tables do not yet exist. Persistent implementation should use a dedicated `sm_answer_change_requests` table and `sm_questionnaire_submission_delete_requests`, each linked to immutable SM submission/question/answer IDs with original/requested snapshots, status, reviewer, review timestamp, admin note and soft-delete/audit fields.
- Admin approval must create a new active answer/submission version or a traceable correction event. Historical raw submissions and request snapshots must remain reproducible; the GM request tables and routes are not reused.

#### 7.5.6 SM questionnaire persistence foundation (2026-08-19)

- The independent production schema is defined in `backend/drizzle/0089_sm_questionnaire_domain.sql` and mirrored by the Drizzle application schema.
- It contains 21 tables, all prefixed `sm_`, covering stable question/module/questionnaire identities, immutable content versions, answer options, conditional logic, ordered composition, submission snapshots, every current SM editor answer shape, answer events and both correction-request flows.
- SM uses one versioned question → module → questionnaire model. The GM table families for Standard, Flex, Billa, Kühler, MHD and Durcharbeit are not copied because those are GM deployment/campaign variants; the SM Coke areas are reusable modules.
- Published content is database-guarded against mutation. Publication order is question version, module version and finally questionnaire version. Later editing requires a new version.
- Runtime answers preserve the explicit states `unanswered`, `answered`, `not_applicable` and `invalidated`, plus points and metric-outcome snapshots.
- Execution-quality scoring and operational OOS detection/remediation are separate metric roles. OOS categories and partial-remediation meaning remain configurable data.
- Every table has forced RLS and no direct `anon`/`authenticated` privileges. Access is backend-only through `service_role`; no direct browser database access is introduced.
- No questionnaire seed content or temporary UI data is inserted by this schema migration. The current UI remains component-local until dedicated APIs are connected.
- `sm_questionnaire_submissions.assignment_id` is reserved for the future `sm_assignments` table and intentionally does not point at any GM planning table. The FK is added with the SM planning persistence migration.
- The detailed table catalog and lifecycle contract live in `docs/sm-questionnaire-data-model.md`.

#### 7.5.7 One central SM questionnaire assignment (2026-08-27)

- Shelf Merchandising uses one centrally selected logical questionnaire for all markets and every one-time or recurring Einsatz. There is no questionnaire picker inside an individual Einsatz drawer and no market cluster assignment.
- The admin/SM-admin selects and later changes this questionnaire once above the SM Verplanung table. New planning is blocked until the central selection is valid.
- `sm_questionnaire_global_assignments` stores append-only selection history. Exactly one non-deleted, non-superseded row may exist. Switching supersedes the current row and inserts a successor; it never bulk-updates assignments or submissions.
- The row points to `sm_questionnaire_templates`, the stable logical identity. When a visit starts, the backend resolves the latest effective published version and snapshots that exact version, modules, questions, answer configuration and logic into the submission.
- Therefore a newly published version of the selected questionnaire is automatically used by later starts. Changing the selected questionnaire affects all not-yet-started visits. Draft, in-progress and submitted visits retain their immutable snapshot and continue unchanged.
- Existing per-assignment questionnaire IDs are treated as rollout-era legacy data. Once a global selection exists, it is authoritative for unstarted visits; the exact resolved version is written only when that visit starts.
- The currently selected template cannot be made inactive or soft-deleted. The administrator must first choose another central questionnaire.
- Migration `20260827135019 sm_global_questionnaire_assignment` was applied additively to production without choosing a default, backfilling assignments or changing the seven existing assignments and one existing submission.
- Forced RLS, no browser-role grants, service-role least privilege, immutable assignment identity, one-current-row uniqueness, hard-delete rejection and a rollback-only behavior test are verified. The UI remains responsible for the first explicit selection.

### 7.6 Submission and time

Implemented separation:

- `sm_assignments` is the immutable planning/execution anchor.
- `sm_questionnaire_submissions.assignment_id` links the existing versioned questionnaire runtime to the concrete Einsatz.
- `sm_assignment_time_submissions` stores independently versioned Ist-Zeit. Exactly one active current revision is allowed per Einsatz.
- `sm_time_change_requests` remains optional future scope only if SM-originated changes require an admin approval workflow.

An assignment may have only one active final questionnaire submission and one current actual-time revision. Corrections create successors or audited state changes; they never overwrite the preserved original plan.

### 7.7 Pauschalen

The payable amount must be snapshotted on the Einsatz, even if a rate template is used during planning. Later changes to a default Pauschale must not change historical or already planned payments silently.

Store money as integer cents and currency explicitly. Do not use floating-point values.

### 7.8 Messages

Implemented on 2026-08-24:

- `sm_messages` stores the immutable subject, body, sender identity/name snapshot, server-owned send timestamp and retry-safe idempotency key.
- `sm_message_recipients` stores exactly one immutable row per addressed SM with the SM user ID, name/e-mail snapshots and server-owned delivery timestamp.
- `read_at` is nullable until the addressed SM explicitly marks the message as read. The backend creates the timestamp; the browser cannot provide it. A set timestamp cannot be changed or cleared.
- The active recipient set is validated transactionally at send time. A later account rename/deactivation does not rewrite the historical recipient or sender snapshots.
- Admin/SM-admin endpoints can list aggregate delivery/read state and the recipient audit rows. SM endpoints return only rows addressed to the authenticated SM.
- Both tables use forced RLS, no `anon`/`authenticated` table privileges, backend-only least-privilege `service_role` access, soft-delete consistency guards and hard-delete rejection.
- No audience/filter snapshot is persisted yet. The concrete immutable recipient rows are the authoritative evidence of who received a message.

The detailed contract lives in `docs/sm-messages-data-model.md`.

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
- The SM admin Nachrichten distributor loads active SM recipients, persists each sent message plus immutable recipient rows, and displays live delivery/read state.
- The phone-first SM dashboard loads only that SM's messages and writes a one-time read timestamp through the backend.
- The phone-first SM dashboard loads only the authenticated SM's effective planning assignments and renders real calendar counts and selected-day visits.
- The dashboard opens the concrete Einsatz in `/sm/marktbesuch?assignmentId=<id>` and orders actionable visits before completed visits only on the SM side.
- The Marktbesuch runtime persists server-owned start/time state, immutable questionnaire snapshots, per-question answer revisions, conditional applicability, private photos and an idempotent completion receipt.

### Existing UI scaffolds or placeholders

- `/sm` dashboard exists and is phone-sized.
- `StatusCard`, `AssignmentList`, `WeekStrip` and `NachrichtenCard` provide visual direction.
- The recipient message card has unread/read visual states backed by persisted recipient rows.
- The admin SM detail drawer contains profile and visit-looking tabs.

### Important limitations in the current code

- The dashboard status/hero card remains temporary by explicit product decision.
- The admin SM visit display uses localStorage plus seed data, not authoritative backend SM visits.
- Existing GM market/visit endpoints remain separate and explicitly reject role `sm`.
- Approval requests, payroll export and broader reporting remain future slices.

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
9. Build phone-first SM Einsatz/questionnaire flow. **Completed 2026-08-24.**
10. Build SM Zeiterfassung and Pauschale reporting.
11. Build message distributor and recipient read state. **Completed 2026-08-24.**
12. Replace dashboard mock data with authoritative endpoints.
13. Add exports, audit views and end-to-end verification.

Implementation checkpoint on 2026-08-24: steps 4, 5, 8, 9 and 11 are complete for the current scope. This includes the production planning schema/service, real admin planning UI, versioned Ist-Zeit persistence, backend-owned message/read state and the phone-first SM Marktbesuch runtime. Approval requests, payroll export and broader dashboard/reporting remain future slices.

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

- What audited correction/request flow is allowed after a completed timer or manual submission?
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

- Exact shared internal-ID column and uniqueness rules.
- Whether Stammmärkte have weekly patterns/default weekdays and default durations.

### Messages

- Push/email notification requirements.
- Scheduling, attachments, expiry and retention.
- Whether replies are allowed or messages are broadcast-only.

## 14. Decision log

### 2026-08-24 – Imported SM/Field-Service ownership columns clarified

- `Shelf Merchandising MITARBEITER` maps to `sm_markets.shelf_merchandiser_name` and is shown on the SM market list as `Stammmarkt von`.
- `Field Service GEBIETSLEITER` maps to `sm_markets.field_service_manager_name`. It is informational cross-team context, remains hidden from SM market table rows, is visible in market details and provides a distinct-name filter.
- The optional `assigned_sm_user_id` remains a separate app-account relation. Import may resolve it only when the imported Shelf Merchandising name uniquely matches an active SM account; the imported name remains the visible authoritative source value.
- This clarification changes only the SM market administration. The GM admin market page and its existing Stammmarkt behavior are unchanged.

### 2026-08-24 – SM market-account synchronization

- The SM market-page header provides `SMs synchronisieren`. It scans only non-deleted SM markets and active, non-deleted users with role `sm`.
- A market that already has `assigned_sm_user_id` is always skipped and is never overwritten by automatic or manual sync.
- Name comparison is backend-owned, case-insensitive, accent-insensitive, punctuation/dash-insensitive and token-order-independent, so values such as `Mustermann Max` and `Max Mustermann` are equivalent. Small spelling variations are ranked fuzzily.
- Automatic persistence requires a unique, clearly separated high-confidence candidate. Duplicate names and ambiguous/weak fuzzy results remain unmatched instead of risking a false assignment.
- The result window groups successful rows compactly and renders every unmatched market with a searchable active-SM dropdown. Suggested candidates are ranked first, but the admin must explicitly confirm a manual match.
- Manual matching is concurrency-guarded and updates only markets whose `assigned_sm_user_id` is still null. The imported `shelf_merchandiser_name` remains unchanged as the source value.
- Once linked, UI display/filter values use the canonical first/last name from the SM user record. The raw imported name remains stored and is visible in market details when it differs from the canonical account name.
- The existing `sm_markets.shelf_merchandiser_name` plus nullable `sm_markets.assigned_sm_user_id` already satisfy this contract; no schema migration is required.

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
- Photos are an explicit versioned SM question type. They use a private bucket, signed assignment-scoped upload paths, server-side MIME/size/ownership validation and soft-deleted metadata.

## 24. Remaining business decisions after research

1. Canonical market population for May 2026: 149 or 150, and the correct Interspar/Spar split.
2. Whether standard business reporting should default to visit-weighted, unweighted market-average, or show both. Recommendation: show both with explicit labels.
3. Whether `teilweise möglich` should continue counting as fully remediated for OOS reporting.
4. Whether MHD `Nein` intentionally receives full points or is a SPOT configuration error.
5. Exact trigger for the market-information follow-up when several categories can contain OOS.
6. Allowed Soll/Ist deviation and any approval/correction workflow.
7. Exact assignment-level Pauschale defaults and payroll/export format.
8. Exact SM market import columns and verified shared internal market identifier.
9. Whether the report/deck should retain chain-level market averages, add visit-weighted measures, or publish both.

## 25. Implemented SM Marktbesuch runtime

Status: implemented and completion-audited on 2026-08-24.

### 25.1 Account capability and entry

- SM account creation and editing persist `sm_travel_time_enabled`; non-SM roles cannot receive the flag through the admin-user API.
- The authenticated SM dashboard opens the selected owned assignment at `/sm/marktbesuch?assignmentId=<uuid>`.
- The backend derives the SM identity exclusively from the authenticated session and rejects foreign, inactive, deleted, cancelled, missed or completed assignments.
- Dashboard ordering is intentionally SM-only: open and `in_progress` visits appear before completed visits. Admin Verplanung remains chronological.
- Before a new submission is created, the visit resolves the one central SM questionnaire assignment. Once the draft exists, its exact published questionnaire graph is immutable and is not affected by a later central switch.

### 25.2 Start and timing flow

- Fahrtzeiten-enabled SMs see the GM-consistent start card with `Timer starten`, `Überspringen und später festhalten`, and optional `hh:mm` Fahrtzeit.
- Fahrtzeiten-disabled SMs enter the questionnaire directly; a server-timed draft is created automatically and the UI exposes a clean retry state if that request fails.
- Timer, manual visit duration and Fahrtzeit are three distinct values. Manual mode requires an explicit `hh:mm` visit duration before final submission; Fahrtzeit remains optional.
- Start and final submission are transactionally protected with assignment locks and idempotency tokens. Repeating a successful request returns the existing draft or durable receipt instead of creating a duplicate.

### 25.3 Questionnaire UI and behavior

- The runtime supports `yesno`, `single`, `multiple`, `yesnomulti`, `likert`, `text`, `numeric`, `slider`, `photo` and `matrix`.
- Question text and option labels wrap without clipping. Large choice sets and the quick navigator scroll internally with hidden scrollbars and retain at least 44 px touch targets.
- The matrix is rendered as readable phone row cards rather than a wide desktop table. A required matrix is complete only when every configured row has one selected column.
- Numeric and slider questions remain semantically unanswered until explicit interaction. Numeric bounds, integer mode and slider step are validated on both client interaction and server normalization.
- `Ja / Nein Multi` supports branch-specific sub-options in the SM editor and runtime. The server rejects unknown top answers, unknown branch options and duplicate/tampered values, then stores them in published order.
- Photo questions expose separate camera and gallery actions. Uploads use a private signed path, accept JPEG/PNG/WebP, enforce 15 MB per file and at most 20 committed files per question, and soft-delete removed metadata.
- Conditional visibility is recomputed authoritatively after each save and at final submission. Hidden current answers are invalidated without overwriting unrelated questions or their history.
- The fixed safe-area-aware navigation provides Back/Next plus a module-grouped quick-navigation bottom sheet. Review shows missing required questions, timing and Fahrtzeit before the final confirmation.

### 25.4 Persistence contract

- Published questionnaire sections, questions, options, config and logic are snapshotted once into the submission graph.
- Saving one changed question creates only a new version of that answer and its normalized option/matrix rows. An identical normalized payload is a no-op.
- Final submission revalidates every applicable required question, writes the actual visit duration, completes the assignment in the same transaction and returns a stable receipt ID.
- Reloading an existing draft restores the persisted answers; reloading a submitted visit restores its timestamp and persisted actual duration.

### 25.5 Production database evidence

- Applied migrations: `20260824111548 sm_visit_runtime_timing` and `20260824112835 sm_visit_photo_bucket`.
- `sm_questionnaire_submissions` contains nullable `visit_time_mode`, `travel_minutes` and `manual_visit_minutes` columns with checks for `timer | manual`, Fahrtzeit `0..1440`, and manual duration `1..1440` only in manual mode.
- All eight runtime submission/answer tables have RLS enabled and forced. `anon` and `authenticated` have no table grants; access is through the authenticated backend service path.
- Storage bucket `sm-visit-photos` is private, limited to 15 MB and restricted to `image/jpeg`, `image/png` and `image/webp`.
- The Supabase security advisor reports the expected informational `rls_enabled_no_policy` entries for backend-only SM tables. Its only warning is the separate project-wide Auth setting for leaked-password protection, not a Marktbesuch schema issue.

### 25.6 Verification evidence

| Gate | Result |
| --- | --- |
| Frontend production build | Passed; `/sm/marktbesuch` is emitted. |
| Backend TypeScript build | Passed with `tsc -p tsconfig.build.json`. |
| Focused runtime tests | 7/7 passed: choice tampering, `Ja / Nein Multi`, numeric limits, matrix completeness/tampering, blank answers and conditional visibility. |
| Local stack | Frontend `http://localhost:3000` and backend `/health` both returned HTTP 200. |
| Browser widths | 320, 375, 390 and 430 px passed without horizontal overflow. |
| Long choice sets | 30 single options, 20 multi options and 20 branch sub-options stayed readable and internally scrollable. |
| Long text | 2,554 characters with 150 line breaks round-tripped in the production component without visual truncation. |
| Matrix stress case | 12 rows × 8 columns rendered with 44 px minimum cells and no horizontal page overflow. |
| Quick navigation | At 390 × 844 px the sheet stayed within the viewport, had a 44 px close target and no clipped question labels. |
| Start screen | Timer target 48 px, manual/back targets 44 px, Fahrtzeit input 46 px; `01:25` parsed correctly. |
| Photo controls | Camera uses rear-camera capture; gallery allows multiple JPEG/PNG/WebP files. |
| Browser console | No runtime errors in the final development-fixture pass. |

The complete backend repository test command also exposes four pre-existing failures outside this feature (one admin Zeiterfassung pause expectation and three RED-Monat date expectations). All Marktbesuch-focused tests pass; those unrelated baseline failures were not hidden or changed as part of this delivery.

## 26. 2026-08-27 completion tranche: export, Nachrichten retention, Shelf Merchandiser

### 26.1 SM Fragebogen Excel export

- `/admin/sm/fragebogen` now performs a real asynchronous `.xlsx` export instead of opening the former preview notice.
- The implementation deliberately reuses the GM workbook styling and interaction contract, but reads only the loaded SM authoring workspace and does not call any GM API or table.
- The workbook contains `Meta`, `Fragen`, `Module`, `Fragebogen`, `Fragebogen Module`, `Logikregeln`, `OOS Zuordnung` and `Summen`.
- All ten SM question types, Pflichtstatus, full type configuration, module/questionnaire order, version, conditional rules and OOS semantics remain auditable.
- Empty workspace, all ten types, SM-specific relation content and XLSX serialization/reopen passed focused tests. The detailed contract lives in `docs/sm-questionnaire-export-living.md`.

### 26.2 Nachrichten after-read visibility

- Every new message chooses one immutable delivery rule: `0` means one-time, positive `N` means visible for exactly `N × 24 h` after the recipient's database timestamp.
- The admin composer exposes the toggle, common presets and a bounded custom day value. The recipient table and message history remain available to admins after inbox expiry.
- The authenticated SM inbox query is authoritative: unread is always visible; one-time read messages are excluded; positive-duration messages are excluded after expiry.
- The existing production message is preserved through a `NULL` compatibility rule and was not rewritten.
- Migration `sm_message_read_visibility` was applied after a read-only production preflight. Counts remained one message/one recipient, the check is validated, the immutability trigger includes the new field, forced RLS and service-role grants are unchanged.
- Focused retention tests passed 4/4. Full details live in `docs/sm-messages-data-model.md`.

### 26.3 Shelf Merchandiser page and Excel account contract

- The Shelf Merchandiser page no longer reads seeded GM-style visits or browser `localStorage` history.
- It loads real SM assignments from the authenticated SM planning API in bounded 93-day chunks, deduplicates by assignment ID and renders assignment status, market, date, Soll/Ist/Fahrtzeit, questionnaire and series/one-time origin.
- Per-account completed-visit counts and the detail drawer are derived by the immutable SM user ID, never by a display-name join.
- The Excel export now contains the agreed SM account fields (`SM ID`, `Name`, `E-Mail`, `Fahrtzeiten`, creation metadata) plus real `SM Summen` and `Einsätze` sheets.
- Production schema verification confirms the complete agreed account contract already exists: non-null first name, last name, email, active state, creation time and `sm_travel_time_enabled`. Address remains intentionally excluded from SM account create/edit/export. No new account column or migration was needed.
- Current production evidence: one active SM account, zero NULL Fahrtzeit flags, seven active assignments from 24–26 August 2026, one completed assignment and zero orphaned SM links.

### 26.4 Verification gates and known unrelated baseline

| Gate | Result |
| --- | --- |
| Frontend production build | Passed; all 45 routes generated. |
| Backend TypeScript build | Passed. |
| SM questionnaire workbook tests | 3/3 passed. |
| SM message retention tests | 4/4 passed. |
| Production message migration | Applied; row counts and historical behavior preserved. |
| RLS/grants/constraint/trigger postflight | Passed. |
| Full backend repository suite | 74/78 passed; failures are three pre-existing RED-Monat date expectations and the pre-existing admin-Zeiterfassung default-pause expectation, not files changed in this tranche. |

No GM database table or GM production row was changed in this tranche.

## 27. Live SM dashboard and OOS reporting

Status: implementation contract locked on 2026-08-28. This section replaces the former May-2026 constants in the SM dashboard. It applies only to the Shelf Merchandising questionnaire, market, assignment and user tables; no GM visit or answer source participates.

### 27.1 Authoritative reporting scope

- The dashboard reads only current, non-deleted `sm_questionnaire_submissions` with status `submitted`, a non-null `reporting_available_at`, and a submission timestamp inside the selected Vienna-local inclusive date range.
- Draft, cancelled, invalidated, superseded and approved-for-deletion submissions are excluded. A pending or rejected deletion request does not change reporting; the already implemented approved deletion flow removes the submission from the eligible state.
- Only current, non-deleted answers with state `answered` are authoritative. An approved answer-change request creates a new current answer version, so the next dashboard read uses the corrected result. Pending, rejected and cancelled correction requests never affect the dashboard.
- OOS meaning comes exclusively from the immutable submission snapshots: `metric_role_snapshot`, `oos_category_snapshot`, `metric_config_snapshot` and the selected option's `metric_outcome_code_snapshot`. The reporting code must never infer OOS from the visible labels `Ja`, `Nein`, `behoben` or similar text.
- Period boundaries use `Europe/Vienna`: `from` begins at local 00:00 and `to` ends immediately before the following local day. This keeps daylight-saving boundaries correct.
- Region, chain, market and Shelf-Merchandiser filters use immutable IDs for selection and the SM market/user domain for display. They narrow every card and breakdown consistently.

### 27.2 Canonical OOS case model

One OOS case is one submitted, applicable detection question in one visit whose current selected option is classified as `oos_present`. Repeated visits can therefore create repeated cases; several detection categories in the same visit can also create separate cases.

Classified detection checks are current applicable detection answers with either `oos_present` or `oos_absent`. `not_applicable`, unanswered and unclassified answers are excluded from the detection denominator and surfaced as documentation gaps where relevant.

The remediation question is linked to its detection question by the authored stable detection-question ID stored in `metric_config_snapshot.detectionQuestionId`. A found case is resolved when its linked, current remediation outcome is:

- `resolved`; or
- `partially_resolved` and that remediation snapshot has `partialCountsAsResolved` set to `true`.

`not_resolved`, a non-counting partial result, an unanswered linked remediation, or a missing linked remediation never counts as fixed. This is deliberately conservative: the dashboard reports proof of remediation, not an optimistic assumption.

### 27.3 Core metric cards

1. **Abgeschlossene Besuche**
   - `completed_visits = count(distinct eligible submission_id)`.
   - The detail line shows distinct submitted markets in the same filtered scope.
   - This card is context only and never acts as an OOS denominator.
2. **OOS gefunden**
   - `oos_found_cases = count(distinct submitted detection case where outcome = oos_present)`.
   - The detail line shows `oos_found_cases / classified_detection_checks` and the visit-weighted detection rate.
   - The headline stays a case count because this is the first user-defined core number.
3. **OOS behoben**
   - `fixed_rate = resolved_found_cases / oos_found_cases`.
   - The detail line shows the exact numerator and denominator, for example `8 von 10 Fällen`.
   - When `oos_found_cases = 0`, the UI displays `—` and `Nicht erforderlich`, never `0 %` or `100 %`.
4. **Märkte mit OOS**
   - `observed_markets = count(distinct market_id with at least one classified detection check)`.
   - `markets_with_oos = count(distinct market_id with at least one oos_present case)`.
   - `affected_market_rate = markets_with_oos / observed_markets`.
   - The detail line always shows `x von y geprüften Märkten`. Imported but unvisited/unclassified markets are not put into this denominator.
5. **Dokumentationsstatus**
   - `documented_remediations = found cases with a linked classified remediation outcome`.
   - `open_remediation_documentation = oos_found_cases - documented_remediations`.
   - This makes skipped optional remediation answers visible without mislabelling them as fixed.

### 27.4 Category component

The category table contains the four authored SM OOS categories in a stable business order, even when one category has no data:

1. Aktionsplatzierungen;
2. Limonaden & Energy;
3. Wasser & Near Water;
4. Säfte & Eistee.

For every category it shows found cases, detection rate (`found / classified checks`), fixed cases and fixed rate (`fixed / found`), plus affected/observed markets. Empty denominators display `—`. The row figures must reconcile exactly to the same filtered flat case set as the headline cards.

### 27.5 Chain and region components

- Each chain and region row is aggregated from the same eligible submissions and current OOS answer rows as the core cards.
- Rows show completed visits, observed markets, found OOS cases, fixed rate and affected-market rate.
- A group with visits but no classified OOS checks remains visible with `—` OOS rates. A group with no eligible submitted visit in the current filtered scope is omitted.
- Search is a presentation filter for the displayed group rows only. Region, chain, market, SM and period controls are data filters and therefore trigger a new authoritative backend read.

### 27.6 Data freshness and answer-to-dashboard propagation

- Final questionnaire submission and its assignment completion already commit in one transaction. Once that transaction returns, the dashboard endpoint can see the new submitted answer versions immediately.
- The frontend requests the endpoint with `cache: no-store`, shows a last-calculated timestamp, and offers an explicit refresh action. Navigating back to or reloading the SM dashboard also re-reads the endpoint.
- Approved answer corrections replace the current answer version transactionally; the next read recalculates the affected case, category, chain, region and core cards. No materialized dashboard cache or delayed job is required for the current data volume.
- Because metrics are calculated from immutable published semantics plus current answer versions, later questionnaire wording or option-label edits cannot rewrite historical OOS meaning.

### 27.7 API, safety and performance contract

- The endpoint is an authenticated admin/SM-admin read endpoint under `/admin/sm-dashboard`; it performs no writes.
- Its base query starts from a bounded submitted-submission period and then joins submission questions, current answers and the selected option snapshot. Existing market/user/status indexes remain usable by the optional filters; a dedicated period index is added only when production query plans and row volume justify it. Filters are parameterized; raw label interpolation is forbidden.
- Only SM tables are selected. The endpoint and tests must contain no GM table import or GM route dependency.
- The response returns one reconciled payload: scope totals, core metrics, category rows, chain rows, region rows and filter options. The Excel export uses that payload rather than a separate calculation.
- Focused tests cover: no OOS, present/absent detection, resolved/not-resolved/partial remediation, partial counting configuration, unanswered remediation, distinct market denominators, repeated visits, dimension grouping and current-answer correction replacement.

### 27.8 UI behavior

- The former static May-2026 dashboard is removed. Loading, empty and error states use the existing clean admin card language and never fall back to historical constants.
- The first visual row prioritizes the three user-defined OOS numbers. Context and documentation cards are quieter so the operational signal remains obvious.
- Red represents found OOS, green represents proven remediation, and neutral gray represents scope/coverage. Percentages always render with one decimal and every percentage has a visible numerator/denominator nearby.
- The dashboard remains desktop-admin oriented and responsive within the existing admin shell. It does not alter any SM phone-side screen.

### 27.9 Implementation and verification evidence

- The read-only backend endpoint, shared metric aggregator, frontend types/API client and live admin workspace are implemented. The endpoint recalculates directly from current answer versions on every request; there is no stale materialized reporting copy.
- Seven focused metric tests pass. They cover empty scope, found/fixed/affected-market denominators, missing remediation, both partial-remediation configurations, repeated visits with distinct-market counting, category/chain/region reconciliation and replacement by the current corrected answer.
- Backend TypeScript and the frontend production build pass. The frontend build emits all 45 application routes, including `/admin/sm/dashboard`.
- A read-only production-schema request for 1–28 August 2026 returned two completed SM submissions across two markets. Both current submissions use questionnaires without OOS-classified questions, so `classifiedChecks = 0`, `foundCases = 0` and all three percentage denominators correctly render as unavailable instead of fabricated zeroes.
- Browser verification loaded the live workspace without runtime or console errors. Applying the Billa chain filter changed the completed-visit scope from two to one and updated the reconciled breakdown from the same payload.
- The verification made no production database write and changed no GM route, table or row. Real non-zero OOS figures appear automatically after an OOS-enabled published questionnaire is selected centrally and a new SM visit is submitted; changing that central production selection was intentionally not used as a test shortcut.

### 27.10 Production-backed SM-only end-to-end verification — 2026-08-28

This verification supersedes the read-only limitation in the initial evidence above. The user explicitly authorized realistic writes in the SM domain only. No GM page was opened, no GM endpoint was called, and no GM table or row was read or changed during the data-path test.

The central SM questionnaire was temporarily exercised with the published `TEST · OOS & Behebung` snapshot. Two isolated assignments for the existing SM test account were completed through the real phone UI:

1. Billa, 1220 Wien: OOS present, fully resolved, with a real private signed-storage photo commit.
2. Billa Plus, 9400 Wolfsberg: OOS absent. Its conditional remediation, explanation and photo questions were correctly removed, leaving one applicable required question.

After the two submissions, the central SM assignment was restored to its exact pre-test value, `TEST · Abschluss & Dokumentation`. The completed visits retain their immutable OOS snapshots, so their dashboard evidence remains valid without changing future unstarted visits.

The finished-only boundary was verified as a state transition, not inferred from code:

- after OOS answers and their current answer versions had already been saved, but while the first visit was still a draft/in progress, the admin dashboard remained at the pre-test baseline of two completed visits and zero classified OOS checks;
- after the first final submission transaction completed, it changed to three completed visits, one classified check, one found OOS and one fixed OOS;
- while the second answered visit remained on its final review screen, the dashboard stayed at three completed visits and one classified check;
- only after the second final submission did it change to four completed visits and two classified checks.

The resulting mixed denominator set reconciled exactly:

| Metric | Verified result |
| --- | --- |
| OOS found | `1 / 2 = 50.0%` |
| OOS fixed | `1 / 1 = 100.0%` |
| Markets with OOS | `1 / 2 = 50.0%` |
| Completed visits | `4` across `3` distinct markets |
| Open remediation documentation | `0` |

Browser filter verification covered region, chain, SM user, market, combined region/chain, comparison-row search and reset. Representative reconciliations were:

- `Region Süd`: one submitted visit, `0 / 1` OOS checks, fixed rate unavailable, affected markets `0 / 1`;
- `Region Ost`: three submitted visits, `1 / 1` OOS checks, fixed `1 / 1`, affected markets `1 / 1`;
- `Billa Plus`: two submitted visits, `0 / 1` OOS checks and affected markets `0 / 1`;
- `Billa Plus · 9400 Wolfsberg`: one submitted visit, `0 / 1` OOS checks;
- the real SM account was redirected from `/admin/sm/dashboard` back to `/sm`.

The SM dashboard schedule cache is invalidated when a visit is submitted or discarded and again immediately before leaving its receipt. This prevents a completed assignment from briefly repainting as `Starten` from the long-lived offline schedule snapshot; the background server read remains authoritative.

The reporting eligibility predicate remains intentionally strict and centralized in the SM-only dashboard route: `status = 'submitted'`, `is_current = true`, `is_deleted = false`, and `reporting_available_at is not null`. Planned, started, paused, draft, cancelled, superseded and soft-deleted questionnaires cannot enter any card, category row, chain row, region row or export payload.
