# SM Verplanung: KW-Zeitraum, GM-Verlauf und OOS-Auswahl

Stand: 2026-09-08
Status: Implementiert und verifiziert

## Ziel

Die bestehende SM-Verplanung wird ohne Änderung ihrer fachlichen Schreiblogik erweitert:

1. Der KW-Schalter öffnet einen Kalender zur Auswahl einer einzelnen KW oder eines zusammenhängenden KW-Zeitraums.
2. Nach Auswahl eines Marktes steht der bereits mit diesem Markt synchronisierte SM im Auswahlfeld an erster Stelle und ist dezent gekennzeichnet.
3. Abgeschlossene GM-Marktbesuche können optional und ausschließlich lesend in derselben Einsatzliste eingeblendet werden.
4. Die Auswahl der passenden OOS-Erkennungsfrage zeigt immer einen brauchbaren Menüinhalt und niemals ein leeres, dünnes Popup.

## Geprüfter Ist-Zustand

- `SmPlanningWeekPicker` kennt aktuell genau eine Woche und schließt direkt nach jedem Klick.
- Die Verplanungs-API akzeptiert bereits beliebige inklusive Zeiträume bis maximal 93 Tagen. Für die KW-Bereichsauswahl ist deshalb keine Datenbankänderung nötig.
- `sm_markets.assigned_sm_user_id` ist bereits die zentrale, persistente Synchronisierungsquelle zwischen Markt und SM.
- Die Verplanung lädt Märkte und aktive SMs bereits gemeinsam; die Empfehlung kann deshalb rein aus den geladenen Daten abgeleitet werden.
- GM-Besuche und SM-Einsätze liegen fachlich in getrennten Tabellen. Eine neue Admin-Leseroute kann abgeschlossene, nicht gelöschte GM-Besuche zeitlich begrenzt liefern, ohne bestehende GM-Schreibabläufe zu berühren.
- Das OOS-Dropdown enthält bei null passenden Erkennungsfragen keinen Empty State. Seine geschätzte Höhe fällt dann auf acht Pixel; das erklärt den sichtbaren dünnen Streifen. Die bestehende Fachregel verlangt bewusst eine passende Erkennungsfrage aus demselben Modul und derselben OOS-Kategorie.

## Festgelegte Invarianten

### KW-Auswahl

- Der erste Klick setzt den Start der Auswahl und hält den Kalender offen.
- Der zweite Klick setzt das Ende und schließt den Kalender.
- Klickt der Nutzer beim zweiten Schritt eine frühere KW, wird der Zeitraum chronologisch sortiert.
- Start und Ende werden vollrot dargestellt. Dazwischenliegende KWs erhalten eine deutlich leichtere rote Fläche.
- Ein einzelner KW-Bereich entsteht durch zweimaliges Klicken derselben KW.
- Vor/Zurück verschiebt den kompletten ausgewählten Bereich um genau eine Woche.
- „Aktuelle KW“ setzt den Zeitraum wieder auf eine einzelne aktuelle KW.
- Die bestehende 93-Tage-Grenze bleibt bestehen. In der UI sind damit höchstens 13 KWs auswählbar.

### Synchronisierter SM

- Die Zuordnung `market.assignedSmUserId` ist Empfehlung, keine erzwungene Einsatzzuweisung.
- Der empfohlene aktive SM wird in der Liste an Position eins sortiert und mit „Mit Markt synchronisiert“ gekennzeichnet.
- Andere SMs bleiben vollständig auswählbar.
- Eine bestehende Einsatzzuweisung wird beim Öffnen/Bearbeiten nie automatisch überschrieben.

### GM-Verlauf

- Standardmäßig bleibt die Ansicht unverändert und zeigt nur SM-Einsätze.
- Der Nutzer aktiviert GM-Besuche bewusst über einen zurückhaltenden Schalter.
- Geladen werden nur `submitted`, nicht gelöschte Besuche mit Abschlusszeit im gewählten Zeitraum.
- GM-Daten sind in der Verplanung strikt read-only. Es gibt keine Bearbeiten-, Löschen-, Wiederherstellen- oder Zeitkorrekturaktion.
- Die GM-Detailansicht zeigt nur Planungsinformationen: GM, Markt, Adresse, Start, Ende, Dauer, Besuchsbereiche, Kampagne/Fragebogen und zusammengefasste Frage-/Antwort-/Fotozahlen. Antwortinhalte und Fotos werden nicht übertragen.
- SM-Suche und SM-Filter berechnen ausschließlich SM-Zeilen.
- GM-Suche und GM-Filter berechnen ausschließlich GM-Zeilen.
- Die beiden gefilterten Ergebnismengen werden erst danach für die Tagesdarstellung zusammengeführt.
- Die neue Route bleibt hinter `requireAuth(["admin", "sm_admin"])` und ist ein GET ohne Nebenwirkungen.

### OOS-Erkennungsfrage

- Die fachliche Kopplung bleibt innerhalb desselben Moduls und derselben Kategorie. Dadurch kann kein Fragebogen eine Behebungsfrage auf eine nicht enthaltene Erkennungsfrage referenzieren.
- Sind passende Fragen vorhanden, werden sie normal angezeigt.
- Sind keine vorhanden, zeigt das Menü einen ruhigen, erklärenden Empty State mit normaler Mindesthöhe.
- Der Hilfetext sagt konkret, dass zuerst im selben Modul eine OOS-Erkennungsfrage derselben Kategorie angelegt werden muss.
- Bestehende valide OOS-Konfigurationen und Dashboard-Zählregeln bleiben unverändert.

## Implementierungsplan und Fortschritt

- [x] Bestehende Kalender-, Markt-SM-, SM-Planungs-, GM-Besuchs- und OOS-Pfade gelesen.
- [x] Daten- und Berechtigungsgrenzen festgelegt.
- [x] Range-Zustand und Range-Kalender implementieren.
- [x] KW-Beschriftung, Navigation, Export und Empty States auf Zeitraum umstellen.
- [x] Synchronisierte SM-Empfehlung im Verplanungsdrawer implementieren.
- [x] Read-only GM-Admin-Route und Frontendtypen/API ergänzen.
- [x] Separaten GM-Schalter, GM-Filter, kombinierte Tagesliste und GM-Detaildrawer implementieren.
- [x] OOS-Dropdown Empty State und kontextuelle Erklärung implementieren.
- [x] Zielgerichtete Unit-/Source-Tests ergänzen.
- [x] Frontend- und Backend-Build sowie bestehende relevante Tests ausführen.
- [x] Read-only Testquery gegen die konfigurierte Supabase-Instanz ausführen.
- [x] End-to-End-Browserprüfung der sichtbaren Zustände durchführen.
- [x] Dieses Dokument mit dem tatsächlich gebauten Verhalten und Prüfergebnissen finalisieren.

## Prüffälle

### Kalender

- Erste KW wählen: Kalender bleibt offen und zeigt einen eindeutigen Startzustand.
- Zweite spätere KW wählen: inklusiver Bereich, Zwischenwochen blass, Endpunkte kräftig, Kalender schließt.
- Zweite frühere KW wählen: Bereich wird korrekt normalisiert.
- Dieselbe KW zweimal wählen: Einzelwoche.
- Bereich über Monats-/Jahresgrenze wählen.
- Mehr als 13 KWs versuchen: Auswahl wird verhindert und erklärt.
- Tastatur, Escape und Klick außerhalb funktionieren weiterhin.

### SM-Empfehlung

- Markt mit synchronisiertem aktivem SM: dieser steht oben und ist markiert.
- Markt ohne Synchronisierung: normale alphabetische/relevante Liste ohne falsche Markierung.
- Synchronisierter Nutzer nicht aktiv/nicht im Verzeichnis: keine Phantomoption.
- Bestehender Einsatz mit anderem SM: aktuelle Auswahl bleibt erhalten.

### GM-Verlauf

- Schalter aus: keine GM-Anfrage, keine GM-Filter, keine GM-Zeilen.
- Schalter ein: nur abgeschlossene GM-Besuche im Zeitraum erscheinen.
- SM-Filter ändern: GM-Anzahl und GM-Zeilen bleiben unverändert.
- GM-Filter ändern: SM-Anzahl und SM-Zeilen bleiben unverändert.
- GM-Zeile öffnen: ausschließlich lesende Detailansicht.
- Schalter ausschalten: GM-Zeilen, Filter und offener GM-Drawer verschwinden.
- Zeitraum wechseln: beide Streams laden denselben inklusiven Zeitraum.

### OOS

- Passende Erkennungsfrage: Dropdown zeigt und speichert sie.
- Falsche Kategorie oder Behebungsfrage: wird nicht angeboten.
- Keine passende Erkennungsfrage: vollständiger Empty State statt dünnem Popup.
- Vorhandene gültige OOS-Beziehung bleibt nach Speichern erhalten.

## Datenbankauswirkung

Keine Migration und keine Produktionsdatenmutation vorgesehen. Die Erweiterung liest bestehende Tabellen und führt nur bestehende SM-Verplanungsmutationen aus, wenn der Nutzer die schon vorhandenen SM-Aktionen verwendet.

## Tatsächlich umgesetzt

### KW-Zeitraum

- Der Workspace speichert Start-KW und End-KW getrennt; die API erhält Montag der Start-KW bis Sonntag der End-KW.
- Der erste Kalenderklick erzeugt nur eine temporäre Startmarke. Der zweite Klick normalisiert vorwärts/rückwärts, prüft maximal 13 inklusive KWs, übernimmt beide Endpunkte und schließt das Popup.
- „Aktuelle KW“ ist bewusst ein eigener Ein-Klick-Shortcut und setzt beide Endpunkte auf die aktuelle Woche.
- Vor/Zurück verschiebt beide Endpunkte gemeinsam um sieben Tage.
- Toolbar, Summen, Überschriften, Empty State, Header-Kontext und Excel-Dateiname/-Tab bilden Einzelwoche oder Bereich korrekt ab.

### Markt-SM-Empfehlung

- Der Drawer liest die Empfehlung beim jeweils ausgewählten Markt aus `assignedSmUserId`.
- Der passende aktive Nutzer wird in einer kopierten Liste nach oben sortiert. Die Original-Nutzerliste wird nicht mutiert.
- Die Option erhält eine grüne, dezente „Synchronisiert“-Kennzeichnung und die Beschreibung „Mit diesem Markt synchronisiert“.
- Der ausgewählte Nutzerzustand bleibt unabhängig; weder neue noch bestehende Einsätze werden automatisch umgebucht.

### GM-Verlauf

- Neue Route: `GET /admin/sm-planning/gm-visits?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Sie verwendet dieselbe strikte Datumsprüfung und 93-Tage-Grenze wie die SM-Verplanung sowie die vorhandene Admin-/SM-Admin-Authentifizierung.
- Die Session-Selektion nutzt `visit_sessions_submitted_period_market_gm_idx` und filtert auf submitted, vorhandenen Abschlusszeitpunkt, nicht gelöschte Session und nicht gelöschten Markt.
- Frage-, Antwort- und Fotozahlen werden in PostgreSQL pro Besuchsbereich aggregiert. Dadurch werden keine einzelnen Antworten, Antwortwerte, Kommentare, Bilder oder Speicherpfade an die Verplanung ausgeliefert.
- Der Client ruft die Route nur bei aktivem GM-Schalter auf. Beim Ausschalten werden GM-Zeilen, Filterzustand, Fehlerzustand und ein eventuell geöffneter GM-Drawer entfernt.
- GM- und SM-Filter besitzen getrennte Zustände und getrennte Filterfunktionen. Erst die fertigen Ergebnislisten werden nach Datum zusammengeführt.
- Die GM-Detailansicht ist visuell blau/neutral, explizit als „Nur lesen“ gekennzeichnet und besitzt nur eine Schließen-Aktion.

### OOS-Auswahl

- Das Menü schätzt bei null Optionen jetzt mindestens 54 Pixel Höhe statt acht Pixel.
- Es rendert dann einen normal gepolsterten Status mit der konkreten Anweisung, im selben Modul eine Erkennungsfrage derselben Kategorie anzulegen.
- Ein zusätzlicher Hilfetext macht die bestehende sichere Modul-/Kategoriegrenze sichtbar.
- Speicherung, OOS-Snapshot und Dashboard-Berechnung wurden nicht verändert.

## Verifikationsergebnisse

- Frontend-Produktionsbuild: erfolgreich.
- Backend-TypeScript-Build: erfolgreich.
- KW-/Planungsansicht: 12/12 fokussierte Tests erfolgreich.
- OOS-Editor: 4/4 fokussierte Tests erfolgreich.
- Weitere Frontend-SM-Regressionsprüfungen: Dashboard 17/17, Fragebogen-Skeleton 4/4, Safety-UI 3/3, Feiertage 5/5 erfolgreich.
- Backend-SM-Feiertage: 6/6 erfolgreich.
- Backend-Safety: 3/3 ausführbare Tests erfolgreich; vier datenbankabhängige Live-Tests waren in der lokalen Umgebung als `SKIP` markiert.
- Browserprüfung: Seite lädt ohne Next-Error-Overlay; erster Klick hält das Popup offen, zweiter Klick übernimmt und schließt; Rückwärtsauswahl wurde als KW 35–36 normalisiert; eine Vier-Wochen-Auswahl zeigte volle Endpunkte und blasse Zwischenwochen.
- Lokale Auth-Grenze: Aufruf der neuen Route ohne Token liefert `401 auth_missing_access_token`.
- Produktions-Supabase, ausschließlich read-only: 479 abgeschlossene Besuche/13 GMs/361 Märkte im geprüften 01.–14.09.-Fenster; der Zeitfilter verwendete den vorhandenen partiellen Index und lief im gemessenen Plan in etwa 3,75 ms.
- Produktions-Supabase, ausschließlich read-only: Eine aktuelle Wochenprobe fasste 5.291 Fragen, 2.095 beantwortete Fragen und 421 Fotos in 183 Bereichssummen zusammen. Diese Aggregation ist die implementierte Datenform.
- Vollständige historische Backend-Suite: 122/126 erfolgreich. Vier bereits bestehende, von dieser Änderung unberührte Tests bleiben rot: ein Default-Pause-Test in `admin-zeiterfassung.shared.test.ts` und drei RED-Monat-Anker/Datums-Tests in `red-monat.shared.test.ts`.

## Bewusste Grenzen

- Der GM-Verlauf ist kein zweites GM-Adminsystem; er enthält keine Mutation und keine fachlichen Antwortinhalte.
- OOS-Verknüpfungen bleiben modul-intern. Eine globale Auswahl wäre ohne zusätzliche Fragebogen-übergreifende Integritätsprüfung riskant und wurde deshalb nicht stillschweigend eingeführt.
- Sehr große Zeiträume sind auf die schon bestehende Obergrenze von 93 Tagen/13 KWs begrenzt.
