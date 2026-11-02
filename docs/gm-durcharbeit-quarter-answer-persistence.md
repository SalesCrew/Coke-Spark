# GM Durcharbeit — Antworten im Kalenderquartal

Stand: 02.11.2026. Implementiert, isoliert geprüft und als Backend-Code-Release in Produktion veröffentlicht.

## Anforderung und Ursache

Bereits erhobene GM-Durcharbeit-/Distributionsantworten sollen beim nächsten Besuch desselben Markts innerhalb des Kalenderquartals wieder ausgefüllt erscheinen und normal bearbeitbar sein.

Der bisherige Visit-Start verwendet grundsätzlich den RED-Monat. Nur über passende Prämienquellen erkannte Distribution-/Flexfragen erhalten das Kalenderquartal. Der Abschnitt `durcharbeit` selbst wurde dabei nicht berücksichtigt. Ohne passende Quellenkonfiguration konnte deshalb eine im Oktober abgeschlossene Antwort beim Novemberbesuch fehlen, obwohl beide Besuche in Q4 liegen. Dies ist anhand des Codes und einer synthetischen Datenbank reproduziert; die gemeldeten Produktionsdatensätze wurden nicht abgefragt.

## Umgesetztes Verhalten

- Der Server bestimmt aus den tatsächlich aufgelösten GM-Kampagnen alle Nicht-Fotofragen im Abschnitt `durcharbeit`. Diese Fragen verwenden das Kalenderquartal unabhängig von Prämienwellen, deren Status oder Quellenverknüpfungen.
- Übernommen wird ausschließlich die jüngste gültig beantwortete Antwort aus einem nicht gelöschten, abgeschlossenen Besuch desselben GMs und Markts mit derselben technischen Frage-ID im gleichen Wiener Kalenderquartal.
- Die neue Fragekonfiguration validiert die Antwort erneut. Neue Frage-IDs, geänderte Fragetypen oder nicht mehr gültige Optionen werden nicht per Fragetext gleichgesetzt.
- Der neue Besuch erhält eigene gespeicherte, editierbare Antwortzeilen einschließlich Kommentar, Auswahloptionen und Matrixwerten. Ein geänderter gültiger Wert, auch `0` oder `Nein`, wird beim folgenden abgeschlossenen Besuch als neuer Stand verwendet. Der Quellbesuch bleibt unverändert.
- Q1: 01.01.–31.03.; Q2: 01.04.–30.06.; Q3: 01.07.–30.09.; Q4: 01.10.–31.12., jeweils `Europe/Vienna`. Beispiel: Oktober → November → Dezember bleibt erhalten; am 01.01. beginnt die neue Vorbelegung leer.
- Bestehende Entwürfe werden nicht nachträglich umgeschrieben. Die Vorbelegung erfolgt im bereits vorhandenen Erstellungspfad neuer Visits, nicht durch einen Daten-Backfill oder einen schreibenden GET-Aufruf.
- Andere GM-Abschnitte behalten ihre bisherige RED-Monats-/Prämienquellenlogik. Fotos behalten ihre vorhandene RED-Monatsreferenzlogik und werden nicht als neue Quartals-Fotoleistung kopiert. SM, Bonusberechnungen, Rechte, historische Antworten/Fotos und die UI bleiben unverändert.

## Umsetzung und Verifikation

`backend/src/lib/visit-answer-reuse.ts` bestimmt die Durcharbeit-Frage-IDs und ergänzt sie zu den bisherigen Quartalsquellen. `backend/src/routes/gm-visit-sessions.ts` übergibt ausschließlich serverseitig aufgelöste Fragen. Das vorhandene transaktionale Kopieren und die GM-UI-Hydrierung gespeicherter Antworten werden weiterverwendet. Kein Schemawechsel, keine Migration oder Produktionsdatenkorrektur erforderlich.

32 fokussierte Tests bestehen gemeinsam: Visit-Übernahme/Persistenz, Quartalsgrenzen und Wiener Zeitzone, aktuelle Konfigurationsvalidierung, Kommentare/Optionen/Matrix, Bearbeitung ohne Änderung des Quellbesuchs, Nullwert, unterschiedliche GMs/Märkte/Frage-IDs, Entwürfe/ungültige/gelöschte Quellen, unabhängiger Wellenstatus, bestehende RED-Fotoreferenzen und Bonus-Deduplizierung. Der Oktober-/November-Test scheitert ohne Fix mit fehlender Quartalsvorbelegung und besteht danach.

Backend-TypeScript-Build und `git diff --check` bestehen. Tests laufen mit leerer Prozessumgebung und einer flüchtigen synthetischen PGlite/PostgreSQL-Datenbank; Produktionskonfiguration, Auth, Supabase-Connector und Hintergrundjobs werden nicht geladen. Kein Browser-/API-Test gegen Produktion ausgeführt.

Reproduktion im Backend, ohne Umgebungsdateien: `node node_modules/tsx/dist/cli.mjs --test src/visit-answer-reuse.integration.test.ts src/praemien-answer-persistence.test.ts src/visit-session-answer-validation.test.ts src/praemien-workspace.integration.test.ts src/praemien-rewards.test.ts`.

## Produktionsrelease

Der Nutzer hat die Veröffentlichung nach Prüfung der unveränderten UI ausdrücklich beauftragt. Backend-Commit `61c00f557e71d6cf02e4b6e6f8d6a0dd24a60ec6` wurde über die bestehende `SalesCrew/Spark-Backend`-Integration auf `master` veröffentlicht. Railway-Deployment `5aec12cc-d478-4dff-8608-38a9e6cffa58` ist SUCCESS, Produktionsservice Spark-Backend online, eine laufende und keine abgestürzte Instanz. Die Plattform meldet keine aktiven Warnungen, kritischen Meldungen oder offenen Konfigurationsänderungen. Es wurden keine Variablen, Schemata oder Produktionsdatensätze durch den Agenten verändert und keine Tests gegen Produktion ausgeführt. Das Frontend-Repository erhält lediglich den passenden Backend-Gitlink und die Dokumentation; keine UI-Datei wird geändert.
