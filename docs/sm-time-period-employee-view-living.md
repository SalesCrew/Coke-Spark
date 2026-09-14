# SM-Zeiterfassung · Zeitraum und Mitarbeiteransicht

Stand: 14.09.2026. Umsetzung der beiden SIMPL-Karten „Zeiterfassung“ im Projekt Coke SPARK / Development / In Arbeit:

- `1f0d22e8-53f1-4a20-847e-f3fcc8ad6bb7`: einzelne Tage und vollständige Kalendermonate.
- `eb0c73aa-3184-42bb-8370-e80cb2427396`: Mitarbeiteransicht wie bei GM.

Beide Beschreibungen wurden vollständig gelesen; keine Kommentare oder Anhänge vorhanden. Freigabe: nur diese beiden Aufgaben. Fragebogen-/Antwortmanagement bleibt ein eigener Folgeschritt.

## Befund und Abgrenzung

Die SM-Adminseite fragt bisher starr die letzten 93 Tage ab. Der bestehende SM-Planungsendpunkt akzeptiert bereits inklusive `from`/`to` mit bis zu 93 Tagen und liefert aktuelle Zeitrevisionen, Besuchszeitstempel und Korrekturanfragen. Die bisherige „SM Ansicht“ verwendet eine Tageszeile für die gesamte Historie und schneidet diese bei 700 Pixeln ab. GM bietet dagegen Mitarbeiterübersicht → Zusammenfassung → einzelne Tage → Besuchsdetails.

Keine Migration oder Änderung von GM-Seiten/-Tabellen notwendig. Keine Produktionsdaten für Tests erstellen oder verändern. Vorhandene uncommittete Planungsarbeiten bleiben erhalten.

## Plan

- [x] Reinen SM-Zeit-Mapper und Aggregationen testen: effektives Datum/SM, keine abgesagten Einsätze, keine doppelte Zählung, fehlende Zeit ist nicht Null.
- [x] Gemeinsamen KW/Tage/Monat-Picker anschließen; Start im aktuellen Wiener Kalendermonat. Suche und Ansicht bleiben bei Zeitraumwechsel erhalten.
- [x] Lade-/Fehler-/Leerzustände und veraltete Antworten sauber behandeln; keine alten Zeitraumwerte unter neuer Überschrift.
- [x] SM-Mitarbeiterübersicht an GM anlehnen: aufklappbare Übersicht, kleine Kennzahlenleiste, separat aufklappbare Tage mit Besuchsdetails. Keine feste Abschneidehöhe.
- [x] Bestehende Istzeit-Korrekturen und Freigabe/Ablehnung in beiden Ansichten erhalten; erfolgreich gespeicherte Änderungen bei anschließendem Ladefehler nicht erneut anbieten.
- [x] Lokale Daten-/UI-/Browserprüfungen, Typecheck, Build und relevante Regressionen durchführen.

## Verbindliche Berechnungen

- Zeitraum basiert auf dem effektiven Einsatzdatum, nicht auf dem späteren Zeitpunkt der Einreichung. Beide Grenzen sind inklusive.
- Sollzeit = Summe der geplanten Minuten nicht abgesagter Einsätze im sichtbaren Filter.
- Besuchszeit = Summe der aktuell gültigen `actualMinutes`. Ohne Zeitrevision wird keine Besuchszeit angenommen.
- Fahrtzeit = gespeicherte Fahrtzeit zu Einsätzen mit erfasster Istzeit. Laufende Entwürfe ohne Istzeit zählen nicht als erfasste Arbeit. Historische Fahrtzeit wird durch eine spätere Kontoänderung nicht rückwirkend entfernt.
- Gesamt = erfasste Besuchszeit + zugehörige Fahrtzeit, keine Hochrechnung aus erster Ankunft/letztem Ende; Zwischenlücken sind keine Arbeitszeit.
- Erfasste Tage = unterschiedliche effektive Datumswerte mit mindestens einer Istzeit. Durchschnitt = Gesamt / erfasste Tage, gerundet auf volle Minuten. Fehlende Daten werden mit „—“ statt scheinbar erfassten 0 Minuten dargestellt.
- Erledigte Einsätze zählen Status `completed`; ein manuell vorhandener Zeiteintrag allein erklärt keinen Fragebogen für erledigt. OOS-Regeln bleiben unverändert.
- Besuchszeitstempel werden in Europe/Vienna angezeigt, einschließlich Datum bei Tageswechsel. Fehlende historische Stempel werden nicht aus Dauern erfunden.

## Sicherheit und Freigabe

Die authentifizierten SM-Admin-APIs sowie vorhandene serverseitige Validierung, Revisionshistorie und Anfrageentscheidungen bleiben maßgeblich. Kalender und Ansichtswechsel sind ausschließlich Leseaktionen. Keine GM-Zeitmodelle, Kilometer, Pausen oder Diäten auf SM übertragen. Kein Push und keine SIMPL-Statusänderung ohne weiteren Auftrag.

## Prüfergebnisse

- `npm run test:sm-time-view`: 6/6 Tests bestanden (Datumsgrenzen, Aggregation, aktuelle Revision/effektive Zuordnung, Wiener Zeiten inkl. Jahreszeiten-/Tageswechsel, barrierearme Übersicht/Ladezustand, API-Vertrag).
- `npm run test:sm-planning-period`: 9/9; `npm run test:sm-planning-week`: 12/12; Feiertags-/Sicherheits-UI: 8/8; Einsatz-entfernen: 3/3. Insgesamt 38 fokussierte Tests bestanden.
- TypeScript-Prüfung für Workspace, Vorschau und Tests bestanden. Vollständiger Frontend-Produktionsbuild bestanden, einschließlich der geschützten Development-Vorschau. Nur die bestehende Next.js-Warnung über mehrere Workspace-Lockfiles.
- Browserprüfung unter `/dev/sm-time-preview` mit der echten Workspace-Komponente und einem lokalen API-Ersatz: September filtert 31.08./01.10. sowie abgesagte Einsätze aus; Tageswahl 14.09. erzeugt exakt `from=2026-09-14&to=2026-09-14` am API-Aufruf. Suche bleibt beim Wechsel zwischen Tage und SM Ansicht bestehen.
- Mitarbeiter → Tag → Besuch visuell geprüft. 23 Besuche an einem Tag bleiben vollständig erreichbar und editierbar; keine 700-Pixel-Kappung. Nicht montierte, eingeklappte Editoren bleiben außerhalb der Tab-Reihenfolge.
- Korrektur von 90 auf 120 Minuten mit Grund aktualisierte Tages-/Mitarbeitersummen um genau 30 Minuten. Freigabe einer lokalen 45→60-Minuten-Anfrage aktualisierte Dauer, Zeitstempel und Summen und entfernte die offene Anfrage. Die bestehende Ablehnungs-API bleibt unverändert verdrahtet; keine neue Entscheidungsregel.
- Verzögerte August-Antwort nach Rückkehr zu September überschreibt die aktuelle Ansicht nicht. Generation + Bereichsschlüssel schützen Daten und Fehlerzustand. Bei Abschluss einer Mutation nach Bereichswechsel lädt der aktuelle Bereich neu.
- Ladefehler zeigt eine eigene Wiederholen-Aktion, erfolgreicher Retry ohne Termine einen echten Leerzustand. Speicherfehler behält Eingaben/Grund; erfolgreicher Save mit anschließendem Ladefehler meldet die erfolgreiche Korrektur und bietet nur Reload an.
- Vorhandene reine Minutenkorrekturen ändern weiterhin keine Besuchszeitstempel. Die Zeile kennzeichnet Zeitrevisionen >1; sie erfindet keine neuen Ankunfts-/Endzeiten.
- Kein Live-Schreibtest: Produktionsdaten/GM-Daten unverändert, keine Migration und keine Backend-Verhaltensänderung für diese beiden Karten. SIMPL-Status unverändert.

## Veröffentlichungsfreigabe am 14.09.2026

Der Nutzer hat den gemeinsamen Push aller fertiggestellten SM-Änderungen freigegeben. Vor Veröffentlichung erneut 38 Frontend- und 31 Backend-Tests erfolgreich geprüft; beide Produktionsbuilds bestanden. Dazu gehören Zeitraumfilter, Mitarbeiter-Zeitansicht und das Entfernen/Wiederherstellen einzelner Einsätze. Lokale Logs, Werkzeugdateien und fremde Vorschauen sind nicht Bestandteil dieses Releases. Der konkrete Git-/Deploymentstatus steht im Aufgabenabschluss.

Die dritte SIMPL-Karte „Zeiten, Änderungen und SM Management“ (`959a51c8-a263-4f3f-98e0-aa2ab378db44`) wurde erneut direkt gelesen: weiterhin In Arbeit, keine Kommentare oder Anhänge. Besuchszeitstempel werden jetzt angezeigt. Noch offen ist eine SM-Adminansicht für abgeschlossene Fragebögen und deren Antworten sowie direkte, versionierte Korrekturen im Stil des GM-FB-Managements. Dabei müssen Fragebogen-Snapshots, Pflicht-/Kommentarregeln, bedingte Fragen, Historie, Konfliktschutz und die OOS-Auswertung berücksichtigt werden. Dieses Antwortmanagement ist nicht Teil des aktuellen Pushs; die vorhandenen Anfragefreigaben ersetzen es nicht.
