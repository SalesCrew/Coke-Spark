# SM: Umsetzungsplan für die offenen SIMPL-Karten

Stand: 15.09.2026 · Projekt Coke SPARK · Bereich SM · SIMPL-Spalte „In Arbeit“

**Status 16.09.: lokal umgesetzt und isoliert geprüft; Git-Push danach beauftragt.** Kilian hat den Kommentar und die End-to-End-Umsetzung freigegeben. Die ursprünglichen Plan-Checkboxen unten bleiben als historischer Planungsstand erhalten; tatsächliche Ergebnisse stehen in den Living MDs und im Abschlussnachtrag unten. Keine Produktionsdaten zu Testzwecken bearbeiten. Ein Git-Push ist kein Nachweis, dass das produktive Deployment erfolgreich ist.

Aktueller Fortschritt: [Mitarbeiter-Sichtbarkeit](sm-employee-visibility-living.md). Der SIMPL-Kommentar ist inhaltlich und für den signierten Browserweg freigegeben, aber noch nicht gepostet: Der Chrome-Tab war durch eine andere Browser-Session/Extension nicht steuerbar. Kein Umgehen der Authentifizierung, keine JWT-Impersonation.

Management-Fortschritt: [Living MD für das SM-Fragebogen-Management](sm-fb-management-living.md). Backend, Admin-UI, isolierte Datenbank-/HTTP-Tests und lokaler Browserfluss einschließlich Foto-Upload sind geprüft. Produktive Wirkung bleibt bis zu einem gesonderten Release ungeprüft.

## 1. Grundlage und Abgrenzung

Die Anforderungen stammen aus den vier im vorherigen Leseschritt geprüften, offenen SM-Karten in SIMPL. Beschreibungen und Kommentartexte wurden gelesen. Drei Karten haben jeweils einen Kommentar ohne Text und einen Bildanhang; die Bilder wurden nicht geöffnet. Deshalb wird aus den Anhängen keine zusätzliche Anforderung abgeleitet.

Der technische Abgleich erfolgte gegen den lokalen Quellcode:

- Frontend: `3ef326c9c24134b1f6a0eb65b71e6bbaf7291f25`.
- Separates Backend-Repository: `a01a99947b99de4538e6ceac6a1132c21ebdbd70`.
- Bestehende lokale, unversionierte Dateien bleiben unangetastet.
- „Im Code vorhanden“ bedeutet nicht „in dieser Prüfung auf Produktion getestet“. Es gab hier keine erneute Prüfung des produktiven Schemas oder Deployments.

| SIMPL-Karte | ID | Verständnis / nächster Schritt |
| --- | --- | --- |
| Zeiten, Änderungen und SM Management | `959a51c8-a263-4f3f-98e0-aa2ab378db44` | Zeitübersicht ist bereits vorhanden. Es fehlt eine eigene SM-Admin-Seite zum Lesen und nachvollziehbaren Korrigieren abgeschlossener Fragebögen. |
| Fahrzeit | `35973711-31a9-4c68-a025-c253d3ca5552` | Bei deaktivierter Fahrtzeit soll der Mitarbeiter die gesamte Eingabe nicht sehen. |
| Abgesagte Einsätze | `b592abbe-7949-4bbe-88e4-f989828a14b4` | Abgesagte Einsätze aus Mitarbeiter-Ansichten entfernen, Admin-Historie und Daten behalten. |
| Wochenansicht | `8417e8e0-4fb8-42e8-8a13-e5ea3006bb41` | Rückfrage notwendig: Welche Ansicht, und sollen auch Tage ohne Einsätze sichtbar sein? Noch nicht implementieren. |

### Feste Grenzen

- Änderungen bleiben auf SM beschränkt. GM-Daten, GM-Endpunkte und GM-Verhalten werden nicht geändert.
- GM-UI darf als Designreferenz gelesen werden. Keine Übernahme von GM-Datenmodellen in SM.
- Keine Löschung von Einsätzen, Antworten, Fotos, Zeitstempeln oder historischen Kontodaten zur Lösung dieser Karten.
- Keine Änderungen an Fragebogen-Vorlagen durch die Bearbeitung eines bereits ausgefüllten Fragebogens.
- Bestehende Pflichtkommentare, bedingte Logik, OOS-Berechnung und Zeitkorrekturen bleiben fachlich erhalten.
- Tests mit isolierten Daten und Fixtures, nicht mit künstlichen Besuchen in der Produktionsdatenbank.
- Neue Routen, Komponenten und API-Verträge in diesem Dokument sind **Vorschläge**, sofern nicht ausdrücklich als bestehend bezeichnet.

## 2. Reihenfolge

1. **Fahrzeit:** kleine, klar abgegrenzte Sichtbarkeitskorrektur.
2. **Abgesagte Einsätze:** Mitarbeiter-API, abgeleitete Anzeigen und Offline-Cache konsistent machen.
3. **SM-Fragebogen-Management:** eigene Ergebnisseite, anschließend sichere Korrekturen und vollständige Regressionstests.
4. **Wochenansicht:** erst nach Beantwortung der Rückfrage planen.

Die ersten beiden Änderungen lassen sich unabhängig vom größeren Management-Bereich verifizieren. Bei später freigegebener Umsetzung getrennte, nachvollziehbare Änderungen bilden; keine fremden lokalen Dateien in einen Commit aufnehmen.

## 3. Karte „Fahrzeit“

### Anforderung

> wenn Fahrzeit "Nein" bei Mitarbeiter bei Eingabemaske von Mitarbeiter ausblenden dass für Mitarbeiter nicht ersichtlich

### Geprüfter Ist-Zustand

- [SmVisitWorkspace.tsx](../src/components/sm/SmVisitWorkspace.tsx): `StartScreen` zeigt die Fahrtzeiteingabe bereits nur bei `payload.profile.travelTimeEnabled`.
- Im `ReviewScreen` wird dagegen die gesamte Sektion immer gerendert. Bei deaktivierter Fahrtzeit erscheint statt der Eingabe der Hinweis „Für diesen Zugang ist keine Fahrtzeiterfassung aktiviert.“
- Genau diese sichtbare Restsektion passt nicht zur Anforderung.
- [sm-visits.ts](../backend/src/routes/sm-visits.ts) lädt die Kontoeinstellung serverseitig. Bei deaktivierter Fahrtzeit werden explizit übergebene Fahrtminuten beim Abschluss bereits zurückgewiesen.
- Die abschließende UI sendet Fahrtminuten schon abhängig von der Einstellung. Die Sichtbarkeitskorrektur soll diese Schutzwirkung nicht aufweichen.

### Zielverhalten

- **Fahrtzeit Nein:** keine Überschrift, kein Icon, kein Optional-Badge, kein Hinweistext, kein Eingabefeld und kein reservierter Leerraum – weder beim Start noch beim Abschluss.
- **Fahrtzeit Ja:** identischer Ablauf wie bisher, einschließlich HH:MM-Eingabe und automatischem Doppelpunkt.
- Die Einstellung entscheidet über neue Eingaben. Bereits gespeicherte Fahrtzeiten verschwinden nicht aus historischen Zeitübersichten und Auswertungen.
- Admin- und GM-Ansichten bleiben unverändert.

### Umsetzung

- [ ] Im SM-Review die komplette Fahrtzeitsektion bedingt rendern, nicht nur den Input.
- [ ] Abstände und Fokusreihenfolge bei beiden Varianten prüfen.
- [ ] Start, Zurück-Navigation, Wiederaufnahme und Abschluss gegen dieselbe Profileigenschaft prüfen.
- [ ] Keine versteckten Werte neu mitsenden, wenn die aktuelle Kontoeinstellung deaktiviert ist.
- [ ] Keine historischen Werte auf `null` setzen, nur weil ein Feld ausgeblendet wurde.
- [ ] Bei zwischenzeitlich geänderter Einstellung die serverseitige Ablehnung verständlich behandeln; Antworten und Besuchsentwurf behalten und das aktuelle Profil nachladen.

Für die reine Sichtbarkeit ist nach aktuellem Code keine Migration erforderlich. Ein offline gespeichertes Profil kann eine inzwischen serverseitig geänderte Einstellung erst nach Synchronisierung kennen; die API bleibt entscheidend.

### Abnahme

- Konto mit Fahrtzeit Nein: Timer- und manueller Start, Fragebogen und Abschluss ohne sichtbare Fahrtzeitsektion.
- Konto mit Fahrtzeit Ja: Eingabe, Validierung, Speichern und spätere Anzeige funktionieren unverändert.
- Konto wird nach einem alten Besuch deaktiviert: die alte Fahrtzeit bleibt in dessen Historie erhalten.
- Änderung der Einstellung während eines offenen Besuchs: kein Verlust anderer Antworten, keine unzulässige Fahrtzeitbuchung.
- Mobile Ansicht ohne zusätzliche Lücke oder springenden Abschlussbutton.

## 4. Karte „Abgesagte Einsätze“

### Anforderung

> Abgesagte Einsätze sollen bitte nicht ersichtlich für Mitarbeiter sein.

### Geprüfter Ist-Zustand

- [sm-planning.ts](../backend/src/routes/sm-planning.ts): Der gemeinsame Assignment-Loader filtert gelöschte Datensätze, Datum und optional den SM, aber nicht den Status `cancelled`.
- Der Mitarbeiter-Endpunkt nutzt diesen Loader. Damit können abgesagte Einsätze weiterhin an den Mitarbeiter geliefert werden.
- [SmDashboardSchedule.tsx](../src/components/dashboard/SmDashboardSchedule.tsx) verwendet die geladenen Einsätze sowohl für Tageslisten als auch Kalendermarker und Vorladen der Fragebögen. Auch der zuerst gelesene lokale Cache fließt ein.
- [AssignmentList.tsx](../src/components/dashboard/AssignmentList.tsx) kennt einen sichtbaren Status „Abgesagt“. Diese gemeinsame Komponente darf nicht pauschal geändert werden, wenn dadurch GM betroffen wäre.
- Der Start-Endpunkt blockiert abgesagte Einsätze bereits. Das verhindert den Start, löst aber die sichtbare Anzeige nicht.
- Die SM-Handy-Zeiterfassung filtert abgesagte Einsätze in `buildDays` bereits. Die Hero-Abfrage zählt sie ebenfalls nicht als heutige Einsätze.

### Zielverhalten

| Oberfläche / Zustand | Verhalten |
| --- | --- |
| SM-Tagesliste | Abgesagter Einsatz nicht vorhanden. |
| SM-Kalendermarker und Tageszahlen | Abgesagte Einsätze zählen nicht mit. |
| SM-Vorladen von Fragebögen | Kein Vorladen abgesagter Einsätze. |
| Bekannter abgesagter Eintrag im lokalen Cache | Bereits vor dem ersten Rendern herausfiltern. |
| Admin-Verplanung und Historie | Unverändert sichtbar und nachvollziehbar; bestehendes Wiederherstellen bleibt möglich. |
| Verpasster Einsatz (`missed`) | Nicht als Absage behandeln. Keine neue fachliche Regel dafür einführen. |
| Abgeschlossener Besuch | Nicht löschen oder aus historischen Ergebnissen entfernen. |

### Server

- [ ] Mitarbeiter-Abfrage um eine explizite Sichtbarkeitsregel erweitern: `status != cancelled` zusätzlich zu den bestehenden Eigentümer-, Datums- und Löschfiltern.
- [ ] Entweder einen ausdrücklich benannten Mitarbeiter-Modus am Loader oder eine getrennte Mitarbeiter-Abfrage verwenden. Der Admin-Aufruf behält seine bisherige Ergebnismenge.
- [ ] Nur den authentifizierten, effektiven SM als Eigentümer verwenden; keine frei übergebene Benutzer-ID für den Mitarbeiterzugriff akzeptieren.
- [ ] Alte Direktlinks prüfen: Für einen abgesagten Einsatz keinen neuen Fragebogenstart zulassen und keine nutzbare Startansicht ausliefern. Klare Meldung „Dieser Einsatz wurde abgesagt“ mit Rückkehr zur Übersicht.
- [ ] Dabei vorhandene abgeschlossene Besuche nicht mit einer pauschalen Statusprüfung aus der Aktivitätshistorie entfernen.
- [ ] Einen zeitgleichen Start und eine Absage unter den vorhandenen Transaktionen/Locks testen. Kein neuer Entwurf nach einer erfolgreich abgeschlossenen Absage.

Der gemeinsame Loader darf **nicht global** verändert werden, sodass Admin-Absagen und ihre Wiederherstellung versehentlich verschwinden.

### Frontend und Cache

- [ ] Eine SM-spezifische sichtbare Assignment-Menge bilden und für Liste, Marker, Anzahl, Dauer und Vorladen verwenden.
- [ ] Dieselbe Regel auf eingelesene Cache-Daten anwenden, bevor sie gerendert werden.
- [ ] Frische, vollständige Ergebnisse für genau denselben Eigentümer und Zeitraum ersetzen die entsprechende Cache-Menge; nicht aus einem beliebigen Teilergebnis auf eine Absage schließen.
- [ ] Bekannte abgesagte Einsätze aus dem Visit-Preload entfernen. Die getrennte Warteschlange noch nicht synchronisierter Antworten nicht pauschal löschen.
- [ ] Bei Rückkehr zur Seite oder wiederhergestellter Verbindung die aktuelle Planung mit bestehender Refresh-Logik abgleichen. Keinen schnellen Polling-Timer einführen.
- [ ] Verspätete Antworten eines alten Datumsbereichs oder alten Accounts dürfen die neuere Ansicht nicht überschreiben.
- [ ] Wiederhergestellte Einsätze nach einem erneuten Laden wieder normal anzeigen; keinen dauerhaften lokalen „Verstecken“-Schalter pro ID speichern.

Relevante Cache-Funktionen liegen in [backend.ts](../src/lib/api/backend.ts). Planungs-, Visit-Preload- und Pending-Answer-Caches sind unterschiedliche Dinge und dürfen nicht als eine gemeinsame Wegwerfmenge behandelt werden.

### Unvermeidbare Offline-Grenze

Ein vollständig offline befindliches Handy kann eine erst danach auf dem Server erfolgte Absage noch nicht kennen. Die Zusage lautet deshalb:

1. Bereits bekannte Absagen werden auch offline nicht angezeigt.
2. Nach erfolgreicher Synchronisierung verschwindet die Absage konsistent aus allen Mitarbeiter-Anzeigen.
3. Beim Serverzugriff werden Start und weitere unzulässige Aktionen blockiert.
4. Noch lokal vorhandene Antworten werden nicht still gelöscht. Ein Konflikt muss erklärt werden.

Das ist keine Zusage einer sofortigen Fernlöschung auf einem Gerät ohne Verbindung.

### Abnahme

- Einzelabsage, abgesagter Serientermin, Serienende und bereits verschobener Termin jeweils separat testen.
- Nicht alle zukünftigen Serientermine als abgesagt annehmen: die tatsächlich gespeicherten Status-/Datumswerte entscheiden.
- Tagesliste, Kalender und Hero ergeben dieselbe fachliche Menge, soweit die jeweilige Kennzahl dieselbe Menge beschreibt.
- Cache mit `cancelled` vor dem Seitenaufruf: kein kurzes Aufblitzen.
- Veralteter Cache mit damals noch geplantem Termin: nach Online-Refresh entfernt.
- Wiederherstellung: Mitarbeiter sieht den Termin erneut, Admin-Historie bleibt vollständig.
- Start über einen alten Link und eine zeitgleiche Absage: verständlicher Konflikt, kein unzulässiger Start.
- Anderes SM-Konto und GM-Ansichten: kein Datenübertritt und keine Verhaltensänderung.

## 5. Karte „Zeiten, Änderungen und SM Management“

### Anforderung

> Uhrzeiten sind nicht ersichtlich wann SM Mitarbeiter im Markt war.
> Fragen nicht ersichtlich was ausgefüllt wurde im Fragebogen und keine Option vorhanden Änderungen durchzuführen.
> Wäre von Vorteil wenn es wie bei GM FB Management wäre.

### Bereits vorhanden / wirklich noch offen

- Die bestehende SM-Zeiterfassung hat bereits Zeitraumwahl, Mitarbeiter-/Tagesansichten und Anzeige gespeicherter Start-/Endzeitstempel. Das ist in [sm-time-period-employee-view-living.md](sm-time-period-employee-view-living.md) dokumentiert.
- [SmFragebogenWorkspace.tsx](../src/components/admin/sm/SmFragebogenWorkspace.tsx) ist der Bereich für Module/Vorlagen, nicht die gewünschte Verwaltung abgeschlossener Antworten.
- [sm-activity.ts](../backend/src/routes/sm-activity.ts) besitzt Mitarbeiter-Aktivitäten sowie Admin-Freigaben für Antwortänderungs- und Löschanfragen.
- Eine Admin-Ergebnisliste mit Detailansicht und direkter, eigenständig begründeter Antwortkorrektur fehlt dort noch.
- Der bestehende Freigabepfad enthält bereits wichtige Bausteine: aktuelle Antwort prüfen, Version ersetzen, Vorgänger erhalten, Auswahl-/Matrix-/Fotodaten übernehmen, Pflichtkommentare und bedingte Logik validieren, Folgefragen und Punkte neu berechnen.

### Ziel-UI

Eigene Seite **„Fragebogen-Management“**, vorgeschlagene Route `/admin/sm/fbmanagement`. Sie ergänzt „Fragebögen“, ersetzt den Vorlageneditor nicht.

**Übersicht:**

- Gleiche Admin-Navigation, Typografie, Filter- und Tabellenmuster wie die vorhandenen Bereiche.
- Eigener Eintrag nur im SM-Workspace; bestehende Rollen-/Workspace-Berechtigung beachten.
- Zeitraum mit dem vorhandenen SM-Zeitraum-Picker, standardmäßig aktueller Wiener Kalendermonat.
- Filter für SM, Markt und Fragebogen; abgeschlossene, aktuelle Fragebögen als Ausgangsmenge.
- Zeilen mit Besuchsdatum, SM, Markt, Fragebogen, Start, Ende und klarer Öffnen-Aktion.
- Serientermine desselben Marktes sind getrennte Besuche; nicht nach Markt zusammenfassen und dabei Antworten verlieren.
- Historische Namen und Fragebogenversionen anhand der beim Besuch gespeicherten Snapshots anzeigen. Ein heute inaktiver SM darf nicht aus vergangenen Ergebnissen verschwinden.
- Begrenzte, stabile Pagination statt stiller Abschneidung nach 80/120 Besuchen.

**Detailansicht:**

- Vertrautes Admin-Seitenpanel mit Besuch, SM, Markt, Datum und Zeitangaben oben.
- Abschnitte und Fragen in der gespeicherten Reihenfolge, einschließlich kleiner Untertitel.
- Aktuelle Antworten, ausgewählte Optionen, Antwortkommentare und Fotos verständlich darstellen.
- „Nicht beantwortet“, „Nicht zutreffend“ und „Durch Logik ausgeblendet“ fachlich unterscheiden.
- Ausgeblendete/ersetzte Antworten nicht als aktuelle Antworten anzeigen; ihre Historie bleibt erreichbar.
- Bearbeiten ausdrücklich einschalten. Entwurf, Speichern, Abbrechen und ungespeicherte Änderungen klar unterscheiden.
- Einen separaten, kurzen **Änderungsgrund** erfassen. Er ist nicht der Antwortkommentar des Mitarbeiters.
- Verlauf mit vorher/nachher, Zeitpunkt, bearbeitendem Admin und Grund. Ursprünglicher Besuchsmitarbeiter bleibt derselbe.

**Lade- und Fehlerzustände:**

- Initiales Skeleton bildet Filter, Tabellenzeilen und Detailstruktur ab.
- „Noch keine abgeschlossenen Fragebögen“ getrennt von „Keine Treffer für diese Filter“.
- Lesefehler mit Wiederholen; bestehende Inhalte bei Hintergrundaktualisierung nicht durch leere Flächen ersetzen.
- Beim Speichern nur die betroffene Bearbeitung sperren; kein dauerhaft blockierender Button nach einem Fehler.
- Netzwerkfehler bedeutet nicht automatisch „nicht gespeichert“. Über Mutationstoken den tatsächlichen Ausgang prüfen bzw. idempotent erneut abrufen.
- Die Admin-Korrektur ist ein Online-Vorgang. Keine neue Offline-Warteschlange für administrative Änderungen einführen.

### Server- und API-Plan

Die bestehende Express-/SM-API bleibt erhalten. Kein Architekturwechsel auf Server Actions und kein privilegierter Datenbankzugriff aus dem Browser.

Vorgeschlagene Erweiterungen unter dem bestehenden Mount `/admin/sm-activity`:

| Neuer Vertrag | Zweck |
| --- | --- |
| `GET /completed` | Gefilterte, paginierte Liste abgeschlossener SM-Fragebögen mit eindeutigen Besuchs-IDs. |
| `GET /completed/:submissionId` | Autorisierte Details aus Besuchs-Snapshots, aktuelle Antworten, Kommentar-/Fotometadaten und Konfliktversion. |
| `GET /completed/:submissionId/history` | Begrenzter Änderungsverlauf mit alten Antwortversionen und Auditdaten. |
| `POST /completed/:submissionId/corrections` | Atomare Korrektur eines oder mehrerer zusammenhängender Antworten. |

Namen und DTOs vor Implementierung final gegen die bestehenden API-Konventionen prüfen; diese Endpunkte existieren noch nicht. Signierte Fotoansichten können im autorisierten Detail-DTO enthalten sein. Ein zusätzlicher Endpunkt ist nur notwendig, wenn die vorhandene Laufzeit-/Erneuerungslogik das verlangt.

- [ ] Rollen wie beim vorhandenen SM-Admin-Router prüfen: `admin` / `sm_admin`; zusätzlich bestehende Berechtigungsregeln beachten. Normale `sm`- und `gm`-Konten ablehnen.
- [ ] IDs und Filter serverseitig validieren; jede Frage, Antwort und Datei muss zum freigegebenen SM-Besuch gehören.
- [ ] Liste und Detail mit denselben Status-/Löschregeln bilden. Keine beliebigen alten oder invalidierten Datensätze editierbar machen.
- [ ] Listenabfragen begrenzen und zusammengehörige Daten gesammelt lesen; kein einzelner Detailrequest pro Tabellenzeile.
- [ ] Datumsauswahl und Grenzen ausdrücklich als Europe/Vienna behandeln. Besuchs-/Planungsdatum, Abschlussdatum und Änderungsdatum nicht austauschbar verwenden.
- [ ] Die Management-Liste nach Besuchsdatum filtern; OOS behält seine bestehende Filterung nach Abschlusszeitpunkt. Diese unterschiedliche Semantik bei Vergleichen berücksichtigen.

### Atomare Antwortkorrektur

Ein einzelner Antwortwechsel kann mehrere Folgefragen sichtbar machen. Deshalb ist ein **gemeinsam validierter Korrekturentwurf** sinnvoller als unabhängiges Sofortspeichern jeder Frage.

1. Admin lädt den vollständigen aktuellen Besuch samt gefrorener Fragen-/Regelkonfiguration und einer serverseitig abgeleiteten Konfliktversion.
2. Änderungen bleiben zunächst lokal im Bearbeitungsentwurf. Sichtbare Folgefragen werden bereits im Entwurf aktualisiert.
3. Neu erforderliche Antworten und Pflichtkommentare können im selben Entwurf ergänzt werden.
4. Speichern sendet Änderungsgrund, Mutationstoken, erwartete Konfliktversion und die geänderten Antworten.
5. Der Server authentifiziert und lädt den Besuch innerhalb einer Transaktion mit Sperre. Lock-Reihenfolge mit existierender Freigabe und Besuchslöschung abstimmen.
6. Besuch muss weiterhin aktuell, abgeschlossen und nicht gelöscht sein. Änderungen anderer Admins seit dem Laden führen zu einem Konflikt statt Überschreiben.
7. Alle Kandidaten anhand der **gespeicherten Besuchs-Snapshots** normalisieren. Heutige Moduloptionen ersetzen keine alten Fragebogenoptionen.
8. Bedingte Sichtbarkeit für den gesamten Kandidatenzustand auswerten. Alle sichtbaren Pflichtfragen und ausgelösten Pflichtkommentare validieren.
9. Jede geänderte Antwort bekommt eine neue Version mit Vorgängerverweis. Vorherige Werte, Kommentare und Fotoreferenzen bleiben in der Historie.
10. Durch die Änderung ausgeblendete Antworten werden nicht mehr als aktuelle Auswertungsantworten geführt; ihre Historie bleibt erhalten. Keine geratenen Antworten für neu sichtbare Fragen einsetzen.
11. Antwort-/Auswahl-/Matrix-/Fotometadaten, Anwendbarkeit, Zähler/Punkte und Auditereignisse gemeinsam schreiben. Ein Fehler rollt die gesamte Korrektur zurück.
12. Der Server liefert den bestätigten aktuellen Zustand und die neue Konfliktversion zurück. Erst danach zeigt die UI „Gespeichert“ und aktualisiert betroffene Lesedaten.

### Versionierung, Parallelität und Wiederholungen

- Bestehende Antwortversionen und `supersedesAnswerId` verwenden; alte Werte nicht überschreiben.
- Konfliktprüfung muss den relevanten gesamten Besuchszustand abdecken, nicht nur die ID einer einzigen bearbeiteten Frage. Sonst können parallele Änderungen an einer steuernden Frage unbemerkt bleiben.
- Eine existierende Anfragefreigabe und eine direkte Admin-Korrektur müssen denselben Besuch konsistent sperren. Lock-Reihenfolge vor dem Extrahieren gemeinsamer Hilfsfunktionen prüfen und testen.
- Gleicher Mutationstoken plus gleiche normalisierte Nutzlast liefert dasselbe Ergebnis zurück. Derselbe Token mit abweichender Nutzlast wird abgelehnt.
- Ob die vorhandene Ereignistabelle dafür eine ausreichend sichere und effiziente Grundlage ist, muss vor Umsetzung geprüft werden. Falls nicht, eine kleine, additive **SM-only** Mutationstabelle/Constraint planen. Nicht unbelegt behaupten, dass gar keine Migration nötig ist.
- Offene Mitarbeiter-Änderungsanfragen werden nicht automatisch genehmigt oder abgelehnt. Nach einer überholenden Korrektur muss eine veraltete Anfrage als Konflikt erkennbar sein; die vorhandene Prüfung der ursprünglichen Antwort darf nicht entfallen.

### Kommentare, Antworttypen und Fotos

- Alle im SM-Modell vorhandenen Antworttypen berücksichtigen: Auswahl, Mehrfachauswahl, Ja/Nein mit Zusatzoptionen, Text, Zahl, Matrix und Foto.
- Keine GM-spezifischen Matrix-/Fotosemantiken einführen. Vorhandene SM-Normalisierung und Validierung wiederverwenden.
- Pflichtkommentar wird anhand der ausgewählten Antwort ausgelöst, auch wenn die Frage selbst nicht als Pflichtfrage markiert ist.
- Unveränderte Kommentare nicht versehentlich durch einen Teil-Patch leeren. Eine beabsichtigte Kommentaränderung erhält ebenfalls eine neue Antwortversion.
- Fotos autorisiert über zeitlich begrenzte URLs anzeigen; niemals einen privaten Bucket öffentlich machen.
- Bestehende Fotodateien bei einer Korrektur versioniert referenzieren, nicht deren Storage-Objekte überschreiben oder löschen.
- Foto-Neuaufnahme/-Ersetzung braucht einen eigenen, auf Admin und Besuch begrenzten Upload-/Commit-Pfad nach dem SM-Muster. Keine beliebigen Datei-IDs akzeptieren und keine globale Lockerung des nur für Entwürfe gedachten Mitarbeiter-Endpunkts.
- Neu hinzugefügte Fotos sind administrative Nachträge; Urheber/Zeitpunkt im Verlauf unterscheiden. Upload-Fehler dürfen die vorher gültige Antwort nicht zerstören.
- Foto-Entfernung oder Ersetzung nur innerhalb der gültigen Fragebedingungen. Referenzierte historische Originale bleiben erhalten; eine spätere Bereinigung unreferenzierter Uploads ist kein Bestandteil dieser Karten.

### Zeiten, Aktivitäten und OOS

- Antwortkorrektur ist **keine** neue Marktvisite und **keine** neue Zeitbuchung.
- `visitStartedAt`, `visitCompletedAt`, ursprünglicher Mitarbeiter, Besuchs-/Abschlusszeit und bestehende Zeiterfassung bleiben unverändert. Fehlende historische Zeitstempel als fehlend anzeigen, nicht schätzen.
- Zeitänderungen weiterhin über den vorhandenen Zeitkorrekturprozess; keine zweite Zeitlogik im Antworteditor bauen.
- Mitarbeiter-Aktivitäten zeigen nach erneuter autorisierter Abfrage die gültige korrigierte Antwort. Eine offene, schon abgeschlossene lokale Ansicht darf sie nach Revalidierung nicht wieder durch einen alten Snapshot ersetzen.
- [sm-dashboard.ts](../backend/src/routes/sm-dashboard.ts) berücksichtigt bereits aktuelle, nicht gelöschte, abgeschlossene und fürs Reporting freigegebene SM-Fragebögen sowie anwendbare Fragen und aktuelle gültige Antworten.
- OOS-Zuordnung und Auswahl-Snapshots müssen bei einer Korrektur vollständig mitgeschrieben werden. Sonst würden Textansicht und Kennzahlen auseinanderlaufen.
- Keine Zähler manuell inkrementieren und keine neue Formel erfinden. Dieselbe bestehende Berechnung muss den korrigierten Antwortstand beim nächsten autoritativen Laden lesen.
- Bearbeitungszeitpunkt darf einen August-Besuch nicht plötzlich in die September-Auswertung verschieben.
- Ausgeblendete Antworten und alte Versionen zählen nicht zusätzlich. Eine Korrektur kann OOS-Zahlen sowohl erhöhen als auch senken.
- Listen-, Detail- und Dashboard-Lesedaten nach Erfolg gezielt revalidieren. Ohne vorhandenen Push-Kanal keine geräteübergreifende Echtzeitaktualisierung versprechen.

### Datenmodell und Dateigrenzen

Bestehende Grundlage in [schema.ts](../backend/src/lib/schema.ts):

- `sm_questionnaire_submissions`, `sm_questionnaire_submission_sections`, `sm_questionnaire_submission_questions`.
- `sm_question_answers`, `sm_question_answer_options`, `sm_question_answer_matrix_cells`, `sm_question_answer_files`, `sm_question_answer_events`.
- `sm_answer_change_requests` und die bestehenden Besuchslösch-/Zeitkorrekturprozesse.
- `sm_assignments`, `sm_assignment_time_submissions`, `sm_markets` als Besuchs-/Planungsbezug.
- Zentrale Benutzerdaten für autorisierte Rollenprüfung und Namen lesen; keine GM-Konten bearbeiten.

Voraussichtliche Änderungsorte bei späterer Umsetzung:

- Neu: `src/app/admin/sm/fbmanagement/page.tsx` und `src/components/admin/sm/SmFbManagementWorkspace.tsx`.
- SM-Navigation in [adminNavigation.ts](../src/components/ui/adminNavigation.ts) sowie SM-spezifische Header-Erkennung in [admin/layout.tsx](../src/app/admin/layout.tsx).
- SM-DTOs und API-Aufrufe in [backend.ts](../src/lib/api/backend.ts).
- Erweiterung von [sm-activity.ts](../backend/src/routes/sm-activity.ts), bei Bedarf Extraktion gemeinsamer **SM**-Korrekturhilfen.
- SM-Fotohandling entsprechend dem vorhandenen [sm-visits.ts](../backend/src/routes/sm-visits.ts), ohne dessen Mitarbeiterrechte auszuweiten.
- Additive Migration nur bei nachgewiesenem Bedarf für Idempotenz/Indexierung; keine pauschale Schema-Synchronisation gegen Produktion.

## 6. Durchgespielte Abläufe und Regressionen

Die folgende Tabelle ist eine **Testplanung**, kein Bericht über bereits ausgeführte Tests.

| Fall | Erwartetes Ergebnis |
| --- | --- |
| Fahrtzeit deaktiviert, frischer Start und Abschluss | Vollständige Sektion unsichtbar; keine neuen Fahrtminuten im Request. |
| Fahrtzeit nach einem alten Besuch deaktiviert | Alte Werte bleiben historisch sichtbar; neue Eingabe verborgen. |
| Absage während geöffneter Wochenübersicht | Nach Refresh aus Liste, Marker und Cache entfernt; Admin-Historie bleibt. |
| Absage während Gerät offline ist | Nach Synchronisierung erkannt; keine Behauptung sofortiger Kenntnis und kein stiller Verlust lokaler Antworten. |
| Abgesagter Einsatz wird wiederhergestellt | Nach Refresh wieder sichtbar; keine dauerhaft gesperrte Cache-ID. |
| Zwei Termine desselben Markts | Getrennte Besuchs-IDs, Antworten und Zeitstempel. |
| Alter Besuch, Modul inzwischen geändert | Detail und Validierung verwenden den alten Besuchs-Snapshot. |
| Admin korrigiert eine OOS-Antwort | Neue Antwortversion, alte erhalten; OOS-Ergebnis entspricht aktueller Antwort nach Reload. |
| Korrektur zeigt neue Pflichtfrage | Speichern erst mit vollständigem gemeinsamen Entwurf; keine halb gültige Submission. |
| Korrektur blendet beantwortete Folgefrage aus | Nicht mehr aktuell auswertbar, alte Antwort weiterhin im Verlauf. |
| Antwort triggert Pflichtkommentar | Leerer Kommentar wird serverseitig abgelehnt; Grund ersetzt Kommentar nicht. |
| Fotoantwort wird geändert | Nur autorisierte Dateien; alter Beleg bleibt; Upload-/Transaktionsfehler zerstört nichts. |
| Zwei Admins korrigieren parallel | Zweiter veralteter Entwurf erhält Konflikt, überschreibt den ersten nicht. |
| Direkte Korrektur parallel zu Anfragefreigabe | Sperren und Versionsprüfung verhindern Lost Updates. |
| Besuch wird während Bearbeitung invalidiert | Korrektur wird abgelehnt, kein Wiederbeleben durch Speichern. |
| Server speichert, Antwort geht im Netz verloren | Derselbe Token erzeugt keine zweite Korrektur. |
| Zugriff mit normalem SM-/GM-Konto oder fremder Foto-ID | Zugriff abgelehnt; keine fremden Inhalte. |
| Inaktiver SM mit alten Ergebnissen | Ergebnisse bleiben in der Admin-Historie auffindbar. |
| Korrektur im Folgemonat | Originale Besuchs-/Abschlusszeit und Reporting-Zuordnung unverändert. |
| Zeitraum-/Accountwechsel während Laden | Veraltete Antworten überschreiben die neue Ansicht nicht. |

## 7. Verifikation und Freigabekriterien

### Automatisierte Tests bei Umsetzung

- [ ] Unit-Tests für vollständige Fahrtzeit-Sichtbarkeit und unveränderte HH:MM-Eingabe.
- [ ] Gemeinsame SM-Sichtbarkeitsregel mit allen Assignment-Statuswerten testen; `cancelled` nicht mit `missed` verwechseln.
- [ ] Cache-Hydration, Refresh, Wiederherstellung und Eigentümerwechsel testen.
- [ ] Neue API-Tests für Admin-Liste, Detail, Rollen, Filtergrenzen und Pagination.
- [ ] Transaktionstests für Versionen, Audit, Pflichtkommentare, Folgefragen, Fotos, Rollback, parallele Korrekturen und idempotente Wiederholung.
- [ ] Bestehende Anfragefreigaben, Löschfreigaben, Zeitkorrekturen, Serientermine und OOS-Auswertung regressionsprüfen.
- [ ] Isolierte PostgreSQL-nahe Integrationstests verwenden. Produktionsdaten nicht als Testfixture mutieren.

Vorhandene Einstiegspunkte: Frontend `test:sm-comments`, `test:sm-dashboard`, `test:sm-oos`, `test:sm-planning-cancellation`, `test:sm-time-view`; Backend `test:sm-comments`, `test:sm-series`, `test:sm-safety` und die SM-Tests im normalen Testskript. Neue Integrationstests müssen zusätzlich angelegt/eingehängt werden; die bestehenden Skripte decken die neuen Funktionen nicht automatisch ab.

### UI- und Release-Prüfung

- [ ] Lokale SM-Admin- und Handy-Flows mit kontrollierten Daten vollständig durchgehen: laden → ändern → speichern → neu laden → Verlauf/Aktivitäten/OOS prüfen.
- [ ] Kleine Handybreite und normale Admin-Breite prüfen; keine GM-Produktionsbesuche zum Test starten.
- [ ] Beide Projekte bauen und die relevanten Tests ausführen. Tatsächliche Ergebnisse dokumentieren, nicht aus Quellcode-Lesen ableiten.
- [ ] Falls neue Schemaelemente notwendig sind: Zielprojekt und Live-Schema vor einer freigegebenen Migration lesen, Migration eng abgrenzen und Rollback vorbereiten.
- [ ] Backend-Vertrag vor dem ihn benötigenden Frontend bereitstellen; vorherige Frontend-Version muss weiter funktionieren.
- [ ] Vor einem später beauftragten Push beide Git-Repositories samt Frontend-Gitlink prüfen. Nur freigegebene Änderungen aufnehmen.
- [ ] Konkrete produktive Railway-Service-Zuordnung und Vercel-Deployment prüfen, nicht irgendeinen grünen Status eines anderen Services als Produktionsnachweis verwenden.
- [ ] Bei Rücknahme Code zurückrollen, nicht bereits gespeicherte Antwortversionen oder Auditdaten löschen.
- [ ] SIMPL-Karten erst nach tatsächlich erfüllter Abnahme und ausdrücklichem Auftrag auf „Fertig“ setzen.

## 8. Dokumentation während der Umsetzung

Dieses Dokument ist der Plan. Die tatsächliche Implementierung bekommt nachvollziehbare Ergebnisse und offene Punkte; nicht einfach alle Checkboxen abhaken.

- Neu: ein fokussiertes Living-MD für das SM-Fragebogen-Management mit API-Vertrag, Berechtigung, Versionierung und Korrekturablauf.
- [sm-questionnaire-submission-living.md](sm-questionnaire-submission-living.md): Admin-Korrekturen, Wiederaufnahme/Cache-Abgrenzung und unveränderte Abschlussregeln ergänzen.
- [sm-answer-comments-living.md](sm-answer-comments-living.md): Pflichtkommentare bei Admin-Korrekturen und Trennung vom Änderungsgrund ergänzen.
- [sm-planning-data-model.md](sm-planning-data-model.md): Mitarbeiter-Sichtbarkeit bei Absagen, Admin-Historie und Offline-Grenze dokumentieren.
- [sm-time-period-employee-view-living.md](sm-time-period-employee-view-living.md): historische Fahrtzeiten und unveränderte Zeitstempel bei Antwortkorrekturen festhalten.
- [sm-questionnaire-data-model.md](sm-questionnaire-data-model.md): nur tatsächlich umgesetzte Erweiterungen, insbesondere eine gegebenenfalls notwendige Mutationstabelle, nachtragen.
- Vorhandene Aussagen über frühere Produktionsdatenstände nicht als aktuellen Datenbankbefund übernehmen.

## 9. Offene Karte „Wochenansicht“ – Kommentarentwurf

Beschreibung: „es wird nicht die ganze Woche angezeigt“.

Der Quellcode liefert mehrere plausible Ansatzpunkte: Der Handy-Startbildschirm verwendet einen Streifen mit fünf sichtbaren Tagen; die Handy-Zeiterfassung begrenzt ihren Wochenzeitraum auf Montag bis heute und hat zusätzlich eine Mo–Fr-Beschriftung. Daraus lässt sich nicht sicher ableiten, welche Ansicht Alina meint. Die Admin-Verplanung ist ebenfalls eine mögliche gemeinte Oberfläche.

**Von Kilian genehmigter Wortlaut, noch nicht in SIMPL veröffentlicht:**

> Meinst du die Wochenansicht auf der Startseite am Handy, in der Zeiterfassung oder in der Admin-Verplanung? Sollen immer alle Tage von Montag bis Sonntag sichtbar sein, auch wenn keine Einsätze geplant sind?

Nach wiederhergestelltem Zugriff auf die authentifizierte SIMPL-Sitzung genau diesen Kommentar in die Karte schreiben. Bis zur Antwort keine der möglichen Wochenansichten auf Verdacht ändern.

## 10. Arbeitsstand dieses Auftrags

- [x] Die vier SM-Karten aus dem vorherigen SIMPL-Lesestand berücksichtigt.
- [x] Die drei klaren Anforderungen gegen relevante Codepfade geprüft.
- [x] Auswirkungen auf Historie, Zeitwerte, Kommentare, Logik, OOS und Cache durchgeplant.
- [x] Kommentarentwurf für die eine unklare Karte formuliert.
- [x] Dieses Planungsdokument erstellt.
- [x] Kommentar von Kilian freigegeben; Veröffentlichung weiterhin offen wegen Browserzugriff.
- [x] Drei klar spezifizierte Funktionen lokal implementiert und isoliert getestet; Einzelheiten in den Living MDs.
- [ ] Deployment/Push beauftragt und verifiziert.
- [ ] Erledigte Karten nach Auftrag aktualisiert.

### Abschlussnachtrag 16.09.2026

Die drei klaren Karten sind im lokalen Arbeitsstand end-to-end umgesetzt. Der isolierte SM-Integrationstest läuft gegen echte SM-Migrationen in PGlite und echte HTTP-Routen (20/20 inklusive Suite). `test:sm-management` besteht mit 14/14, beide Produktionsbuilds bestehen. Der Browserfluss für abgeschlossene SM-Fragebögen deckt Korrektur, Pflichtkommentar, Textantwort, OOS-Änderung, History, Foto-Upload, signierte Fotoansicht, Entwurfswarnung, Leerzustände und 390-px-Layout ab. Mitarbeiter-API, Cache, Absage/Wiederherstellung, Aktivität und historische Zeitwerte sind zusätzlich automatisiert abgedeckt. Kein GM-Datensatz und kein produktiver SM-Datensatz wurde für diese Tests geändert.

Der Backend-Gesamttest ist **nicht** komplett grün: 151/155, vier Fehler in nicht angefassten GM/RED-Datumstests. Diese Abweichung ist kein Nachweis eines SM-Fehlers, wird aber auch nicht als bestanden verschwiegen. Die produktive Abnahme, der SIMPL-Kommentar und ein eventueller Push bleiben getrennte Schritte. Die älteren Checklisten dieses Dokuments sind als Planungsreferenz zu lesen, nicht als aktueller offener Arbeitsauftrag.
