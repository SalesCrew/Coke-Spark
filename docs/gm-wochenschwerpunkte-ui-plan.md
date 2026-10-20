# Wochenschwerpunkte — admin UI redesign

Date: 2026-10-20. Scope: the admin document library and editor only. This is the design and implementation plan; completion evidence is recorded at the end after verification.

## 1. Product and working context

An admin receives a PDF, adds an optional introduction/page notes, chooses its visibility dates, and publishes it for GMs. Returning admins need to identify an existing document, change its draft, publish a new version, or archive it. The PDF is the content, not an invitation to recreate a desktop publishing tool. Admins work on laptops. The GM reader, Home menu, read receipts, immutable publications, backend contracts, and database schema stay as implemented.

Read before planning: deslopify SKILL.md and its controls/content, visual-language, adaptation/states, and implementation/verification references. Studied the actual admin layout/header/navigation, Durcharbeit campaign workspace, FB Management panels/forms, existing custom date controls, mileage editor screenshot, existing Wochenschwerpunkte implementation, and the supplied screenshot.

### Existing product language to reuse

| Source | Established decision | Application here |
| --- | --- | --- |
| `src/app/admin/layout.tsx` | 80px white page header, 20px title, pale `#f5f5f7` workspace, existing outer gutters | Keep the shell and navigation intact. Do not introduce another page hero or another font. |
| `SMDurcharbeitCampaignWorkspace.module.css` | Thin borders, 12–14px white panels, compact toolbar and table, quiet metadata | A normal document table, then two deliberate editor panels. |
| `SmFbManagementWorkspace.module.css` | Real labels, familiar form fields, red primary action in the GM context | Form field density, inset spacing, save/publish hierarchy. |
| Existing admin header buttons | 7–8px corners, fine inset highlight, restrained shadow, small Lucide icons | Reuse that button character rather than oversized flat CTAs or pill actions. |
| `AdminFilterControls.tsx` | Product-specific custom calendars and dropdowns, portals and keyboard handling | Reuse the actual components. No native select/date popup and no new UI library. |

No changes to other admin pages, GM dashboard card filters, GM reader layout, permissions, existing drafts, publications or PDF files.

## 2. Precise diagnosis

| Observation | Consequence | Remedy | Regression to watch |
| --- | --- | --- | --- |
| Persistent library + page rail + large PDF + inspector create four vertical lanes | It looks like a separate design tool and squeezes useful content at laptop widths | Separate collection browsing from focused document editing; two columns in the editor | Keep returning to the document list obvious and guard unsaved edits. |
| 8–10px low-contrast form labels and metadata | The interface feels miniature and reading becomes effortful | 11–12px metadata/controls, 12–13px inputs, 15–16px object heading | Fit actual laptop widths without shrinking type again. |
| Full-width PDF makes a single page extend far below the viewport | An admin cannot review the complete page while editing | Default to fitting the whole page to the available preview height; offer width mode | Keep landscape PDFs, page notes and long pages reachable. |
| Document settings and every optional text field remain exposed simultaneously | Unused form chrome competes with the actual document | Two clearly named settings tabs: Dokument / Seitentext; optional introduction disclosure | Page annotations must remain easy to find and retain values between tabs. |
| A small icon is the main upload entry and an oversized empty-state slogan fills the remainder | Upload is less discoverable than on ordinary admin pages | Labeled PDF hinzufügen button; short functional empty state | Keep drag/drop and visible format/size limits. |
| Gray-looking non-draft statuses can imply a different published state than reality | Admin may confuse an editable draft with the live publication | Text + dot with correctly mapped Entwurf/Geplant/Veröffentlicht/Abgelaufen/Archiviert states | A saved draft change must not imply its publication is already updated. |

## 3. End product

### A. Document overview

- Existing global page header remains Wochenschwerpunkte.
- One normal white admin surface; no permanent internal sidebar or decorative KPI cards.
- Surface toolbar: Aktuell / Archiv at the start, searchable title/file/introduction in the middle, PDF hinzufügen at the end. A small document count belongs with the collection label.
- Current/Archive are mutually exclusive filter buttons with `aria-pressed`; all actions remain real buttons.
- Search is a 32–34px high input with the same muted inset surface used by market/campaign search. It has a clear button when populated and a persistent accessible label.
- Table columns: Dokument (widest), Status, Sichtbarkeit, Zuletzt veröffentlicht, open affordance. The API has no draft-updated timestamp, so the date column uses the actual latest publication date and remains empty for an unpublished draft. Page count and file size sit on the second document line; the PDF filename remains available without forcing titles into cryptic abbreviations.
- Title is 12px/600 with a readable 18px line-height. Metadata is 11px; both use existing admin slate/neutral colors. A row's title button owns navigation and the row has a soft hover response.
- Real PDF/page icon in a quiet 30px square identifies the content type. No novelty illustrations, stacked preview mosaics or unnecessary color blocks.
- Table header uses the existing restrained uppercase 9–10px style. Body rows are approximately 68px; long document titles can wrap to two lines rather than disappear at a fixed 230px width.
- Empty library: small file icon, Noch keine Wochenschwerpunkte, one short upload hint and the existing upload action. No slogan or rotated-paper ornament.
- Search with zero matches: Keine Dokumente gefunden and Suche zurücksetzen. Archive with zero rows: Noch keine archivierten Dokumente. Loading is its own state; errors are durable and retryable.
- Upload accepts exactly one PDF, up to 500 MB/80 pages, using the existing validation and service. File picker and page drop are both supported. An upload opens the new draft directly.

### B. Focused editor

The selected document replaces the overview in the same route. No route/history changes or new API are required.

1. A compact white object header spans both columns. Left: clearly named back-to-documents control, document title, file/page metadata. Right: honest save feedback, Speichern secondary action, Veröffentlichen/Neue Version primary action. The document status is adjacent to identity.
2. Below: settings panel on the left, PDF preview on the right. Both use the same 12px panel corners and borders as ordinary admin panels. Gap 14px; no panels inside panels without a grouping reason.
3. The left panel is 310px at ordinary laptop widths, up to 330px on wide displays. The right panel takes all remaining space. At tighter desktop windows, settings remain legible at 290px; the PDF fits its remaining width. The side navigation can expand without breaking the workspace.
4. The workspace uses the available height under the existing shell. Top actions stay visible; settings and preview scroll locally when needed. A short-height laptop must keep save/publish and page navigation reachable.

### C. Settings panel

- Two top tabs: Dokument and Seitentext. These are related edit views, not publication steps. Tab changes do not save or discard anything. The active style is the small red underline/tint used elsewhere in the GM admin area.
- Dokument contains a normal Titel input (max 160), optional Einleitung in a disclosure, and Sichtbarkeit.
- The introduction disclosure is open when a saved introduction exists. Opening an empty one reveals a 3-row textarea; collapsing it never clears content.
- Sichtbarkeit has Von and Bis fields in one row using the existing `AdminDatePicker`. Clear shortcuts Ab sofort / Ohne Ende stay visible and tied to their corresponding date. A compact summary states the actual chosen range; invalid ranges get a local message rather than a mystery disabled button.
- Seitentext explicitly identifies Seite N von M. It contains Überschrift (max 160) and Beschreibung (max 4000). Switching PDF pages changes only the addressed page, not the other pages' text.
- Optional does not become a repeated gray sentence on every field. One small optional label in the page-text section is enough. Real labels remain visible above inputs.
- The page text preview is shown under the PDF when present, including unsaved edits. It must be possible to scroll to the caption in either view mode.
- Publication history is a secondary disclosure below the main settings, with version and visibility dates. Historical records stay immutable. Archive/restore is a quiet labeled action at the bottom with the existing confirmation and permission guards.
- Inputs: 34–36px minimum height, 8px corners, 10px horizontal insets, 12px text, neutral border, red-tinted focus border without a large generic halo. Textareas resize vertically.

### D. PDF preview

- One 42–44px toolbar: previous page, Seite N von M, next page; fit controls; PDF ersetzen as a quiet labeled utility. Disabled arrows communicate first/last page; icon controls have explicit accessible labels.
- View modes: Ganze Seite (default) and Breite. Use small matching buttons with `aria-pressed`, not an OS dropdown. Whole-page sizing follows actual PDF dimensions and measured available preview height, not a hardcoded A4 assumption.
- A neutral pale stage, a white page and one fine edge/shadow support legibility. The stage is not another giant card or a decorative canvas.
- Keep both page edges visible with at least 16px stage padding. Center the fitted page horizontally. In width mode, allow natural vertical scroll; do not scale a tall PDF until its text becomes microscopic.
- Multiple pages: a compact horizontal thumbnail strip at the bottom, 44–48px wide previews with page numbers and red selection edge. Only nearby pages render live thumbnails, preserving the existing lazy rendering behavior for an 80-page PDF.
- Single-page PDF: omit the redundant thumbnail strip and give that height back to the page. Page counter remains visible in the toolbar.
- Thumbnail selection changes the active page and preserves the chosen settings tab. The Seitentext tab always refers to that selected page. The selected thumbnail scrolls into view.
- Loading reserves the page area. A PDF failure retains all form content, gives a concise message and Erneut laden; it must not look like an intentionally blank viewer.
- PDF replacement retains current confirmation, saved/unsaved handling, page-number association and original published file history. No original file is overwritten.

## 4. Type, color, geometry and density

| Role | Decision |
| --- | --- |
| Typeface | Inherit the existing admin Inter/system font stack. |
| Global shell | Existing `#f5f5f7`, white header; unchanged outer spacing. |
| Panel | White, `#e7e7eb`/existing subtle neutral boundary, 12px radius, very small product-style shadow. |
| Primary ink | Existing near-black `#202124`/`#27272a`. |
| Supporting ink | Slate/neutral around `#69717c`; avoid the old 8px pale gray text. |
| Brand | Existing Coke red `#dc2626`; selection, primary publish/upload and integrated focus only. |
| Status | Neutral Entwurf, restrained green Veröffentlicht, blue Geplant, muted amber Abgelaufen, neutral Archiviert; always actual text + dot. |
| Object title | 15–16px, 650 weight, normal wrapping/ellipsis only with accessible full title. |
| Section heading | 11–12px, 600–650 weight. |
| Field text | 12px/1.5; labels 11px. |
| Metadata | 10.5–11px/1.5; dates and page counts use tabular numerals. |
| Buttons | 32–34px height, 7px corners, 11px/650 label, 13px Lucide icon, subtle familiar inset highlight. |
| Layout rhythm | 14px between panels, 18–20px panel inset, 14–18px between form groups, 6px label-to-control. |
| Scroll | Native scrolling with hidden or 3–4px low-opacity scrollbar chrome. No heavy permanent scrollbar. |
| Motion | 120–160ms color/background/opacity changes; no delayed reveal, panel-bounce or new motion dependency. Reduced-motion support retained. |

## 5. Interaction and data safeguards

- Keep load/upload/save/publish/archive endpoints and payloads unchanged.
- Preserve account-change isolation, stale-response checks, revision conflicts, idempotent upload IDs, no automatic publication, and unsaved-navigation guards.
- Back to documents runs the same unsaved-confirmation contract as selecting another document. Browser unload warning remains active.
- Save acknowledges only the server response. Publish saves dirty fields first as already implemented. A draft with saved changes remains distinguishable from its latest published version.
- New-draft, archived, published, expired and scheduled documents remain distinct. Previewing the current draft is not labeled as the already-live GM version.
- Editing title, description or dates is never a database migration. This redesign requires no schema/data changes and no push/deployment.
- All agent checks use the isolated 3037/4037 fixture with no production environment. The normal 3000/4000 app is only switched to the tested build for the human to use.

## 6. Challenge every major decision before implementing

| Initial decision | Challenge / tradeoff | Final decision after critique |
| --- | --- | --- |
| Keep a small document sidebar and make the inspector prettier | It preserves the exact spatial problem the screenshot demonstrates. Is fast cross-document switching frequent enough to justify a permanent third column? No evidence supports that. | Replace the sidebar with an ordinary document overview and an obvious one-click return. |
| Show a gallery of PDF cards | It is tempting for a PDF feature, but slow to compare status and dates and unlike the product's operational pages. | Use rows/table with a file marker and informative metadata. |
| Put the red upload action in the global shell through custom events | It would match some existing pages, but adds cross-component state/event plumbing merely for appearance and complicates busy-state handling. | Keep one labeled upload action in the overview toolbar, like the self-contained campaign workspace. No global shell event machinery. |
| Always expose all document and page fields | It looks convenient but competes with the PDF and recreates the old long inspector. | Keep frequent document settings visible; use a distinct Seitentext tab and a lightweight optional introduction disclosure. |
| Automatically open page-text settings when a thumbnail is clicked | That could speed note entry but would unexpectedly replace document settings for someone simply reviewing pages. | Preserve the selected tab. Page identity remains visible and updates immediately. |
| Hide page notes behind an unlabeled icon | Less text is not the same as more usable. | A labeled Seitentext tab remains visible. The PDF replace action is also labeled. |
| Fit PDF to full width by default | It makes the screenshot fill the stage but creates a huge vertical page and hides its end. | Default to whole-page fit; offer width mode for reading. Both obey actual PDF dimensions. |
| Always show the thumbnail strip | For a one-page file this only repeats the same page and steals vertical room. | Render the strip only for multiple pages. |
| Hide save state until there is an error | It makes the toolbar quieter but removes confidence about draft persistence. | Keep one small honest save indicator; do not repeat save confirmation in multiple places. |
| Add a new stepper and a mandatory preview step before publishing | It adds ceremony to a recurring task; existing publication confirmation already protects the consequential action. | No stepper or new workflow gates. Preserve confirmation with concise, accurate visibility information. |
| Match tiny existing metadata literally | The product has some small text, but repeating its worst cases would sacrifice readability. | Reuse the hierarchy and density, with readable 10.5–12px supporting/control text and real labels. |
| Make a pure CSS decorative PDF size | A4-only sizing breaks landscape files and mixed page dimensions. | Measure the preview viewport with ResizeObserver and calculate from the selected page's actual dimensions. |
| Rebuild every admin page to share new tokens | Unnecessary regression risk and not requested. | Scope styles to this feature and reuse the existing custom components as-is. |

This critique changes the structure, not only colors and corners. It removes three persistent navigation/form areas, avoids hidden essential actions, and gives page review the available laptop height.

## 7. Acceptance and verification

### Must be true

- Overview and editor look like the existing admin surface/toolbar/form family.
- No permanent document library or vertical thumbnail rail in the focused editor.
- Whole-page mode shows the full PDF page at ordinary laptop heights; width mode preserves scrolling.
- Title, date controls, primary actions and optional page notes are readable and reachable with expanded and collapsed admin navigation.
- One-page, multi-page, long-title, description, archived, scheduled, no-match, loading, error and dirty states have deliberate presentations.
- Search/clear, document open/back, settings tabs, date picker, page navigation, page notes, save, publish, archive/restore, PDF replacement and unsaved warning retain their functions.
- No existing PDF/answer data changes through agent activity, no production-connected UI testing, no schema changes, no push/deployment.

### Evidence to capture

- Synthetic overview at 1440×900 and 1280×800.
- Synthetic selected editor at 1440×900, 1280×800 and short-height laptop 1366×768, plus an intermediate desktop width.
- One-page and multi-page PDF, both fit modes; page-text tab and custom calendar.
- Behavioral check of editing/saving/publishing existing synthetic PDF, selecting another page, returning to overview with/without unsaved changes, searching/no-results, archive/restore and load-error recovery.
- Keyboard focus/activation, dialog Escape and focus return; inspect clipping, wrapping, panel heights and horizontal overflow from rendered DOM/screenshots.
- TypeScript/lint/production build appropriate to the files changed. Repeat only checks affected by observed fixes.

## 8. Implementation and review record

Implemented on the existing feature branch. Source changes are scoped to `BriefingWorkspace.tsx`, its CSS module and this plan. The database, API, GM reader and other admin screens were not changed.

### Review findings and corrections

1. **Unsupported metadata:** the draft API does not expose an updated timestamp. The table therefore shows the actual latest publication date, not an invented last-edit date. Published visibility uses the latest publication's dates; draft edits do not silently relabel the live visibility window.
2. **Redundant content:** omit a repeated filename in overview rows when it is identical to the document title. Page count and size remain visible; the actual filename remains available and is shown in the editor.
3. **Inactive action clarity:** an unchanged published document uses a neutral disabled publication button rather than a faded red button competing for attention.
4. **Document ownership of feedback:** the screenshot pass exposed an archive confirmation persisting after switching documents. Selecting a document now clears the previous document's action notice and its timer.
5. **Optional introduction behavior:** introduction disclosure state is independent of its text, so deleting the last character does not collapse the textarea or lose focus. Switching settings tabs retains its content.
6. **Keyboard return:** the confirmation dialog previously closed in a passive effect after its DOM had been removed. Closing it during layout cleanup preserves the browser's native return of focus to its invoking control. Verified with Escape. Opening a document also places programmatic focus on its object heading; returning restores the original document-row button.
7. **Honest failed-load state:** a failed collection request has a separate retryable state rather than an empty-library/upload message. A PDF load failure retains the form, selection and retry action.

### Actual evidence

Evidence directory: `outputs/project-context/Coke Spark/investigations/gm-wochenschwerpunkte-ui-20261020/`.

- **25 main browser checks passed** (`interaction-results.json`): collection search/no matches, whole-page fit and no horizontal page overflow at 1440×900, 1280×800, 1366×768 and 1160×800; expanded admin navigation; width-mode scrolling; existing custom calendar; keyboard settings tabs; page-text save and separation; unsaved Escape/discard; new publication with all earlier publications retained; archive/restore; single-page strip suppression; long titles; PDF replacement; collection failure/retry; zero browser errors and zero external/production browser connections.
- **9 edge-state checks passed** (`edge-state-results.json`): actual PDF upload, optional introduction deletion and tab persistence, native dialog focus return, cross-document notice reset, PDF load failure/retry preserving the draft, true empty library, no page errors or external connections.
- Screenshots were visually inspected for overview, document settings, page text, expanded navigation and one-page fit. Additional captures include custom calendar, long title, width fit, short-height laptops and PDF error. See PNG files in the evidence directory.
- Scoped Next/React/TypeScript ESLint passed using the installed Next configs. Production compilation, TypeScript and generation of the human frontend passed; no development routes are included.
- Every interactive test ran on isolated synthetic 3037/4037 with a clean environment and browser network restricted to those ports. No real PDFs, business records, production credentials or the human 3000/4000 endpoints were used for agent checks.

### Limits

Rendered checks used headless Chromium on this Mac, not every desktop browser or a screen reader. Existing global navigation can make the overall document taller than a short laptop viewport; that existing shell was left alone. The feature's header, actions and PDF workspace fit the tested viewport heights, with local scrolling for notes/width mode. No new migration, push or deployment belongs to this UI change.


## 9. Follow-up — whole-row action and separate GM preview (20.10.2026)

The existing native document button now has a stretched hit target covering its complete table row. Status, visibility, publication metadata, blank areas and the arrow all open the same detail view. The arrow is decorative rather than a duplicate keyboard stop. Table semantics and the native button Enter/Space behavior remain available; keyboard focus is drawn around the row. Disabled buttons do not retain an active overlay.

Six focused checks passed on the isolated fixture: status cell, visibility cell, publication-date cell, arrow, blank row area and Enter on the native document button. No backend or schema change was needed.

A dedicated GM preview uses synthetic data on 3037/4037. Its optimized frontend is built without production environment files and connects only to the isolated API. The human 3000/4000 app is not used for this preview.


## Final release refinements — 20 October

Aktuell/Archiv now use the existing admin tab convention: transparent surface, 24 px separation, Coke-red 2 px active underline and neutral inactive text. The row click target and keyboard navigation are unchanged. Kurti no longer receives its promotional badge/tinted row by default.

The upload cap is 500 MB in app validation and the private bucket migration, with the existing 80-page cap retained. The hosting global-cap prerequisite and the actual isolated checks are recorded in `gm-wochenschwerpunkte-verification.md`; do not infer that an updated bucket alone raises Supabase's global limit.
