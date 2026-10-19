# Wochenschwerpunkte — Produkt- und UI-Plan

Stand: 19.10.2026. Ausgangsbasis: aktuell veröffentlichte Frontend-/Backend-Stände c944b2e / 892065f. Unabhängige Feature-Branch; bestehende offene Änderungen im ursprünglichen Arbeitsverzeichnis bleiben erhalten.

## Vollständiges Ziel

Ein GM-Admin stellt PDFs mit kurzen Begleittexten und Sichtbarkeitszeitraum bereit. GMs öffnen sie aus dem vorhandenen Home-Menü in einer ruhigen, bildschirmfüllenden Ansicht. Seiten lassen sich überwiegend durch Wischen und Scrollen lesen. Der Lesestand wird je GM und veröffentlichter Version gespeichert. SM-Mitarbeiter erhalten weder Menüeintrag noch Datenzugriff.

## Ausgangslage und bewusst beibehaltene Muster

- Admin: vorhandene weiße Arbeitsflächen, zurückhaltende Rahmen, Coke-Rot für Hauptaktionen, bestehende eigene Datumsfelder.
- GM: iPad, bestehender Home-/Kurti-Menümechanismus. Der neue Eintrag ergänzt diesen Ablauf und ersetzt keine Navigation.
- SM-Nachrichten liefern das Muster für den roten Ungelesen-Zähler. Keine neue Browserbenachrichtigungsfreigabe, kein zusätzlicher Benachrichtigungskanal.
- PDF-Anzeige ist ein eigener, einfacher Leser; kein unveränderter Browser-PDF-Viewer mit fremder Werkzeugleiste.
- Bestehende GM-Dashboardkarten und deren individuelle Filter bleiben unverändert.

## Ablauf und Texte — erster Entwurf

Admin: Liste → „PDF hinzufügen“ → Datei ablegen → Seitenvorschau → Begleittexte/Zeitraum → „Veröffentlichen“.
GM: Home-Menü → „Wochenschwerpunkte“ + Anzahl ungelesener Veröffentlichungen → wischen/scrollen → zurück zum vorherigen Bildschirm.

## Hinterfragung und überarbeitete Entscheidungen

1. **Editor statt großer Upload-Maske:** Der Upload ist nur der Einstieg. Danach stehen die eigentlichen PDF-Seiten im Mittelpunkt: schmale Seitenleiste, große Vorschau, kompakter Bereich für Seitentitel/Beschreibung und Sichtbarkeit. Keine großen Erklärungskarten und keine dekorativen Kennzahlen.
2. **Entwurf und Veröffentlichung trennen:** Tippen oder ein PDF-Wechsel ändert noch keinen GM-Inhalt. Erst eine ausdrückliche Veröffentlichung erzeugt eine unveränderliche neue Version. Das verhindert unfertige Inhalte und unnötig zurückgesetzte Neu-Zähler.
3. **Geplante Version verdrängt aktive nicht vorzeitig:** Eine zukünftige neue Version übernimmt erst an ihrem Startdatum. Ist eine aktive Version abgelaufen, erscheint keine frühere Version wieder. Archivieren blendet den gesamten Schwerpunkt aus, erhält Versionen und Lesestände.
4. **Gelesen nicht durch Vorladen:** Nur eine erfolgreich gerenderte und sichtbare Seite wird quittiert. Ein Schwerpunkt gilt nach dem Anzeigen aller enthaltenen Seiten als gelesen. Vorschauen, Fehler und Hintergrundladen entfernen keinen Zähler. Erneute Veröffentlichung hat einen eigenen Lesestand.
5. **Einfaches Lesen:** Horizontales Wischen blättert Seiten; vertikales Scrollen liest längere Seiten und Begleittexte. Kleine Seitenanzeige und dezente Seitenauswahl ergänzen die Gesten; Tastatur und zugängliche alternative Navigation bleiben verfügbar. Keine großen Vor-/Zurück-Schaltflächen.
6. **Kontinuität durch Animation:** Die Ansicht wächst visuell aus dem Menübereich in die volle iPad-Fläche; Schließen führt zurück. Fokus, Scrollposition und reduzierter Bewegungswunsch werden berücksichtigt.
7. **Keine Inhalte ist ein eigener Zustand:** Menü bleibt sichtbar, aber deaktiviert mit „Derzeit keine Wochenschwerpunkte“. Ladefehler bekommen eine Wiederholen-Aktion und werden nicht als leer ausgegeben.
8. **Geschützte PDFs:** „Öffentlich für GMs“ bedeutet für angemeldete GMs, keine anonymen öffentlichen Dateien. Privater Storage, rollen- und zeitgeprüfter Abruf. PDF-Seitenanzahl und Dateityp werden serverseitig geprüft.

## Finale kompakte Beschriftungen

- Navigation/Überschrift: **Wochenschwerpunkte**
- Hauptaktion Liste: **PDF hinzufügen**
- Upload: **PDF hier ablegen** / **Datei auswählen**
- Editor: **Seiten**, **Titel**, **Beschreibung**, **Sichtbar von**, **Bis**, **Entwurf speichern**, **Veröffentlichen**, **Vorschau**
- Status: **Entwurf**, **Geplant**, **Aktiv**, **Abgelaufen**, **Archiviert**
- Seitentext-Platzhalter: **Was ist auf dieser Seite wichtig?**
- Leser: **Seite 2 von 8**, **Neu**, **Zurück**
- Leer: **Derzeit keine Wochenschwerpunkte**
- Fehler: **PDF konnte nicht geladen werden.** / **Erneut versuchen**

## Technischer Vertrag

- Stabile Schwerpunkt-ID, getrennte bearbeitbare Entwürfe und unveränderliche Veröffentlichungen.
- Privater PDF-Dateibeleg mit Originalname, Größe, geprüftem Seitenumfang und Hash; keine überschriebenen Dateien.
- Sichtbarkeit nach Europe/Vienna; von/bis inklusive Kalendertage; leeres Ende bedeutet ohne Ablaufdatum.
- Lesetabelle: Veröffentlichung + GM eindeutig, gesehene Seiten idempotent zusammenführen, gelesen-Zeitpunkt erst vollständig. Keine Quittierung für fremde, zukünftige, abgelaufene oder archivierte Veröffentlichungen.
- Optimistische Versionsprüfung gegen gleichzeitige Editoränderungen; wiederholtes Veröffentlichen mit gleichem Schlüssel erzeugt keine Duplikate.
- Normaler Adminbereich und bestehende Kundenseitenrechte; GM-Leser nur für Rolle GM. Volladministratoren bleiben nach bestehender Rollenpolitik Volladministratoren, auch wenn ihr Standardarbeitsbereich SM heißt.
- Tests ausschließlich mit isolierter Datenbank, synthetischen PDFs und lokalem Storage-Ersatz. Keine Produktionsverbindung, keine Produktionsimporte und keine agentseitigen Prüfungen auf localhost:3000/4000.
- Neue Tabellen/Storage-Konfiguration als additive Migration vorbereiten. Keine Produktionsmigration oder Veröffentlichung ohne gesonderte spezifische Autorisierung.

## Nachweis für die Fertigstellung

Echte PDF hochladen → automatisch alle Seiten → Texte und Daten speichern → Entwurf bleibt für GMs unsichtbar → veröffentlichen → GM-Menü zeigt Neu-Zähler → Leser lädt dieselben Seiten/Texte → wischen/scrollen → persistierter vollständiger Lesestand entfernt Zähler auch nach Neuladen. Zusätzlich geplante/abgelaufene/archivierte Version, neue Revision, mehrere GMs, verbotene SM-/anonyme Zugriffe, falsche PDF, Konflikt, Upload-/Ladefehler und leere Liste prüfen. Admin auf Laptop, GM auf iPad Hoch-/Querformat prüfen und Screenshots sichern.

## Primäre technische Referenzen

- PDF.js: https://mozilla.github.io/pdf.js/examples/index.html und https://mozilla.github.io/pdf.js/api/draft/api.js.html
- PDF-LIB: https://pdf-lib.js.org/docs/api/classes/pdfdocument
- Supabase Private Storage: https://supabase.com/docs/guides/storage/buckets/creating-buckets

## Umsetzungsstand

Der Ablauf wurde umgesetzt und gegen die vollständigen Anforderungen geprüft. Die finalen Editorbezeichnungen sind **PDF hinzufügen**, **Speichern**, **Veröffentlichen / Neue Version**, **Einleitung**, **Sichtbarkeit**, **Überschrift** und **Beschreibung**. Der sichtbare Live-Status heißt **Veröffentlicht**. Details, Tests, Screenshots und klare Produktionsgrenzen stehen in `docs/gm-wochenschwerpunkte-verification.md`.
