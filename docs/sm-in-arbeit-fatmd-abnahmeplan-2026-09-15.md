# FatMD: offene SM-Karten – Fertigstellungs- und Abnahmeplan

Stand des ursprünglichen Plans: 15.09.2026 · Fortsetzung: 16.09.2026 · SIMPL / Development / Coke SPARK / In Arbeit / Label SM

> **Fortsetzung nach ausdrücklicher Freigabe:** Der Satz „Nicht enthalten: Kommentar veröffentlichen … Funktionen implementieren“ unten beschreibt nur den ursprünglichen Planungsauftrag. Kilian hat danach genau den Rückfragekommentar und die End-to-End-Umsetzung der drei klaren Karten freigegeben. Diese sind nun lokal implementiert und isoliert geprüft; siehe [Abschlussnachtrag im Umsetzungsplan](sm-in-arbeit-2026-09-15-fat-plan.md#abschlussnachtrag-16092026), [Management-Living-MD](sm-fb-management-living.md) und [Mitarbeiter-Sichtbarkeit](sm-employee-visibility-living.md). Ein Git-Push wurde am 16.09. separat beauftragt; Deployment und SIMPL-Kartenstatus müssen nach der jeweiligen Aktion geprüft werden. Keine Teständerung an Produktionsdaten.

## Auftrag und belastbarer Stand

Dieser Auftrag liefert einen Kommentarentwurf zur Freigabe und den Plan für die drei klaren Karten. **Nicht enthalten:** Kommentar veröffentlichen, Karten abschließen, weitere Funktionen implementieren, Produktionsdaten ändern oder pushen.

Die vier Karten samt vollständigen Beschreibungen und vorhandenen Kommentartexten wurden erneut direkt aus SIMPL gelesen. Identität und Workspace-Zugriff wurden nach dem `simpl-briefing`-Skill geprüft; alle Datenbankabfragen liefen in Read-only-Transaktionen.

Die Karten Fahrzeit, Wochenansicht und Abgesagte Einsätze haben jeweils einen leeren Kommentar und einen Bildanhang. Die Anhänge wurden nur als Metadaten gelesen, nicht geöffnet. Aus ihnen werden keine zusätzlichen Anforderungen behauptet.

Im lokalen Arbeitsverzeichnis liegen bereits uncommittete Änderungen für die drei klaren Karten. Die unten genannten Codebestandteile sind beim Lesen vorhanden, aber **nicht durch diesen Plan als fertig, getestet oder produktiv freigegeben**. Vorhandene Änderungen werden erhalten. Der ältere ausführliche [Planungsstand](sm-in-arbeit-2026-09-15-fat-plan.md) und die Living MDs bleiben als Arbeitsunterlagen bestehen; dieser Plan beschreibt den erneut geprüften Stand und die noch erforderliche Abnahme.

| Karte | SIMPL-ID | Umfang |
| --- | --- | --- |
| Fahrzeit | `35973711-31a9-4c68-a025-c253d3ca5552` | Fahrtzeiteingaben bei deaktivierter Kontoeinstellung vollständig ausblenden. |
| Abgesagte Einsätze | `b592abbe-7949-4bbe-88e4-f989828a14b4` | Mitarbeiter sieht Absagen nicht; Admin-Historie und Daten bleiben erhalten. |
| Zeiten, Änderungen und SM Management | `959a51c8-a263-4f3f-98e0-aa2ab378db44` | Abgeschlossene Fragebögen mit Zeiten und Antworten ansehen und nachvollziehbar korrigieren. |
| Wochenansicht | `8417e8e0-4fb8-42e8-8a13-e5ea3006bb41` | Oberfläche und gewünschte Wochendarstellung klären; bis dahin keine Änderung. |

## 1. Unverhandelbare Grenzen

- Nur SM-Verhalten ändern. Gemeinsame Dateien dürfen ausschließlich in SM-spezifischen Zweigen angepasst werden; GM-UI, GM-Endpunkte und GM-Produktionsdaten bleiben unverändert.
- Keine Besuche, Antworten, Kommentare, Fotos oder Zeitbuchungen zum Beheben der Karten löschen.
- Keine künstlichen Testdaten in Produktion anlegen. Tests mit isolierter Datenbank und lokalen Fixtures durchführen.
- Historische Fragebogen-Snapshots verwenden, nicht inzwischen geänderte Vorlagen.
- Tatsächliche Zeitstempel erhalten. Fehlende Zeiten als fehlend anzeigen, niemals rekonstruieren oder erfinden.
- Keine abgeschlossene Karte oder erfolgreiches Deployment aus bloß vorhandenem Quellcode ableiten.
- Erst nach einem gesonderten Umsetzungsauftrag weiter implementieren. Push, produktive Migration und SIMPL-Abschluss benötigen den entsprechenden Auftrag.

## 2. Reihenfolge

1. Vorhandene Änderungen gegen diesen Plan prüfen; keine zweite Parallelimplementierung bauen.
2. Fahrzeit isoliert fertigstellen und verifizieren.
3. Abgesagte Einsätze einschließlich API, Cache und Wiederherstellung verifizieren.
4. Fragebogen-Management vervollständigen, transaktional und im UI abnehmen.
5. Beide Repositories bauen, Regressionen prüfen und tatsächliche Ergebnisse dokumentieren.
6. Wochenansicht erst nach Alinas Antwort konkret planen.

## 3. Fahrzeit

### Verständnis

Wenn beim SM-Konto Fahrtzeit auf Nein steht, soll der Mitarbeiter die Eingabe überhaupt nicht sehen – auch keine deaktivierte Restsektion. Das löscht keine früher erfasste Fahrtzeit.

### Im lokalen Code vorhanden

- `src/components/sm/SmVisitWorkspace.tsx`: Start und Review rendern die Fahrtzeitsektion bereits bedingt über `profile.travelTimeEnabled`.
- Der Abschluss-Request nimmt Fahrtminuten nur bei aktivierter Einstellung auf.
- `backend/src/routes/sm-visits.ts`: Kontoeinstellung wird serverseitig geladen; explizite Fahrtminuten bei deaktivierter Einstellung werden beim Abschluss zurückgewiesen.
- `tests/sm-employee-visibility.test.mjs` enthält neue Sichtbarkeitsprüfungen. Existenz des Tests ist kein aktueller Testerfolgsnachweis.

### Noch zu erledigen / prüfen

- [ ] Start und Abschluss mit aktivierter sowie deaktivierter Fahrtzeit rendern: keine Überschrift, Hinweiszeile, Badge oder leere Karte bei Nein.
- [ ] HH:MM und automatischen Doppelpunkt bei Ja unverändert prüfen.
- [ ] Request-Inhalt und Backend-Ablehnung für unzulässige Fahrtminuten testen.
- [ ] Einstellung während eines offenen Fragebogens ändern: nach Revalidierung richtige UI und verständlicher Fehler statt dauerhaftem Ladebutton.
- [ ] Bereits gespeicherte historische Fahrtminuten bleiben in Zeitübersicht und Export erhalten.
- [ ] Kleine Handybreite, Fokusreihenfolge und Position des Abschlussbuttons prüfen.

**Abnahme:** Die gesamte Eingabe ist bei Nein unsichtbar; bei Ja funktioniert der bisherige Ablauf. Historische Werte, Admin und GM bleiben unverändert.

## 4. Abgesagte Einsätze

### Verständnis

Nur der Status `cancelled` wird für Mitarbeiter ausgeblendet. `missed` ist keine Absage. Die Admin-Verplanung behält Absagen und ihre Wiederherstellung; abgeschlossene Besuchshistorie bleibt bestehen.

### Im lokalen Code vorhanden

- `backend/src/routes/sm-planning.ts`: Der gemeinsame Loader besitzt einen ausdrücklich getrennten Mitarbeiter-Modus mit `status != cancelled`.
- `backend/src/routes/sm-visits.ts`: Bekannter abgesagter Direktlink erhält `sm_visit_assignment_cancelled`; der bestehende Startpfad blockiert unzulässige Statuswerte.
- `src/lib/sm/assignmentVisibility.ts`: SM-spezifische Filterregel.
- `src/lib/api/backend.ts`: Planungscache und Mitarbeiter-Antworten werden gefiltert; Visit-Preload wird bei bekannter Absage entfernt. Eigentümerprüfungen sind vorhanden.
- `src/components/dashboard/SmDashboardSchedule.tsx`: Liste, Kalendermarker und Vorladen verwenden dieselbe sichtbare Menge; Fokus/Online-Wechsel lösen Refresh aus, kein schneller Intervalltimer.

### Noch zu erledigen / prüfen

- [ ] Mitarbeiter-API liefert keine Absagen, Admin-API weiterhin alle zulässigen historischen Einträge.
- [ ] Einzelabsage, abgesagten Serientermin und Serienende jeweils prüfen; nicht pauschal alle künftigen Serienbesuche ausblenden.
- [ ] Bekannte Absage im Cache darf auch beim ersten Rendern nicht kurz erscheinen.
- [ ] Frischer vollständiger Zeitraum ersetzt ausschließlich den Cache dieses Kontos und Zeitraums; Teilergebnisse dürfen keine vermeintlichen Absagen erzeugen.
- [ ] Pending-Answer-Warteschlange bleibt unberührt. Noch nicht synchronisierte Antworten nicht beim Entfernen eines Preloads löschen.
- [ ] Absage während geöffneter Seite bzw. Startversuch: klarer Konflikt und Rückkehr zur Übersicht, kein weiter nutzbarer Startbildschirm.
- [ ] Gleichzeitigen Start und Absage mit den vorhandenen Transaktions-/Sperrregeln prüfen.
- [ ] Wiederhergestellter Einsatz erscheint nach Refresh wieder. Keine dauerhafte lokale Sperrliste.
- [ ] Langsame Antworten nach Konto- oder Zeitraumwechsel dürfen keine alten Daten zurückbringen.
- [ ] Tagesliste, Kalender, Hero und Zeiterfassung hinsichtlich Absagen abgleichen, ohne unterschiedliche Kennzahlen fachlich gleichzusetzen.

**Offline-Grenze:** Ein offline befindliches Gerät kennt eine neue serverseitige Absage noch nicht. Bereits bekannte Absagen bleiben verborgen; neue werden beim erfolgreichen Abgleich erkannt. Kein Versprechen einer sofortigen Fernaktualisierung ohne Verbindung.

**Abnahme:** Mitarbeiter-Anzeigen sind nach Abgleich konsistent; Admin-Historie, Restore, alte Besuche und lokale offene Antworten bleiben erhalten.

## 5. Zeiten, Änderungen und SM Management

### Verständnis und bestehende Grundlage

Alina möchte wie im GM-FB-Management abgeschlossene Besuche finden, deren Start/Ende und Antworten ansehen und Antworten ändern können. Die bereits vorhandene SM-Zeiterfassung nicht neu bauen. Eine Antwortkorrektur ist keine Zeitkorrektur und kein neuer Besuch.

Im lokalen Arbeitsstand vorhanden:

- Route `src/app/admin/sm/fbmanagement/page.tsx`, SM-Navigation sowie `SmFbManagementWorkspace.tsx` mit CSS-Modul und Antworteditor.
- Liste mit Zeitraum, SM, Markt, Fragebogen, Suche und Pagination; Detailpanel mit Entwurf, Änderungsgrund, Kommentaren, Fotos und Verlauf.
- DTOs in `src/types/smManagement.ts`, API-Anbindung in `src/lib/api/backend.ts`.
- Backend-Router `backend/src/routes/sm-management.ts`, eingebunden unter `/admin/sm-activity/completed`.
- Transaktionaler Dienst `backend/src/sm-management.ts` mit Antwortversionen, Konfliktprüfung und wiederholbarem Speichern über Mutationstoken.
- Isolierter Integrationstest `backend/src/sm-management.integration.test.ts`.

Konkrete verbleibende UI-Lücke beim Lesen: `src/app/admin/layout.tsx` erkennt `isSmFbManagement` bereits für Aktionen, berücksichtigt es aber noch nicht in `pageTitle`. Die Seite darf nicht mit der allgemeinen Fallback-Überschrift erscheinen.

### Ziel-UI und noch offene Integrationsprüfung

- [ ] Eigener SM-Navigationseintrag und korrekter Seitentitel; keine unpassenden GM-Aktionen oder Exportbuttons.
- [ ] Vorhandene Admin-Dropdowns und Zeitraumwahl wiederverwenden, keine zweite Designsprache.
- [ ] Jeder Besuch hat seine eigene Zeile und ID, auch bei wiederholten Besuchen desselben Markts.
- [ ] Historische, heute inaktive SMs bleiben auffindbar; keine Pflicht zum aktuellen aktiven Mitarbeiterkonto für die Anzeige alter Ergebnisse.
- [ ] Vollständige Ladezustände, hilfreicher Leerzustand, sichtbarer Fehler mit Wiederholen. Hintergrundaktualisierung ersetzt gültige Daten nicht unnötig durch leere Flächen.
- [ ] Detailpanel zeigt gespeicherte Fragen, Reihenfolge, kleine Untertitel, aktuelle Antworten und Zeiten.
- [ ] Nicht beantwortet, nicht zutreffend und durch Logik ausgeblendet korrekt unterscheiden.
- [ ] Alle tatsächlich unterstützten SM-Antworttypen anhand der vorhandenen Normalisierung abgleichen: Auswahl, Mehrfachauswahl, Ja/Nein mit Zusatzoptionen, Text, Zahl/Slider, Matrix, Foto.
- [ ] Untertitel-Konfigurationsnamen und Matrixauswahlregeln direkt mit dem bestehenden SM-Fragebogen vergleichen, nicht aus dem neuen Editor ableiten.
- [ ] Explizites Bearbeiten, Speichern, Abbrechen; Warnung bei ungespeichertem Entwurf. Tastaturfokus, Escape, Handybreite und Schließen nach Fehler prüfen.
- [ ] Netzwerkfehler darf nicht als sichere Nicht-Speicherung dargestellt werden. Unklaren Ausgang mit demselben Token prüfen, ohne den Nutzer dauerhaft einzusperren.

### API-Vertrag, der fertig geprüft werden muss

| Bestehender lokaler Entwurf | Zweck / Abnahme |
| --- | --- |
| `GET /admin/sm-activity/completed` | Begrenzte Liste, validierter Zeitraum und Filter, stabiler Datum/ID-Cursor. |
| `GET /admin/sm-activity/completed/:submissionId` | Nur aktueller, abgeschlossener, nicht gelöschter SM-Besuch; Snapshot-Details und Konfliktversion. |
| `GET /admin/sm-activity/completed/:submissionId/history` | Begrenzter Verlauf pro Frage, Versionscursor, Urheber, Zeitpunkt, Grund und Originalfotos. |
| `POST /admin/sm-activity/completed/:submissionId/corrections` | Gesamten zusammenhängenden Antwortentwurf atomar validieren und versionieren. |
| `POST /admin/sm-activity/completed/:submissionId/photos/upload-url` | Privater, auf Admin, Besuch und Frage begrenzter Upload; kein Überschreiben vorhandener Objekte. |

- [ ] Rollen `admin` und `sm_admin` einschließlich bestehender Kontosperren prüfen. Normale SM- und GM-Konten dürfen die Admin-Endpunkte nicht verwenden.
- [ ] Jede Frage, Antwort und Datei muss zum autorisierten SM-Besuch gehören; fremde IDs zurückweisen.
- [ ] Pagination, Filterkombinationen, leere Ergebnisse und Grenztage in Europe/Vienna testen. Der lokale Entwurf begrenzt Zeiträume auf 93 Tage.
- [ ] Listendatum bleibt Besuchsdatum; OOS behält seine vorhandene Abschlussdatum-Semantik. Keine neue Kennzahl durch stillen Datumswechsel.
- [ ] Private Foto-URLs dürfen fehlen oder ablaufen, ohne das ganze Ergebnis unlesbar zu machen; Nachladen anbieten.

### Sichere Korrektur: verbindlicher Ablauf

1. Aktuellen Besuch mit gespeicherten Fragen-/Options-/Regel-Snapshots und Konfliktversion laden.
2. Änderungen zunächst nur im lokalen Entwurf sammeln. Folgefragen und Pflichtkommentare sofort entsprechend den Regeln anzeigen.
3. Separaten Änderungsgrund verlangen; dieser ersetzt keinen Antwortkommentar.
4. Server sperrt den Besuch, prüft aktuellen Abschluss-/Löschstatus, erwartete Version und Mutationstoken.
5. Gesamten Kandidatenzustand nach den historischen Regeln normalisieren und validieren. Neue Pflichtfragen und ausgelöste Pflichtkommentare müssen im selben Speichervorgang beantwortet werden.
6. Geänderte Antworten als neue Versionen mit Vorgängerverweis schreiben. Originalwerte, Kommentare und Fotoreferenzen erhalten.
7. Durch Logik ausgeblendete Antworten aus der aktuellen Auswertungsmenge nehmen, nicht aus der Historie löschen.
8. Auswahl-, Matrix- und Fotodatensätze, Anwendbarkeit, Punkte und Audit gemeinsam schreiben. Jeder Fehler rollt die gesamte Korrektur zurück.
9. Gleicher Token mit gleicher Nutzlast liefert den bestätigten Erfolg erneut; abweichende Nutzlast mit demselben Token wird abgelehnt.
10. Erst nach bestätigtem Erfolg gespeichert anzeigen und gültige Details neu laden. Liste, Aktivitäten und betroffene Dashboard-Lesedaten müssen beim autoritativen Reload den aktuellen Stand zeigen.

### Besondere Daten- und Fehlerrisiken

- [ ] Zwei Admins sowie direkte Korrektur parallel zur bestehenden Anfragefreigabe/Löschfreigabe: Sperrreihenfolge und Konfliktprüfung verhindern Überschreiben und Deadlocks.
- [ ] Ausgeblendete und später wieder eingeblendete Antwort: neue Versionsnummer muss höher als alle historischen Versionen sein, nicht nur höher als die aktuelle.
- [ ] Pflichtkommentar auch bei einer nicht verpflichtenden Frage serverseitig verlangen, sobald die gewählte Antwort ihn auslöst.
- [ ] Kommentar-only-Korrektur und unveränderte Kommentare prüfen; Kommentar nicht versehentlich durch Teil-Patch entfernen.
- [ ] Fotos versioniert referenzieren; IDs in Antwort-JSON und Dateizeilen müssen zusammenpassen. Historische Objekte nicht überschreiben oder löschen.
- [ ] Upload-Beleg hinsichtlich Admin, Besuch, Frage, Ablauf, Dateityp und Größe prüfen. Abgebrochener Upload lässt alte Antwort gültig.
- [ ] Storage-Netzwerkzugriffe dürfen die Transaktion nicht unbegrenzt blockieren; Timeouts und Sperrdauer bei der Fertigstellung prüfen.
- [ ] Idempotenter Replay darf nach bestätigtem Speichern nicht an inzwischen abgelaufenem Upload-Beleg scheitern.
- [ ] Bereits offene Änderungsanfragen nach überholender Direktkorrektur als Konflikt behandeln; nicht still genehmigen oder umschreiben.
- [ ] Ursprünglichen SM, Markt, Besuchsstart/-ende, Abschlusszeit, Fahrtminuten und Zeitbuchungen unverändert lassen.
- [ ] August-Besuch, im September korrigiert: bleibt in der ursprünglichen Reporting-Zuordnung.
- [ ] OOS nicht manuell hochzählen. Bestehende Berechnung liest aktuelle gültige Antwortversionen; Korrekturen können Werte erhöhen oder senken.

**Schema:** Der lokale Entwurf verwendet vorhandene SM-Antwort-/Ereignistabellen. Nicht vorsorglich eine Migration bauen. Erst bei belegtem Bedarf für Konsistenz oder Indexierung eine additive SM-only-Migration gesondert planen; nichts automatisch auf Produktion anwenden.

## 6. Nachweis vor Fertigmeldung

Die folgenden Punkte sind geplante Prüfungen, keine in diesem Auftrag ausgeführten Tests.

- [ ] Frontend-Regel-/Render-/Cachetests für Fahrzeit, Absagen, Restore, Konto- und Zeitraumwechsel.
- [ ] Backend-API-Tests für Rollen, Detailgrenzen, Filter, Pagination und private Fotos.
- [ ] Isolierte Datenbanktests für sämtliche Antworttypen, Pflichtkommentare, bedingte Logik, Versionen, Audit, Rollback und Token-Replay.
- [ ] Gleichzeitige Korrekturen und bestehende Freigabe-/Löschpfade prüfen; rein sequenzielle Tests nicht als Parallelitätstest ausgeben.
- [ ] Echte bestehende OOS-Berechnung mit isolierten abgeschlossenen Besuchen vor/nach Korrektur prüfen; gespeicherter Optionscode allein beweist keine korrekte Dashboard-Zahl.
- [ ] Lokaler UI-Ablauf: filtern → Besuch öffnen → Antworten ändern → speichern → neu laden → Originalverlauf, Aktivität, Zeiten und OOS vergleichen.
- [ ] Verbindungsabbruch, Konflikt, Uploadfehler, neue Pflichtfrage und fehlender Kommentar im UI durchspielen.
- [ ] Bestehende SM-Kommentar-, Zeit-, Planungs-/Serien- und Dashboardtests sowie beide Builds ausführen.
- [ ] GM-relevante gemeinsame Dateien auf unbeabsichtigte Verhaltensänderungen prüfen. Keine GM-Produktionsbesuche für Tests starten.
- [ ] Tatsächliche Testergebnisse, verbleibende Einschränkungen und nicht getestete Fälle getrennt festhalten.

## 7. Dokumentation und spätere Auslieferung

Während einer beauftragten Umsetzung folgende Dokumente aktualisieren:

- `docs/sm-employee-visibility-living.md`: vollständige Fahrtzeitsichtbarkeit, Absagen, Restore und Offline-Grenzen.
- `docs/sm-fb-management-living.md`: finaler API-Vertrag, UI, Versionierung, Rechte und echte Prüfnachweise.
- `docs/sm-questionnaire-submission-living.md`: direkte Admin-Korrektur und Abgrenzung zur Mitarbeiter-Warteschlange.
- `docs/sm-answer-comments-living.md`: Pflichtkommentar bei Admin-Korrektur, getrennt vom Änderungsgrund.
- `docs/sm-planning-data-model.md`: Mitarbeiter-Sichtbarkeit bei Absagen ohne Datenlöschung.
- `docs/sm-time-period-employee-view-living.md`: historische Fahrtzeiten und unveränderte Zeitstempel.
- `docs/sm-questionnaire-data-model.md`: nur tatsächlich notwendige/umgesetzte Schemaänderungen.

Nach einem gesonderten Push-Auftrag beide Git-Repositories und den Backend-Gitlink prüfen, nur freigegebene Änderungen aufnehmen und Backend vor dem darauf angewiesenen Frontend bereitstellen. Produktive Deployment-Zuordnung und Funktionsfähigkeit verifizieren. Bei Rollback Code zurücknehmen, keine gespeicherten Originale oder Korrekturhistorien löschen. Karten erst nach echter Abnahme und Auftrag abschließen.

## 8. Wochenansicht: Kommentarentwurf

Kartenbeschreibung: „es wird nicht die ganze Woche angezeigt“.

Nicht klar ist, welche Oberfläche gemeint ist und ob die gesamte Kalenderwoche einschließlich leerer Tage gezeigt werden soll. Deshalb keine der möglichen Ansichten auf Verdacht ändern.

**Entwurf zur Freigabe, nicht veröffentlicht:**

> Meinst du die Wochenansicht auf der Startseite am Handy, in der Zeiterfassung oder in der Admin-Verplanung? Sollen immer alle Tage von Montag bis Sonntag sichtbar sein, auch wenn keine Einsätze geplant sind?

Nach der Antwort Oberfläche, Tagesumfang und Navigation in einem gezielten Nachtrag festlegen. Andere Wochenansichten und GM unverändert lassen.

## 9. Ergebnis dieses Planungsauftrags

- [x] Vier offene SM-Karten in SIMPL frisch gelesen, Scope und Identität geprüft.
- [x] Vorhandene lokale Änderungen berücksichtigt, ohne sie zu verändern oder als fertig auszugeben.
- [x] Kommentarentwurf in natürlichem Deutsch vorbereitet.
- [x] Fertigstellungsplan mit Datenregeln, UI, Fehlerfällen, Tests und Dokumentation geschrieben.
- [ ] Kommentarfreigabe und Veröffentlichung – ausstehend.
- [ ] Vollständige technische Abnahme und Auslieferung – nicht Bestandteil dieser Planung.

In diesem Auftrag wurden ausschließlich SIMPL gelesen und dieses Dokument erstellt. Keine App-Codeänderung, kein Produktionsschreibzugriff, keine Statusänderung und kein Push.
