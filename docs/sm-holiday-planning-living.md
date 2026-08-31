# SM-Verplanung — österreichische Feiertage

Stand 31.08.2026. Nur SM; GM-Daten und GM-Planung bleiben unverändert.

## Regeln und Gegenprobe

- Grundlage: die 13 bundesweiten gesetzlichen Feiertage, nicht Schulferien oder regionale Schutzpatronstage. Quellen: [Stadt Wien](https://www.wien.gv.at/inhalt/feiertage), [RIS](https://www.ris.bka.gv.at/eli/bgbl/1957/153/A1P1/NOR40213432). Neun feste Daten; Ostermontag, Christi Himmelfahrt, Pfingstmontag und Fronleichnam werden aus dem gregorianischen Osterdatum berechnet. Keine Feiertags-API zur Laufzeit; mindestens zehn Jahre Vorschau, auch danach berechenbar. Gesetzesänderungen brauchen eine Regelaktualisierung.
- Beim Erstellen eines Einzeltermins oder einer Serie wird jeder betroffene heutige/zukünftige, noch nicht gestartete Einsatz atomar verschoben. Ursprungsdatum, Serien-Schlüssel, Serienversion, SM, Markt und Sollzeit bleiben erhalten. Nur `replacement_work_date` und ein nachvollziehbares SM-Ereignis ändern sich.
- Dienstag–Donnerstag: den vorherigen und nächsten zulässigen Werktag vergleichen; weniger **effektive Sollminuten desselben SM** gewinnt. Bei Gleichstand nach vorne, also auf das spätere Datum. Montag nur nach vorne, Freitag grundsätzlich zurück. Ausnahme: Ist der Freitag bereits heute und der vorherige Werktag damit Vergangenheit, wird der nächste zulässige Werktag gewählt. Wochenend-Feiertage: angrenzende Werktage vergleichen. Zusätzliche Feiertage und Wochenenden werden übersprungen. Keine automatische Rückdatierung vor heute.
- Bereits vergebene Sollzeit zählt unabhängig vom UI-Filter; abgesagte, verpasste und gelöschte Einsätze zählen nicht. Innerhalb eines Batches wird jede Verschiebung sofort in der Lastberechnung berücksichtigt. Die Reihenfolge ist stabil nach Datum, Erstellungszeit, UUID. Kein nachträgliches Hin-und-her bei späteren Laständerungen.
- Manuelles Verschieben hat Vorrang, auch auf einen Feiertag (mit sichtbarem Hinweis). Eine automatische Nachprüfung überschreibt keine manuelle Datumsentscheidung. Andere Termin-/Serienänderungen ändern nicht rückwirkend die gewählte Feiertagsverschiebung.
- Wiederherstellen eines abgesagten, bislang nicht manuell datierten Feiertags-Einsatzes führt ebenfalls die Regel aus. Vergangene, laufende, abgeschlossene, verpasste, abgesagte oder gelöschte Zeilen werden bei Bestandskorrekturen nicht angefasst.
- Feiertagsname und ursprüngliches/neues Datum sind im Kalender und Einsatzdetail sichtbar. Der ursprüngliche Feiertag bleibt auch bei null Einsätzen als farbiger Tages-Collapse sichtbar. Eine kompakte aufklappbare Feiertagskarte zeigt zehn Jahre und erklärt die Regel.

## Architektur / Produktionssicherheit

Bestehende `sm_assignments` und append-only `sm_assignment_events` reichen aus. Kein neues Schema, keine GM-Migration. Feiertagsmetadaten stehen im `after_state.holidayAdjustment` des Verschiebe-Ereignisses; manuelle Datumsentscheidungen werden separat markiert. Dieselbe SM-Planungstransaktionssperre wie bei Marktdeaktivierung verhindert konkurrierende Lastberechnungen. Externe Aufrufe finden nicht unter dieser Sperre statt.

Bestandsprüfung ist ein expliziter Admin-POST/CLI-Schritt (GET bleibt lesend). Vor Änderungen erst Dry-run; bekannte Produktionslage: drei offene zukünftige/heutige SM-Einsätze am 31.08.2026, also kein Feiertag. Keine rückwirkende Bearbeitung abgeschlossener Fragebögen.

## Geplante Nachweise

- Amtliche Termine 2026–2028; mindestens 2026–2036, Ostern/Jahreswechsel/Schaltjahr.
- Montag→Dienstag, Freitag→Donnerstag, Dienstag mit Mo 2h/Mi 6h→Montag, Gleichstand→Mittwoch; abgesagte Last zählt nicht; mehrere Einsätze werden nacheinander verteilt.
- Weihnachten + Stephanstag, Feiertag am Wochenende, keine Rückdatierung; Einzeltermin und genau eine Serien-Ausnahme; Wiederholung idempotent; manuelle Änderung bleibt bestehen.
- Echte zurückgerollte SM-DB/API-Tests: ursprüngliche Identität und Serie unverändert, effektive Daten in Admin und Phone gleich, Prüf-/Änderungsaufrufe ohne GM-Schreibvorgänge.
- Frontend-/Backend-Build, gerenderte UI-/Regressionsprüfungen, Browserprüfung soweit lokal verfügbar.

## Fortschritt

- [x] Bestand und offizielle Feiertage geprüft; Regeln/Gegenproben dokumentiert.
- [x] Feiertagsberechnung und Backend-Integration.
- [x] Kalenderkennzeichnung, Feiertagskarte und Phone-Hinweise.
- [x] Tests und abschließender Anforderungsaudit.

## Abschlussprüfung 31.08.2026

- Frontend-Produktionsbuild und Backend-TypeScript-Build erfolgreich.
- 34 Frontend-Tests erfolgreich: Feiertagskarte und Hinweise tatsächlich gerendert; SM/GM-Opt-in der Wochenleiste, Dashboard, Datenschutzfenster und HH:MM-Eingabe regressionsgeprüft. Die gemeinsam genutzte Wochenleiste ändert ihr Verhalten nur mit dem neuen SM-Callback; GM übergibt diesen nicht.
- 16 Backend-Unit-Tests erfolgreich: offizielle Kalender 2026–2028, Vorschau über zehn Jahre, Feiertagsketten, Jahreswechsel, Montag/Freitag, Sollzeitvergleich, Gleichstand, keine Rückdatierung sowie bestehende Serien-/Zeitkonfliktregeln.
- Drei echte SM-DB/API-Integrationstests erfolgreich, jeweils vollständig zurückgerollt. Feiertagsnachweis: Einzelanlage und idempotente Wiederholung; genau eine Ausnahme in einer Drei-Termine-Serie ohne neue Serienversion; manuelles Zurückverschieben bleibt erhalten; Admin-/SM-Antworten identisch; zwei Termine werden anhand aktualisierter Tageslast verteilt; Dry-run schreibt nichts; Wiederherstellung berücksichtigt Feiertage; abgeschlossene/vergangene Termine bleiben unverändert. Der separat freizuschaltende ältere Konkurrenztest war bei diesem Lauf deaktiviert, nicht als erneut bestanden gezählt.
- Browserprüfung am lokalen Produktionsbuild: Test-SM-Admin-Anmeldung und Verplanung funktionieren; Feiertagskarte auf- und zuklappbar; gemeinsames Admin-Dropdown bis 2036 bedienbar, alle 13 Feiertage sichtbar. KW 44/2026 zeigt Nationalfeiertag und Allerheiligen trotz null Einsätzen als bernsteinfarbene Tagesgruppen mit Namen und Erklärung. Keine Terminänderungen über den Browser vorgenommen.
- Bestands-Dry-run ergab `count: 0`: keine produktiven Feiertagstermine zu ändern. Nach dem Testlauf existieren null aktive Märkte mit dem Fixture-Namen `SM SAFETY ROLLBACK TEST`. Keine GM-Schreibzugriffe, keine Schemaänderungen, keine produktiven Datensätze gelöscht.

## Betrieb und Wartung

- Automatik läuft in derselben Transaktion bei Einzelanlage, Serienanlage und Wiederherstellung; nicht bei lesenden Kalenderaufrufen. Die Ursprungstermine und die Audit-Historie bleiben erhalten. Nach manueller Datumswahl wird nicht automatisch neu entschieden.
- Explizite Bestandsprüfung: `POST /admin/sm-planning/holidays/reconcile` mit `{ "dryRun": true }` (Standard), nur für Admin/SM-Admin. Alternativ Backend-CLI `npx tsx src/scripts/reconcile-sm-holidays.ts --actor=<bestehende Admin-UUID>`. Erst ein bewusst ergänztes `--apply` schreibt Änderungen; beim Abschluss dieser Aufgabe nicht benötigt oder ausgeführt.
- Frontend und Backend enthalten dieselbe reine Berechnungsdatei, weil sie getrennt bereitgestellt werden. Der Paritätstest verhindert ein unbemerktes Auseinanderlaufen. Bei Gesetzesänderungen beide Dateien und die offiziellen Datumstests aktualisieren.
- Kein zusätzlicher Feiertagsdienst, keine neue Umgebungsvariable und keine Migration erforderlich. Bestehende Benutzer- und Planungsrechte gelten unverändert.
