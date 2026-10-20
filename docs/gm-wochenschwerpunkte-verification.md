# GM Wochenschwerpunkte — Umsetzung und Prüfnachweise

Stand: 19.10.2026. Feature-Branch: `codex/gm-wochenschwerpunkte-20261019` in Frontend und Backend. Basis: Frontend c944b2e, Backend 892065f. Die offenen Änderungen im ursprünglichen Projektverzeichnis wurden nicht verändert.

## Fertiger Ablauf

- GM-Arbeitsbereich → Management → **Wochenschwerpunkte**. PDF hinzufügen oder in den Arbeitsbereich ziehen, Seiten automatisch vorbereiten, Dokumenteinleitung und optionale Texte je Seite bearbeiten, Sichtbarkeit setzen, veröffentlichen.
- Veröffentlichung ist ein eigener Schritt. Speichern und PDF ersetzen verändern zunächst nur den Entwurf. Eine neue veröffentlichte Version erhält einen eigenen Lesestatus.
- GMs finden **Wochenschwerpunkte** im vorhandenen Home-Menü, auch auf Aktivität, Zeiterfassung und Profil. Der rote Zähler zählt ungelesene aktive Veröffentlichungen.
- Der Reader öffnet bildschirmfüllend aus dem Menü. Seitliches Wischen, vertikales Scrollen und kleine Seitenpunkte sind die Hauptnavigation; Pfeiltasten und dezente Pfeile ergänzen sie. Mehrere aktive Dokumente sind über die kleine Titelauswahl erreichbar.
- Eine Seite wird erst nach erfolgreicher Darstellung, während sie die aktuelle Seite ist und der Tab sichtbar ist, nach 900 ms quittiert. Vorladen benachbarter Seiten zählt nicht. Erst alle Seiten zusammen entfernen den Neu-Zähler.
- Ohne aktive Veröffentlichung ist der Menüeintrag deaktiviert. Fehler sind eigene Zustände mit Wiederholen-Aktion.

## Anforderung für Anforderung

| Anforderung | Umsetzung | Nachweis |
| --- | --- | --- |
| Vorher planen, hinterfragen, deslopify und bestehende UI berücksichtigen | Produktplan mit Erstentwurf, Kritik und finalem Ablauf; vorhandene Adminflächen, Coke-Rot, Datumspicker und Home-Menü beibehalten | `docs/gm-wochenschwerpunkte-plan.md`; tatsächliche Admin-/GM-Screenshots |
| PDF unkompliziert hochladen | Dateiauswahl und Drop-Zone; echte PDF-Prüfung, 25 MB, 1–80 Seiten; automatisch Seitennummern und Vorschauen | Browser-Dateidialog mit synthetischer 3-Seiten-PDF; Integrationstest Upload → Entwurf |
| Cleanen Editor mit Seitentexten | Dokumentliste, Seitenleiste, große Vorschau und kompakte Eigenschaften; Einleitung und Überschrift/Beschreibung je Seite | Browser: Text ändern, speichern, Kalender verwenden und veröffentlichen; `admin-editor-1440.png` |
| Sichtbarkeitszeitraum | Von/Bis nach Europe/Vienna, Endtag inklusive; sofort oder ohne Ende möglich | Integrationstest vor/nach Wiener Mitternacht; zukünftige Version, Ablauf, kein Rückfall auf alte Version |
| GM-only | Nur GM-Viewerroute und GM-Menü-Wrapper; Admin/Kundenrechte über neue GM-Seite; kein SM-Workerzugriff | Rollen- und Kundenrechte im echten Router mit isolierten Auth-Identitäten geprüft; SM erhält 403 |
| Neu-Zähler wie SM-Nachrichten | Vorhandene rote Badge-Darstellung im Home-Menü, Zahl aktiver ungelesener Versionen | Browser: 1 ungelesen, nach drei Seiten und Reload kein Zähler; später 2 bei zwei aktiven neuen Veröffentlichungen |
| Lesestatus in DB | Eindeutige Veröffentlichung/GM-Quittung; atomar zusammengeführte Seitennummern; gelesen-Zeitpunkt erst vollständig | Integrationstests mit Duplikaten, zwei GMs und neuer Version; Browser-Reload |
| Volle Seite und saubere Animation | Dialog wächst aus Menübereich, Rückanimation zum eingeklappten Menü; Fokus-/Scroll-Rückgabe; Reduced-Motion-Zweig | Browser Öffnen, Escape, Tastaturnavigation und Rückkehr; CSS/Animationszweige geprüft |
| Wischen und Scrollen | Horizontale Scroll-Snap-Seiten, pro Seite vertikaler Scrollbereich mit Begleittext | Browser: seitlich zu Seite 2, nach unten zum Seitentext, Pfeiltaste zu Seite 3 |
| Keine Inhalte nicht öffnen | Deaktivierter, erklärend beschrifteter Menüeintrag | Browser mit archivierter synthetischer Veröffentlichung |
| Historie und Entwürfe schützen | Unveränderliche Veröffentlichungssnapshots und neue PDF-Pfade; Archiv erhält Inhalte/Quittungen; Revisionskonflikt statt Überschreiben | DB-Trigger-Test; PDF-Ersatz erhält ältere Datei/Seitenzahl; Browser-Konflikt und kontrolliertes Neuladen |
| Fehler beheben können | PDF erneut laden; Lesestatus erneut speichern; fehlerhafter Upload hinterlässt keinen Dokumententwurf | Browser PDF-Fehler/Retry und Quittierungsfehler/Retry; isolierter Storage-Ausfalltest |
| Laptop / iPad | Admin 1440×900 und 1280×800; GM 1180×820 und 1024×1366 | Screenshots; Dokument/Inspector `scrollWidth === clientWidth` auch bei 1280 px |

## Automatisierte Checks

Alle Befehle liefen mit geleerter Umgebung (`env -i`), ohne Produktions-Environment-Dateien.

- Backend: `tsx --test src/gm-briefings.integration.test.ts` — **4 Tests bestanden**, mit PostgreSQL über PGlite, tatsächlicher additiver SQL-Migration, tatsächlichen Routern/Service und ausschließlich synthetischen Benutzern/PDFs.
- Abgedeckt: Upload, Wiederholung, PDF-Prüfung und Seitenlimit, Größenlimit, Speichern, Revisionskonflikt, Veröffentlichung, idempotentes Publizieren, unveränderliche Snapshots, privater Dateiabruf, vollständige/teilweise Quittierung, getrennte GMs, neue Version, Archiv, Zeitgrenzen, Storage-Ausfall und Rollen/Kundenrechte.
- Neue Tabellen haben RLS und keine anonymen/Worker-Tabellenrechte. Der private Bucket bleibt selbst bei einer künstlichen vorhandenen breiten Storage-Policy für Worker unsichtbar. Andere Buckets werden von der neuen restriktiven Policy nicht eingeschränkt.
- Backend-Produktions-TypeScript-Build bestanden.
- Frontend-TypeScript/optimierter Next-Produktionsbuild bestanden.
- ESLint für neue React-Komponenten und den angepassten gemeinsamen Menübaustein bestanden.
- Bestehende SM-Home-Regressionschecks: **13 bestanden**. Es wurden keine SM-UI- oder GM-Dashboardfilter umgestaltet.

## PDF-Bibliotheken und Browsergrenzen

- PDF.js **6.4.299**, lokales Legacy-Bundle einschließlich Worker/Fonts/CMaps/WASM; lädt erst bei Bedarf. Keine fremde Viewer-Werkzeugleiste und kein öffentliches PDF-Hosting. [Mozilla beschreibt das Legacy-Bundle für breitere Browserkompatibilität](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).
- PDF-LIB **1.17.1** prüft serverseitig die tatsächliche PDF, Seitenzahl und Seitengrößen. Der Originalinhalt wird nicht umgeschrieben.
- Gerenderte Checks liefen im In-App-Browser auf dem Mac mit iPad-Viewportgrößen, nicht auf einem physischen iPad. Kein Screenreader- oder echter iPad-Safari-Gerätetest; Reduced Motion ist implementiert, aber wurde nicht durch Ändern der Betriebssystempräferenz getestet.
- Storage-Adapter gegen Supabase wurde anhand der SDK-Schnittstelle implementiert. In Tests und Vorschau ersetzt ihn ausschließlich ein lokaler privater Speicher. Es wurden keine produktiven Daten/Dateien abgefragt, verändert oder zur Verifikation genutzt.

## Migration und Produktionsstatus

Vorbereitet: `backend/supabase/migrations/20261019153844_gm_wochenschwerpunkte.sql`.

Additiv sind genau drei neue Tabellen (`gm_weekly_briefings`, `gm_weekly_briefing_publications`, `gm_weekly_briefing_reads`), ihre Indizes/Schutzregeln sowie der private Bucket `gm-weekly-briefings` mit PDF-/25-MB-Beschränkung. Bei widersprüchlicher bestehender Bucket-Konfiguration bricht die Migration ab. Keine Backfills, Besuche, Kilometerstände, Kampagnen oder bestehenden Inhalte werden geändert.

Die Migration wurde ausschließlich auf der isolierten Datenbank angewendet. Produktionsmigration, Produktions-Storage-Einrichtung und Deployment dieses Features sind noch nicht autorisiert und wurden nicht ausgeführt. Für die spätere Produktionsfreigabe muss genau diese Schema-/Storage-Migration gesondert freigegeben werden.

## Vorschau und Belege

Vorschau: Frontend `http://127.0.0.1:3037`, isoliertes Backend `http://127.0.0.1:4037`. Login: `admin@preview.invalid` oder `gm@preview.invalid`, Passwort `preview`. Der Fixture-Server akzeptiert ausschließlich künstliche Identitäten und ist nicht Bestandteil der normalen App-Startpunkte.

Screenshots liegen unter:
`/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/project-context/Coke Spark/investigations/gm-wochenschwerpunkte-20261019/`

- `admin-editor-1440.png`
- `gm-menu-unread.png`
- `gm-reader-landscape.png`
- `gm-reader-portrait.png`

Normaler menschlicher localhost:3000/4000 blieb unverändert. Die Vorschau startet keine geplanten Jobs und lädt keine Produktionsumgebung.


## Release preparation — 20.10.2026

This dated addendum supersedes the original 19 October local-only status above.

- The original schema/private bucket migration was explicitly authorized and applied earlier in this conversation (registered as `20261020123857_gm_wochenschwerpunkte`).
- The 500 MB limit migration was separately authorized and applied through the Supabase plugin (registered as `20261020135103_gm_briefing_500mb_upload_limit`). It changes only the existing private PDF bucket cap; publications, read receipts, files and business answers are untouched.
- Client validation, HTTP raw-body parsing and server-side PDF inspection accept up to 500 × 1024 × 1024 bytes; the 80-page limit remains. Upload requests have a 10-minute client timeout. Railway still imposes its own request-duration limits. No full 500 MB production transfer was attempted.
- **Remaining hosting prerequisite:** Supabase's global storage ceiling is below 500 MB. Its Storage API rejected the bucket update before the SQL migration with HTTP 413. The plugin supports the bucket migration but does not expose the project-level storage configuration endpoint; the available CLI/browser are not signed in. Raising that global ceiling is authorized but remains unapplied. The bucket migration alone does not bypass the global ceiling.
- Refined admin document table/editor, whole-row opening and current/archive underline tabs are included. Kurti uses the normal unfeatured menu style; its feature badge is off by default.
- The release merges the current production branches, retaining the existing SM visit-answer and photo-upload recovery fixes. The original project checkout's unrelated working changes were not included.
- Isolated checks: 8 backend briefing/SM-history integration tests; 9 SM photo-upload regression tests; backend TypeScript check; React component lint; optimized frontend builds; 6 laptop browser checks at 1280 and 1440 pixels. A real PDF above the former 25 MB cap was uploaded through the actual isolated route/service. The fixture applies both migrations with synthetic users and storage.
- The GM Home menu was visually inspected in the synthetic preview: Kurti has no Neu badge or special tint. No human localhost or production business endpoint was used for agent verification.
- Production release status is tracked separately in the persistent project-context release record; inspect the deployment providers for the live commit and final rollout status.
