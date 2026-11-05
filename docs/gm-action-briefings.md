# GM Aktionsbriefings

## Ablauf

Unter **GM → Management → Aktionsbriefings** (`/admin/aktionsbriefings`) lädt ein Admin eine PDF hoch und vergibt einen Namen. Zwei unabhängige Zeiträume werden über die vorhandenen Kalender eingestellt:

- **Aktionszeitraum · Beginn / Ende:** wann die Aktion stattfindet. Diesen Zeitraum sehen GMs im Menü und im PDF-Reader.
- **Sichtbarkeit · Von / Bis:** wann das Briefing im GM-Menü erscheint. Die Sichtbarkeit kann vor dem Aktionsbeginn starten, damit GMs sich vorbereiten können.

Für eine Veröffentlichung sind alle vier Daten erforderlich; das jeweilige Ende darf nicht vor dem Beginn liegen. Unvollständige Angaben können als Entwurf gespeichert werden. Die Dokumentliste und Veröffentlichungshistorie zeigen beide Zeiträume. Änderungen am Entwurf wirken sich erst mit einer neuen Veröffentlichung auf die GM-Fassung aus. PDF-Vorschau, Entwurfsspeicherung und Veröffentlichungsbestätigung werden wiederverwendet.

Nach der Veröffentlichung sehen **alle GMs** das Dokument im bestehenden Home-Menü unter **Aktionsbriefings**. Mehrere gleichzeitig sichtbare Briefings stehen untereinander. Jedes hat seinen Namen, Zeitraum und den gewählten Espresso-Button zum Öffnen der PDF. Die Funktion verwendet keine Touren, Märkte, Marktgruppen oder Kampagnenzuordnungen. Die Sichtbarkeit ist unabhängig davon, ob eine Durcharbeit bereits läuft, und ermöglicht die Vorbereitung vor einer Aktion.

Die Anzeige gilt einschließlich der Sichtbarkeitsdaten in **Europe/Vienna**. Zukünftige Veröffentlichungen erscheinen erst ab ihrem Sichtbarkeitsbeginn, unabhängig vom Aktionsbeginn. Abgelaufene und archivierte Briefings erscheinen nicht im GM-Menü. Eine ältere Version wird nach Ablauf einer neueren Version nicht erneut angezeigt. Bereits offene Apps aktualisieren beim Zurückkehren, bei wiederhergestellter Verbindung und alle zwei Minuten.

Bei älteren Veröffentlichungen ohne Aktionsdaten steht **„Aktionszeitraum noch nicht hinterlegt“**. Der bisherige Sichtbarkeitszeitraum und der PDF-Zugriff bleiben erhalten. Es werden keine Aktionsdaten aus der Sichtbarkeit abgeleitet. Ein Admin kann die Daten im Entwurf ergänzen und eine neue Fassung veröffentlichen.

Der vorhandene PDF-Reader unterstützt Seitenwechsel, Zoom, Wiederholung bei Ladefehlern und das Öffnen des Originals. Neue Veröffentlichungen haben getrennte Lesestände je GM. Beim Schließen kehrt der Fokus zum geöffneten Briefing im Menü zurück. Leere Listen und Ladefehler haben eigene Zustände mit Wiederholung.

PDFs können im Entwurf ersetzt und als neue Version veröffentlicht werden. Archivierung blendet das Dokument aus; Wiederherstellung aktiviert dieselbe gültige Veröffentlichung wieder. Frühere Veröffentlichungen, PDFs und Lesestände bleiben erhalten. Wochenschwerpunkte bleiben eine separate Funktion. Die Startansicht eines Marktbesuchs erhält keinen zusätzlichen Briefing-Button.

## Daten und Zugriff

- `gm_action_briefings`: bearbeitbare Entwürfe, nullable `action_from` / `action_until` und Archivstatus.
- `gm_action_briefing_publications`: unveränderliche Veröffentlichungsversionen und Anzeigezeiträume. Die Aktionsdaten stehen je Version im vorhandenen JSON-Snapshot; frühere Snapshots werden nicht umgeschrieben.
- `gm_action_briefing_reads`: gelesene Seiten und Abschlusszeitpunkt je Veröffentlichung und GM.
- Privater Storage-Bucket `gm-action-briefings`, PDF bis 500 MB / 80 Seiten.
- Direkte Tabellen- und Storage-Zugriffe durch anonyme und angemeldete Browserrollen sind gesperrt. Der Backend-Zugriff liefert nach Autorisierung kurzlebige signierte PDF-URLs.
- Admin-API: `/admin/gm-action-briefings` einschließlich Upload, Entwurf, Vorschau, Veröffentlichung, PDF-Ersatz und Archivierung.
- GM-API: `/gm/action-briefings` einschließlich Dateiabruf und seitenweisem Lesestatus.
- Volladministratoren verwalten die Dokumente. Kundenkonten benötigen die separate Seitenberechtigung `aktionsbriefings` mit den vorhandenen Aktionen `read`, `write`, `update`. Worker-Lesezugriff gilt für die GM-Rolle.

## Migration und Release

`backend/supabase/migrations/20261102141400_gm_action_briefings.sql` legt ausschließlich die neuen Tabellen, Indizes, Zugriffssperren, den privaten Bucket und den Schutz unveränderlicher Veröffentlichungen an. Sie verändert keine vorhandenen Besuche, Antworten, Fotos oder WSP-Datensätze.

`backend/supabase/migrations/20261105141824_gm_action_briefing_action_dates.sql` ergänzt ausschließlich zwei nullable Datumsspalten am Entwurf und eine Prüfung ihrer Reihenfolge. Vorhandene Zeilen behalten unbekannte Aktionsdaten. Veröffentlichungen, PDFs und Lesestände werden nicht verändert. Die bestehenden Zugriffsregeln gelten weiter. Ein Lock-Timeout von drei Sekunden begrenzt das Warten auf die Tabellensperre; die Migration läuft als Transaktion.

Release-Reihenfolge: die freigegebene Migration anwenden, danach Backend und Frontend aus demselben Featurestand veröffentlichen. Die Anwendung startet keine automatische Migration. Im bestehenden Bucket-Konfliktfall bricht die Migration ab, statt dessen Einstellungen zu überschreiben.

## Isolierte Prüfung

`test:gm-action-briefings` führt die Action- und WSP-API-Tests gegen eine neue PGlite-Datenbank mit synthetischen Nutzern und PDFs aus. Die Fixture lehnt Produktionsverbindungsvariablen ab. Abgedeckt sind überlappende Veröffentlichungen, Vienna-Tagesgrenzen, Versionen, Archivierung, PDF-Ersatz, getrennte Lesestände, Rollen, Kundenrechte, private Speicherung und WSP-Regressionen.

`backend/tests/gm-action-briefing-preview.ts` startet ausschließlich die echte Briefing-Router-/Service-Implementierung mit dieser Fixture. Sie lädt keine Umgebungsdateien, keine App-Startjobs und keine externen Dienste. Ein mit expliziten synthetischen Variablen gebautes Frontend verwendet die tatsächlichen App-Seiten. Die isolierten Loopback-Adressen werden über `ACTION_BRIEFING_API_ORIGIN` und `ACTION_BRIEFING_WEB_ORIGIN` gewählt (Standard: `4038` / `3038`; Prüfung vom 05.11.: `4068` / `3068`). Der Browserablauf lehnt die für die menschliche Produktionsnutzung reservierten Ports `3000` / `4000` ab.

`tests/gm-action-briefings-browser.mjs` prüft Upload, benannte Veröffentlichung über die Kalender-UI, Anzeige bei zwei GMs, PDF-Seiten, getrennte Lesestände, Rückkehrfokus, Archivierung/Wiederherstellung, Fehlerbehandlung, leere Listen und den bisherigen WSP-Reader. Es verlangt die synthetische API-Kennung und blockiert jeden Browser-Netzwerkzugriff außerhalb dieser zwei lokalen Ports. Admin-Prüfung: Laptopformat. GM-Prüfung: Tablet im Quer- und Hochformat. Die Browserbibliothek wird aus dem lokalen Codex-Runtime geladen; WebKit wird mit `BROWSER_ENGINE=webkit` gewählt. Alternativ kann `PLAYWRIGHT_MODULE_ROOT` auf eine lokale Paketdatei mit Playwright gesetzt werden.

## Verifikation vom 05.11.2026

- Zwölf API-/Migrations-Tests für Aktionsbriefings und WSP bestanden. Dazu gehören getrennte Aktions- und Sichtbarkeitsdaten, Vorbereitung vor Aktionsbeginn, unvollständige Entwürfe, Veröffentlichungsvalidierung, einzelne Aktionstage, erneute Veröffentlichung und Migration bereits vorhandener Veröffentlichungen mit unveränderten PDFs und Leseständen.
- Backend-TypeScript-Build, Frontend-Typprüfung und optimierter Next.js-Produktionsbuild bestanden.
- Vollständiger Browserablauf mit allen vier vorhandenen Kalendern in Chromium und WebKit bestanden; Admin auf 1440 × 1000, GM auf 1024 × 768 und 768 × 1024. Keine Browser-Laufzeitfehler oder externen Netzwerkzugriffe. Das ersetzt keinen Test auf einem physischen iPad.
- Ausschließlich disposable PGlite, synthetische Nutzer/PDFs und die unabhängige Vorschau `3068` / `4068` verwendet. Keine Produktionsverbindungen oder Produktionsumgebungsdateien verwendet.

## Verifikation vom 02.11.2026

- Neun API-/Migrations-Tests für Aktionsbriefings und WSP bestanden; ausschließlich disposable PGlite und synthetische PDFs.
- Backend-TypeScript-Build und optimierter Next.js-Produktionsbuild bestanden.
- Der vollständige Browserablauf wurde mit Chromium und WebKit geprüft; Admin auf 1440 × 1000, GM auf 1024 × 768 und 768 × 1024. Beide Browser verwenden dieselben tatsächlichen App-Seiten und die isolierte Service-Implementierung. Das ersetzt keinen Test auf einem physischen iPad.
- Keine Produktionsdatenbank, Produktionsumgebungsdateien oder echten Kundendaten für Entwicklung und Prüfung verwendet.
