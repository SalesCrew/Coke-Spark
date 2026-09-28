# Prämienwelle – Umsetzungsplan

Stand: 28.09.2026. Neuer Auftrag: end-to-end lokal umsetzen, nicht pushen. Produktionsdaten bleiben unverändert. Anschließend Mailentwurf an Doris, nicht versenden.

## Entscheidungen und Arbeitsstand

Aktueller Auftrag: den abgestimmten UI-/Logikplan implementieren und isoliert testen. Frühere Planungsbeschränkungen unten dokumentieren den bisherigen Entscheidungsweg, nicht den aktuellen Auftrag.

| Entscheidung | Festlegung | Warum |
| --- | --- | --- |
| D1 – Quartalsziele | Komponenten und Regeln frei je Welle einstellen; keine feste Q3-Sonderlogik voraussetzen | Nutzer: „doesnt matter wird ja eingestellt“ |
| D2 – Manuelle Bearbeitung | Regel-/Zieleditor und zusätzliche, sauber integrierte manuelle GM-Werte planen | Nutzer bestätigt beide Bearbeitungsmöglichkeiten |
| D3 – Beträge | Vorhandene Unterlagen zusammentragen; Herkunft, Gültigkeit und Widersprüche protokollieren | Nutzer kennt die Beträge nicht; keine neue Rate erfinden |
| D4 – Teilnehmer | Alle echten GMs; keine gesonderte Teilnehmerauswahl und keine Demoliste | Nutzer: „alle“; historische Ergebnisse inaktiver GMs erhalten |
| D5 – Historie | Laufende Wellen nach Änderungen neu berechnen; abgeschlossene Wellen einfrieren | Nutzer bestätigt den zuvor vorgeschlagenen Umgang |
| D6 – Umfang | Jetzt end-to-end implementieren, lokal prüfen, kein Push und keine Produktionsdaten ändern | Neuer Nutzerauftrag: „build it now e2e (dont poush)“ |

„Alle“ beantwortet die Teilnehmerfrage, nicht ausdrücklich die Ranglisten-Zeitspanne. Geplanter UI-Vorschlag: Umschalter „Dieses Quartal / Gesamt“, damit keine unbestätigte Interpretation fest eingebaut wird. Archivierte GMs werden in ihrer Historie weiter berücksichtigt.

### Fortschrittsprotokoll

- [x] Vorprüfung des bestehenden Prämiensystems und lesende lokale UI-Prüfung dokumentiert.
- [x] Nutzerentscheidungen D1–D6 festgehalten; damalige Planungsphase von der jetzt freigegebenen lokalen Umsetzung getrennt.
- [x] Vorhandene PDF-/Excel-Extrakte, Ableitungen und sieben passende SIMPL-Karten lesend zusammengeführt; Quellen und Grenzen in `praemienwelle-quellen-und-regeln.md` festgehalten.
- [x] Fragebogenerstellung, Bonusquellen, Antwortübernahme, Besuchsabschluss, Zeitkorrekturen und genehmigte Löschungen gelesen.
- [x] Konkretes UI-Konzept mit Zuständen und manueller/automatischer Erfassung dokumentiert.
- [x] Datenvertrag, Neuberechnung, Historienabschluss und notwendige angrenzende Änderungen geplant.
- [x] Zusammenfassung, Quellenkonflikte und verbleibende Einrichtungsfragen für die Übergabe vorbereitet.
- [x] Berechnungsmodell und additive Datenbankmigration lokal implementieren.
- [x] Echte Auswertung, Regel-/Quelleneditor und einzelne GM-Messwerte anbinden.
- [x] Gemeinsame GM-Anzeige, unveränderlicher Abschluss und Änderungsverlauf prüfen.
- [x] Isolierte Datenbank-/API-/Browsertests durchführen; genaue Abdeckung und Grenzen unten.
- [x] Mailentwurf an Doris mit den tatsächlich umgesetzten Funktionen erstellen.
- [ ] Veröffentlichung / produktive Migration – ausdrücklich nicht autorisiert.

## Umgesetzt – aktueller Stand der lokalen Version

Die folgenden Abschnitte ersetzen die früheren Aussagen „nur geplant“ **für den aktuellen Auftrag**. Die ursprüngliche Recherche bleibt unten als Entscheidungsverlauf erhalten.

### UI und Datenweg

- Neue Admin-Prämienseite mit Quartalswahl, frei bearbeitbaren Säulen/Komponenten, Quellen, UND-Bedingungen, Euro-Stufen und maximaler Prämie. Namen und Farben sind Anzeige; fachliche Art und stabile Schlüssel steuern die Logik.
- Echte GM-Roster aus `users`, einschließlich inaktiver GMs mit Kennzeichnung. Keine Demo-Rangliste im produktiven Prämienpfad. Gleicher Betrag ergibt gleichen Rang. Quartalsübersicht und getrennte Gesamtsicht aus neu abgeschlossenen Snapshots.
- Messwerte pro GM und Messgröße: manuelle Prozent-/Stück-/Punktwerte, persönliche positive Sollwerte, Begründung, Ursprung und Bearbeiter/Zeit. Es werden nur tatsächlich geänderte Eingaben gespeichert. Leer entfernt die manuelle Bewertung; 0 bleibt eine echte Bewertung. Abgeleitete Werte nutzen die wirksamen Einzelwerte.
- Regel- und Werte-Vorschau schreiben keine Daten. Laufende Regeländerungen müssen im UI vor dem Speichern geprüft werden. Bestätigtes Speichern aktualisiert den gemeinsamen Stand; ungültige Zahlen und veraltete Revisionen werden nicht still übernommen.
- Schütten-Soll kann nach manuell bestätigten Arbeitstagen/Abwesenheit berechnet werden; Basis und Tage landen in der Begründung. Keine unbelegte automatische Ableitung aus SM-/GM-Tätigkeiten. Produktbezugsmenge wird explizit als Soll angegeben, nicht aus nur vorhandenen Ja-Antworten erraten.
- GM-Bonusdetail, laufende kumulierte GM-KPI und Admin verwenden dasselbe Modell. Die alten Cache-Summen werden für umgestellte Wellen nicht zusätzlich gezählt.
- Änderungsverlauf und bestätigter Quartalsabschluss. Abschluss blockiert bei fehlenden benötigten Bewertungen; danach sind Regeln, GM-Werte, Namen und Ergebnisse eingefroren. Auch alte Mutations-/Löschpfade dürfen moderne Wellen nicht umgehen. Keine Auszahlung wird durch Aktivieren oder Abschließen ausgelöst.
- Excel-Export der aktuell geöffneten Ergebnisse mit Versions-/Zeitraumangaben sowie Messwerten und Herkunft; bestehender Exportknopf wieder angebunden.
- Alte Wellen werden nicht automatisch konvertiert. Gespeicherte alte Punktsummen/Prämien bleiben lesbar; eine laufende Alt-Welle kann ausdrücklich eingerichtet werden. Alte abgeschlossene Wellen werden nicht aus heutigen Regeln neu berechnet. Die Gesamtsicht bezeichnet ausdrücklich die neuen eingefrorenen Quartale, keine erfundene Alt-Historie.

### Angrenzende Funktionen und begründete Architekturentscheidungen

1. `praemien_waves` bleibt die gemeinsame Wellenidentität. Eine 1:1-Regelerweiterung, einzelne GM-Messwerte und ein Änderungsjournal ergänzen die alten Tabellen. Alte punktbasierte Säulen/Overrides werden nicht still in Prozent übersetzt. Der bewährte Auszahlungsrechner wird für Bedingungen weiterverwendet.
2. Laufende moderne Wellen werden aus **committeten** gültigen Besuchsantworten beim Lesen berechnet. Dies ersetzt für diesen Pfad den geplanten zusätzlichen Hintergrundjob/Outbox: keine zweite veraltbare Ergebniskopie, keine Bonus-Neuberechnung als Fehlerquelle im Besuchsabschluss. Neue, korrigierte oder gelöschte Antworten erscheinen beim nächsten Laden. Bei abgeschlossenen Wellen wird ausschließlich der gespeicherte Snapshot gelesen.
3. Quellen sind stabile Frage-IDs + Besuchsbereich + Antwort/Faktor, mit Mindestfrequenz und Ketten. `latest` nimmt den neuesten gültigen Besuch je GM/Markt/Frage/Quartal; Bearbeitung einer alten Antwort macht diese nicht zum neuesten Besuch. `once` nimmt höchstens einen Wert pro Schlüssel im Quartal. Fehlende Beobachtung bzw. fehlender positiver Nenner bleibt offen.
4. Quellen für fachlich als Distribution konfigurierte Säulen werden bei quartalsweiser Antwortübernahme im Besuch berücksichtigt. Umbenennen der Säule ändert diese Zuordnung nicht. Bestehende Antwortvalidierung und normaler Visitflow bleiben erhalten; keine neue Pflichtfrage wird hinzugefügt.
5. Standard-/Flex-/Billa-Frageeditoren zeigen aufklappbar die Verwendung einer Frage in Prämienregeln. Live-Boni-Gewichte ändern die gespeicherte monetäre Quartalsregel nicht heimlich. Die Quellenübersicht zeigt Abweichungen; Anpassung erfolgt bewusst im Regel-Editor.
6. Neuer tatsächlicher Eingangsstempel bei Besuchseinreichung wird getrennt von editierbaren Start-/Endzeiten gespeichert. Kein historischer Backfill: frühere tatsächliche Einreichzeiten sind nicht bekannt. Dieser Stempel ist eine Grundlage, **noch keine erfundene automatische SARA-/Qualitätsbewertung**.
7. Speichern und Abschluss verwenden Transaktion + Wellen-Lock + Revision; Konflikt liefert 409 statt fremde Eingaben zu überschreiben. Erstellung einer Welle mit kopierten Regeln ist atomar, ohne Übernahme von GM-Istwerten. Backend-Authentifizierung/Kundenseitenrechte bleiben maßgeblich; die rein lesende Vorschau verlangt Leserecht.
8. RLS aktiv, kein Direktzugriff für `anon`/`authenticated`; Zugriff auf neue Daten erfolgt über den berechtigungsgeprüften Backendpfad. Migration ist vorbereitet, nur in isolierter Test-DB ausgeführt, nicht in Produktion.

### Fachliche Grenzen – bewusst offen, nicht als fertige Automatik ausgegeben

- Q1-/Q2-Vorlagen bilden belegte Prozent-/Euro-Stufen und Flex-Mindestteilziele ab. Q3 hat Kühler und permanente Racks, aber keine erfundenen Stufen. Jedes neue Quartal wird eingerichtet; die alte Vorlage ist keine neue fachliche Freigabe.
- Qualität ist separat manuell bewertbar. Ohne bestätigte Stufen bleibt sie offen. Die synthetische Browserfixture hat ausdrücklich frei erfundene Qualitätsstufen, damit Speichern/Abschluss getestet werden können; diese sind **keine produktive Voreinstellung**.
- Für automatische Distribution muss je Produkt die berechtigte Sollmenge bestätigt/eingetragen werden. Automatische zeitabhängige Zuordnungs-/Produktpopulation-Snapshots sind nicht behauptet. Gegebenenfalls manuelle Gesamtquote verwenden.
- Rack-/Display-Neuplatzierungen sind nicht aus beliebigem Bestand sicher erkennbar. Quartals-Deduplizierung verhindert Wiederholungszählung im definierten GM-/Marktschlüssel, ersetzt aber keine unternehmensweit eindeutige Platzierungs-ID oder bestätigte Übergaberegel zwischen GMs. Solche Ziele bis zur Datenklärung manuell bewerten.
- Keine automatische SARA-Anbindung, Tag-Richtigkeitsprüfung oder Ableitung einer Zeitabweichung ohne definierte Vergleichsbasis. Fragen dazu stehen im Mailentwurf.
- Alle echten GMs werden gemäß Nutzerentscheidung angezeigt. Vor einem Abschluss müssen die für die Regeln benötigten Bewertungen vollständig sein, auch für angezeigte inaktive GMs; keine still angenommenen Nullbewertungen.

### Verifikation und reproduzierbarer isolierter Test

- `backend`: `npm run test:praemien-workspace` – **19/19 Tests erfolgreich** (PostgreSQL-kompatible PGlite-Testdatenbank, echte Migration und echter Express-Router plus vorhandene Prämien-/Antwortübernahme-Tests). Auch gespeicherte Alt-Punktsummen bleiben unverändert lesbar, ohne Prozentkonvertierung.
- Geprüft: API-Speicherung/Reload, GM-eigene Daten, Prozent-/Euro-Auswertung, UND-Gates, gruppierte Qualität ohne doppelte Teilstufen, 0/leer, fehlende Daten/Nenner, 409 bei parallelem Speichern, unveränderlicher Abschluss und Namen, RLS-Direktzugriff gesperrt, atomare Regelkopie und vollständiger Rollback ungültiger Erstellung, tatsächlicher Eingangsstempel bleibt bei Bearbeitung gleich, quartalsweise neue Quellenzuordnung.
- Browser: tatsächlicher Admin- und GM-UI-Pfad gegen die isolierte API. GM Nord von 85 auf 95 %: Vorschau 907,50 → 1.017,50 €, danach Speicherung, Reload und GM-Bonusdetail mit identischen 1.017,50 €. Laufende Stufe 440 → 450 €: Vorschau anderer GMs jeweils +10 €, nach Bestätigung 917,50 €. Eingabe `abc` wird vor Speichern abgelehnt. Responsive Karten und keine horizontale Dokument-Überbreite am schmalen Prüfviewport; Inaktiv-Kennzeichnung bleibt sichtbar.
- Frontend `tsc --noEmit` und Backend-Produktionsbuild mit `tsconfig.build.json` erfolgreich. Zusätzliche Backend-Typprüfung inklusive sämtlicher alter Tests ist wegen vorhandener Fehler in Kurti-/App-/SM-/Campaign-Testdateien und deren `rootDir`-Konfiguration nicht grün; keine Fehler in den neuen Prämien-Dateien. Frontend-Produktionsbundle kompiliert, aber vollständiger **Projekt-Build nicht grün**: bereits in Git HEAD vorhandener unzulässiger Export `ScopedQuestionnaireCatalog` aus `src/app/admin/mhd/page.tsx:903`. Diese fremde MHD-/Durcharbeit-Struktur nicht im Prämienauftrag umgebaut. Vor späterer Veröffentlichung gesondert beheben.
- Browser-Abschlussbestätigung hat zunächst eine Automationseinschränkung des nativen Bestätigungsfensters gezeigt. Die neue Version verwendet stattdessen einen normalen gestylten UI-Dialog. Nachprüfung bestanden: „Abschluss bestätigen“ → API/Snapshot → Version 4 „Abgeschlossen“ → Säuleneditoren gesperrt → Abschlussereignis mit Bearbeiter/Zeit im Verlauf. Serverseitige Schreibsperre und unveränderte Snapshots zusätzlich in lokalen API-/DB-Tests geprüft.
- Gesamt-Rangliste zeigt nach dem Abschluss die drei synthetischen GMs mit jeweils 907,50 € und einem abgeschlossenen Quartal. Backend-Produktionsbuild (`npm run build`) erfolgreich. Excel-Knopf erzeugt tatsächlich `Praemien_Isolierter_Test_Q3_V4.xlsx` im Downloadordner; Datei lesend geprüft: Meta, Prämien, Messwerte, echte synthetische GM-IDs und drei numerische Prämien von 907,50 €, keine Fehlerzellen. Der In-App-Browser meldet für diesen Blob-Download kein Automationsevent; die vorhandene Datei bestätigt den Download trotzdem.
- Sicherer Einstieg: `http://localhost:3017/dev/praemien-fixture`. Nur synthetische Nutzer, keine externen Datenbankverbindungen. Backend `127.0.0.1:4017` aus eigenständigem Test-Einstieg ohne `.env`-Laden oder Hintergrundjobs.

Backend im Ordner `backend`:

```powershell
npm run dev:praemien-preview
```

Frontend im Workspace, in einem separaten Terminal:

```powershell
$env:NEXT_PUBLIC_BACKEND_URL = 'http://127.0.0.1:4017'
$env:SPARK_NEXT_DIST_DIR = '.next-praemien-test'
node node_modules/next/dist/bin/next dev --webpack --port 3017
```

Beim Neustart wird die rein lokale In-Memory-Testdatenbank neu angelegt. Bestehende Hosts 3000/4000 sind **kein** isolierter Schreibtest. Die frühere Demo-Dashboardkarte wurde nicht ungefragt produktiv verdrahtet. Kein Push, keine produktive Migration, keine SIMPL-Änderungen, keine Mail versandt.

### Spätere Veröffentlichung – noch nicht ausgeführt

1. Doris' Regeln/Bezugsmengen anhand echter Beispieldaten fachlich abnehmen, vollständigen Projekt-Build-Blocker lösen.
2. Additive Migration `backend/supabase/migrations/20260928081414_praemien_wave_workspace.sql` gezielt in der autorisierten Umgebung anwenden. Ein Git-Push allein führt diese Migration nicht aus.
3. Backend + Frontend gemeinsam veröffentlichen; vorheriges Prozent-/Punktmaterial nicht automatisch umdeuten. Ohne Migration liefert der neue Prämienpfad einen klaren 503-Hinweis.
4. Produktive Quartalsregeln ausdrücklich als Entwurf einrichten, prüfen und aktivieren. Noch keine dieser Aktionen ist autorisiert oder durchgeführt.

### Entscheidungsverlauf 28.09.2026

1. Nutzerantworten zuerst D1–D6 zugeordnet; keine neue Nachfrage nach bereits frei einstellbaren Q3-Zielen.
2. Frühere PDF-/Excel-Extrakte mit alten Planungsdateien abgeglichen. Originaldateien sind am damaligen Temp-Pfad nicht mehr vorhanden; Quellenstand deshalb ausdrücklich begrenzt. Q1 und Q2 separat dokumentiert, nicht als neue Q3-Freigabe ausgegeben.
3. SIMPL lesend auf sieben thematische Coke-SPARK-Karten und die beiden vorhandenen Kommentare geprüft. Kein neuer Zahlenanhang; „Prämien Flexziel“ In Arbeit. Kein Kartenstatus/Kommentar verändert.
4. Prozent-/Euro-Stufen und Flex-UND-Regeln rekonstruiert. Excel-Fehler (1050er-Nenner, fehlendes Flex-Gate) nicht als Sollregel übernommen. Qualitätsregeltext gefunden, aber technische Bezugsdefinitionen nicht vollständig.
5. Quellzuordnung, Duplizierung, Antwortübernahme, Finalizer, Abschluss und Korrekturpfade gelesen. Daraus D7–D12 sowie die notwendige Trennung zwischen Beobachtung, Vorbefüllung und Bonuszählung abgeleitet.
6. Daraus gemeinsames UI-/Datenkonzept und Umsetzungsreihenfolge erstellt. Bestehende Demo-Dashboardkarte und Flex-Marktzugriff nicht still in den Auftrag aufgenommen.
7. Planung überprüft; nur die drei `docs/praemienwelle-*.md` erstellt/aktualisiert. Andere vorhandene Workspace-/Backend-Änderungen gehören zu früherer Arbeit und bleiben unberührt. Keine Funktionsänderung, produktive Migration, Veröffentlichung oder produktiver Schreibtest.

## Ziel

Je Quartal sollen die richtigen Flexziele, echte Mitarbeiter und nachvollziehbare Prämien angezeigt werden. Admins sollen jede Säule bearbeiten und Zielerreichungen in Prozent mit frei konfigurierbaren Euro-Stufen bewerten können. Admin-Anzeige und GM-Anzeige müssen dieselbe Berechnung verwenden.

Die Karte „Prämien Flexziel“ nennt Q3 mit Kühlern und permanenten Racks, ein falsches Leaderboard, händisch bearbeitbare Säulen und beispielsweise „ab 80 % = 86,50 €, darunter 0 €“. Der Kommentar „KW36“ enthält keine zusätzlichen Berechnungsregeln. Genaue Quartalswerte werden gemäß D1 eingerichtet, nicht fest im Code vorausgesetzt.

Nach D1 ist die fehlende Q3-Zahlentabelle **kein Grund, feste neue Werte zu erfinden**: Komponenten, Zieldefinition und Euro-Stufen werden je Quartal eingerichtet. Belegte Q1-/Q2-Werte, Formelfehler und verbleibende Datenlücken stehen in [Quellen und Regeln](praemienwelle-quellen-und-regeln.md). Die bisherigen Fragen sind durch die Nutzerantworten weitgehend erledigt; die Fragen-Datei dokumentiert nun diese Entscheidungen und verbleibende Einrichtungsfragen.

## Geprüfter Bestand

| Bereich | Bereits vorhanden | Was fehlt oder falsch ist |
| --- | --- | --- |
| Quartale | Wellen mit Jahr, Quartal, Zeitraum, Status und eigenen Säulen, Messgrößen und Stufen; Speicherung über Backend | Neue Wellen verwenden dieselben Flex-Defaults unabhängig vom Quartal. Kein vollständiger UI-Editor für Komponenten und deren Einheiten/Datenquellen |
| Flex | Backend speichert beliebige `componentValues`; Eingabemaske liest die konfigurierten Komponenten | Defaults sind `Kühler`, `RED / IR` und Gesamtpunkte; Q3-Racks sind nicht als passendes Quartalsmodell eingerichtet. Eingabe und Gesamtbildung sind weiterhin punkteorientiert |
| Manuelle Werte | Override je Welle, GM und Säule, gespeichert im Backend; leer = automatisch, 0 = bewusst null | Feld speichert **Punkte**, nicht explizit Prozent. Derselbe Override wird bei zusammengesetzten Säulen auf alle Teilmessgrößen übertragen; das ersetzt keine getrennte Erfassung von Kühlern und Racks |
| Auszahlung | Unabhängige Säulen; Prozentbedingungen; mehrere Stufen mit Euro-Beträgen; höchste erreichte Stufe oder additive Teilziele | UI ist nur teilweise flexibel: vorhandene Grenzen/Beträge lassen sich ändern, aber Komponenten, Bedingungen und Auszahlungsmodus nicht vollständig verwalten |
| Mitarbeiter | Echte GM-Liste wird geladen; im geöffneten Quartal lokal 16 GMs angezeigt | Fallback ist eine Demo-Liste. Das Leaderboard verwendet unabhängig davon stets 10 Demo-Mitarbeiter und erfundene Historien |
| Fortschritt | Backend berechnet echte GM-Bonuszusammenfassungen und speichert Wellen-/Säulentotals | Admin-Fortschritt, Detailansicht und GM-Vorschau enthalten noch Mockwerte und teilweise das alte globale Stufenmodell |
| GM-Dashboard Admin | Zuletzt gestaltete Boni-Karte mit passenden Diagrammen | Absichtlich weiterhin Demo, wie zuvor beauftragt. Echtdaten-Anbindung ist ein separater Ausbau, nicht stillschweigend Teil dieser Planung |

### Konkrete Codebelege

- `src/app/admin/praemien/page.tsx:90`: `buildDefaultPillars()` ist quartalsunabhängig; Flex enthält Kühler und RED/IR.
- `src/app/admin/praemien/page.tsx:178`: Flex-Eingaben lesen vorhandene Komponenten dynamisch.
- `src/app/admin/praemien/page.tsx:954`: `buildGmProgressRows()` nutzt `MOCK_GM_PROGRESS` und globale Schwellwerte statt echter Säulen-Auszahlungen.
- `src/app/admin/praemien/page.tsx:1149`: `buildLeaderboard()` nutzt `ALL_GMS` und `MOCK_GM_WAVE_HISTORY`.
- `src/app/admin/praemien/page.tsx:2594`: `PillarRewardEditor` bearbeitet vorhandene Stufen, Grenzen, Beträge und Maximum; vollständige Messgrößen-/Bedingungsverwaltung fehlt.
- `src/app/admin/praemien/page.tsx:2971`: `PillarOverridesModal` speichert einen numerischen Punktewert je GM/Säule.
- `src/app/admin/praemien/page.tsx:4750`: `GMPreviewCard` ist eine simulierte Vorschau, keine echte GM-Berechnung.
- `src/app/admin/praemien/page.tsx:5021`: echte GM-Liste mit Demo-Fallback.
- `backend/src/routes/praemien.ts:81`: Backend nimmt Messgrößen, Einheiten, Stufen und Bedingungen entgegen.
- `backend/src/routes/praemien.ts:1678`: eigener Speicherpfad für manuelle Säulenwerte.
- `backend/src/lib/bonus-finalizer.ts:223`: Punkt-Overrides werden für Prozentbedingungen durch das Säulenziel geteilt. Ein Wert 80 bedeutet deshalb nicht grundsätzlich 80 %.
- `backend/src/lib/bonus-finalizer.ts:269`: ein Gesamt-Override überschreibt auch jede einzelne Flex-/Qualitätsmessgröße.
- `backend/src/lib/praemien-rewards.ts:126`: gemeinsame Säulen-Stufenberechnung; alle Bedingungen einer Stufe müssen erfüllt sein. Ohne erreichte Stufe ist die Auszahlung 0 €.
- `backend/src/lib/schema.ts:2427`: gespeicherte Wellen- und Säulenergebnisse als Grundlage für echte Auswertungen.
- `src/components/admin/gm-dashboard/BonusOverviewCard.tsx`: bewusst separat gekennzeichnete Demodaten.

Die älteren Dateien `praemien-findings.md` und `praemien-saeulenmodell.md` liefern fachlichen Kontext, sind aber kein Nachweis der aktuellen Q3-Regeln oder des aktuellen Deploymentstands. Insbesondere steht dort teilweise 82,50 €, während die neue Karte 86,50 € als Beispiel nennt.

## Geplante Umsetzung

### 1. Quartalsregeln sauber konfigurierbar machen

- Den bestehenden Wellen-/Säulen-/Messgrößen-/Stufenaufbau erweitern, nicht ein zweites Prämiensystem bauen.
- Flex-Komponenten je Welle bearbeiten: Bezeichnung, Einheit (% / Punkte / Anzahl), Datenquelle bzw. manuelle Eingabe, Reihenfolge und Zieldefinition.
- Q3 kann mit Kühler-/Rack-Komponenten eingerichtet werden; keine erfundenen Zielgrenzen hinterlegen. Kein pauschales Umbenennen von `RED / IR`, weil damit alte Werte falsch interpretiert würden.
- Komponenten über stabile fachliche Keys identifizieren; Umbenennungen dürfen Berechnungsart und Historie nicht ändern. Der aktuelle Code erkennt Flex/Qualität teilweise am Säulennamen; dies entkoppeln.
- Neue Quartale dürfen leer, aus einer belegten Q1-/Q2-Vorlage oder als Regelkopie einer bestehenden Welle entstehen. Istwerte, Bewertungen und Ergebnisse werden nicht mitkopiert. Vorlage zeigt ihr Ursprungsquartal; Übernahme erzeugt einen prüfpflichtigen Entwurf.
- Vorhandene Wellen und alte Berechnungsmodelle unverändert lesbar halten. Quartalswechsel darf keine vorangegangene Welle überschreiben.
- Bei automatischen Rack-/Kühlerwerten genau festlegen, ob Bestand, Neuplatzierung, Nettoveränderung oder Scanquote zählt und wie doppelte Besuche behandelt werden. Bereits vorhandene und neu platzierte Racks sind im Quellenkatalog getrennte Fragen; nicht ungeprüft addieren oder zusätzlich in zwei Säulen zählen.
- Aktivierung nach Messgrößenart prüfen: positive Sollzahl nur bei „Ist / Soll“, keine erfundenen Zielpunkte für manuelle Prozente, feste Quoten oder additive Qualität. Der heutige Aktivierungscheck verlangt positive Zielpunkte für **alle** Säulen und muss dafür angepasst werden (`backend/src/routes/praemien.ts:699`).
- Persönliche Sollwerte pro GM erlauben. Q2 berücksichtigt Urlaub/Krankheit/Messe; das kann nicht allein durch ein gemeinsames `targetPoints` für die ganze Säule abgebildet werden.

### 2. Jede Säule verständlich editierbar machen

- Pro Säule einen zusammenhängenden Editor für Ziele, Messgrößen, Bedingungen, Stufenbeträge, Maximum und Auszahlungsmodus anbieten.
- Beispiel verständlich anzeigen: „ab 80 % → 86,50 €“, „unter der ersten Stufe → 0 €“; Beispiel ist keine freigegebene echte Regel.
- Einfacher Standard: höchste erreichte Stufe. Additive Teilziele nur dort, wo fachlich gewünscht, z. B. mehrere getrennte Qualitätsziele.
- Mehrere notwendige Teilziele als UND-Bedingungen sichtbar machen; keine Freischaltung allein durch einen Gesamtwert, wenn ein Teilziel fehlt.
- Grenzen und Euro-Beträge mit deutscher Dezimaleingabe (z. B. 86,50) erfassen und centgenau anzeigen.
- Rohwert → Zielerreichung → Euro getrennt konfigurieren. Unterstützte Bausteine: Ist/Soll-Quote, Ja/Nein-Verfügbarkeit, Mittelwert definierter Produktquoten, Nettodifferenz, Schwellenumrechnung, Summe kompatibler Teilpunkte und direkte manuelle Prozentbewertung. Keine frei ausführbaren Formeln oder unbeschriftete Summe aus Prozenten und Stückzahlen.
- Bei Qualität pro Teilziel die höchste passende Teilstufe auswählen und erst dann Teilbeträge addieren. Sonst würde der heutige flache `sum_earned_tiers`-Modus z. B. gleichzeitig 55 € und 110 € fürs selbe Zeitmanagement zahlen, wenn beide Mindestschwellen erreicht sind. Gruppen/Teilziele deshalb explizit modellieren.
- Stufenreihenfolge, ungültige/mehrdeutige Stufen, unbekannte Messgrößen und Beträge über dem Säulenmaximum serverseitig prüfen. Die bestehende Berechnung wählt bei `highest_tier` die letzte erreichte Stufe in der konfigurierten Reihenfolge: darum Reihenfolge eindeutig validieren.

### 3. Prozentwerte pro Mitarbeiter eindeutig speichern

- Gemäß D2 beides: Regeln/Ziele bearbeiten und tatsächliche GM-Werte manuell erfassen/korrigieren. Bestehende Automatik bleibt als Ausgangswert; fehlende automatische Quellen erlauben einen ausdrücklich manuellen Modus.
- Bei manueller Prozent-Erfassung `80` als exakt `80 %` speichern und bewerten, nicht als 80 Rohpunkte eines zufällig anderen Ziels.
- Das vorhandene Override-Modell erhält eine ausdrückliche Einheit bzw. einen eindeutigen Eingabemodus. Alte Punktewerte bleiben Punkte; kein stilles Uminterpretieren bestehender Daten.
- Für zusammengesetzte Ziele zusätzlich getrennte Messgrößenwerte ermöglichen. Ein Gesamtwert darf nicht pauschal auf Kühler, Racks und Qualitätsteilziele kopiert werden.
- Klarer Zustand pro Wert: „Automatisch“, „Manuell“, „Noch nicht bewertet“. Leer bleibt automatisch; 0 % ist eine echte Bewertung und nicht „fehlt“.
- Hat eine rein manuelle Messgröße keinen Eintrag, bleibt sie offen. „Zur Automatik“ funktioniert nur mit einer konfigurierten Datenquelle; andernfalls „Bewertung entfernen“. Bei Datenfehlern erscheint „Nicht auswertbar“, keine vermeintlich echte Null.
- Manuelle Änderung mit Bearbeiter, Zeitpunkt und optionaler Begründung nachvollziehbar machen; Rückkehr zur Automatik anbieten. Bestehende Änderungsprotokolle wiederverwenden und Lücken gezielt schließen.
- Nach Speichern serverseitig neu berechnen und die bestätigten Prozent-/Euro-Ergebnisse in allen Ansichten anzeigen. Vor Speichern eine reine Vorschau anbieten.

### 4. Echte Auswertung und Leaderboard anbinden

- Demo-Mitarbeiter, Demo-Historien und Mock-Fortschritte aus echten Auswertungsansichten entfernen. Lade-/Fehler-/Leerzustände dürfen nicht durch Demo-Daten ersetzt werden.
- Admin-API für paginierte Mitarbeiterergebnisse pro Welle und Leaderboard/Historie ergänzen, mit bestehenden Berechtigungsgrenzen und denselben Berechnungsfunktionen wie die GM-Ansicht.
- Entwürfe und noch nicht erfasste manuelle Werte ausdrücklich als Vorschau/offen darstellen. Keine erfundenen historischen Prämien ergänzen.
- Für Entwürfe erforderliche Vorschau nur lesend berechnen; kein Recompute-Schreibvorgang als Nebeneffekt eines GET-Aufrufs.
- Gemäß D4 alle echten GMs berücksichtigen. Quartalsrangliste sortiert nach der tatsächlich berechneten Euro-Summe, Gleichstände als Gleichstand; vorgeschlagener Umschalter „Dieses Quartal / Gesamt“ trennt laufende Werte von eingefrorener Historie. Gesamt summiert nur abgeschlossene Wellen, nicht zusätzlich deren laufende Vorschau.
- Bei historischen Ergebnissen ausgeschiedene/inaktive GMs nicht allein wegen ihres heutigen Status aus vergangenen Quartalen verlieren. Aktuelle Teilnehmer und historisch berechtigte Teilnehmer getrennt behandeln.
- Admin-Fortschritt, Mitarbeiterdetails und echte GM-Anzeige verwenden einen gemeinsamen Ergebnisvertrag, nicht getrennte globale und säulenbasierte Rechnungen.
- Die absichtlich demobasierte GM-Dashboard-Boni-Karte bleibt bis zu einem eigenen Auftrag als Demo gekennzeichnet. Eine spätere Anbindung nutzt dieselbe Ergebnis-API und erhält das zuletzt abgestimmte Diagrammdesign.

### 5. Historie und Veröffentlichung absichern

- Gemäß D5 laufende Quartale nach bestätigten Änderungen neu rechnen, abgeschlossene Ergebnisse und zugehörige Regeln einfrieren. Im heutigen Backend verhindert der Wellen-Lock veraltete Writes, aber **keine** Bearbeitung archivierter Wellen (`backend/src/routes/praemien.ts:679`); Recompute überspringt dagegen nicht aktive Wellen (`backend/src/lib/bonus-finalizer.ts:813`). Das allein ist noch kein vollständiger Abschluss-Schutz.
- Bei Regeländerung betroffene Ergebnisse und Caches konsistent aktualisieren; Konfliktschutz (`expectedUpdatedAt`) beibehalten.
- Nur notwendige additive Migrationen für Messgrößen-/Quellsemantik, individuelle Ziele, einzelne manuelle Messgrößen, Regelrevision/Abschluss-Snapshot und fehlende Zeit-/Übernahme-Herkunft planen. Keine manuell gepflegte Teilnehmerliste: D4 ist „alle“. Vorher bestehende Tabellen und RLS prüfen; keinen unnötigen Parallelbestand schaffen.
- Umsetzung und Migrationen zunächst mit isolierter lokaler Testdatenbank und synthetischen Mitarbeitern/Besuchen prüfen. Produktionsdaten nicht ändern.
- Push/Deployment und produktive Migrationen sind spätere Schritte, nicht Teil dieses Planungsauftrags.

## Konkretes UI-Konzept

Dies ist ein Planungskonzept, kein bereits gebauter Bildschirm. Vorhandene Prämienseite umbauen, keine zweite Einstellungsseite daneben anlegen.

### Übersicht und Navigation

```text
Prämienwelle         [Jahr / Quartal ▾] [Laufend]
01.07.–30.09.        Berechnet am … · Regelversion …
[Übersicht] [Regeln & Quellen] [Mitarbeiterwerte] [Verlauf]

[Schütten/Displays] [Distribution] [Flexziel] [Qualität]
 Ziel / Maximum      Ziel / Maximum Teilziele   Bewertung offen
 [Regeln bearbeiten] je Säule; echte Ergebnisse statt Demo

Mitarbeiter                            [Dieses Quartal | Gesamt]
GM suchen …                            [Alle | Offen | Manuell ▾]
GM        Schütten   Distribution   Flex   Qualität   Prämie
Name      84 %       81 %           …      offen      … € vorläufig
          Automatisch/Manuell + Detailansicht pro Wert
```

- Bestehende Inter-Schrift, Abstufungen der Überschriften, weißer Kartenhintergrund, Abstände und kompakten Dropdowns der GM-/Prämien-Dashboards übernehmen. Kein neues Schrift-/Formularsystem.
- Balken/Ringe wie die zuletzt abgestimmte Verteilungskarte: Kontur in voller Farbe, schwächer deckende Füllung. Keine grauen Zielbalken als undurchsichtiger Hintergrund. Legende „Zielerreichung“ von „Anteil der maximalen Prämie“ unterscheiden; 80 % Zielerreichung ist je nach Stufe nicht 80 % Auszahlung.
- Einfache Prozent-Säule zeigt Prozent, nächste Stufe und Euro. Zusammengesetztes Flexziel zeigt **beide Komponenten**, ihre Mindestbedingungen und Prämie, nicht einen irreführenden einzigen Fortschrittskreis.
- Eine offene Qualitätsbewertung macht die Gesamtsumme „vorläufig“, nicht die ganze Person wertlos. Bereits berechnete Teilbeträge bleiben sichtbar. Ladefehler zeigen Wiederholen, keine Mockzahlen.
- Alle echten GMs in der Admin-Auswertung; inaktive als „Inaktiv“ kenntlich und historische Beträge erhalten. „Gesamt“ enthält vorhandene abgeschlossene Ergebnisse, keine erfundenen Vorjahre. Rangfolge/Gleichstand und Zeitraum sichtbar beschriften.
- Mobil werden Säulenkarten gestapelt und GM-Zeilen zu kompakten Detailkarten; keine abgeschnittenen Editorspalten. Tastaturbedienung, sichtbare Fokuszustände und erklärende Textlabels, nicht nur Farbcodes.

### „Regeln bearbeiten“: Seitenpanel statt verstreuter Pop-ups

Für jede Säule dasselbe Panel mit drei Abschnitten:

1. **Ziel & Erfassung:** Name, Beschreibung, Maximalprämie, Messgrößen mit Einheit, „Automatisch / Manuell“, Berechnungsart und GM-Sollwerten. Einfacher Fall: „Erreichung in %“. Zusammengesetzter Fall: „Kühler“ und „Permanente Racks“, jeweils mit eigener Einheit und Datenquelle; Gesamt ausschließlich daraus ableiten.
2. **Stufen & Bedingungen:** editierbare Zeilen „ab [80] % → [82,50] €“, „Stufe hinzufügen“, Maximum. Für Flex „Kühler mindestens … **und** Racks mindestens …“ als klar lesbare zusätzliche Bedingungen. Für Qualität getrennte Teilzielgruppen mit jeweils eigenen Beträgen. Stufenmodus „Höchste erreichte Stufe / Teilziele addieren“ sichtbar erklären.
3. **Datenquellen:** passende Frage suchen, Fragebogen/Modul/Bereich und Antwort anzeigen, Messgröße zuordnen, berechtigte Marktgruppe und Zeitraum/Zählweise festlegen. Warnungen bei fehlender Quelle, verändertem Antworttyp, Doppelzuordnung und unvollständiger Bezugsmenge.

Zusätzliche Berechnungsdetails erscheinen nur bei Bedarf unter „Berechnung“, mit unterstützten Bausteinen statt Freitext-Code. Beispiel Q2-Flex: Neu minus retour → Schwellenpunkte; RED/IR-Quote → Schwellenpunkte; Summe plus zwei Mindestbedingungen. Einheitenwechsel bei vorhandenen Istwerten verlangt bewusste Umstellung, nicht Umbenennung.

Unter dem Panel eine reine Vorschau mit frei einstellbaren Beispiel-Istwerten: „Bei 79,99 %: 0 €; bei 80 %: … €“. Das ist eine Simulation, keine GM-Bewertung.

Bei laufender Welle: „Änderungen prüfen“ zeigt betroffene GMs, Differenz alter/neuer Prämie, fehlende Bewertungen und Quelle der neuen Regel. Erst „Speichern & neu berechnen“ veröffentlicht die neue Regelrevision. Keine unbeabsichtigte produktive Geld-Neuberechnung durch jedes Tippen/Blur-Autosave. Entwürfe dürfen lokal zwischengespeichert werden; serverseitiges Speichern bleibt sichtbar.

### „Mitarbeiterwerte“: Direkt erfassen und Herkunft sehen

- Tabelle mit echten GMs und Säulen. Einfache Säule: direkter Prozent-Eintrag mit `%`-Suffix und Ergebnisvorschau in Euro. Unter dem Feld „Automatisch: 81,3 %“ bzw. „Manuell, bearbeitet von … am …“.
- Gesamt-Flexfeld nicht auf alle Komponenten übertragen. Zeilenklick öffnet Teilwerte mit einzelnem Modus und Einheit. Wenn eine Welle direkt Prozent als manuelles Gesamtziel definiert, ist nur diese Messgröße gemeint; komponentenbasierte UND-Regeln bleiben separat erforderlich.
- Persönliches Schütten-Soll zeigt „Basis … Punkte“, „Abwesenheit … Tage“, „Wirksames Soll …“. Bearbeitbar, mit nachvollziehbarer Quelle; automatische Abwesenheitsanbindung erst mit verifizierter Datenquelle. Keine Ableitung von Krankheit aus einem Arztbesuch.
- Qualität: getrennte Prozentfelder „Zeitmanagement“, „Reporting“, „Bildertags/Survey“, mit jeweiligen Euro-Stufen. Kein ungewichteter Mittelwert als Auszahlung aller Teilziele.
- „Zur Automatik“ entfernt eine Korrektur, nicht Besuchsantworten. Leeren einer rein manuellen Bewertung bedeutet „offen“. Eine bewusst eingetragene 0 bleibt beim Speichern eine 0.
- „Speichern“ bestätigt nur geänderte Werte mit Konfliktschutz. Kurze Begründung bei Korrekturen; getrennte Aufzeichnung automatisch/manuell/wirksam. Kein manuell überschriebenes Geldfeld als Ersatz der Prozentregel.
- Optionaler späterer Bewertungsimport kann vorhandenen Qualitätsimport weiterverwenden, muss aber Einheiten und GM-IDs korrekt zuordnen. Kein neuer Importumfang für diese erste Umsetzung vorausgesetzt.

### GM-Ansicht und Abschluss

- GM sieht die eigene echte Welle, Prozent-/Teilwerte, Euro je Säule, nächste Grenze, Aktualisierungsdatum und Hinweis „manuell bewertet“/„Bewertung offen“. Keine Admin-Regelbearbeitung und kein Zugriff auf individuelle Bewertungen anderer Personen durch eine neue API.
- „Verlauf“ zeigt Änderungen an Regeln/Bewertungen sowie abgeschlossene Quartale. Abschlussknopf erst nach erfolgreicher aktueller Berechnung; Warnung bei offenen Werten oder Berechnungsfehlern. Nicht vollständig bewertete Wellen nicht still endgültig auf 0 € abschließen.
- Bestätigter Abschluss: Regeln, effektive Werte, Teilnahme-/Namenskontext und Auszahlungsdetails versioniert speichern. Danach „Abgeschlossen – Stand vom …“, nur lesend. Kopieren ins nächste Quartal ist möglich, Wiederöffnung/Abrechnungskorrektur **nicht** implizit autorisiert.
- Ein künftiger Export enthält GM-ID, Welle, Regelversion, Messgröße/Einheit, automatische/manuelle/wirksame Werte, Bezugsmenge, Stufe und Euro. Nicht bloß vier Gesamtzahlen ohne Erklärung.

## Angrenzende Abläufe: gelesen, notwendige Änderungen und UI

| Bereich und Codebeleg | Heutiger Stand / Lücke | Geplante Anpassung | Sichtbar im UI |
| --- | --- | --- | --- |
| Fragebewertung: `src/components/admin/ModuleEditor.tsx:1332`, `FlexModuleEditor.tsx:612`, `BillaModuleEditor.tsx:612` | Boni-Gewicht pro Antwort bzw. Wert × Faktor; keine vollständige Wellen-/Messgrößen-/Zählzuordnung | Gemeinsamen Boni-Zuordnungsbereich für relevante GM-Frageeditoren planen. Bestehende IPP-/Zweitplatzierungswertung unverändert halten. Boni-Gewicht bedeutet Punkte, **nicht Euro** | Unter „Bewertung“ ausklappbar „Prämienzuordnung“: Welle, Säule, Messgröße, Einheit, Zählregel und Link zur Regel. Keine neue Pflichtfrage für normalen Besuch |
| Quellenkatalog: `backend/src/lib/praemien-source-catalog.ts:86`, `backend/src/routes/praemien.ts:961` | Nur aktive/geplante bzw. kampagnenverwendete Fragen mit Boni ≠ 0. Zuordnung primär Frage/Score→Säule, kein vollständiger Quoten-Nenner. Doppelte Frage/Score bereits verboten | Zugeordnete alte Quellen lesbar behalten; Entwurfsfragen gezielt für geplante Wellen wählbar machen, ohne sie als aktive Erhebungen auszugeben. Zuordnung zusätzlich zur Messgröße/Bezugsmenge. Nicht jede Rohwertquelle braucht einen positiven Boni-Faktor | Kennzeichnung „Entwurf/aktiv“, „bereits zugeordnet“, gewählte Produkt-/Kettenmatrix, Zahl berechtigter Märkte, fehlende Daten |
| Duplizierung: `backend/src/routes/fragebogen.ts:3395`, `:3423` | Neue Module verknüpfen dieselben Frage-IDs; Frageänderung wirkt auf geteilte Fragen. Wellenquellen werden nicht automatisch als neue Quartalskonfiguration kopiert | Stabile Frageidentität erhalten und geplante Zuordnungen auf Kompatibilität prüfen. Keine stillschweigende Kopie von laufenden Geldregeln/GM-Werten. Bei wirklich neuer Frage bewusste neue Zuordnung statt Textvergleich | „Verwendet dieselben Fragen“; Zuordnung im Zielquartal „übernehmen und prüfen“ mit Konfliktliste. Kein zweites gleich vergütetes Exemplar derselben Quelle |
| Frageänderung: `backend/src/routes/fragebogen.ts:2093`, `:2102`, `:2109`, `:2149` | Score-Änderungen stoßen IPP an, nicht automatisch ein fachlich kontrolliertes Update der als Wellenquelle gespeicherten Boni-Werte | Auswirkungsprüfung auf nicht abgeschlossene Wellen. Umbenennen nicht als neue Messgröße erkennen; veränderten Typ/Score-Key und alte Snapshot-Antworten explizit behandeln. Erst bestätigte Wellenänderung neu rechnen | „Diese Frage wird in … Wellen verwendet“, „Boni-Wert weicht ab“, „Zuordnung prüfen“. Alte Besuche nicht umschreiben |
| Antwortübernahme: `backend/src/lib/praemien-answer-persistence.ts:14`, `backend/src/routes/gm-visit-sessions.ts:825`, `:2401` | Distributionsziel kann nach exakter technischer Frage-ID im Kalenderquartal vorbefüllt werden; andere Antworten weiter im RED-Monat. Vorbefüllung wird als neue Antwort gespeichert, ohne eigenes durchgängiges Herkunftsfeld | Übernahme- und Zählzeitraum trennen; Herkunft (Session/Antwort/Zeitpunkt) bewahren. Existierende gültige Vorbefüllung samt Kommentar beibehalten, Fragen weiter korrigierbar. Keine quartalsweite Fotoübernahme pauschal ergänzen | Kurzer Hinweis „Vom Besuch am … übernommen, weiterhin bearbeitbar“. Nicht „neu aufgestellt“ suggerieren, wenn nur ein früherer Bestand übernommen wurde |
| Quartalszählung: `backend/src/lib/bonus-finalizer.ts:753`, `:772`; `backend/src/lib/schema.ts:2525` | Beitrags-Schlüssel enthält RED-Monatsstart. Wiederholte Monatsbesuche können dieselbe übernommene Platzierung mehrfach in einer Quartalswelle beitragen | Explizite Aggregation je Messgröße; Verfügbarkeit als neuester gültiger Zustand pro Markt/Frage, quartalsweise identische Platzierung einmal. Echte neue Platzierung nur mit geeigneter Ereignis-/Objektidentität oder manuellem Nachweis; keine allgemeine Summierung kopierter Antworten | In den Quellen „Zählweise: einmal pro Markt/Quartal / letzter Stand / neue Ereignisse“. Detail zeigt gezählt/ersetzt/nicht zusätzlich gezählt mit Grund |
| Frequenz/Kette: `backend/src/lib/bonus-finalizer.ts:687`, `src/app/admin/praemien/page.tsx:3364` | UI sagt <8/>8, Code ≤8/≥8; genau 8 hat andere Bedeutung. Nur Frequenzfilter, keine vollständige produktspezifische Excel-Matrix im Quotenmodell | Operator und Grenze eindeutig speichern; für belegte Distribution ≥8. Ketten/Privatmarkt/Produkte und Soll-Marktbestand im Quotennenner prüfen. Alte Regeln sichtbar migrieren, nicht still ändern | „Mindestens 8 Besuche/Jahr“, Produkttabelle für Ketten, „nicht anwendbar“ statt „Nein“ |
| Besuchsabschluss: `backend/src/routes/gm-visit-sessions.ts:5402`, `:5418` | Bonusfinalizer läuft in derselben Transaktion wie Besuchsabschluss | Gültigen Besuch nicht wegen unvollständiger Prämienkonfiguration unabschließbar machen. Entweder vollständige Aktivierungsvalidierung plus robuste Berechnung oder dauerhaft vorgemerkte Berechnung nach Commit; Vorschlag: transaktionaler Auftrag mit idempotenter Ausführung und sichtbarem Ergebnisstatus | Besuchsablauf bleibt gleich: Zeit prüfen → abschließen. Bei verzögerter Bonusberechnung „Besuch gespeichert, Prämien werden aktualisiert“, kein neuer Prämien-Eingabeschritt |
| Antworten korrigieren/löschen: `backend/src/routes/campaigns.ts:3707`, `:3251`; `backend/src/routes/admin-zeiterfassung.ts:2197` | Antwortkorrektur finalisiert die einzelne Session erneut, genehmigte Löschungen rechnen Wellen neu | Betroffene laufende Wellen/Messgrößen und neueste gültige Antwort neu bestimmen. Korrektur einer älteren Session darf neuere Quartalswerte nicht überschreiben. Abschluss-Snapshots bleiben stabil; nachträgliche Differenz sichtbar, keine automatische Auszahlungskorrektur | Bestehende Korrekturmaske plus Hinweis „Prämien im laufenden Quartal werden neu berechnet“ bzw. „Abgeschlossenes Ergebnis bleibt unverändert“ |
| Zeitkorrekturen: `backend/src/routes/admin-zeiterfassung.ts:1484`, `backend/src/routes/time-entry-change-requests.ts:755` | Start/Ende editieren `startedAt/submittedAt`; in diesen Pfaden kein Bonus-Recompute. Dauer folgt dem Intervall | Zentralen Änderungsimpuls für relevante laufende Wellen planen, einschließlich alter/neuer Periodenzuordnung. Historische Regeln nicht neu anwenden. Besuchsdauer weiter aus Start/Ende ableiten | Bestehende Start-/Endfelder behalten; kein neuer „Dauer bearbeiten“-Knopf. Nur Auswirkungshinweis/Status |
| Reporting-Frist: `backend/src/lib/schema.ts:3123` und Endzeitkorrektur oben | `submittedAt` ist bearbeitbare Besuchs-Endzeit, kein unveränderlicher Nachweis tatsächlicher Abgabe. `createdAt`/`updatedAt` ersetzen diesen nicht | Besuchsdatum/Intervall und tatsächlichen serverseitigen Einreichzeitpunkt getrennt erfassen. Für Sara-Kriterium externen Nachweis brauchen, SPARK-Zeit nicht als Sara-Eingabe ausgeben. Historische Abgabezeit nicht rückwirkend erfinden | Optional Detail „Besuch: …; Bericht eingereicht: …“. Fehlende alte Abgabezeit als unbekannt. Qualitätsmaske bleibt bis klarer Definition manuell |
| Persönliche Abwesenheiten: `backend/src/lib/schema.ts:96`, `:3168` | GM-Zeiterfassung kennt Sonderaufgabe, Arzt, Werkstatt, Homeoffice, Schulung, Lager, Heimfahrt, Hotel; keine gleichwertige vollständige Urlaub/Krank/Messe-Grundlage nachgewiesen | Kein automatisches Urlaub-/Krankheitsmodell aus diesen Tätigkeiten ableiten. Zunächst Basis-/Abwesenheits-/Sollfelder im Prämienbereich; Import/Anbindung nur mit bestätigter Quelle | „Sollwert manuell eingerichtet“ mit Basis, Tagezahl, Begründung; kein großflächiger neuer Abwesenheitsworkflow |

Die Untersuchungen betreffen GM-Erhebungen und Prämien. SM-Fragebögen/-Besuche werden dadurch **nicht** automatisch prämienfähig oder mit neuen Pflichtfeldern versehen. Flex-Zugriff aller GMs auf alle Märkte bleibt unverändert: Bonus-Berechtigung einer Messgröße ist keine neue Zugriffsbegrenzung.

### Weitere Entscheidungen aus der Codeprüfung

| Kennung | Geplante Festlegung | Grund |
| --- | --- | --- |
| D7 | Stabile fachliche Säulen-/Messgrößenart, Namen nur Anzeige | Heutige Flex-/Qualitäts-/Übernahmeerkennung hängt an Namen; „Racks“ umbenennen darf Logik nicht wechseln |
| D8 | Vorbefüllen, Beobachten und Vergüten sind getrennte Schritte | Gleiche Antworten können korrekt übernommen sein und trotzdem keine neue vergütbare Platzierung darstellen |
| D9 | Manuell pro Messgröße, Rohwert und Prozent getrennt | Einheiten unterscheiden sich; Override auf alle Flex-/Qualitätskomponenten ist sachlich falsch |
| D10 | Geldregeln bewusst veröffentlichen, Ist-Korrekturen protokollieren | Heute mehrere Autosave-Pfade; keine unbemerkte monetäre Regeländerung nach jedem Tastendruck |
| D11 | Keine Automatik ohne vollständige Daten-/Nennerdefinition | Fehlende Produktberechtigung, Sara-Frist oder Zeitabweichungsbasis darf nicht als 0 % erscheinen |
| D12 | Abschluss ist ein versionierter Ergebnisstand, nicht nur ein Statuslabel | Archivstatus blockiert heute keine Regel-/Bewertungs-Writes; aktuelle Summen hängen sonst weiter an veränderbaren Stammdaten |

D7–D12 dokumentieren den damaligen Vorschlagsstand. Aktuell umgesetzte Teile und verbleibende fachliche Grenzen sind oben separat festgehalten.

## Datenvertrag und Berechnungsweg

Die bestehenden Wellen-/Säulentabellen und den gemeinsamen Auszahlungsrechner weiterverwenden; gezielt erweitern. Neue benannte Felder/API-Pfade sind Planungsnamen, noch keine vorhandenen Schnittstellen.

```text
Wellen-Regelrevision + Quellzuordnung + GM-Sollwert
                        ↓
gültige abgeschlossene Beobachtungen / externe oder manuelle Werte
                        ↓
Markt-/Produktberechtigung → Zählweise → Rohwert + Bezugsmenge
                        ↓
automatischer Wert → optionaler Messgrößen-Override → wirksamer Wert
                        ↓
Prozent-/Punktumrechnung → Bedingungen → Teilstufe → Säulen-Euro
                        ↓
gemeinsames Ergebnis für Admin, GM und Rangliste
                        ↓
bestätigter Abschluss-Snapshot, unveränderlich
```

### Notwendige Angaben

- **Welle:** Zeitraum/Zeitzone, Status, Regelrevision, Abschlusszeit/-bearbeiter, Berechnungsstatus und gültiger Ergebnisstand. Aktive überlappende Zeiträume erkennen: der heutige Finalizer nimmt die zuletzt aktualisierte passende Welle, nicht zwingend jede passende (`bonus-finalizer.ts:597`). Für ein eindeutiges Bonusprogramm entweder Überlappung ausschließen oder explizite Programmbindung, nicht Zufallsauswahl.
- **Säule/Messgröße:** stabile ID/Art, Label, Einheit, Rolle Rohwert oder berechnete Größe, Quelle, unterstützte Aggregation, Zeitraum, Berechtigungs-/Nennerregel, Ziel und optionale Schwellenumrechnung. Minuten und signierte Nettoanzahl nicht in generische nichtnegative Bonuspunkte pressen.
- **GM-Ziel:** Welle/Messgröße/GM, Basis, wirksames Soll, ggf. Abwesenheitstage/Arbeitstage, Herkunft, Änderungskontext. Gibt es kein gültiges positives Soll, ist „Ist / Soll“ nicht auswertbar.
- **GM-Ist/Override:** pro Welle/GM/Messgröße Wert **mit Einheit**, Modus, Originalwert, wirksamer Wert, Bearbeiter/Zeit/Begründung. Alt-Overrides weiterhin explizit Punkte. Keine automatische Konvertierung „25 alte Qualitätspunkte = 25 %“ ohne belegte Skala.
- **Beobachtung:** Session-/Frage-/Antwort-ID, stabile fachliche Messgröße, Markt, GM, Beobachtungszeit, tatsächlicher Einreichzeitpunkt soweit vorhanden, Übernahmeherkunft, Gültigkeit, Regel-/Quellrevision. Ausgefilterte und deduplizierte Daten mit Grund rekonstruierbar.
- **Ergebnis:** automatische/manuelle/wirksame Werte samt Einheit, numerator/denominator, Soll, Datenvollständigkeit, erreichte/fehlende Bedingungen, nächste Stufe, Säulenprämie, Gesamt/Maximum, vorläufig/final, berechnetAm/Regelrevision. Punkte verschiedener Einheiten nicht zu einer irreführenden globalen Gesamterreichung addieren.
- **API:** Admin-Auswertung aller echten GMs paginiert und mit Gesamtanzahl; Einzel-GM-Detail, lesende Regel-/Ist-Simulation, bestätigtes Speichern/Veröffentlichen, Jobstatus, Abschluss und historische Ergebnisse. GM-Endpunkt liefert nur eigene Daten. Keine GET-Schreibnebenwirkungen.

### Berechnungsregeln und Zustände

1. Ausschließlich gültige, nicht gelöschte, abgeschlossene relevante Sessions/Antworten aus dem definierten Beobachtungszeitraum. Authentifizierte echte GM-IDs, keine Zuordnung über Namen. Gleiche Antworttexte verschiedener Fragen sind keine gemeinsame Identität.
2. Marktberechtigung und Produkt-/Kettenmatrix zuerst. Nenner umfasst die konfigurierte berechtigte Population, nicht nur vorhandene Ja-Antworten. Nicht-Anwendbarkeit, fehlende Erhebung und echtes Nein getrennt führen. Wenn unbesuchte Märkte zur Sollmenge gehören, diese ausdrücklich ausweisen; keine still verbesserte Quote durch Weglassen.
3. Bestands-/Verfügbarkeitsfragen: deterministisch neuester gültiger Zustand pro festgelegtem Markt-/Frage-/GM-Schlüssel, mit Tie-Breaker. Display-/Rack-Neuplatzierungen: Identität der tatsächlich neuen Platzierung nötig, keine Wiederholung übernommenen Bestands. Bei Übernahme durch einen anderen GM keine Doppelvergütung derselben Platzierung; Verantwortlichkeit/Objektidentität explizit konfigurieren. Ohne ausreichende Daten automatisches Ergebnis offen, manuelle Bewertung möglich.
4. Rohwerte passend aggregieren und in Prozent/Punkte umrechnen. Nicht alle Produkte gleich anwendbar, nicht alle Prozente dieselbe Größe. Q2-Distribution kann ungewichteten Mittelwert ausgewählter Produktquoten nutzen; eine andere Methode ist eine neue sichtbare Quartalsregel.
5. Manuelle Korrektur nur auf ihre Messgröße anwenden; abgeleitete Gesamtgrößen danach neu bilden. Übererfüllung als echten Wert erhalten, Balken optisch bei 100 % begrenzen, Prämie durch konfiguriertes Maximum begrenzen. Negative Nettozahlen erlauben, wenn fachlich vorgesehen; Prozent-Bewertung bleibt nichtnegativ. Keine automatische lineare Extrazahlung über 100 %.
6. Pro nicht additivem Teilziel höchste passende Stufe; mehrere Bedingungen UND. Additive Qualität addiert je Teilziel den passenden Betrag, nicht mehrere Stufen derselben Teilgröße. Centgenaue, zentral definierte Rundung; Grenzen auf nicht vorher gerundeten Prozentwerten prüfen.
7. Unter erster Grenze 0 € **bei vorhandenem gültigem Wert**; fehlende Bewertung/Quelle/Bezugsmenge offen/nicht auswertbar. Bei Qualität unbekannte Daten nicht als automatisch volle oder null Prämie bewerten.
8. Aktive Neuberechnung veröffentlicht einen konsistenten Ergebnisstand erst nach Erfolg. UI zeigt währenddessen alten gültigen Stand mit „wird aktualisiert“; Fehler sind sichtbar und wiederholbar. Recalc umfasst alle GMs, auch ausschließlich manuell bewertete/noch ohne Besuche, und entfernt veraltete Beiträge korrekt.
9. Entwurf nur lesend simulieren. Abschluss unter Versions-/Wellen-Lock nach aktueller erfolgreicher Berechnung; gleichzeitig eintreffende Änderungen dürfen nicht an der Abschlussprüfung vorbeilaufen. Abgeschlossene Wellen serverseitig sperren, nicht bloß Eingabefelder deaktivieren. Spätere Besuchskorrektur verändert die Besuchshistorie, aber nicht rückwirkend den eingefrorenen Prämienstand.

### Umsetzungsreihenfolge, erst nach Freigabe

| Schritt | Umfang | Abnahme |
| --- | --- | --- |
| 1 | Ergebnis-/Messgrößenvertrag, stabile Arten/Einheiten, Regeln und reine Simulation | Belegte Q1-/Q2-Fälle exakt abbildbar, keine Mock-Auszahlungen |
| 2 | Gemeinsamer Säuleneditor, Quellen-/Nennerwahl, persönliche Ziele und Prozent-/Teilwerteditor | Jede Säule einrichtbar, 0/offen/automatisch unterscheidbar |
| 3 | Frageeditor-Zuordnung und Besuchs-Herkunft/Zählung/Korrekturimpulse | Wiederholte Besuche, Duplizierung und geänderte Zeiten konsistent, keine Zusatzpflicht im Visitflow |
| 4 | Echte Admin-/GM-Ergebnisse, alle GMs im Leaderboard, Historie/Abschluss | Identische Euro-Beträge in allen Ansichten, gefrorene Altquartale |
| 5 | Isolierte lokale Migration-/API-/Browser-Schreibtests mit synthetischen Daten | Gesamter Ablauf inklusive Recalc, Reload, Konflikt und Fehlerpfad bestanden |

Diese Tabelle dokumentiert die frühere Umsetzungsreihenfolge. Der aktuelle überprüfte Stand steht oben; nicht jede angedachte automatische externe Datenquelle ist dadurch vorhanden.

## Prüffälle für die Umsetzung

- Q2 zeigt seine bisherigen Komponenten; Q3 zeigt die bestätigten neuen Komponenten; Q4 kann unabhängig anders konfiguriert werden.
- 79,99 % → 0 €, 80,00 % → exakt bestätigter Stufenbetrag; weitere Grenzen genauso prüfen. Das Beispiel 86,50 € wird erst nach Bestätigung als echte Konfiguration übernommen.
- Kein ungewolltes lineares Hochrechnen zwischen Stufen; keine doppelte Auszahlung sich überschneidender nicht-additiver Stufen.
- 0 %, leeres Feld, automatische Berechnung und entfernte manuelle Bewertung bleiben unterscheidbar; Reload erhält Werte und Modus.
- Getrennte Flex-Komponenten erfüllen UND-Regeln nur gemeinsam. Kein Gesamt-Override setzt fälschlich alle Komponenten auf denselben Wert.
- Punktbasierte Altwerte, prozentbasierte neue Werte, Dezimalwerte und ggf. Übererfüllung werden korrekt behandelt.
- Leaderboard, Admin-Details und GM-Ansicht zeigen für dieselbe Welle dieselben Personen und identische Euro-Ergebnisse; keine Mocknamen oder Mockhistorien.
- Unbewertet, nicht teilnehmend und tatsächlich 0 € sind unterscheidbare Zustände.
- Archivierte Ergebnisse bleiben gemäß bestätigter Historienregel stabil. Inaktive GMs verlieren keine historischen Ergebnisse.
- Nicht berechtigte Nutzer können Regeln und Bewertungen weder lesen noch ändern. Gleichzeitige Änderungen verlieren keine Werte.
- Browser → API → isolierte Testdatenbank → Reload → Anzeige prüfen, inklusive Speichern, Rückkehr zur Automatik und Fehlerzuständen.
- Q1/Q2 nach Quellen reproduzieren: Schütten 69,99/70/80/95 %, Distribution 79,99/80/90 %, Flex beide Mindestbedingungen. 10 Kühlerpunkte + 0 RED-Punkte zahlen im Q2-Modell **nicht** 82,50 €.
- Qualität pro Teilziel nur eine passende Stufe: nicht zugleich 50-%- und 100-%-Zeitmanagementbetrag addieren. Altdaten mit 25er-Grenze nicht still auf neues Prozentmodell umdeuten.
- Genau 8 Besuche/Jahr, verschiedene Ketten/Privatmarkt, Produkte ohne berechtigte Märkte, unbesuchte berechtigte Märkte und ungleich große Produktgruppen.
- Derselbe Markt/Display im zweiten RED-Monat des Quartals, echte neue Platzierung, übernommene Antwort, Korrektur einer älteren Session und Wechsel des GMs; keine Doppelvergütung und kein Überschreiben eines neueren Zustands.
- Frage-/Modulduplikat mit stabilen IDs, eigenständige neue Frage, umbenannte Antwortoption und nachträglich verändertes Scoring; Quellbindung und historische Antwort-Snapshots bleiben nachvollziehbar.
- Quartalswechsel in Wiener Zeitzone, verspätete tatsächliche Berichtabgabe und nachträgliche Endzeitkorrektur; Reporting-Frist nicht anhand bearbeitbarer Besuchs-Endzeit bewerten.
- Negative Kühler-Nettozahlen, persönliche Sollwerte mit Abwesenheiten, fehlendes Soll, Übererfüllung, prozentbasierte manuelle Flexwerte und getrennte Rohwert-Skalen.
- Neue GMs ohne Sessions erscheinen offen statt nicht vorhanden; inaktive GMs mit alten Ergebnissen bleiben in Historie. Gesamtansicht zählt keine Welle zweimal.
- Gleichzeitig Speichern/Neuberechnen/Abschließen, nicht erfolgreiche Berechnung und Neustart eines Jobs; abgeschlossene Snapshots unverändert, Besuch bei Bonusfehler trotzdem zuverlässig gespeichert.

## Historischer lokaler Prüfstand der Planungsphase

- Frontend auf `http://localhost:3000`, Prämienseite auf `/admin/praemien`.
- Backend auf `http://localhost:4000`; `/health` antwortet `status: ok`.
- Prämienseite und Start-/Loginseite laden; kein Framework-Fehleroverlay und keine erfassten Browser-Konsolenfehler.
- Leaderboard nur geöffnet/gelesen: 10 Demo-GMs und fiktive kumulierte 46.970 € bestätigt. Keine Bewertung gespeichert.
- Bestehende reine Tests `src/praemien-rewards.test.ts` und `src/praemien-pillar-overrides.test.ts`: **12/12 erfolgreich**. Sie prüfen die vorhandene Logik, nicht die noch nicht gebauten Änderungen.
- Backend wurde über `createApp()` gestartet, ohne Finalizer-, Kalender- oder Speicherbereinigungs-Scheduler aus `src/index.ts` zu starten. Keine Migration ausgeführt.
- **Wichtig:** Die lokale Backend-Konfiguration verweist auf eine externe Datenbank, nicht auf eine isolierte lokale Kopie. Die bisherige Prüfung war lesend; Speichern in der lokalen App ist dadurch nicht automatisch ein sicherer Test ohne Produktionswirkung. Für Schreibtests erst eine isolierte Testdatenbank verwenden.

### Server erneut starten

Die aktuell laufenden Prozesse bleiben für die lokale Ansicht geöffnet. Falls sie beendet wurden:

Frontend, im Workspace:

```powershell
$env:NEXT_PUBLIC_BACKEND_URL = 'http://localhost:4000'
node node_modules/next/dist/bin/next dev --webpack --port 3000
```

Backend, im Unterordner `backend`, ohne Hintergrundjobs:

```powershell
$env:NODE_ENV = 'development'
$env:IPP_FINALIZER_ENABLED = 'false'
$env:CORS_ORIGIN = 'http://localhost:3000,http://127.0.0.1:3000'
node --import tsx --input-type=module --eval 'import { createApp } from "./src/app.ts"; createApp().listen(4000, () => console.log("Local backend ready on 4000; background jobs not started"));'
```

Diese Startbefehle isolieren die Datenbank **nicht**. Keine produktiven Schreibtests damit durchführen.
