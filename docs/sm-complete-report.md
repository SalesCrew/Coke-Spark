# SM-Komplettauswertung

Im SM-Arbeitsbereich **Fragebogen-Management** öffnen, Besuchszeitraum und vorhandene Filter wählen und oben rechts **Komplettauswertung** anklicken. Für Standardbesuche den Fragebogentyp **Standard** auswählen. Der Fragenkatalog-Export im Fragebogen-Editor bleibt unverändert.

Die Excel-Datei enthält:

- **Besuche**: jede abgeschlossene Abgabe als eigene Zeile mit Datum, SM, Markt, Adresse, Beginn, Ende, Ist-/Fahrtzeit, Fragebogen und Version; jede Frage mit Antwort und Kommentar in eigenen Spalten.
- **Antwortdetails**: jede gespeicherte Besuchsfrage einschließlich Modul, Status, Zeit, Name der beantwortenden Person und Punkten. Nicht beantwortet, nicht anwendbar und nicht zum Besuch gehörend bleiben unterscheidbar.
- **Fotos**: Dateiangaben und geschützter Link zum zugehörigen Fragebogen. Ein Klick auf „In der App öffnen“ führt zum passenden Fragebogen; keine eingebetteten Bilddateien. Technische IDs und URLs bleiben in der sichtbaren Tabelle ausgeblendet.
- **Exportinfo**: Erstellungszeit, lesbare Filternamen und Umfang.

Technische IDs, Frage-Codes und JSON-Rohdaten werden nicht als Spalten ausgegeben. Mitarbeiter und Filter erscheinen mit Namen; Links haben verständliche Beschriftungen.

Alle Treffer der bestehenden Filter werden exportiert, unabhängig von der angezeigten Listenseite. Zeitangaben verwenden Europe/Vienna. Der Export verwendet gespeicherte Frage-/Namenssnapshots und aktuelle Antwortversionen, keinen veränderlichen Autorenkatalog. Historische Antwortrevisionen bleiben im bestehenden Verlauf verfügbar. Widersprüchliche kompatible Frageversionen werden ausdrücklich ausgewiesen; eigenständige Fragen mit gleichen Titeln bleiben getrennt.

## Umsetzung und Schutz

`GET /admin/sm-activity/completed/report` verwendet dieselben Rollen, Leserechte und Filter wie die bestehende Liste. Die Abfrage läuft in einer konsistenten, ausschließlich lesenden Transaktion. Kein Schema- oder Datenumbau erforderlich. Vorhandene Besuche, Antworten, Fotos und Versionen werden nicht verändert.

Grenzen: maximal 93 Besuchstage, 3.000 Besuche, 100.000 Fragen, 20.000 Fotoangaben und zwei Millionen Excel-Zellen. Größere Auswahlen oder unzulässig lange Excel-Zellen führen zu einer verständlichen Fehlermeldung, nicht zu einer gekürzten Datei. Ein Filter-/Kontowechsel verhindert die Ausgabe einer veralteten Datei. Leere Auswahl, Ladezustand, Fehler und Wiederholung sind in die vorhandenen Statusmeldungen integriert.

Die Integration folgt dem bestehenden Admin-Header und den SM-Durcharbeit-Exporten; der Exportablauf von MarsPets+ wurde ebenfalls zum Vergleich geprüft. Es wurden keine zusätzlichen Filter, Seiten oder Dialoge eingeführt.

## Isolierte Prüfung

Keine Produktions-Umgebungsdateien laden. Die Backend-Tests erzeugen eine frische PGlite-Datenbank und ersetzen DB, Auth und Storage vollständig.

- Backend: `env -i PATH="$PATH" HOME="$HOME" ./node_modules/.bin/tsx --test src/sm-management.integration.test.ts`
- Excel und Durcharbeit-Regression (Frontend-Verzeichnis): `env -i PATH="$PATH" HOME="$HOME" ./backend/node_modules/.bin/tsx --test tests/sm-management-report-export.test.ts tests/sm-SMDurcharbeit-report-export.test.ts tests/sm-SMDurcharbeit-export.integration.test.ts`
- Für Browserprüfungen den Backend-Test mit `SM_REPORT_BROWSER_FIXTURE=1` starten. Ausschließlich synthetische Daten; API auf 127.0.0.1:4062. Der normale App-Server wird nicht gestartet.
- Das Frontend aus einem Checkout ohne Umgebungsdateien mit `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4062` auf 127.0.0.1:3062 starten. Danach `node tests/sm-management-report-browser.mjs`.

Der Browser-Test prüft den echten App-/HTTP-/Excel-Ablauf mit 105 Besuchen über mehrere Listenseiten, alle Antwortarten, Nullwerte, Kommentare, Fotoangaben, Filter, Fehler/Wiederholung sowie Abbruch bei Filter-/Kontowechsel. Er akzeptiert ausschließlich die bestätigte synthetische API und blockiert andere Netzwerkziele. Produktionsverbundene Ports 3000/4000 und die unabhängige Vorschau 3037/4037 werden nicht verwendet.

## Produktionsrelease · 12.11.2026

Der Release baut auf Frontend `c0a641e74f0acd7ce036c2c1093ff7dd2c1b3baa` und Backend `f2b54d34088b7363b0b19088f909558edb0123da` auf. Die bereits veröffentlichten ergebnisbasierten SM-Dashboard-Filter bleiben erhalten. Enthalten ist außerdem die gewünschte Beschriftung „Nach ganz oder teilweise Behebung“ im SM-Dashboard und dessen Export.

Backend-Release: `5579f82d231a56b42d9036fac750046189c80367`. Produktionsziele: `SalesCrew/Spark-Backend:master`, Railway-Projekt `52e48407-7116-44f8-94a7-f0123891881e`, Service `5214a3c7-67fd-4422-8141-3ccd98c80fff`, Umgebung `28d539cb-a359-4f9a-89f5-75fc347f4133`; anschließend `SalesCrew/Coke-Spark:master`, Vercel-Projekt `prj_YjiNsxSXnWDMBJ7E8UXeyRY2mmWc`, bestehende Domain `coke-spark.vercel.app`.

Backend-Produktionsbuild und optimierter Next.js-Webpack-Build wurden ohne Produktions-Umgebungsdateien erfolgreich geprüft. Die gezielte Release-Prüfung umfasst 33 Backend-Tests und 14 Excel-/Durcharbeit-Tests, jeweils ausschließlich mit synthetischen Daten. Der Browser-Ablauf mit 105 Besuchen prüft den echten Download, lesbare Namen und Links ohne sichtbare ID-/JSON-Spalten sowie Fehler/Wiederholung und Filter-/Kontowechsel.

Die Deploymentbestätigung erfolgt anhand der exakten Git-Commits und Hosting-Statusmeldungen. Keine Produktions-Datenbankabfragen, App-Smoke-Tests, Migrationen, Imports oder Datenkorrekturen. Vorhandene historische Antworten und Fotos werden weder geändert noch neu interpretiert.
