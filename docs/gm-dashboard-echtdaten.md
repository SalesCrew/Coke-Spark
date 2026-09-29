# GM-Dashboard: Echtdaten

## Vollständige Produktionsfreigabe und Buildkorrektur (28.09.2026)

- Nutzer stellt klar: die vollständige gebaute Boni-Funktion und das Echtdaten-Dashboard sollen in Produktion verfügbar sein, nicht nur ein Git-Push oder ein lesender Teilumfang.
- Tatsächlicher voriger Deploymentstatus: Railway `5f5b9d5` erfolgreich, Vercel `95ba710` fehlgeschlagen. Buildlog: Backend-Submodule nicht geladen; danach fehlende Workspace-Typinformation/implizites `any` in `BonusOverviewCard`. Frühere lokale Prüfung enthielt den Backend-Checkout und reproduzierte diese Deploymentbedingung nicht.
- Frontend-eigene Dashboard-/Workspace-Typverträge entfernen die Backend-Checkout-Abhängigkeit. Ein Regressionstest vergleicht sie mit den Backend-Verträgen. Produktionsprüfung zusätzlich auf exakt gestagten Dateien ohne Backend-Checkout, ohne `.env`, separat vom laufenden localhost.
- Vollständiger Prämien-Editor, Fragequellenanzeige, Workspace-API, GM-Ergebnisse/Kumulierung und Quartalsbindung werden jetzt mit veröffentlicht. Keine automatische Übernahme/Umdeutung der bestehenden Prämienwelle, keine erfundenen Ziele oder Demonstrationsbeträge.
- Additive vorbereitete Migration `praemien_wave_workspace` auf dem verifizierten Coke-Spark-Projekt `quqefecmqeienxmeueqa` erfolgreich angewendet: vier neue Tabellen, eingeschränkte Zugriffe/RLS und Empfangszeit-Trigger für künftige Abgaben. Kein Backfill, keine Änderung vorhandener Antworten, Besuche, Wellen oder Auszahlungsbeträge. Kurze Sperr-/Statement-Timeouts für die Migration verwendet.
- Backend-Build und isolierte PostgreSQL-/HTTP-Prüfung erfolgreich (22 Tests im exportierten Backend-Prüfstand). Frontend-Zustands-/Layouttests und Vertragsprüfung erfolgreich. Authentifizierte Live-Browserprüfung ist derzeit durch eine geöffnete Chrome-Erweiterungsoberfläche blockiert; keine Browserprüfung fälschlich behaupten.
- Sauberer kompletter Next-Produktionsbuild ohne Backend-Checkout hat zusätzlich bestehende Build-Grenzen offengelegt: backendabhängige Tests wurden mit der Anwendung typgeprüft; die MHD-Route exportierte einen wiederverwendbaren Katalog. Tests bleiben separat ausführbar, sind aber aus dem Produktions-Typecheck ausgeschlossen. Der Katalog wurde unverändert in eine normale Komponentendatei verschoben und MHD/Durcharbeit darauf verwiesen; kein UI-/Logik-Redesign. Danach kompletter Produktionsbuild inklusive 55 Routen und Typecheck erfolgreich; zusätzlicher Regressionstest für diese Grenzen.

## Freigegebener Push-Umfang (28.09.2026)

- Nutzerfreigabe: „ok push that“. Die bisherigen Echtdaten-/Darstellungsänderungen des Dashboards werden gemeinsam veröffentlicht, da die letzten UI-Anpassungen darauf aufbauen. Separate Prämien-Editor-, Fragebogen-, Besuchs- und Exportplanungsänderungen bleiben im Arbeitsverzeichnis.
- Backend-Abhängigkeiten: authentifizierte GM-Dashboard-Leseabfragen und ein eigener `praemien-dashboard-read`-Router mit ausschließlich GET `/status`, `/waves` und `/waves/:id`. Er wird hinter den vorhandenen Prämien-Auth-/Seitenrechten eingebunden. Keine Editor-Mutationsrouten, keine Scheduleränderung und keine Migration enthalten oder ausgeführt. Das vollständige lokal vorbereitete Workspace-Routing bleibt separat uncommitted.
- Fehlende Prämien-Erweiterung ergibt weiterhin `ready: false` und einen echten Einrichtungs-Leerzustand. Das Dashboard aktiviert keine Prämienwelle und erzeugt keine Konfiguration.
- Exakt die gestagten Frontend-/Backend-Dateien in ein separates temporäres Prüfverzeichnis exportiert (ohne `.env` oder lokale Zusatzänderungen). 21 Tests, Frontend-Typecheck und Backend-Produktionsbuild bestanden. Zwei neue Tests belegen fehlende Einrichtung, lesende Wellenabfrage und nicht vorhandene Editor-Mutationsendpunkte. Keine Produktions-Datenbankverbindung für diese Prüfung.

## Saubere Boni-Leerzustände und Ausnahme für Coke-Balken (28.09.2026)

- Nutzerwunsch: keine leeren Prämienbalken/-ringe mit Strichen; die automatische Abstandsregel für den Coke-Platzierungsbalken entfernen. Interpretation in der Rückmeldung ausdrücklich genannt: gemeint ist das automatische Spreizen der Balken, nicht der Zeitraumwähler oder die Auswertungslogik.
- Bonus nach Kategorie und Bonusziel behalten ihre bestehenden Karten/Überschriften. Ohne Daten ersetzen ruhige zentrierte Meldungen die Diagramme: Laden, nicht eingerichtet, keine Welle, keine Auswahl, keine Teilnehmer oder keine Ziele. API-Fehler haben eine eigene Meldung plus lesenden Wiederholungsbutton; Einrichtung fehlt ist kein Ladefehler. Keine technischen Datenbank-/Produktionshinweise mehr in der UI.
- Reale Ergebnisse mit 0 Euro bleiben Ergebnisse und werden nicht als leer behandelt. Entfernt ist die erfundene Liste von vier Zielsäulen als Fallback. Ladezustände für Wellen und Einzelberechnung getrennt; alte Antworten nach Auswahl-/Retry-Wechsel werden ignoriert. Die React-Prüfung berücksichtigt eindeutige Zustände, Status-Ankündigungen und Hook-Bereinigung.
- Coke/Mitbewerber-Balken: feste kompakte 56-px-Gruppenabstände, kurze Serien zentriert statt auf die ganze Breite gespreizt. Lange Serien weiter scrollbar. Leere Randperioden weiterhin rein visuell ausgeblendet; Kalender, Intervallwahl, Gewichtungen, Daten/Export und andere Diagramme unverändert.
- Drei neue Boni-Zustands-/Renderingtests und ein separater kompakter Balkentest. Insgesamt 16 UI-/Layouttests und Frontend-Typecheck bestanden. Kein Browser-Screenshot oder erfolgreiche Browserprüfung behauptet. Keine Datenbankabfrage, Produktionsänderung oder Push.

## Adaptive Höhe der Füllstand-Trends (28.09.2026)

- Nutzerwunsch: Werte um 90 % sollen nicht am oberen Rand einer starren 0–100-Achse zusammengedrängt werden. Nur `FuellstandLineChart` geändert; IPP, Score-Verteilung, horizontale Abstände und übrige Gestaltung bleiben unverändert.
- Y-Achse aus den aktuell horizontal sichtbaren Werten aller weiterhin sichtbaren Kategorien. Je 20 % der beobachteten Spannweite als Randabstand; Beispiel 85–95 % ergibt 83–97 %. Grenzen bei 0/100 %, konstante/einzelne Werte mit nichtleerem Bereich, fehlende Werte ausgeschlossen. Keine Änderung der tatsächlichen Werte oder ihrer Berechnung.
- Beim Scrollen/Gößenwechsel erneute Skalierung; unmittelbar angrenzende Punkte berücksichtigt, damit am Viewport-Rand eintretende Kurven nicht abgeschnitten werden. Die Prozentachse bleibt beim horizontalen Scrollen sichtbar, Linien werden auf die Plotfläche begrenzt. Leere Daten behalten den sicheren 0–100-Fallback.
- Drei neue Tests für 20-%-Rand, Null/100/konstante/leere Werte, Viewport-Ausschnitt und vertikale Vergrößerung. Insgesamt zwölf Layout-/Renderingtests und Frontend-Typecheck bestanden. Keine Datenbankverbindung, keine Produktionsänderung und kein Push.

## Adaptive Diagramm-Abstände (28.09.2026)

- Nutzerwunsch: wenige verfügbare Intervalle sollen die ganze Diagrammbreite nutzen, statt nur die rechte Hälfte zu füllen. Bestehende Gestaltung unverändert.
- Rein visuelle Änderung in IPP-, Füllstand-, Score- und Platzierungsdiagrammen: leere Intervalle vor der ersten bzw. nach der letzten vorhandenen Beobachtung werden nur aus dem Diagramm-Ausschnitt entfernt. Kalender, Auswahl, Exporte und Datenabfragen bleiben vollständig. Echte Nullwerte zählen als Daten, Lücken innerhalb des Datenbereichs bleiben als Lücken erhalten.
- Diagramme messen ihren eigenen Container über ResizeObserver und verteilen die sichtbaren Intervalle gleichmäßig über dessen Breite. Viele Intervalle behalten 56 px Mindestabstand und horizontales Scrollen. Ein einzelner Punkt wird mittig angezeigt; aktive IPP-Vergleiche werden bei der Bestimmung des sichtbaren Bereichs berücksichtigt.
- Größen-/Datenbereichswechsel zentrieren die Auswahl neu. Erste/letzte Achsenbeschriftung bleiben lesbar, auch bei ausgedünnten Beschriftungen langer Serien. Keine Farben, Kartenaufteilung oder Berechnungsregeln verändert.
- Fünf neue Layout-/Renderingtests plus vier bestehende UI-Tests bestanden. Browser-Verbindung erneut nicht verfügbar; keine visuelle Browserprüfung behauptet. Keine Datenbankabfrage, keine Produktionsänderung, kein Push.

## Prüfung der fehlenden RED-Historie (28.09.2026)

- Rückmeldung: IPP und Füllstand zeigen nur RED 07–09; vermutete Begrenzung auf die letzten drei Monate.
- Verifiziert durch `verify-gm-dashboard-history-readonly.ts` in einer expliziten READ ONLY-Transaktion mit geprüftem `transaction_read_only=on`: erster abgeschlossener GM-Besuch am 06.07.2026. Auch ungefiltert über alle Besuchsstatus gibt es keine Abgaben in RED 01–06. Jeweils null Archivzeilen in `ipp_market_redmonth_results`.
- Zum Prüfzeitpunkt: RED 07 = 1.124, RED 08 = 1.418, RED 09 = 1.413 gültige abgeschlossene Besuche. Der vollständige Dashboard-Datenpfad liefert genau dieselben Besuchszahlen; RED 01–06 bleiben `null` für IPP/Füllstand, nicht Nullpunkte. Die Datenbank kann während der Prüfung durch andere Nutzer weiter wachsen.
- Kein nachgewiesener Ladefehler oder Drei-Monats-Cap. Keine künstlichen Ersatzwerte, Rückdatierung, Migration oder Produktionsmutation. Ohne historischen Besuchs-/Antwortdatensatz lässt sich Januar–Juni nicht durch einen Code-Fix ergänzen. Original-UI unverändert.
- Die vorherigen durchgehenden Jahrescharts waren Demo-Daten: Git-HEAD von `IppAuswertungCard` importiert und verwendet `buildMockLineSeries`, `buildMockPieData` und `buildMockPieCumulativeData`; `FuellstandCard` importiert aus `fuellstand-dashboard/mock-data`. Diese Kurven sind kein Nachweis gespeicherter historischer Besuche.
- Neuer isolierter PostgreSQL-/HTTP-Regressionstest über neun Monatsintervalle mit Januar-/April-Daten: ältere Daten erscheinen vollständig, echte Bad-Antwort ergibt 0, leere Intervalle bleiben `null`. Sechs Dashboard-Tests bestanden.

## Korrektur: bestehende Oberfläche beibehalten (28.09.2026)

- Nutzerkorrektur: Datenanschluss ist kein Redesign. Wieder eingebunden sind `IppAuswertungCard`, `FuellstandCard`, `PlatzierungenCard` und `PlaceholderCardNine`. Overlap-Dialog, IPP-Bubbles, getrennte Kühlerinventur, Füllstand-/Score-Charts nebeneinander, Halbkreis-Verteilung, vertikale Aktivitätsbalken und ursprüngliche 1,35/0,65-Spaltenaufteilung bleiben bestehen. Ersatz-Karten und Ersatz-Chart entfernt.
- Datenadapter innerhalb dieser Karten statt neuer Gestaltung. RED nur aus echtem Kalender, ohne zukünftige Intervalle oder errechnete Ersatzperioden. Ein nicht vorhandener Vorjahresvergleich bleibt leer statt still auf den Vormonat zu springen.
- Interne Chart-Verträge nutzen NaN als fehlenden Punkt; Renderer überspringen diese Punkte, unterbrechen Linien und zeigen `—`. Echte Null bleibt ein Punkt. API/Excel bleiben bei `null`. Platzierungsbalken zeigen konfigurierte Punkte, auch negative Werte, keine erfundenen komplementären Prozentwerte.
- Weitere CORS-Fehler kamen von der lokalen Schutzschicht vor dem normalen CORS-Middleware. CORS läuft nun vor allen lokalen Antworten. Authentifizierte Kurti-Layouts bleiben nur im Prozessspeicher, Telemetrie wird mit 204 verworfen. Keine DB-Schreibaktionen, keine Hintergrundjobs.
- Lesender Prämien-Endpunkt `/workspace/status` erkennt fehlende Erweiterung mit 200, ohne fehlende Tabellen abzufragen. Boni behalten ihre beiden ursprünglichen Chart-Flächen mit `—` und Statusmeldung. Das aktiviert keine Boni-Berechnung: Erweiterung fehlt weiterhin und wurde nicht in Produktion angewendet.
- Vier neue Layout-/Rendering-/Adaptertests, zwei lokale CORS-/Schutz-/Status-Tests und fünf bestehende Dashboard-Tests bestanden. Frontend-Typecheck und Backend-Build bestanden. Browser-Verbindung weiterhin nicht verfügbar: keine authentifizierte visuelle Prüfung behauptet. Keine Produktionsdaten verändert, kein Push.

## Festgelegte Entscheidungen (28.09.2026)

- Nur lesende APIs. Keine Produktionsdaten werden geändert; lokale Tests ausschließlich in PGlite ohne .env, Auth-Verbindung oder Jobs.
- Platzierungen und Mitbewerber verwenden hinterlegte Antwortgewichte (Ja → 2 zeigt 2 Punkte), Zahlenfragen den konfigurierten `__value__`-Faktor. Keine erfundenen Stückzahlen oder komplementären Prozente. Negative konfigurierte Platzierungspunkte bleiben erhalten.
- Füllstand: alle gültigen Besuchsbeobachtungen je Intervall, nicht nur der letzte Marktstand. Top=100, Mediocre=50, Bad=0; links arithmetischer Durchschnitt, rechts Prozentverteilung. Ein Top und ein Bad ergibt 50, nicht 100. Gleiche Frage in mehreren Besuchsbereichen zählt einmal je Besuch.
- IPP bleibt marktbezogen: letzte bewertete Antwort je Markt/Frage im Intervall, positive Marktwerte gemittelt wie in der bestehenden IPP-Auswertung. Ungefilterte/GM-gefilterte RED-Werte nutzen die bestehende effektive IPP-Auswertung einschließlich Archiv und manueller GM-Korrekturen. Bei Markt/Ketten/Regionsfiltern werden die gefilterten Antworten neu ausgewertet, ohne pauschale GM-Korrekturen herunterzubrechen.
- Wochen schließen Samstag und Sonntag ein. Intervalle und Datumsgrenzen in Europe/Vienna, Enddatum inklusive. RED nur aus dem hinterlegten Kalender; keine geschätzten Vierwochenperioden. Aktuelles Intervall als Startauswahl, keine Zukunftswerte.
- Leer bedeutet keine Daten, nicht Null. Tatsächliche Bad-Antworten und konfigurierte Nullpunkte bleiben echte Nullwerte. Kein Demo-Fallback bei API-/Berechtigungsfehlern.
- Fortschrittsanzeige benennt ausdrücklich beantwortete Füllstandsabfragen in abgeschlossenen Besuchen. Sie behauptet keine Plan-/Marktabdeckung; hierfür fehlen noch definierte Sollregeln.
- Aktivität zählt abgeschlossene, nicht gelöschte Besuchssitzungen einmal. Standard/Flex-Überschneidungen separat als „beide“, weitere Bereiche als „andere“. RED-Anteil = Besuche mit gültiger beantworteter RED-Frage / alle Besuche. Dauer aus Start/Ende, ungültige Dauern ausgeschlossen.
- GM-Filter bezieht sich auf tatsächlichen Besucher, nicht heutige Marktzuweisung. Historische inaktive GMs bleiben sichtbar. Markt/Kette/Region stammen aus aktuellen Stammdaten; historische Marktstammdaten-Snapshots existieren hier nicht.
- STC bleibt als Auswahl vorhanden, wird noch NICHT angewendet. Sichtbarer Hinweis statt erfundener Gold/Silver/Bronze-Zuordnung; fachliche Intervalle liefert Kilian später.
- Boni aus dem bereits gebauten Prämien-Workspace, quartals-/wellenbezogen, echte Teilnehmer und dynamische Säulen. Entwurf/Vorschau/Abschluss klar erkennbar. Falls die Erweiterung nicht eingerichtet ist, Fehler/Leerzustand, keine Demo-Beträge.
- Excel exportiert dieselben geladenen Zahlen, Filter, gewählten Intervalle und Füllstand-Kategorie wie die sichtbaren Karten. Keine versteckten Mockdaten.
- Laufende Intervalle werden nur bis heute ausgewertet. Wochen nutzen das ISO-Wochenjahr; der Vorjahresvergleich für RED sucht dasselbe hinterlegte RED-Intervall im Vorjahr, nicht pauschal zwölf Positionen zurück.
- YTD ist der Durchschnitt der vorhandenen IPP-Intervallwerte mit Startdatum im aktuellen Kalenderjahr. Leerintervalle gehen nicht als Null ein. Eine jahrübergreifende RED-Periode zählt zum Jahr ihres Startdatums.
- Die Gesamt-RED-IPP-Auswertung gewichtet effektive GM-Werte nach ihrer Anzahl bewerteter Märkte; manuelle GM-Korrekturen und eingefrorene Werte werden nicht durch eine neue Rohdatenformel ersetzt.
- Die API-Abfrage ist ein lesendes POST mit begrenztem Zeitraum und validierten Filtern: längere Wochenachsen passen damit nicht in unnötig lange GET-URLs. Die Antwort enthält aggregierte Zahlen, keine einzelnen Antworten oder Zugangsdaten.

## Fortschritt

- [x] Datenvertrag, lesende SQL-Abfragen, vorhandene Auth/Seitenrechte und echte IPP-Anbindung.
- [x] UI, Filter/Vergleich, leere Intervalle, Boni und Export.
- [x] Isolierter API-/DB-Test, Browserprüfung, Typprüfung/Backend-Build.
- [x] Übergabe mit localhost-Link; kein Push und keine Prod-Migration.

## Nachweise und lokale Vorschau

- 24 Tests grün: Dashboard-SQL/HTTP auf echtem lokalem PostgreSQL (PGlite), Datumsgrenzen, Filter, alte/inaktive GMs, gültige/ungültige Antworten, Entduplizierung, Null gegenüber fehlend, positive und negative Gewichte sowie bestehende Prämienfunktionen.
- Über 1.000 Märkte im Filtertest: keine unbemerkte REST-Paginierungsgrenze.
- Frontend-Typprüfung `npx tsc --noEmit` und Backend-Produktionsbuild erfolgreich.
- Browser: kompletter lokaler Admin-Einstieg, 50/25/25 bei vier Beobachtungen, GM-Filter 50/50/0 bei zwei Beobachtungen, unbeantwortete Kategorien leer, Wochenmodus, IPP-Vergleich, tatsächliche Prämienwelle und Excel-Download geprüft. Keine horizontale Seitenüberbreite; Diagramme und Intervalle haben eigene Scrollbereiche.
- Gespeicherten Excel-Export gelesen: Füllstand 62,5 und Split 50/25/25, Coke 2 und Mitbewerber 3, sechs Jahresbesuche mit 45 Minuten Durchschnitt, echte lokale Prämienergebnisse und Filterauswahl stimmen überein. Die Tabellen-Skill wurde für diese Kontrolle verwendet; keine zusätzliche Arbeitsmappe erstellt.
- ESLint konnte wegen der fehlenden Flat-Config des bestehenden Projekts nicht laufen. Kein globales Lint-Setup geändert.
- Lokaler Einstieg: `http://localhost:3017/dev/gm-dashboard-fixture`, Button „Lokale Admin-Vorschau öffnen“.
- Frontend 3017 nutzt ausschließlich das separate Backend 4017. Dieses startet mit `node --import tsx src/scripts/praemien-local-preview.ts` im Backend-Verzeichnis und öffnet nur eine In-Memory-Datenbank ohne `.env`, Supabase-Verbindung oder Hintergrundjobs.
- Die Anwendung ist auf echte gespeicherte App-Daten verdrahtet; die lokale Vorschau verwendet ausdrücklich synthetische Datensätze. Produktionsdaten, Produktionsmigrationen und Deployment wurden nicht verändert. Die Einrichtung der bestehenden Prämien-Erweiterung bleibt ein separater späterer Deployment-Schritt.

## Offen

STC-Intervalle und Zuordnung liefert Kilian später. Die Auswahl hat bis dahin ausdrücklich keine Wirkung auf die Zahlen. Für diese Aufgabe gibt es keine weitere blockierende Fachfrage.

## Normaler localhost: Laufzeitkorrektur (28.09.2026)

- Rückmeldung: Auf Port 3000 neue UI, aber 404 für `/admin/gm-dashboard/facets`, `/admin/gm-dashboard/query` und `/admin/praemien/workspace/waves` auf Port 4000.
- Ursache: Port 4000 lief als einmal gestarteter `createApp()`-Prozess ohne Watcher. Neue Routen waren in diesem älteren Prozess nicht geladen; die separate Vorschau auf 3017/4017 war davon nicht betroffen.
- Port 4000 neu mit `npm run dev:readonly` gestartet. Aktueller App-Code, keine Scheduler, mutierende API-Aufrufe blockiert. Normale Authentifizierung bleibt erhalten. Dies ist ein API-Lesemodus, keine globale Änderung der Datenbank oder ihrer Berechtigungen.
- Direktes Verifizieren der aktuellen SQL-Abfragen mit `node --import tsx src/scripts/verify-gm-dashboard-readonly.ts` ausschließlich innerhalb einer expliziten READ ONLY-Transaktion. Connection-Startparameter werden vom verwendeten Pooler nicht zuverlässig erhalten und wurden daher nicht als Schutz vorausgesetzt.
- Ergebnis: 6.849 Marktfilter, 16 GMs, September bis 28.09.2026 mit 1.348 abgeschlossenen Besuchen, gültigen Füllstandsbeobachtungen und hinterlegten Gewichtungen. Keine Daten verändert.
- Vorhandene Datenbank hat `praemien_wave_settings` noch nicht: Boni können erst nach bewusst freigegebener Einrichtung dieser vorbereiteten Erweiterung auf dieser Datenbank live berechnet werden. Keine Prod-Migration durchgeführt. Isolierte Prämienvorschau 3017/4017 bleibt verfügbar.
- Browsersteuerung war in diesem Folgeturn durch eine fehlende vertrauenswürdige Browser-Verbindung gesperrt. Daher keine authentifizierte visuelle Prüfung auf Port 3000 behauptet; Datenabfragen, HTTP-Erreichbarkeit und Schreibblockade direkt geprüft. Bestehende Seite muss vollständig neu geladen werden, um die alten Fehlerzustände zu verwerfen.

## Datenabhängiger Filterbeginn (29.09.2026)

- Gemeinsame Datumsuntergrenze für das Admin-GM-Dashboard: erster abgeschlossener, nicht gelöschter Besuch mit vorhandenem Markt, minus genau ein Kalendertag Puffer. Vienna-Datum aus `submitted_at`, nicht Import-/Erstellungsdatum. Zukunftsdaten bestimmen die Untergrenze nicht.
- `/facets` liefert `firstEntryDate` mit einem indexfreundlichen, lesenden `ORDER BY submitted_at LIMIT 1`. Keine Migration, keine Datenänderung. Alle Karten verwenden dieselbe Grenze, unabhängig vom aktuell gewählten Zeitmodus oder Chart-Viewport.
- Wochen/Monate/Quartale/RED vor der Grenze verschwinden aus den Filtern. Ein überlappendes Intervall bleibt mit gekürztem Start erhalten; technische IDs/Periodenzuordnung unverändert. Lücken innerhalb der verfügbaren Geschichte und echte Nullwerte bleiben sichtbar. Ohne Daten bzw. beim Laden keine erfundene Vergangenheit.
- Aktivität begrenzt ihre Jahres-/Monats-/Benutzerabfragen ebenfalls; der Datumskalender sperrt Tage vor der Grenze und nach heute. Bestehende Gestaltung und Auswertungsformeln bleiben unverändert.
- 30 lokale Tests bestanden: Kalendertag-Puffer (DST/Schaltjahr/Jahreswechsel), alle Zeitmodi, Filter-Rendering, unveränderte IDs/interne Lücken, Datenleere und tatsächlicher HTTP-/PostgreSQL-Datenpfad sowie bestehende UI-/Chart-/Boni-/Vertragstests. Frontend-Typecheck und Backend-Build bestanden. Separate `tests/tsconfig.json` hält JSX-Tests ausführbar, obwohl sie aus dem Produktionsbuild ausgeschlossen sind. Auswahl bleibt während Filterdaten-Refresh erhalten. Keine Browserprüfung behauptet; Testlauf isoliert ohne Produktionszugriff.
- Produktivfreigabe durch den Nutzer: Backend zuerst, dann Frontend; keine Migration und keine Änderung bestehender Geschäftsdaten.
