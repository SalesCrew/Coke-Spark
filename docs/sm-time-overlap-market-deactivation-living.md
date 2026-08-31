# SM — Zeitüberschneidungen und Markt-Deaktivierung

Stand: 31.08.2026. Aktives Arbeitsdokument; Implementierung und Nachweise werden unten ergänzt.

## Auftrag und Grenzen

Zwei vollständige SM-Flows: überlappende Besuchszeiten verhindern; beim Deaktivieren eines SM-Marktes betroffene Einsätze anzeigen und ausdrücklich absagen oder auf Ersatzmärkte verplanen. Keine GM-Tabellen, GM-Daten oder GM-Oberflächen ändern. Bestehende Produktivdaten nicht bereinigen oder rückwirkend umschreiben. Tests verwenden isolierte SM-Testdaten oder vollständig zurückgerollte Transaktionen.

## Bestandsaufnahme

- `sm-visits.ts` speichert Abschluss, Ist-Zeit, Einsatzstatus und Ereignis bereits atomar, sperrt aber nur den einzelnen Einsatz. Zwei verschiedene Einsätze desselben SM können deshalb dieselbe Zeit erhalten.
- Besuchsintervalle liegen in `sm_questionnaire_submissions`; gültige aktuelle Ist-Zeiten in `sm_assignment_time_submissions`. Korrekturfreigaben in `sm-planning.ts` ändern die Intervalle. Diese sind ebenfalls zu prüfen.
- Manueller Abschluss speichert bislang ausschließlich Minuten. Ohne echte Start-/Endzeit lässt sich eine Überschneidung nicht überprüfen. Neue manuelle Abschlüsse müssen deshalb beide Zeitstempel angeben; die vorhandenen Datum-/Uhrzeitpicker werden wiederverwendet. Historische fehlende Zeitstempel werden nicht erfunden.
- `sm-markets.ts` setzt `is_active` derzeit direkt. Serien sind vollständig materialisierte `sm_assignments`; Ursprungswerte und Serienversionen sind unveränderliche Historie. Ersatzfelder und append-only Ereignisse sind bereits vorhanden. Keine neue Tabelle nötig.

## Verbindliche Zeitregeln

1. Nur eigener SM, nie andere Mitarbeiter. Prüfung gegen aktuelle, nicht gelöschte, abgeschlossene SM-Fragebögen mit einer aktuellen, nicht gelöschten Ist-Zeit. Eine freigegebene Zeitlöschung zählt nicht mehr als belegtes Zeitintervall. Historische Revisionen und Entwürfe zählen nicht.
2. Überschneidung exakt als `existing.start < proposed.end && existing.end > proposed.start`. Direkt aneinander anschließende Besuche sind erlaubt. Gleiche, enthaltene, umschließende und tageübergreifende Intervalle sind nicht erlaubt. Vergleich echter UTC-Zeitpunkte, Darstellung Europe/Vienna einschließlich Datum.
3. Transaktionsgebundene Sperre pro SM vor Konfliktabfrage und Schreibvorgang: auch zwei gleichzeitige Abschlüsse oder eine gleichzeitig freigegebene Korrektur können nicht beide gewinnen. Keine Netzwerkanfragen unter dieser Sperre.
4. Fehler HTTP 409, eigener Code, ausdrücklich: Abschluss nicht gespeichert, bereits belegter Markt samt Adresse und vollständiger Von-/Bis-Zeit, eigene gewählte Zeit, Aufforderung Start/Ende zu ändern. Strukturierte Konfliktdetails für die Phone-Karte. Kein stilles Kürzen oder Verschieben.
5. Fehler rollt sämtliche Abschlussänderungen zurück. Antworten/Entwurf bleiben erhalten; Zeitfelder bleiben editierbar; erneuter Versuch erlaubt. Erfolgreiche identische Abschlusswiederholung bleibt idempotent.
6. Neue Abschlüsse benötigen Start und Ende (Timer oder manuell). Dauer wird daraus berechnet, 1 Minute bis maximal 24 Stunden. Fahrtzeit bleibt optionale Dauer und wird nicht als erfundener zusätzlicher Zeitraum behandelt.
7. Korrekturanfrage und Freigabe prüfen erneut; eine Anfrage reserviert keine Zeit. Freigabe darf den Schutz nicht umgehen. Wiederherstellung einer gelöschten Ist-Zeit über Admin-Zeiterfassung wird ebenfalls geprüft.

## Verbindliche Marktregeln

1. Bei Auswahl „Inaktiv“ sofort ein Dialog; vor Bestätigung bleibt der Markt aktiv. Andere ungespeicherte Marktänderungen bleiben im Entwurf.
2. Vorschau ab heute (Europe/Vienna), effektives Einsatzdatum und effektiver Markt. Nur `planned`, `confirmed`, `open` sind änderbar. Laufende/abgeschlossene Einsätze bleiben unverändert und werden als geschützt kenntlich gemacht. Frühere Tage, bereits abgesagte, verpasste und gelöschte Einsätze bleiben erhalten.
3. Einmalige Einsätze einzeln, Serien in je einer Karte mit Anzahl, Datumsbereich, Markt/Adresse/Stammnummer und SM-Namen. Aufklappbare Einzeltermine erlauben Detailprüfung und individuelle Ersatzmärkte. Kein unübersichtliches Wiederholen jeder Woche in der Hauptliste.
4. Absagen: Status `cancelled`, vorheriger Status, Zeitpunkt, Admin und Grund speichern; nichts löschen. Die bestehenden SM-/Admin-Planungsansichten zeigen diese Einsätze weiterhin als abgesagt.
5. Ersatz: aktiven, nicht gelöschten anderen SM-Markt mit Stammnummer auswählen, für eine ganze Gruppe oder pro Termin. Datum, SM, Sollzeit und Einsatz-ID bleiben erhalten; Ersatzmarkt und Stammnummer ausschließlich in Ersatzfeldern. Ursprungsmarkt bleibt nachvollziehbar. Kein automatischer Wechsel des SM durch Stammmarkt-Zuordnung.
6. Die bisherige Seriendefinition des deaktivierten Markts darf nicht weiterlaufen. Bei einheitlichem Ersatz wird eine neue unveränderliche Marktversion angelegt; bei Absage/gemischter Einzellösung endet die ursprüngliche Serie, bereits materialisierte Ersatztermine bleiben bestehen. Bereits auf andere Märkte umgeplante Termine werden nicht abgesagt.
7. Vorschau trägt einen Fingerprint aus Markt, Stichtag, betroffenen Terminen und Serienzustand. Speichern lädt unter einer kurzen SM-Planungssperre erneut: neue Termine, Start eines Besuchs, Verschiebung oder anderer Admin => 409 und neue Vorschau, keine Teiländerung.
8. Deaktivierung und sämtliche Entscheidungen/Audit-Ereignisse erfolgen in genau einer Transaktion. Abbrechen, ungültiger Ersatz, fehlende Entscheidung oder veraltete Vorschau verändert nichts. Direkter PATCH oder Import darf betroffene Einsätze nicht ohne Entscheidung übergehen.
9. Erstellung, Umplanung, Wiederherstellung und Besuchsstart respektieren denselben SM-Planungs-Lock und aktiven Markt. Dadurch kann während der Bestätigung kein neuer Einsatz in den gerade deaktivierten Markt rutschen. Keine GM-Sperren.

## Gedankliche Gegenprobe / geplante Tests

- 15:10–15:30 vorhanden; 15:10–15:50 abgelehnt. 15:30–15:50 danach erfolgreich; Entwurf/Antworten überstehen die Ablehnung.
- Identische/verschachtelte/umgekehrte/benachbarte Intervalle, zwei Konflikte, Mitternacht, Sommerzeit, anderer SM, gelöschte Zeit, alter Fragebogenstand, fehlende manuelle Zeitstempel, Doppel-Submit.
- Zwei Verbindungen schließen unterschiedliche Fragebögen desselben SM gleichzeitig ab: genau einer erfolgreich. Ebenso Abschluss gegen Zeitkorrektur.
- Markt mit Einzeltermin und langer Serie: kompakte Vorschau; Gruppenabsage, Gruppenersatz, unterschiedliche Ersatzmärkte, gemischte Entscheidungen. Historie/Originalwerte unverändert, Audit vollständig, abgesagte Termine sichtbar.
- Ersatz inzwischen inaktiv; neuer Termin nach Vorschau; laufender Besuch nach Vorschau; verschobener Termin und bereits ersetzter Markt; keine Termine; zwei Admins; Abbrechen; direkte PATCH-/Import-Umgehung; Wiederherstellung auf inaktiven Markt; erneutes Aktivieren erzeugt keine Termine neu.
- API-Berechtigungen, Frontend-/Backend-Build, fokussierte Tests und echte SM-DB-Transaktionen. Keine GM-Testschreibvorgänge.

## Umsetzung / Nachweise

- [x] Aktuellen Code und SM-Tabellenstruktur geprüft.
- [x] Regeln, Randfälle und Transaktionsgrenzen dokumentiert.
- [x] Zentraler Zeitkonflikt-Guard, Abschluss, Korrekturen, manuelle Zeitfelder, klare Fehlermeldung.
- [x] Deaktivierungsvorschau/-Transaktion, Import-/Planungs-/Start-Schutz, Dialog und Ersatzwahl.
- [x] Automatisierte und echte DB-Verifikation einschließlich Parallelität.
- [x] Abschlussaudit und verbleibende Einschränkungen dokumentiert.

### Tatsächliche Umsetzung

- Backend: `sm-time-overlap.ts` kapselt die personenbezogene Transaktionssperre und Konfliktabfrage. Abschluss, Zeitkorrekturanfrage, Korrekturfreigabe und Admin-Ist-Zeiterfassung verwenden denselben Guard. Die SM-Antworttabellen werden bei einem Konflikt nicht verändert. Keine Migration, kein rückwirkender Eingriff in bestehende Zeiten.
- Phone: `SmVisitTimeConflict` zeigt Markt/Adresse, beide vollständigen Intervalle und den erneuten Versuch ausdrücklich an. Timer und manuelle Erfassung verwenden dieselben Start-/Endpicker. Die Dauer wird serverseitig berechnet, nicht aus einem unprüfbaren Minutenfeld übernommen. Die Konfliktkarte erhält Fokus; reduzierte Bewegung wird respektiert.
- Admin: `SmMarketDeactivationModal` öffnet unmittelbar beim Statuswechsel, lädt Vorschau und aktive Ersatzmärkte parallel und nutzt die bestehenden Admin-Dropdowns. Serienentscheidung und aufklappbare Einzelentscheidungen, feste Bestätigungsleiste, Scrollbereich, Lade-/Fehlerzustände und Tastaturfokus sind integriert. Ohne vollständige Entscheidungen kein Speichern.
- Backend: `sm-market-deactivation.ts` validiert den Vorschau-Fingerprint und führt Deaktivierung, Absagen/Ersatz und Ereignisse atomar aus. `sm-planning-lock.ts` serialisiert nur SM-Planungsmutationen. Direkter PATCH/Import darf den Dialog nicht umgehen. Die bestehenden Tabellen reichen aus; GM-Code und GM-Daten bleiben unverändert.
- Abschlussaudit: Auch Besuchsstart und Verwerfen nehmen vor der Einsatz-Zeilensperre den Planungslock. Ein bereits laufender Besuch bleibt beim Deaktivieren geschützt. Wird dieser anschließend ausdrücklich verworfen, wird sein heutiger/zukünftiger Einsatz auf dem inzwischen inaktiven Markt sichtbar abgesagt, statt erneut als startbar aufzutauchen. Vergangene Einsatzdaten werden durch die Deaktivierung nicht umgeschrieben.

### Verifikation am 31.08.2026

1. Backend- und Frontend-Produktionsbuild erfolgreich. Bestehende 30 Frontend-SM-Regressionsprüfungen erfolgreich. Drei Zeitkonflikt-Unit-Tests erfolgreich (SM-only SQL, halboffene Intervalle, verständliche Meldung, Wien/Mitternacht/Sommerzeit).
2. Echte SM-Datenbank/API-Tests in zurückgerollten Transaktionen: überlappender Abschluss 409, Entwurf bleibt erhalten, korrigierter angrenzender Abschluss 200, Wiederholung idempotent, fehlende manuelle Zeitstempel blockiert; Serienersatz und Einzelabsage, Ursprungswerte/Historie unverändert, abgesagte Zeilen in SM-Planung sichtbar, inaktive Märkte nicht neu startbar/verplanbar/wiederherstellbar.
3. Zweiter zurückgerollter Durchlauf: Korrekturfreigabe mit Überschneidung 409/pending; nach freigegebener Zeitlöschung erlaubter Zeitraum; Admin-Wiederherstellung einer kollidierenden Zeit blockiert; neuer Einsatz nach Vorschau 409, inzwischen inaktiver Ersatzmarkt 409 ohne Teiländerung, komplette Serie abgesagt/beendet, leerer Markt deaktivierbar. Nach dem abschließenden Lock-Fix erneut erfolgreich, einschließlich Verwerfen eines laufenden Besuchs nach Marktdeaktivierung.
4. Realer Paralleltest auf zwei unterschiedlichen PostgreSQL-Verbindungen: zwei gleichzeitige überschneidende Abschlüsse => genau 200 + 409; korrigierter Retry des Verlierers => 200. Nur eigens neu angelegte SM-Testzeilen wurden danach per exakter ID soft-deleted; Audit-Ereignisse bleiben nachvollziehbar. Einsatz-IDs: `7b8219f2-691b-4430-99e7-c2d6cd34dd44`, `eea9dabb-d34e-4204-83a8-a6d0876a20cb`. Keine bestehenden Kunden-/GM-Zeilen geändert oder hart gelöscht.
5. Tests sind standardmäßig datenbankfrei: `npm run test:sm-safety` in beiden Repositories. Live-Tests erfordern ausdrücklich `SM_SAFETY_DATABASE_TESTS=1`; der echte Zwei-Verbindungen-Test zusätzlich `SM_SAFETY_CONCURRENCY_TESTS=1`. Die Testanmeldung ist ausschließlich unter `NODE_ENV=test` aktiv. Fehlendes Login wurde mit 401 bestätigt; die unveränderte Produktions-Rollenprüfung bleibt vorgeschaltet.

### Grenzen / bewusste Entscheidungen

- Historische Abschlüsse ohne Zeitstempel können nicht zuverlässig auf Überschneidung geprüft werden; keine Start-/Endwerte werden erfunden. Neue Abschlüsse benötigen immer überprüfbare Intervalle. Bereits bestehende Überschneidungen werden nicht rückwirkend gelöscht oder verändert.
- Die Garantie gilt für die SM-Anwendungspfade, nicht für privilegiertes manuelles SQL außerhalb der Anwendung. Kein produktionsriskanter nachträglicher Exclusion-Constraint auf historische Daten. Transaktionsgebundene Advisory Locks sind für Connection-Pooling geeignet: [PostgreSQL-Dokumentation](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).
- Die kurze globale SM-Planungssperre schützt auch neue Einsätze zwischen Vorschau und Bestätigung. Sehr große SM-Importe können andere SM-Planungsänderungen bis zum Transaktionsende warten lassen; sie sperrt keine GM-Flows.
- Ein Browser-Smokeversuch auf localhost blieb im bestehenden Entwicklungs-/Lazy-Loading-Fehler hängen. Deshalb kein behaupteter visueller End-to-End-Nachweis aus diesem Versuch; Produktionsbuild, gerenderte Konfliktkarte und echte API-/DB-Flows bilden den überprüften Nachweis. Kein GM-Browser-Schreibtest.
