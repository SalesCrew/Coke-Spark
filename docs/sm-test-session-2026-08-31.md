# SM-Testsession - 31.08.2026

## Umfang und Sicherheit

Auf ausdrücklichen Wunsch wurden für alle vier vorhandenen SM-Testkonten je zwei Einsätze für den 31.08.2026 (Europe/Vienna) angelegt. Alle acht Einsätze wurden ungestartet und unbeantwortet übergeben.

- Keine GM-Daten, GM-Einstellungen oder GM-Endpunkte geändert.
- Keine bestehenden Benutzer, Marktstammdaten oder historischen Einsätze geändert.
- Keine Löschungen, keine Schemaänderungen und keine Anwendungsänderungen.
- Erstellung über die normalen, authentifizierten SM-Admin-APIs mit deren Validierung, Transaktionen und Ereignishistorie.
- Normale Auth-Anmeldungen zur Berechtigungsprüfung; keine Passwortänderungen.
- Temporär bedeutet hier klar als TEST gekennzeichnet, nicht automatisch ablaufend oder automatisch gelöscht.

## Konten und Einsätze

| SM-Konto | Fahrtzeit | Billa - Breitenleer Straße 148, 1220 Wien | Billa Plus - Triesterstraße 64, 1100 Wien |
| --- | --- | --- | --- |
| SM Testaccount | deaktiviert | 30 Minuten geplant | 45 Minuten geplant |
| J. Philipp Krone | aktiviert | 30 Minuten geplant | 45 Minuten geplant |
| Alina Schüller | deaktiviert | 30 Minuten geplant | 45 Minuten geplant |
| Thomas Majurek | aktiviert | 30 Minuten geplant | 45 Minuten geplant |

Die geplante Zeit ist keine vorab eingetragene Ist-Zeit. Timer oder manuelle Start-/Endzeit werden erst beim tatsächlichen Ausfüllen verwendet. Es wurden keine Antworten oder Zeitbuchungen simuliert.

## Zentraler Fragebogen

Name: **TEST · OOS Ja/Nein · 31.08.2026**

Die Anwendung priorisiert den zentralen SM-Fragebogen vor einer einsatzbezogenen Versions-ID. Da sämtliche vorhandenen SM-Benutzer Testkonten sind, wurde der neue Testfragebogen zentral ausgewählt. Das betrifft alle künftig gestarteten SM-Fragebögen, nicht nur diese acht Einsätze. Es gab vor der Umstellung keine offenen SM-Fragebogenentwürfe. Bestehende veröffentlichte Vorlagen und bereits abgeschlossene Besuche bleiben erhalten.

- Vorlage: `f14dfccb-8980-49cd-a64d-d10eded9fb71`
- Veröffentlichte Version 1: `6f19b8fa-dfd8-4945-a7ec-69a10f7eafea`
- Modul: `07484fd4-45de-43ff-b375-64d4a0373a7f`
- Neue zentrale Zuordnung: `9be81900-ac88-4b19-8b6b-07e4ec5a522f`
- Vorherige Vorlage: `f595e84c-2101-4f48-b254-badb0bcbf69b` / TEST · Abschluss & Dokumentation
- Vorherige Zuordnung `ee467647-d703-406c-83b1-a8d27b533bab` wurde regulär historisiert, nicht gelöscht.
- Die zentrale Auswahl bleibt aktiv, bis im SM-Admin ein anderer Fragebogen ausgewählt wird.
- Kein Einmal-pro-Markt-Limit: Alle vier Personen können dieselben zwei SM-Märkte testen.

## Fragen und OOS-Logik

Vier Kategorien, jeweils zwei Ja/Nein-Fragen:

1. Aktionsplatzierungen
2. Limonaden & Energy
3. Wasser & Near Water
4. Säfte & Eistee

Je Kategorie:

| Frage | Ja | Nein |
| --- | --- | --- |
| Wurde OOS (eine Regallücke) gefunden? | `oos_present` | `oos_absent` |
| Wurde die gefundene OOS vollständig behoben? | `resolved` | `not_resolved` |

Die Behebungsfrage ist mit der Erkennungsfrage derselben Kategorie verknüpft. Sie erscheint ausschließlich nach Ja und ist dann verpflichtend. Bei Nein oder noch unbeantworteter Erkennungsfrage bleibt sie verborgen und blockiert keinen Abschluss. Jede Erkennungsfrage ist verpflichtend. Es gibt keinerlei Fotos, Freitexte, Mehrfachauswahl oder Matrixfragen.

## Manueller Testablauf

1. Mit dem persönlichen SM-Testkonto anmelden und den heutigen Tag öffnen.
2. Billa starten; Timer starten oder die manuelle Zeiterfassung wählen. Philipp und Thomas können Fahrtzeit eingeben, Alina und das ursprüngliche Testkonto nicht.
3. Für Aktionsplatzierungen **Ja** bei gefunden und **Ja** bei behoben wählen. Bei den drei übrigen Kategorien **Nein** wählen.
4. Zeitangaben prüfen und **Marktbesuch abschließen** drücken. Bloßes Speichern einer einzelnen Antwort zählt noch nicht in der Auswertung.
5. Aktivitäten öffnen: Der abgeschlossene Fragebogen sollte als Besuch mit den gespeicherten Antworten erscheinen. Zeiterfassung öffnen: Die Ist-Zeit und, falls aktiviert/eingetragen, Fahrtzeit sollten beim Einsatz sichtbar sein.
6. Billa Plus starten und bei allen vier Erkennungsfragen **Nein** wählen; es sollten keine Behebungsfragen erscheinen. Den zweiten Besuch ebenfalls abschließen.
7. Im **Admin-SM-OOS-Dashboard** Von/Bis auf 31.08.2026 und den Filter auf die getestete Person setzen. Dashboard bei bereits geöffnetem Tab neu laden bzw. aktualisieren.

Erwartung nach diesen beiden vollständig abgeschlossenen Besuchen für genau diese Person:

| Kennzahl | Erwartet |
| --- | --- |
| Abgeschlossene Besuche | 2 |
| Unterschiedliche besuchte Märkte | 2 |
| Klassifizierte OOS-Prüfungen | 8 |
| OOS gefunden | 1 |
| OOS behoben | 1 |
| Behebungsquote unter gefundenen OOS | 100 % |
| Märkte mit OOS | 1 von 2 = 50 % |
| Fundquote unter allen Kategorieprüfungen | 1 von 8 = 12,5 % |

Zusätzliche Varianten: gefunden Ja / behoben Nein ergibt einen gefundenen, nicht behobenen Fall. Zurückgehen und gefunden auf Nein ändern muss die Behebung ausblenden; eine eventuell zuvor gewählte Behebung darf dann nicht mitzählen.

## Nachgewiesene Prüfungen

- Alle vier Konten über die Produktions-API erfolgreich als `sm` angemeldet.
- Jedes Konto sieht genau seine zwei heutigen Einsätze.
- Jede Besuchsvorprüfung liefert genau den neuen Fragebogen und `submission: null`.
- Fahrtzeitprofil je Konto geprüft; keine Profiländerung vorgenommen.
- Zugriff auf einen fremden SM-Einsatz wird für jedes Konto mit HTTP 403 abgelehnt.
- Aktivitäten-Endpunkt ist für jedes Konto erreichbar.
- Datenbank-Readback: acht geplante Einsätze, acht Erstellungsevents, acht Ja/Nein-Fragen, 16 Optionen mit korrekten Metrikcodes und vier bedingte Regeln.
- Für die neuen Einsätze existieren bei Übergabe null Submissions und null Zeiteinträge.
- Admin-SM-Dashboard für heute vor und nach dem Seed unverändert: null abgeschlossene Besuche, null gefundene/behebene OOS; Quotennenner ohne Daten bleiben leer.
- 81 Kombinationen der gespeicherten Fragebogenkonfiguration durch dieselbe Sichtbarkeitslogik und OOS-Aggregation geprüft, einschließlich versteckter alter Behebungsantworten.
- 28 bestehende SM-Tests für Antworten, Dashboard und Verplanung bestanden.
- Quellcodeprüfung: Abschluss setzt `submitted` und `reporting_available_at`, schließt den Einsatz ab und schreibt die SM-Ist-Zeit in derselben Transaktion. Aktivitäten und Zeiterfassung lesen diese Datensätze; Dashboard wertet nur aktuelle, nicht gelöschte, abgeschlossene Submissions aus.

Es wurde bewusst **kein** Teilnehmerbesuch zum Test abgeschlossen oder gestartet. Eine erfolgreiche reale Abschlussrunde bzw. Browser-/iPhone-End-to-End-Prüfung wird damit nicht behauptet.

## SM-Phone-Hero: Live-Anbindung (31.08.2026)

Nach separater Freigabe implementiert: `/sm` verwendet jetzt `SmDashboardHero` statt der unversorgten Demo-`StatusCard`. Keine Änderung am GM-Hero, GM-Routen, GM-Auswertungen oder an Produktionsdaten. Gemeinsame Veröffentlichung von Frontend und Backend am 31.08.2026 vom Nutzer freigegeben.

### Daten und Zeitbezug

- Neuer GET-Endpunkt `/sm/dashboard`, ausschließlich für aktive `sm`-Konten. Nutzer-ID ausschließlich aus der verifizierten Backend-Session, nicht aus dem Request. Zusätzliche Query-Filter werden mit 400 abgewiesen. Kein Admin-Verzeichnis und keine Daten anderer SMs im Payload.
- Name: aktueller Vor-/Nachname des angemeldeten SM aus `users`, nicht Max Mustermann oder eine Demo-Vorgabe.
- **Einsätze heute:** Anzahl nicht gelöschter, nicht stornierter SM-Einsätze für das aktuelle Datum in Europe/Vienna und die effektive Person. Ersatzdatum/Ersatzperson haben wie in der Verplanung Vorrang vor Originalwerten. Auch bereits abgeschlossene heutige Einsätze bleiben in dieser Tagesgesamtzahl enthalten.
- **OOS-Balken:** Verteilung der heute abgeschlossenen Besuche, nicht der einzelnen Fragen oder geplanten Einsätze. Maßgeblich ist `submitted_at` in Europe/Vienna, genau wie im Admin-SM-OOS-Dashboard. Ein gestern geplanter, erst heute abgeschlossener Besuch zählt heute im OOS-Balken, aber nicht in der heutigen Planungsanzahl. Die Beschriftung unterscheidet Einsätze heute und Besuche heute abgeschlossen.
- Nur Submissions mit `status = submitted`, `is_current = true`, `is_deleted = false` und vorhandenem `reporting_available_at` zählen. Versteckte Fragen, übersprungene/leere Antworten, gelöschte Optionen und alte Antwortversionen sind ausgeschlossen.
- Gemeinsame SQL-Ladelogik mit dem bestehenden Admin-SM-Dashboard und dieselbe OOS-Paarungslogik. Die Admin-Auswertung selbst bleibt unverändert. Die Phone-Daten lesen Name, Anzahl und Antworten in einer **read-only / repeatable-read**-Transaktion, damit ein parallel erfolgender Abschluss keinen halben Zustand liefert. Vorhandene SM-Indizes decken Personen-/Datumsfilter und Antwort-Joins ab; keine Migration nötig.

### Segmentregeln

| Segment | Regel pro abgeschlossenem Besuch |
| --- | --- |
| Ohne OOS | Mindestens eine auswertbare OOS-Erkennung, aber kein gefundener Fall |
| OOS behoben | Mindestens ein Fund; alle gefundenen Fälle gelten nach ihren gespeicherten Regeln als behoben |
| OOS offen | Mindestens ein Fund ist nicht behoben oder die Behebung nicht dokumentiert |
| Nicht klassifiziert | Kein auswertbares Erkennungsergebnis; wird nicht als „Ohne OOS“ gezählt und aus dem Balken ausgeschlossen |

Behebungen müssen zur Erkennungsfrage, Kategorie und Submission passen. Teilweise behoben zählt nur bei entsprechendem Snapshot-Schalter. Ein Besuch mit gemischten behobenen/offenen Fällen ist „OOS offen“. Mehrere Besuche desselben Marktes werden getrennt gezählt. Die Balkenbreiten ergeben sich aus Besuchszahlen; Nullsegmente erzeugen keine künstlichen Lücken. Die Legende zeigt die absoluten Zahlen, der barrierefreie Text dieselben Werte.

### Lade-, Leer- und Fehlerzustände

- Initialer Skeleton: Name, Tagesanzahl, drei Legendeneinträge, Balken und Hinweiszeile im echten Kartenlayout; nur bei erlaubten Animationen animiert. Keine falsche Null-Anzahl während des Ladens.
- Keine heutigen Einsätze und keine Abschlüsse: neutraler Balken, „Heute sind keine Einsätze geplant.“
- Einsätze vorhanden, aber noch kein Abschluss: Hinweis auf Auswertung nach dem ersten Abschluss.
- Abschluss ohne klassifizierbare OOS-Antworten: eigener Hinweis, keine erfundene No-OOS-Wertung.
- Gemischt klassifizierte/nicht klassifizierte Abschlüsse: Anzahl ohne OOS-Auswertung als Hinweis.
- Erstladefehler: keine vermeintlich erfolgreiche leere Übersicht; kompakter Fehlerhinweis mit Wiederholen-Taste.
- Fehler nach erfolgreichem Laden: bekannte Werte dieses Tages bleiben sichtbar, ausdrücklich als letzter geladener Stand gekennzeichnet. Keine neue persistente Offline-Statistik: Nach Navigation/Neustart ohne Verbindung erscheint bei fehlenden Daten der Fehlerzustand.

### Aktualisierung und Isolation

- Neue Anfrage beim Öffnen/Zurückkehren zur Startseite, bei Fensterfokus, sichtbarem Tab und Wiederverbindung. Nach erfolgreichem `submitSmVisit` wird zusätzlich ein SM-only-Refresh-Event ausgelöst.
- Gleichzeitige Fokus-/Sichtbarkeitsereignisse werden zusammengefasst. Ein Abschluss während einer laufenden Anfrage veranlasst genau einen weiteren aktuellen Read. Kein sekündliches Polling.
- Ein einzelner Timer lädt am nächsten Wiener Mitternachtswechsel neu. Sommer-/Winterzeit mit 23/25-Stunden-Tagen ist berücksichtigt. Alte Tageszahlen werden nicht als heute angezeigt.
- Konto wird über die bestehende Auth-Subscription verfolgt. Späte Antworten nach Kontowechsel oder Unmount werden verworfen; vor dem Rendern werden Nutzer-ID und Tag nochmals geprüft. Keine persistente Statistik zwischen Accounts. HTTP `private, no-store` verhindert geteilte Antwort-Caches.

### Prüfung und verbleibende Schritte

- 13 Frontend-Tests: gerenderte Skeleton-/Leer-/Fehler-/Live-Zustände, echte Segmentbreiten, DST, deduplizierte Reads, Abschluss während laufendem Read, Offline/Retry, Kontowechsel inklusive A→B→A, Tageswechsel, Schutz vor falscher Antwortidentität und Endlosschleifen.
- Vier zusätzliche OOS-Tests im bestehenden Backend-Testmodul, darin alle 81 Kombinationen der vier Ja/Nein-Kategoriepaare gegen die Admin-Berechnung.
- Drei neue Backend-Tests prüfen parametrisierte Nutzer-/Zeitfilter, Abschluss-/Gültigkeitsbedingungen, aktuelle/sichtbare Antworten, effektive Verplanung sowie die konsistente Read-only-Transaktion. Keine echte DB-Verbindung in diesen Tests.
- Gesamter fokussierter Regressionslauf: 28 Frontend- und 35 Backend-Tests bestanden. Frontend- und Backend-Produktionsbuild bestanden. Der zusätzliche ungefilterte Root-`tsc --noEmit` meldet 20 vorhandene Fehler ausschließlich in `backend/src/admin-kurti-model-context.test.ts` und `backend/src/app.integration.test.ts`; diese fachfremden Testdateien wurden nicht geändert.
- Read-only-API-Prüfung des lokalen Backends gegen die vorhandene Datenbank: alle vier SM-Logins liefern den richtigen Namen, je zwei heutige Einsätze und aktuell null Abschlüsse, passend zu Verplanung und Admin-SM-Auswertung. Ohne Login 401, mit SM-Admin 403, fremde Nutzer-/Datumsfilter 400. Keine Besuchsstarts, Antworten oder Abschlüsse erzeugt.
- Keine Browser-/iPhone-Prüfung durchgeführt. Reale Teilnehmer-Abschlüsse bleiben bewusst den Teilnehmern vorbehalten.
- Release-Reihenfolge: Backend veröffentlichen, dann Frontend. Danach manuelle Teilnehmer-Runde auf der Vercel-URL. Ein Frontend-only-Deploy würde ohne den neuen Backend-Endpunkt den Fehlerzustand zeigen.

## SM-Erstanmeldung und Fahrtzeit (31.08.2026)

- Ausschließlich Rolle `sm` erhält die neue einspaltige Phone-Ansicht unter `/vereinbarung`: lesbare Absätze, normale Seitenscrollbewegung statt 58vh-Innenscrollen, kein eingezwängtes Titel-/Badge-Raster, Safe-Area-Abstände, volle Bestätigungsbuttonbreite und große Touch-Ziele. GM-Ansicht und Admin-Datenschutzseiten unverändert.
- Eigene SM-Vereinbarung `spark_sm_employee_agreement`, Version `2026-08-31-sm-v1`, mit eigenem Inhaltshash. Behandelt Einsätze, Antworten/Fotos, abgeschlossene OOS-Ergebnisse, optionale Fahrtzeit, Offline-Zwischenspeicherung, Nachrichten, Korrekturen, bestehende Aufbewahrungsregeln und Datenschutzkontakt. Keine Übernahme von GM-spezifischen IPP-/Prämien-/Kurti-Zusagen. Die ausführliche bestehende `/datenschutz/sm`-Information bleibt verlinkt.
- Backend wählt Dokument und Akzeptanzschlüssel aus der authentifizierten Rolle. Bestehende generische Akzeptanzen werden nicht geändert oder gelöscht; SM bestätigt die neue Version einmalig. GM bleibt exakt bei `2026-07-11-v5` und Hash `a1b2bfd8277473fe36f056958e77a393fe93ab28ee0a2bc88610d2ae16379caa`.
- Bestätigung benötigt weiterhin ein aktives Häkchen. Die gespeicherte Version und der Hash gehören zum dargestellten SM-Dokument; falsche oder alte Versionen ergeben 409. Kein Akzeptieren im Namen der Testteilnehmer und keine DB-Migration.
- Fahrtzeit im SM-Start- und Prüf-Screen verwendet dasselbe einzelne numerische Eingabefeld: `0 → 01: → 01:3 → 01:30`. Löschen bleibt möglich; Paste von `0130`, `01:30` und `1:30` funktioniert. Cursorposition wird beim Formatieren erhalten. Bestehende Minuten-/24-Stunden-Validierung und das Konto-Flag bleiben unverändert. Die größeren 16px-Eingabeziffern vermeiden den typischen iPhone-Fokuszoom.
- Verifikation: 9 neue Frontend-Tests und 5 Backend-Tests mit ausschließlich gemockten Akzeptanzdaten; darunter vollständiger GM-Hashvergleich, SM-Versionierung, Idempotenz, falsche Versionen, Loading/Fehler, Input-Löschung und Paste.
- Textgrundlage: vorhandene SM-Datenschutzinformation und tatsächliche App-Funktionen. Die lesbare, klare Darstellung orientiert sich an den [Transparenzleitlinien der Datenschutzbehörde](https://dsb.gv.at/sites/site0344/media/downloads/leitlinien_fuer_transparenz_gemaess_der_verordnung_2016-679.pdf). Dies ist keine externe rechtliche Freigabe des betrieblichen Dokuments.

## Einsatz-IDs für spätere Zuordnung

| Konto | Billa | Billa Plus |
| --- | --- | --- |
| SM Testaccount | `d7cddb89-1a5a-4137-a02d-9e61e953cdc3` | `13bca588-ae11-4389-bca1-878031cafcb2` |
| Philipp | `2b03088f-d692-4477-ae06-50d0c86da250` | `bfc65164-29dc-4a18-a291-b3f7094ce429` |
| Alina | `386a22d8-5024-4529-bffe-4232d187e16f` | `b6b021ca-caf8-4f5f-81d7-da58407f13eb` |
| Thomas | `cfc2c1b7-ac3d-4831-a482-a75134fb6c3d` | `0820b456-0cd4-4488-aefc-bf1f895946e1` |

Idempotenzpräfix der acht Einsätze: `sm-oos-training:2026-08-31:`. Keine automatische Bereinigung eingerichtet. Eine spätere Bereinigung benötigt eine eigene, ausdrücklich freigegebene SM-only-Aktion.
