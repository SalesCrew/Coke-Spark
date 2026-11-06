# PowerPoint-Berichte aus dem GM-Dashboard

Im Kopf des GM-Dashboards öffnet **Exportieren** die Berichtsvorschau. Sie enthält **Verfügbarkeit** und **Mitbewerb**. Der bestehende Excel-Export ist im selben Dialog weiterhin erreichbar. Die Dashboardkarten und ihre eigenen Filter bleiben erhalten.

## Datenbasis und Filter

Verfügbarkeit übernimmt die Filter der Verfügbarkeitskarte, Mitbewerb jene der Platzierungskarte: Region, GM, einzelne oder mehrere Handelsketten, einzelne oder mehrere Märkte und STC. Es zählen eingereichte, nicht gelöschte Besuche. Zusatz-GMs und als Zusatz-GM-Arbeit gespeicherte Besuche bleiben ausgeschlossen. Der Besuchstag wird in Europe/Vienna ausgewertet. **Stand einschließlich** begrenzt den letzten Zeitraum inklusive dieses Tages; frühere Vergleichszeiträume bleiben vollständig.

Die Zeiträume stammen aus dem hinterlegten RED-Kalender. Verfügbarkeit verwendet einen RED-Monat; Mitbewerb vergleicht bis zu drei RED-Monate oder drei RED-Quartale. Ein RED-Quartal reicht vom Anfang des ersten bis zum Ende des dritten zugehörigen RED-Monats. Diese Auswahl verändert weder RED-Monate noch vorhandene Besuchsdaten.

## Verfügbarkeit

Die Auswertung verwendet dieselbe historische Antwortprüfung wie das Dashboard: Frage- und Kategoriesnapshots, Gültigkeit, bedingte Sichtbarkeit, Handelskettenbezug und die vorhandene Bereinigung doppelter Besuchsfragen. Kategorien sind Cooler, SingleServe, MultiServe, Promos und Warehouse.

Je Kategorie gilt:

- **Top %** = gültige Top-Antworten / alle gültigen Antworten dieser Kategorie × 100.
- **Mediocre %** und **Bad %** werden entsprechend berechnet.
- Fehlende oder ungültige Antworten sind kein Bad und keine Null-Prozent-Beobachtung.
- Anzeige und Datenbeschriftung runden auf ganze Prozentwerte; Diagrammdaten behalten ihre volle Genauigkeit.

Der Überblick trennt unterschiedliche Märkte von Besuchen. Die Marktaufteilung REWE/SPAR/Sonstige verwendet ebenfalls unterschiedliche Märkte. Die Tabellen zeigen Beobachtungen nach Kategorie, Region und einzelner Handelskette. Zusätzliche Regionen oder Handelsketten bekommen eine Fortsetzungsfolie, damit keine Zeilen verloren gehen.

Die Wochenkurven verwenden die ISO-Kalenderwochen innerhalb des ausgewählten RED-Zeitraums. Die Fotoseite enthält bis zu acht Fotos aus tatsächlich eingeschlossenen Verfügbarkeitsantworten derselben Datenbasis. Zunächst werden unterschiedliche Märkte berücksichtigt. Kunden benötigen zusätzlich die bestehende Leseberechtigung für das Fotoarchiv; ohne sie werden weder Fotos noch signierte Foto-URLs geliefert. Fotos behalten ihr Seitenverhältnis und werden mittig in die Vorlagenfelder eingepasst. Nicht ladbare Fotos erhalten einen Platzhalter.

## Mitbewerb: physische Mengen

Bestätigt durch Kilian am 06.11.2026: Die Balken zeigen die **Anzahl physischer Kühler beziehungsweise Großplatzierungen**, keine Bewertungspunkte und keine Anzahl von Märkten.

Pro Markt, Frage und Vergleichszeitraum zählt der zuletzt eingereichte Stand. Mehrere Besuche desselben Marktes addieren dieselbe Bestandsfrage nicht mehrfach. Eine spätere ungültige oder unbeantwortete Beobachtung wird nicht still durch eine ältere Antwort ersetzt.

Eindeutig erfasste numerische Mengen sowie ausdrücklich zugeordnete Angaben wie `Red Bull: 2; Monster: 1` werden ausgewertet. Eine eindeutige Nein-/Nicht-vorhanden-Antwort zählt als null. Ein bloßes Ja, unklare Marken, fehlende Mengen oder Widersprüche sind **nicht** automatisch ein Stück. Betroffene Summen erscheinen als **—**, Diagramme lassen dafür Lücken. Fehlende Mengen werden nicht aus Punkten geschätzt.

**Datenzuordnung** zeigt die ausgewerteten Fragen, Platzierungstyp und Marke. Diese Zuordnung kann für den einzelnen Export geändert oder eine Frage bewusst ausgeschlossen werden. Sie bearbeitet keine gespeicherten Fragen oder Antworten. Bekannte Marken ohne eigene Zeile in der jeweiligen Vorlage werden unter Sonstige zusammengefasst. Die verwendete Zuordnung und Hinweise stehen auch in den Foliennotizen.

## Vorlagen und Dateien

Die Folien folgen den von Denise gelieferten PDFs:

- `2026_Verfügbarkeitsabfrage RED Oktober.pdf`: Titel, Überblick, Tabellen, Wochenkurven und Fotocollage.
- `Abfrage Mitbewerb_Vergleich Q1-Q3_2026.pdf`: vierseitiger Aufbau für Kühler und Großplatzierungen; mit Monatszeiträumen auf ausdrücklichen Wunsch von Kilian.

Format: 960 × 540 pt; Schrift Calibri. Originale Markengrafiken werden wiederverwendet. Zahlen, Texte, Tabellen und Diagramme werden aus der gewählten Datenbasis erzeugt. Fehlerhafte Beispiel-Prozente der Referenz werden nicht übernommen. Die Original-PDFs und deren Fotos werden nicht als Beispieldaten ausgeliefert. Quellenhashes stehen in `public/gm-reports/source.json`.

Die PowerPoint-Dateien enthalten bearbeitbare Tabellen und Diagramme mit eingebetteten Excel-Daten. Die Ausgabe korrigiert unbenutzte Masterdeklarationen und die Nullwert-Serialisierung des verwendeten PPTX-Writers. Echte Nullen bleiben null; fehlende Beobachtungen bleiben leer.

## Betrieb und Prüfung

`POST /admin/gm-dashboard/reports/query` ist eine reine Leseoperation unter der bestehenden Dashboard-Authentifizierung und Seitenberechtigung. Berichtsdaten werden nicht zwischengespeichert. Vor dem Download wird die gleiche Auswahl frisch geladen. Das Feature benötigt keine Datenbankmigration.

Die unabhängige lokale Vorschau verwendet `http://127.0.0.1:3070/admin/gm-dashboard` und die synthetische API auf Port 4070. Anmeldung: `admin@preview.invalid` mit einem beliebigen Passwort; `kunde-no-photos@preview.invalid` demonstriert fehlenden Fotozugriff. Es werden ausschließlich synthetische Besuche in einer flüchtigen PGlite-Datenbank verwendet. Produktionsumgebungsdateien und die regulären Backend-Einstiegspunkte werden dabei nicht geladen.

Gezielte Prüfungen:

```sh
env -i HOME="$HOME" PATH="$HOME/.local/bin:/usr/bin:/bin" node backend/node_modules/tsx/dist/cli.mjs --test tests/gm-report-export.test.ts backend/src/gm-report.integration.test.ts
env -i HOME="$HOME" PATH="$HOME/.local/bin:/usr/bin:/bin" node tests/gm-report-browser.mjs
```

Die Tests prüfen echte API-Abfragen gegen die isolierte Datenbank, Mengen statt Punkten, Mehrfachbesuche, Stichtag, Filter, Zusatz-GM-Ausschluss, unsichtbare Fragen, unveränderte Antworten und Fotos, Fotozugriff und tatsächliche PPTX-Pakete einschließlich eingebetteter Diagrammdaten. Browserprüfungen verwenden Laptopgrößen 1440 × 1000 und 1280 × 800 und sperren externe Verbindungen.

Prüfstand 06.11.2026: 56 gezielte und bestehende Dashboard-Tests erfolgreich, Frontend-Produktionsbuild und Backend-Typprüfung erfolgreich. Die drei Beispiel-Präsentationen wurden strukturell geprüft und vollständig gerendert. Die Browserprüfung umfasst auch übernommene Mehrfachauswahlen bei Handelsketten und den weiterhin funktionierenden Excel-Download.
