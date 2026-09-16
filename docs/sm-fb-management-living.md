# SM-Fragebogen-Management – Living MD

Stand: 16.09.2026. **Lokal implementiert und verifiziert; Git-Push am 16.09. beauftragt.** Ein produktives Deployment ist separat zu prüfen. Grundlage: [SM-FatMD](sm-in-arbeit-2026-09-15-fat-plan.md), Karte „Zeiten, Änderungen und SM Management“.

## Grenzen

Nur SM-Funktionen. Keine GM-Datenänderung, keine Testbesuche in Produktion. Bestehende Besuche, Originalantworten, Zeitstempel und Storage-Objekte behalten ihre Historie. Die Vorlage eines abgeschlossenen Besuchs wird nicht nachträglich verändert.

## Aktueller Backend-Vertrag

Unter `/admin/sm-activity/completed`, autorisiert für `admin` und `sm_admin`, `Cache-Control: private, no-store`:

- `GET /`: `from`, `to` (maximal 93 Tage), optionale SM-/Markt-/Fragebogen-ID und Suche; Cursor aus Besuchsdatum + ID. Standard 40, maximal 100 Zeilen. Filteroptionen aus demselben Zeitraum, bei mehr als 2000 Kombinationen explizites Truncation-Flag; serverseitige Suche bleibt verfügbar.
- `GET /:submissionId`: Snapshot-Abschnitte, Fragen, Antworten, Kommentarwerte, Zeitstempel, signierte Fotos und Konfliktversion. Das Datum der Liste ist der tatsächliche Wiener Besuchsstart, ersatzweise Planungs-/Abschlussdatum.
- `GET /:submissionId/history?questionId=…`: Antwortversionen mit Urheber, Zeitpunkt, Grund, Fotos; 20 pro Seite, Versionscursor.
- `POST /:submissionId/corrections`: erwartete Konfliktversion, UUID-Mutationstoken, separater Änderungsgrund, atomare Liste geänderter Antworten und gegebenenfalls signierte Upload-Belege.
- `POST /:submissionId/photos/upload-url`: nur für eine Foto-Frage dieses abgeschlossenen SM-Besuchs. Privater SM-Bucket, neues zufälliges Objekt, kein Upsert. HMAC-Beleg bindet Datei, Größe, MIME-Typ, Frage, Besuch, Admin und Ablaufzeit.

## Persistenz

`backend/src/sm-management.ts` ist der transaktionale Dienst. Er benötigt keine neue Tabelle:

1. Bestehende Submission-Zeile sperren. Dieselbe Zeile sperren auch die vorhandenen Antwort-/Löschfreigaben; nach dieser Sperre werden keine fremden Advisory-Locks angefordert.
2. Idempotenz in den bestehenden, nach Submission indizierten Answer-Events prüfen. Derselbe Token und dieselbe Nutzlast liefern das bestätigte Ergebnis; andere Nutzlast mit gleichem Token wird abgelehnt.
3. Ganzen aktuellen Besuchszustand gegen die geladene Version vergleichen. Veraltete Bearbeitung kann nicht überschreiben.
4. Kandidaten mit den gespeicherten Fragen-/Options-/Regel-Snapshots normalisieren. Alle neu sichtbaren Pflichtantworten und ausgelösten Kommentare im gemeinsamen Entwurf verlangen.
5. Neue Antwortversionen mit Vorgängerverweisen erstellen. Nach zuvor invalidierten Antworten die höchste historische Versionsnummer verwenden.
6. Options-/Matrix-/Fotoreferenzen für die neue Antwort schreiben. Neue Fotoreferenz-IDs auch in `value_json` speichern. Fremde bzw. nicht aktuelle Foto-IDs ablehnen. Alte Dateien nicht löschen.
7. Anwendbarkeit, Zähler/Punkte und Audit gemeinsam schreiben; Rollback bei jedem Fehler. Nicht mehr sichtbare Antworten aus der aktuellen Auswertungsmenge nehmen, Historie behalten.
8. Keine neue Visit-/Zeitbuchung. ursprünglicher SM, Besuchszeit, Abschlussdatum und Fahrtminuten bleiben erhalten. OOS liest weiterhin nur gültige aktuelle Antworten abgeschlossener Besuche.

Ein Replay wird vor der Prüfung neuer Uploads erkannt, damit ein bereits bestätigtes Speichern nicht durch inzwischen abgelaufene Upload-Belege scheitert. Foto-Metadaten werden vor dem Insert gegen den Storage-Dienst geprüft. Netzwerkausfall darf keine gültige alte Antwort zerstören.

## Verifikation 16.09.2026

- SM-Admin-Seite mit vorhandenem Zeitraum-/Dropdownmuster, eigener Navigation und Seitentitel, gefilterter/paginierter Liste, Detailpanel, allen gespeicherten Antworttypen, Bearbeitungsentwurf und Verlauf ist lokal vorhanden. Matrix: genau eine Auswahl je Zeile; historische Leerzeilen und ursprüngliche Optionslabels bleiben stabil. Zahlen übernehmen String-Grenzen und Ganzzahl-/Dezimalmodus.
- 19 PGlite-Subtests plus Suite (20/20) mit den echten SM-Migrationen und tatsächlichen HTTP-Routen bestanden. Geprüft: Rollen, Filter/Pagination, inaktive historische SMs, Snapshots, Zeiten, alle Nicht-Foto-Antworttypen, Pflichtkommentar, bedingte Folgefrage, Konflikte und Idempotenz, konkurrierende Saves, bestehende Mitarbeiterfreigaben/Löschung, Audit-Rollback, private Fotos und HMAC-Upload-Belege, Korrekturgrund im Verlauf, OOS-SQL vor/nach Korrektur und unveränderte Reporting-Zuordnung. Das Fixture enthält keine GM-Geschäftstabellen.
- 14 fokussierte Frontend-Tests (`test:sm-management`) bestanden. Darin enthalten: Editor/Regeln, deaktivierte/aktivierte Fahrtzeit, Cache-Absagen, Wiederherstellung, Konto-/Zeitraum-Isolation inklusive verzögerter A→B→A-Antworten und Trennung der Pending-Answer-Warteschlange.
- Lokaler Browser mit echter SM-Admin-Komponente, Express-Routen, PGlite und privatem Storage-Ersatz: Antwortkorrektur einschließlich ausgelöstem Pflichtkommentar, zweite Textantwort, Verlauf, OOS-Neuberechnung, unveränderte Besuchszeiten, Filter-Leerzustände und Warnung bei ungespeichertem Entwurf geprüft. Desktop sowie 390×844 px geprüft. Zusätzlich Foto durch die UI hochgeladen, gespeichert, signiert wieder angezeigt und mit getrenntem Änderungsgrund im Verlauf gefunden; die signierte lokale Bild-URL lieferte HTTP 200 mit den ursprünglichen Testbytes. Keine Produktionsdaten verwendet.
- Frontend-Produktionsbuild und Backend-TypeScript-Build bestanden. Der breite Backend-Testlauf hatte 151/155 grün; vier fehlschlagende GM/RED-Datumstests liegen in nicht geänderten Testmodulen. Diese SM-Umsetzung ändert die GM-Logik nicht; ein vollständiger grüner Backend-Gesamtlauf wird hier nicht behauptet.
- Admin-Korrekturen sind bewusst online-only. Bei einem unklaren Netzwerkausgang wird derselbe Mutationstoken für den idempotenten Retry verwendet. Storage-Aufrufe haben ein 8-Sekunden-Limit; fehlende signierte Ansichts-URL lässt Details weiterhin lesbar.

## Noch offen / Release-Grenze

- Keine produktive Anmeldung oder produktiver Schreibtest durchgeführt; damit ist die Wirkung im echten Deployment erst nach einem getrennt beauftragten Release beobachtbar. Backend vor Frontend ausrollen und Rollen-/Schema-/Storage-Konfiguration dort prüfen.
- Der genehmigte SIMPL-Rückfragekommentar zur unklaren Wochenansicht ist noch nicht veröffentlicht: Zugriff auf den signierten Chrome-Tab war durch eine fremde Browser-Session/Extension blockiert. Kein privilegierter Datenbank-Write und kein Auth-Bypass.
- Der Git-Push wurde nach der lokalen Abnahme separat beauftragt. Ein grüner Build ist kein Nachweis für produktive Datenwirkung; SIMPL-Status nur nach bestätigter Kartenänderung angeben.
