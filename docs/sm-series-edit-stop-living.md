# SM · Serien ändern und stoppen

Stand: 2026-09-14. SIMPL: „Einsätze Ändern“ (`f1d5270d-b567-4201-9e17-16ee1d052f16`).

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
