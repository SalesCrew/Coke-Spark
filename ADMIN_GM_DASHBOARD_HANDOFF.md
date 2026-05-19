# Admin GM Dashboard Design Handoff

## Scope
- Dashboard target: **Admin view of GM performance only**.
- Explicitly out of scope: SM dashboard.
- Purpose: give design direction with clear data semantics and implementation constraints while leaving visual interpretation room for Claude Design.

## Brand and Visual Vibe
- Overall tone: operational, premium, trustworthy, high signal-to-noise.
- Base palette:
  - Primary accent: Coke red (`#F40009`, with deeper UI red variants around `#DC2626`).
  - Surfaces: white and very light grey cards on a soft neutral page background.
  - Text: high-contrast dark neutrals with restrained secondary greys.
- Style rules:
  - Clean card-first layout, generous spacing, minimal chrome.
  - Use red selectively for hierarchy, state emphasis, and progress.
  - Keep chart styling thin and readable; avoid heavy gradients or dense gridlines.

## Layout Concept (Desktop-First)
Use a 12-column grid with a strong top-down hierarchy:

1. **Sticky filter bar** (full width)
2. **Primary KPI row** (5 compact cards)
3. **Main analytics block** (2x2 visual anchor area)
4. **Secondary insights block** (compliance + rankings + campaign progress)

Recommended card grouping:
- Row A:
  - Left: Visit composition donut
  - Right: IPP trend line/area
- Row B:
  - Left: Category fulfillment multi-line trend
  - Right: Market coverage map with clustered pins
- Row C:
  - Daily consistency/compliance card
  - Top/bottom markets card
  - Campaign progress table card

## Dataset-to-Widget Mapping (Business Meaning)
### 1) Visit Execution (`visit_sessions`)
- KPI: Visit Completion % = submitted/completed visits divided by planned visits.
- KPI: Visit volume = done vs planned total.
- Donut: planned / started / submitted / canceled composition.
- Business meaning: execution reliability and territory coverage discipline.

### 2) Campaign Coverage (`campaign_market_assignments`)
- KPI/Table: assigned markets, visit target count, completed visits count.
- Progress bars: completion toward repeat-visit targets per campaign.
- Business meaning: whether GM is actually meeting quota depth, not just touching markets once.

### 3) Questionnaire Quality (`visit_answers` + module/fragebogen context)
- KPI: data quality/completion % (required answered vs required total).
- Secondary quality signal: unresolved/invalid answers share.
- Business meaning: submitted visits are only valuable if data is complete and valid.

### 4) Time Tracking (`time_tracking_entries`)
- KPI: total tracked hours in selected range.
- Split chart: market work vs Zusatz activities.
- Status ratio: submitted vs draft time blocks.
- Business meaning: effort allocation visibility and productivity traceability.

### 5) Day Sessions (`gm_day_sessions`, pauses)
- Compliance card:
  - day started/day ended completeness
  - missing start/end KM counts
  - pause duration trends
- Business meaning: operational hygiene and routine consistency.

### 6) IPP/KPI Trends
- KPI card: current IPP + delta to previous period.
- Trend chart: IPP over time (line/area).
- Category chart: multi-line category fulfillment over time.
- Business meaning: outcome trajectory, not just activity counts.

### 7) Geographic Footprint (market geo dataset)
- Map layers:
  - visited markets
  - planned not visited
  - clustered regional density
- Business meaning: geographic execution and concentration hotspots.

## Required Dashboard Modules (React + TypeScript)
- `GmDashboardPage`
- `GmDashboardFilters`
- `KpiCard`
- `VisitCompositionChartCard`
- `IppTrendChartCard`
- `CategoryFulfillmentChartCard`
- `MarketCoverageMapCard`
- `DailyConsistencyCard`
- `MarketRankingCard`
- `CampaignProgressTableCard`
- `DashboardStateLayer`

## State and UX Rules
Each card supports independent states:
- `loading`: skeleton with fixed geometry to prevent layout jumps.
- `empty`: no baseline data exists.
- `noDataInRange`: data exists globally but not in selected filter window.
- `error`: inline error with retry action for that widget only.

Global behavior:
- Filter changes should not blank the entire page instantly; preserve old data until new payload starts rendering skeleton overlays.
- No horizontal overflow in tables/charts; use truncation + tooltip patterns for long labels.

## Motion and Transition Spec
Motion should feel soft and premium:
- Card entrance: short fade + small translate (8-12px), stagger optional.
- KPI number updates: subtle count-up, short duration.
- Chart refresh: interpolated transitions, no hard redraw flash.
- Hover/focus: restrained elevation/outline transitions.
- Map marker updates: smooth cluster dissolve/merge behavior.

Accessibility:
- Respect reduced motion preferences with near-instant transitions.
- Keep color semantics understandable without animation.

## React TypeScript Handoff Constraints
- Design must be realistic for standard React + TypeScript component architecture.
- Favor reusable card shells and typed view-model props over one-off UI blocks.
- Keep chart/map assumptions practical for common libraries (Recharts/Nivo + Mapbox/Leaflet style ecosystems).
- Responsive behavior:
  - Desktop: full 12-col hierarchy.
  - Tablet/smaller desktop: stack secondary modules first while preserving KPI visibility.

## Copy/Paste Prompt for Claude Design
Use the text below directly:

```text
Design a super-clean Admin GM Dashboard (Gebietsmanager dashboard only). Do not include SM.

Goal:
Create a premium, modern admin analytics dashboard to monitor GM execution, quality, compliance, and KPI trends over time.
Use the provided screenshot only as loose structural inspiration (cards + charts + map), then improve it with cleaner hierarchy and better visual discipline.

Brand and vibe:
- Professional, operational, trustworthy.
- Red-accented UI with white/light-grey card surfaces.
- Readability first, polish second.
- Minimal and uncluttered.
- Motion should feel soft and premium, never bouncy or playful.

Required data meaning to express in UI:
1) visit_sessions: planned/started/submitted/canceled execution reliability.
2) campaign_market_assignments: assigned markets, repeat visit target count, completed visits.
3) visit_answers: required answer completeness and validation quality.
4) time_tracking_entries: total tracked hours, market vs Zusatz split, draft vs submitted.
5) gm_day_sessions + pauses: start/end day consistency, pause behavior, missing KM completeness.
6) IPP/KPI trends: current value, delta, trend over time, category-level performance lines.
7) Geographic market footprint: visited vs planned-not-visited + regional clustering.

Required structure:
- Top filter bar: date range, GM, campaign, region/chain, status.
- KPI row: Visit Completion %, Total Visits (done/target), IPP (current + delta), Time Tracked, Data Quality %.
- Main analytics: visit donut, IPP trend, category fulfillment multi-line, clustered map.
- Secondary insights: daily consistency/compliance, top/bottom markets, campaign progress table with bars.

State requirements:
- loading skeletons
- empty state
- error with retry
- no-data-in-selected-range

Motion requirements:
- card enter fade+translate
- smooth KPI count-up
- chart interpolation transitions
- subtle hover/focus feedback
- reduced-motion fallback

Technical constraints:
- Must be feasible in React + TypeScript.
- Use reusable component patterns and clear card modules.
- Desktop-first with graceful collapse on narrower screens.

Creative freedom:
You can decide spacing system, typography pairing, icon style, and chart styling details as long as output stays clean, high-contrast readable, and aligned with red + grey/white brand language.

Deliver:
1) visual direction and layout concept
2) component breakdown
3) interaction/motion notes
4) concise implementation-ready React TypeScript handoff spec
```
Design a super-clean **Admin GM Dashboard** (Gebietsmanager dashboard only — do NOT include SM dashboard in this task).

## Goal
Create a modern, premium-feeling analytics dashboard for admins to monitor GM performance, visit execution, and quality/compliance over time.
Use the attached screenshot only as directional inspiration for structure (cards + charts + map), but make the final UI cleaner and more refined.

## Product vibe / brand direction
- Tone: professional, operational, trustworthy, high-clarity.
- Visual style: our usual **red theme** with neutral **white + light grey cards**.
- Feel: soft, smooth, elegant motion; no harsh jumps.
- Priority: readability first, then visual polish.
- Keep the UI minimal and uncluttered; avoid over-decoration.

## Data we track (and what each metric is for)
Design around these real business datasets and their purpose:

1) **Visit execution data** (market visits / `visit_sessions`)
- Counts: planned visits, started visits, submitted/completed visits, canceled visits.
- Business use: execution reliability and field coverage.

2) **Campaign assignment coverage** (`campaign_market_assignments`, including repeat-visit targets)
- Counts: assigned markets, visit target count, current completed visits.
- Business use: whether a GM is hitting campaign quotas, including multiple required visits per market.

3) **Questionnaire / quality outcomes** (`visit_answers`, modules/fragebogen)
- Counts: answered vs unanswered required questions, validation/completion quality.
- Business use: submission quality and data completeness.

4) **Time tracking** (`time_tracking_entries`)
- Categories include market work + “Zusatz” activities.
- Counts: total tracked duration, activity split, submitted vs draft time blocks.
- Business use: effort distribution and productivity transparency.

5) **Day session data** (`gm_day_sessions`, pauses)
- Counts: day started/day ended consistency, pause duration, missing day-end/start KM cases.
- Business use: discipline/compliance and operational hygiene.

6) **IPP / KPI trend signals** (IPP score trend + category fulfillment)
- Counts: current score, trend over time, category-level fill/performance.
- Business use: outcome quality and trend direction, not just activity volume.

7) **Geographic footprint** (market location map)
- Counts: visited markets, planned-not-visited markets, cluster density by region.
- Business use: route/territory visibility and concentration patterns.

## What we want to see on the GM dashboard
Design a complete page with:

- **Top filter bar**:
  - date range (today / week / month / custom)
  - GM selector
  - campaign selector
  - region/chain filter
  - status filter (planned, in progress, submitted, overdue)
- **Primary KPI row (cards)**:
  - Visit Completion %
  - Total Visits (done / target)
  - IPP score (current + delta)
  - Time Tracked (h)
  - Data Quality / Submission completeness %
- **Main analytics area**:
  - donut/pie for visit composition
  - line/area trend for IPP over time
  - multi-line chart for category fulfillment over time
  - map card with clustered pins and status colors
- **Secondary insights area**:
  - GM daily consistency (start/end day, pauses, KM completeness)
  - top/bottom markets by KPI or completion quality
  - campaign progress table with progress bars
- **States**:
  - loading skeletons
  - empty state
  - error/retry state
  - no-data-in-selected-range state

## Motion and transitions (important)
- Use subtle, soft animations everywhere:
  - card entrance (small fade/translate)
  - chart drawing transitions
  - smooth number count-up on KPI updates
  - gentle hover/focus transitions
- Motion should feel premium and calm (not playful/bouncy).
- Include reduced-motion behavior.

## Technical compatibility requirements
- Must be feasible for **React + TypeScript** implementation.
- Componentized structure with clear reusable card/chart blocks.
- Responsive behavior for desktop-first admin usage (large screens), with graceful collapse for smaller widths.
- Use practical UI patterns that can be built with typical React chart/map libs.

## Creative freedom
Keep the constraints above, but you have room to interpret:
- exact spacing system
- typography pairing
- chart style details
- iconography and microinteractions
as long as final result is super clean, high-contrast readable, and aligned to red + grey/white brand style.

Deliver:
1) visual direction + layout concept
2) component breakdown
3) interaction/motion notes
4) a concise handoff spec suitable for React TypeScript build.