# SM · Verplanung nach Tagen und Kalendermonaten

Stand: 2026-09-14. SIMPL „Verplanung-Tage“, ID `bff35a63-fee5-4563-a2e3-71e85f4cad05`, Development → Coke SPARK → In Arbeit; Label SM/SPARK/Anpassung; Alina Schüller, zugewiesen an Kilian Sternath.

## Anforderung und Befund

Die vollständig gelesene Karte verlangt einzelne Tage und Zeiträume vom Monatsersten bis zum letzten Monatstag. Keine Kommentare oder Anhänge vorhanden. Umsetzung betrifft den Ansichtszeitraum der SM-Verplanung, nicht den Wiederholungsrhythmus oder die Datierung bestehender Einsätze.

Die Backend-APIs akzeptieren bereits `from`/`to` als inklusive ISO-Kalendertage, einschließlich `from = to`, mit maximal 93 Tagen. Die Einschränkung lag im Frontend: zwei gewählte Montagswerte wurden immer zu ganzen Wochen inklusive Sonntag erweitert. Ein Septemberfilter schloss dadurch zusätzliche August-/Oktobertage ein. Es braucht keine neue Tabelle, Migration oder Datenkorrektur.

## Plan und Umsetzung

- [x] SIMPL direkt und read-only über die Skill-Identitäts-/Workspace-Prüfung lesen; keine Browser-Automation für SIMPL.
- [x] Vorhandenen KW-Kalender samt Hover/Fokus auf ganzen Wochen beibehalten.
- [x] Zentralen Zeitraum-Picker um „KW“, „Tage“ und „Monat“ ergänzen. Dieselben Admin-Farben, Buttons, Popover-Abstände und Kalenderstile verwenden.
- [x] Einen einzelnen Zeitraumzustand `{mode, from, to}` für API-Abfragen, Listen, Summen, Überschrift, Seitenkopf, Excel und Neuanlage-Vorschlag verwenden.
- [x] Reine UTC-Kalendertagsfunktionen für Monatsgrenzen, Tagesanzahl, Verschiebung und Beschriftung testen; „Heute“ wird in Europe/Vienna ermittelt.
- [x] Browser-, Build- und abschließende Regressionstests bestätigen.

## Bedienung

- Klick auf den mittleren Datums-/KW-Button öffnet das Popover mit drei kompakten Modi.
- **KW:** wie bisher Start-KW und End-KW wählen, auch dieselbe KW zweimal. Montag bis Sonntag, maximal 13 Wochen. Hover/Fokus zeigt die ganze Kalenderwoche, ohne den Abfragezeitraum zu ändern.
- **Tage:** einen Tag anklicken, dann „Tag anzeigen“ für genau diesen Tag. Alternativ einen zweiten Tag als inklusive Bereichsgrenze anklicken. Rückwärtsauswahl wird normalisiert. Maximal 93 Tage; zu lange Auswahl bleibt zur Korrektur geöffnet und sendet keine Anfrage. Ein weiterer Klick auf denselben Tag wählt ebenfalls genau einen Tag.
- **Monat:** Monat im Jahresraster anklicken. Die Auswahl reicht immer vom 1. bis zum echten letzten Tag, einschließlich Februar/Schaltjahren. Jahresnavigation verändert nur das sichtbare Raster. „Aktueller Monat“ ist eine ausdrückliche Schnellwahl.
- Modi wechseln, Monate/Jahre durchblättern und Hover ändern die aktive Planung nicht. Escape/Außenklick verwerfen unbestätigte Auswahl. Nach Anwendung kommt der Fokus zum Trigger zurück. Tagespfeiltasten bewegen den Fokus, nicht die Auswahl.
- Die äußeren Pfeile verschieben KW-Ansichten wie bisher um eine Woche, Tagesbereiche um ihre Länge und Monatsansichten um einen echten Kalendermonat. „Heute“ zeigt im jeweiligen Modus die aktuelle KW, den heutigen Tag beziehungsweise den aktuellen Monat.

## Datenfluss und Sicherheit

`period.from` und `period.to` gehen unverändert an `fetchSmPlanningAssignments`. Eine ausdrücklich eingeblendete bestehende GM-Verlaufsebene erhält denselben Lesebereich; ihre Berechtigungen/Filter und sämtliche GM-Schreibpfade bleiben unverändert. Die SM-Liste prüft zusätzlich das effektive Einsatzdatum gegen die Grenzen. Abgesagte Termine und Sollsummen behalten die Regeln aus `sm-series-edit-stop-living.md`.

Bereiche werden atomar in einem React-State gesetzt, nicht in zwei unabhängig normalisierten Wochen-States. Veraltete Antworten nach einem Bereichswechsel dürfen aktuelle Ergebnisse nicht überschreiben. Excel wartet auf einen vollständig geladenen, fehlerfreien Bereich. Der Export enthält die angezeigten, gefilterten SM-Zeilen; sein Dateiname verwendet die echten ISO-Grenzen oder `YYYY-MM` bei Monatsauswahl. Vorhandene Original-/Ersatzdaten an Einsätzen werden nicht geändert.

Der historische Header-Eventname `sm-verplanung:weekContext` bleibt zur Kompatibilität bestehen, überträgt aber die korrekte Tages-/Monats-/KW-Beschriftung. Neue Einsätze erhalten wie bisher den Beginn des sichtbaren Zeitraums als editierbaren Vorschlag. Bereits laufende Drawer/Bestandsdaten werden nicht automatisch umgeplant.

Keine Datenbank-Schreiboperation, keine Rolle, RLS-Regel, Produktionstabelle oder SIMPL-Karte wird für diese Funktion verändert. Frühere uncommittete Einsatz-entfernen-Arbeiten werden bewahrt. Push/Erledigt-Status werden erst bei ausdrücklicher Freigabe veröffentlicht.

## Prüfnachweise

- `npm run test:sm-planning-period`: Tagesgrenzen, umgekehrte Auswahl, Monate mit 28/29/30/31 Tagen, Jahreswechsel, DST, 93-Tage-Limit, KW-Kompatibilität, Heute-Modi, Exportschlüssel und bestehender API-Vertrag.
- `npm run test:sm-planning-week`: bestehende ganze-KW- und GM-Lesefilter-Regressionen.
- `/dev/sm-planning-period`: echter Picker mit lokalen Grenzdatums-Beispielen (31.08., 01.09., 14.09., 30.09., 01.10.); kein Produktionszugriff, außerhalb Development gesperrt.

### Abschlussprüfung am 14.09.2026

- 9/9 Zeitraumtests, 12/12 KW-/Ansichtsregressionen, 8/8 Feiertags-/Sicherheits-UI-Tests und 3/3 Einsatz-entfernen-Regressionen bestanden.
- Fokussierter TypeScript-Check für die SM-Verplanung und `git diff --check` bestanden. Vollständiger Frontend-Produktionsbuild bestanden; nur die bestehende Warnung zu mehreren Workspace-Lockfiles.
- Im lokalen Browser bestätigt: September als voller Monat enthält 01.09., 14.09. und 30.09., aber weder 31.08. noch 01.10. Tagesauswahl 14.09. enthält genau einen Beispieltermin. Rückwärtsauswahl 30.09. → 01.09. ergibt exakt denselben Septemberbereich im Modus Tage.
- Der erste Datumsklick lässt den angewendeten Zeitraum unverändert; „Tag anzeigen“ beziehungsweise der zweite Klick bestätigt. Pfeil rechts verschiebt nur den Tastaturfokus von 14.09. auf 15.09. Escape verwirft die noch offene Auswahl, behält den vorherigen Bereich und setzt den Fokus zurück auf den Zeitraum-Button.
- Monats- und Tagespopover visuell geprüft; bestehendes kleines Admin-Kalenderdesign mit KW/Tage/Monat-Schalter. Listenüberschrift, Datumsgrenzen und Exportkennung stimmen in der lokalen Vorschau überein.
- Browserprüfung mit lokalen Beispieldaten, kein Live-Produktions- oder Downloadtest. Die tatsächliche Workspace-/API-Verdrahtung ist zusätzlich durch Codeprüfung und Vertragstests abgesichert. Keine produktiven Einsätze erzeugt, verschoben oder gelöscht.
- Umsetzung und Prüfungen abgeschlossen. Am 14.09.2026 wurde der gemeinsame Push mit SM-Zeiterfassung und Einsatz-entfernen ausdrücklich freigegeben; konkreter Git-/Deploymentstatus im Aufgabenabschluss. SIMPL bleibt unverändert in „In Arbeit“.
