# GM Aktionsbriefings

## Ablauf

Unter **GM → Management → Aktionsbriefings** (`/admin/aktionsbriefings`) lädt ein Admin eine PDF hoch, vergibt einen Namen und legt den Anzeigezeitraum **Von / Bis** fest. Beide Daten sind für eine Veröffentlichung erforderlich. Die vorhandenen Kalender, PDF-Vorschau, Entwurfsspeicherung und Veröffentlichungsbestätigung werden wiederverwendet.

Nach der Veröffentlichung sehen **alle GMs** das Dokument im bestehenden Home-Menü unter **Aktionsbriefings**. Mehrere gleichzeitig sichtbare Briefings stehen untereinander. Jedes hat seinen Namen, Zeitraum und den gewählten Espresso-Button zum Öffnen der PDF. Die Funktion verwendet keine Touren, Märkte, Marktgruppen oder Kampagnenzuordnungen. Die Sichtbarkeit ist unabhängig davon, ob eine Durcharbeit bereits läuft, und ermöglicht die Vorbereitung vor einer Aktion.

Die Anzeige gilt einschließlich Start- und Enddatum in **Europe/Vienna**. Zukünftige Veröffentlichungen erscheinen erst ab ihrem Startdatum. Abgelaufene und archivierte Briefings erscheinen nicht im GM-Menü. Eine ältere Version wird nach Ablauf einer neueren Version nicht erneut angezeigt. Bereits offene Apps aktualisieren beim Zurückkehren, bei wiederhergestellter Verbindung und alle zwei Minuten.

Der vorhandene PDF-Reader unterstützt Seitenwechsel, Zoom, Wiederholung bei Ladefehlern und das Öffnen des Originals. Neue Veröffentlichungen haben getrennte Lesestände je GM. Beim Schließen kehrt der Fokus zum geöffneten Briefing im Menü zurück. Leere Listen und Ladefehler haben eigene Zustände mit Wiederholung.

PDFs können im Entwurf ersetzt und als neue Version veröffentlicht werden. Archivierung blendet das Dokument aus; Wiederherstellung aktiviert dieselbe gültige Veröffentlichung wieder. Frühere Veröffentlichungen, PDFs und Lesestände bleiben erhalten. Wochenschwerpunkte bleiben eine separate Funktion. Die Startansicht eines Marktbesuchs erhält keinen zusätzlichen Briefing-Button.

## Daten und Zugriff

- `gm_action_briefings`: bearbeitbare Entwürfe und Archivstatus.
- `gm_action_briefing_publications`: unveränderliche Veröffentlichungsversionen und Anzeigezeiträume.
- `gm_action_briefing_reads`: gelesene Seiten und Abschlusszeitpunkt je Veröffentlichung und GM.
- Privater Storage-Bucket `gm-action-briefings`, PDF bis 500 MB / 80 Seiten.
- Direkte Tabellen- und Storage-Zugriffe durch anonyme und angemeldete Browserrollen sind gesperrt. Der Backend-Zugriff liefert nach Autorisierung kurzlebige signierte PDF-URLs.
- Admin-API: `/admin/gm-action-briefings` einschließlich Upload, Entwurf, Vorschau, Veröffentlichung, PDF-Ersatz und Archivierung.
- GM-API: `/gm/action-briefings` einschließlich Dateiabruf und seitenweisem Lesestatus.
- Volladministratoren verwalten die Dokumente. Kundenkonten benötigen die separate Seitenberechtigung `aktionsbriefings` mit den vorhandenen Aktionen `read`, `write`, `update`. Worker-Lesezugriff gilt für die GM-Rolle.

## Migration und Release

`backend/supabase/migrations/20261102141400_gm_action_briefings.sql` legt ausschließlich die neuen Tabellen, Indizes, Zugriffssperren, den privaten Bucket und den Schutz unveränderlicher Veröffentlichungen an. Sie verändert keine vorhandenen Besuche, Antworten, Fotos oder WSP-Datensätze.

Release-Reihenfolge: die freigegebene Migration anwenden, danach Backend und Frontend aus demselben Featurestand veröffentlichen. Die Anwendung startet keine automatische Migration. Im bestehenden Bucket-Konfliktfall bricht die Migration ab, statt dessen Einstellungen zu überschreiben.

## Isolierte Prüfung

`test:gm-action-briefings` führt die Action- und WSP-API-Tests gegen eine neue PGlite-Datenbank mit synthetischen Nutzern und PDFs aus. Die Fixture lehnt Produktionsverbindungsvariablen ab. Abgedeckt sind überlappende Veröffentlichungen, Vienna-Tagesgrenzen, Versionen, Archivierung, PDF-Ersatz, getrennte Lesestände, Rollen, Kundenrechte, private Speicherung und WSP-Regressionen.

`backend/tests/gm-action-briefing-preview.ts` startet ausschließlich die echte Briefing-Router-/Service-Implementierung mit dieser Fixture auf `127.0.0.1:4038`. Sie lädt keine Umgebungsdateien, keine App-Startjobs und keine externen Dienste. Ein mit expliziten synthetischen Variablen gebautes Frontend auf `127.0.0.1:3038` verwendet die tatsächlichen App-Seiten.

`tests/gm-action-briefings-browser.mjs` prüft Upload, benannte Veröffentlichung über die Kalender-UI, Anzeige bei zwei GMs, PDF-Seiten, getrennte Lesestände, Rückkehrfokus, Archivierung/Wiederherstellung, Fehlerbehandlung, leere Listen und den bisherigen WSP-Reader. Es verlangt die synthetische API-Kennung und blockiert jeden Browser-Netzwerkzugriff außerhalb dieser zwei lokalen Ports. Admin-Prüfung: Laptopformat. GM-Prüfung: Tablet im Quer- und Hochformat. Die Browserbibliothek wird aus dem lokalen Codex-Runtime geladen; WebKit wird mit `BROWSER_ENGINE=webkit` gewählt. Alternativ kann `PLAYWRIGHT_MODULE_ROOT` auf eine lokale Paketdatei mit Playwright gesetzt werden.

## Verifikation vom 02.11.2026

- Neun API-/Migrations-Tests für Aktionsbriefings und WSP bestanden; ausschließlich disposable PGlite und synthetische PDFs.
- Backend-TypeScript-Build und optimierter Next.js-Produktionsbuild bestanden.
- Der vollständige Browserablauf wurde mit Chromium und WebKit geprüft; Admin auf 1440 × 1000, GM auf 1024 × 768 und 768 × 1024. Beide Browser verwenden dieselben tatsächlichen App-Seiten und die isolierte Service-Implementierung. Das ersetzt keinen Test auf einem physischen iPad.
- Keine Produktionsdatenbank, Produktionsumgebungsdateien oder echten Kundendaten für Entwicklung und Prüfung verwendet.
