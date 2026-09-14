# SM · Serien ändern und stoppen

Stand: 2026-09-14. SIMPL: „Einsätze Ändern“ (`f1d5270d-b567-4201-9e17-16ee1d052f16`).

## Ergänzung: Alinas Frage zu Serienende und falsch verplantem Markt

Prüfung am 14.09.2026: Serienende ist bereits über „Serie ändern oder stoppen → Stoppen“ umgesetzt. Einzeltermine konnten ebenfalls bereits abgesagt und wiederhergestellt werden; die Bezeichnung „Als Ausfall markieren“ machte die Korrektur eines falsch geplanten Marktes jedoch schlecht erkennbar. Es braucht keine zweite Löschfunktion und keine Datenmigration.

- Der Einsatz-Drawer bietet jetzt „Einsatz entfernen“. Aufklappen zeigt den konkreten Markt/Tag, die Auswirkung und den Hinweis auf Wiederherstellung. Ein Grund und „Entfernen bestätigen“ sind erforderlich. Bei Serien wird ausdrücklich nur dieser Termin entfernt; für alle künftigen Termine bleibt die separate Serienverwaltung zuständig.
- Technisch bleibt das die vorhandene transaktionale Absage (`cancelled`) mit Actor, Grund, Zeitstempel und Vorher/Nachher-Event. Der Marktstamm, Originalplanung, Fragebogen-/Zeitdaten und alle anderen Einsätze werden nicht gelöscht. Laufende, abgeschlossene und versäumte Termine bleiben durch die bestehenden Backend-Regeln gesperrt.
- Entfernen/Wiederherstellen haben einen separaten Frontend-Submit-Typ. Ungespeicherte Markt-, SM-, Datums- oder Sollzeitänderungen können nicht versehentlich vor der Absage gespeichert werden. Die UI erklärt das, wenn solche Eingaben vorhanden sind. Doppelklicks werden blockiert, Fehler erhalten den Eingabezustand, fehlgeschlagene Listen-Refreshes nach erfolgreichem Commit lösen keine Wiederholung aus.
- Die normale Ansicht verwendet „Ohne abgesagte Einsätze“. Über „Status → Abgesagt / entfernt“ oder „Alle inkl. abgesagte Einsätze“ bleibt die Historie sichtbar. „Einsatz wiederherstellen“ aktiviert nur diesen Termin und startet keine gestoppte Serie neu.
- Abgesagte Einträge tragen vorrangig das Label „Abgesagt“, auch wenn sie früher verschoben/ersetzt wurden. Ihre ursprünglichen Sollminuten bleiben am Datensatz erhalten, zählen jedoch nicht mehr zu den angezeigten Wochen-/Tages-Sollstunden. Die beiden Zusammenfassungen verwenden dieselbe getestete Berechnung. Auch der Zähler aktiver Serien ignoriert abgesagte Zeilen.
- SM-Phone-Regeln bleiben erhalten: ein abgesagter Einsatz ist nicht startbar. Keine GM-Funktion, GM-Tabelle, Rolle, RLS-Regel oder Produktionszeile wurde geändert. Keine Migration erforderlich.
- Die vorhandenen Backend-Transaktionskörper für Einzelabsage/Wiederherstellung wurden unverändert in testbare Funktionen innerhalb derselben Route extrahiert. Die HTTP-Verträge, Auth-Prüfung und Lock-/Konfliktregeln bleiben gleich.

Prüfungen dieser Ergänzung: `npm run test:sm-series` enthält jetzt 31 erfolgreiche Tests einschließlich echter Einzelabsage, Wiederherstellung, Konkurrenzfehler, geschützter Status, Geschwisterschutz und Audit-Rollback im isolierten PGlite. Die drei Tests unter `npm run test:sm-planning-cancellation` prüfen Filter, Sollsummen und UI/API-Sicherheitsvertrag. Weitere 20 Kalender-/Verplanungs-/SM-Safety-Tests sowie 17 Dashboard-Regressionen sind erfolgreich. Frontend- und Backend-Produktionsbuild sowie die abschließende fokussierte Frontend-Typprüfung sind erfolgreich.

Lokale Browserprüfung: `/dev/sm-planning-remove` verwendet den echten Drawer mit ausschließlich lokalem Speicher; keine produktiven Einsätze werden zu Testzwecken verändert. Geprüft: Entfernen erfordert einen Grund, ungespeicherte Sollzeit wird nicht übernommen, Entfernen/Wiederherstellen schließen nach Erfolg, abgeschlossene Einsätze haben keine Entfernen-Aktion, ein simulierter Konkurrenzfehler lässt Drawer und Begründung erhalten. Screenshot der Bestätigung visuell geprüft. Der Dev-Pfad ist in Produktion gesperrt. Veröffentlichungsstatus steht im Aufgabenabschluss, nicht in einer automatisch gesetzten Release-Markierung.

## Ursache

Die Verplanung konnte Serien erstellen, aber danach nur Einzeltermine bearbeiten/absagen und den SM für zukünftige Einsätze ersetzen. Eine Änderung von Rhythmus, Wochentagen, Ende, Markt und Sollzeit sowie ein expliziter Serienstopp fehlten. Die materialisierten Einsätze wurden unabhängig voneinander geladen; die angezeigte Serienbeschreibung stammte außerdem immer aus der ursprünglichen Erzeugungsversion.

## Verhalten

- Jeder Serien-Einsatz bietet oben im bestehenden Drawer „Serie ändern oder stoppen“. Auch von einem abgeschlossenen Einsatz aus ist die Verwaltung der zukünftigen Serie erreichbar; der abgeschlossene Einsatz selbst bleibt gesperrt.
- Die Serienverwaltung lädt die neueste Definition statt die ursprüngliche Definition des geöffneten Einzeltermins. Ein eigener kompakter Umschalter trennt „Ändern“ und „Stoppen“. Standardmäßig bleibt das Öffnen eines Einsatzes eine Einzelbearbeitung.
- Änderungen gelten ab einem expliziten Datum, frühestens heute (Europe/Vienna) und bei Änderungen frühestens ab der neuesten Serienversion. Frühere bereits geplante Versionsabschnitte werden nicht stillschweigend überschrieben.
- Änderbar: aktiver SM-Markt mit Stammnummer, aktiver SM, Sollminuten, wöchentlich/14-tägig, Wochentage, Serienende. Der ursprüngliche Wochenanker bleibt erhalten; ein Stichtag in einer freien Woche verschiebt keine 14-Tage-Serie.
- „Auswirkung prüfen“ ist eine reine Leseoperation. Danach werden neue, geänderte, abgesagte, wieder eingeplante und geschützte Einsätze einzeln gezählt. Erst „Änderungen bestätigen“ beziehungsweise „Serie jetzt stoppen“ schreibt. Ein kurzer Grund ist erforderlich.
- Stoppen sagt alle noch planbaren Einsätze mit tatsächlichem Datum ab dem Stichtag ab und setzt den Serienstatus auf `ended`. Frühere Einsätze bleiben erhalten. Eine Serie wird nicht gelöscht und nicht automatisch wieder gestartet. Die bestehende explizite Wiederherstellung einzelner Einsätze bleibt eine bewusste Ausnahme, kein Neustart der Serie.
- Änderungen erzeugen eine neue unveränderliche Serienversion. Bestehende Termine behalten UUID, ursprüngliche Werte, Stammnummern-Snapshot und Erzeugungsversion. Änderungen werden nur in den vorhandenen Ersatzfeldern gespeichert.
- Nicht mehr passende Termine werden abgesagt, neue Termine materialisiert. Bereits manuell abgesagte Termine werden nie automatisch wiederhergestellt. Nur nachweislich durch diese Serienverwaltung entfernte, noch unbenutzte Termine dürfen bei Rückänderung des Rhythmus erneut eingeplant werden; dabei bleibt ihre UUID bestehen.
- Vorhandene Datumsverschiebungen bleiben für weiterhin passende Termine erhalten. Verschobene Termine über dem Änderungsstichtag werden beim Bearbeiten konservativ geschützt; beim Stoppen entscheidet der tatsächliche Tag. Belegte Tage werden nicht doppelt angelegt.
- Neue und wieder eingeplante Termine verwenden die bestehende Feiertagsautomatik. Bestehende bewusste Verschiebungen werden nicht zurückgesetzt.
- Laufende, abgeschlossene, versäumte, historisch genutzte und manuell abgesagte Einsätze sind geschützt. Zusätzlich zum Status werden Start-/Endzeit, jegliche Fragebogen- und Ist-Zeit-Historie geprüft, einschließlich nicht mehr aktueller Revisionen.
- Das Listenlabel der Serie verwendet die für das effektive Einsatzdatum geltende Serienversion; die unveränderliche Erzeugungsversion bleibt technisch separat erhalten. Gestoppte Serien zählen nicht als aktive Serien.

## Atomarität, Konkurrenz und Datenbank

Keine Migration, kein Backfill, keine GM-Schreiboperation. Verwendet werden die bestehenden SM-Tabellen `sm_assignment_series`, `sm_assignment_series_versions`, `sm_assignments`, `sm_assignment_events`; Nutzer und SM-Märkte werden zur Zielvalidierung gelesen. Fragebogen-/Zeit-Tabellen werden ausschließlich zum Schutz bestehender Historie gelesen.

`GET /admin/sm-planning/series/:id` lädt die Definition. `POST .../:id/preview` läuft in einer read-only Repeatable-Read-Transaktion. `POST .../:id/change` läuft vollständig in einer Transaktion unter dem bereits von Einsatzstart und Einzelbearbeitung verwendeten SM-Planungslock. Alle drei Routen liegen hinter `requireAuth(["admin", "sm_admin"])`.

Die Vorschau enthält einen SHA-256-Fingerabdruck aus Definition, vollständigem Einsatzzustand, Historienindikatoren, Stichtag und angefragten Werten. Beim Speichern wird derselbe Plan unter dem Lock erneut berechnet. Eine abweichende Vorschau führt zu HTTP 409 vor dem ersten Schreibzugriff. Ein anderer Admin, ein gestarteter Fragebogen, ein zwischenzeitlicher Stopp oder ein Datumswechsel kann deshalb keinen veralteten Sammelschreibzugriff auslösen.

Änderungen/Absagen/Wiederherstellungen werden gruppiert geschrieben. Jeder betroffene Einsatz erhält im selben Commit einen append-only Event mit Vorher/Nachher, Grund, Actor, Stichtag und `seriesOperation`. Fehler rollen die gesamte Operation zurück. Originalfelder werden weiterhin durch bestehende Datenbanktrigger geschützt. Bei einem fehlgeschlagenen Listen-Refresh nach erfolgreichem Commit bietet die UI keine erneute Speicherung derselben Aktion an.

Begrenzungen: höchstens zwei Jahre ab Stichtag, höchstens 1.000 gewünschte Termine, höchstens 5.000 bestehende Einträge einer Serie. Keine Freigaben/RLS/Benutzerrollen werden verändert. Pauschalen bleiben auf ihrem bisherigen Wert.

## Umsetzung / Prüfstand

- [x] SIMPL-Karte, Datenmodell, Frontend- und Backend-Flows geprüft.
- [x] Reine Planberechnung, geschützte Historie, atomare Speicherung, Vorschau-Konkurrenzschutz implementiert.
- [x] Kompakte Serienverwaltung mit bestehenden Admin-Kalendern und Dropdowns eingebunden.
- [x] Unit-/Datenbank-/UI-Regressionen abschließen.
- [x] Builds und Sicherheitsgrenzen prüfen.

Release-Gate: Nach diesen Prüfungen Backend und Frontend pushen, beide produktiven Deployments verifizieren und erst anschließend SIMPL „Einsätze Ändern“ auf Fertig setzen. Der tatsächliche Veröffentlichungsstatus wird im Ausführungsprotokoll dieser Aufgabe bestätigt.

### Nachweise vor dem Push

- 27/27 Serien-/Planungstests erfolgreich, darunter 11 Integrationstests mit der echten Planungsmigration in einem isolierten PGlite-PostgreSQL. Es gibt dort keine GM-Tabellen; alle Mutationen laufen ohne Produktionsverbindung.
- 40/40 weitere Backend-Regressionsprüfungen für Fragebogen, Kommentare, OOS-Dashboard und Feiertage erfolgreich.
- 20/20 Frontend-Prüfungen für Verplanung, Kalender, Feiertage und SM-Safety erfolgreich.
- Frontend-Produktionsbuild, fokussierte Frontend-Typprüfung und Backend-Produktionsbuild erfolgreich.
- Browserprüfung der echten Serien-UI mit lokaler Datenattrappe: Bearbeiten → Vorschau → Bestätigen, Stoppen → Vorschau → Bestätigen und ein simulierter Konkurrenzfehler funktionieren. Beim Konflikt bleiben Eingaben erhalten, der Bestätigen-Zustand wird verworfen und eine neue Vorschau verlangt. Keine produktiven Einsätze wurden hierfür geändert.
- Produktive Supabase-Prüfung ausschließlich lesend: die vorhandenen Planungs-/Event-Tabellen und die benötigten `service_role`-Rechte reichen aus; keine Migration erforderlich.
- Produktions-Push/Deployment und die anschließende SIMPL-Erledigt-Markierung werden nach diesen Gates ausgeführt; ihr Ergebnis steht im Ausführungsprotokoll dieser Aufgabe.
