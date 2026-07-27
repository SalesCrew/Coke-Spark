# Durcharbeit – Implementierungsstand

Stand: 27.07.2026

## Ziel

Durcharbeit ist als eigener Fragebogen- und Kampagnentyp umgesetzt:

- eigener Admin-Bereich
- isolierter Fragen-, Modul- und Spezialfragenpool
- vollständige Fragewerkzeuge
- eigene Kampagnen und Markt-/GM-Zuordnungen
- eigener GM-Fortschritt als `Durch A.`
- Marktauswahl, Besuchsstart, Antworten, Fotos, Kommentare und Abschluss
- speichersicherer Fotoarchiv-Gesamtexport

## Arbeitsregeln

- Keine Smoke-Tests gegen Produktionsdaten.
- Datenbankänderungen ausschließlich über die nachvollziehbare Migration `0082_durcharbeit_scope.sql`.
- Bestehende, nicht zugehörige Änderungen im Worktree bleiben unberührt.

## Umsetzung

### Datenmodell und Backend

- [x] DB-Enums um `durcharbeit` erweitert
- [x] Eigene Modul-, Modulfragen-, Fragebogen-, Fragebogenmodul- und Spezialfragen-Tabellen
- [x] `question_bank_shared.pool_scope` trennt Durcharbeit-Fragen vom bestehenden Pool
- [x] Indizes, Fremdschlüssel, RLS, Grants und Service-Role-Policies in Migration 0082
- [x] Admin-CRUD für Fragen, Module, Spezialfragen und Fragebögen
- [x] Serverseitige Pool-Isolation bei Lesen, Schreiben, Referenzen und Duplikation
- [x] Kampagnen-CRUD und Fragebogenvalidierung
- [x] GM-Fortschritt, Marktliste und Abschlusszählung
- [x] Besuchsstart, Antworten, Fotos, Kommentare, Spezialfragen-Sync und Abschluss
- [x] Kunde-/Admin-Berechtigungsauflösung und Logging

### Admin

- [x] Eigene Route `/admin/durcharbeit`
- [x] Navigation, Header, eigener Context und eigener State
- [x] Isolierte Fragen-, Modul- und Fragebogenansicht
- [x] Vollständiger Modul- und Fragebogeneditor
- [x] Spezialfragenpool mit Durcharbeit-Scope
- [x] Erstellen, Bearbeiten, Duplizieren und Deaktivieren
- [x] Durcharbeit-Kampagne erstellen und verwalten
- [x] Kampagnenvorschau, Fragebogenzuordnung und Marktzuordnung

### GM

- [x] `Durch A.` als dritter Punkt neben Kühler und MHD
- [x] Fortschrittsbalken und offen/gesamt
- [x] Alle Märkte anzeigen und durchsuchen
- [x] Markt auswählen und Durcharbeit-Kampagne starten
- [x] Antworten, Fotos und Kommentare speichern
- [x] Pflichtfelder, Regeln, Handelskettenfilter und Spezialfragen anwenden
- [x] Abschluss und sofortige Fortschrittsaktualisierung

### Fotoexport

- [x] Ursache bestätigt: JSZip hielt alle Original-Blobs plus Kompressions- und Ergebnisbuffer gleichzeitig im Browser
- [x] Filter werden unverändert serverseitig angewendet
- [x] ZIP wird serverseitig mit Zip64 erzeugt
- [x] Originalbilder werden nacheinander gestreamt; nie alle gleichzeitig im Speicher gehalten
- [x] Unterstützte Browser schreiben den Response-Stream direkt in die ausgewählte Datei
- [x] Fallback bleibt für Browser ohne File-System-Streaming vorhanden
- [x] Eindeutige Dateinamen, README und Fehlerliste bleiben erhalten
- [x] Kunden-MHD-Sperre wird auch im Export serverseitig erzwungen

## Verifikation

- [x] Frontend-Produktionsbuild erfolgreich
- [x] Backend-TypeScript-Build erfolgreich
- [x] Migration und Schema statisch gegeneinander geprüft
- [x] Vollständige Anforderungsprüfung über Admin-, Kampagnen-, GM- und Exportpfade
- [x] Keine Produktions-/Smoke-Tests ausgeführt
- [x] Backend-Unit-Suite ausgeführt: 37/41 erfolgreich

Vier bestehende, nicht zugehörige Tests schlagen mit der lokalen Zeit-/RED-Month-Konfiguration fehl:

- Standardpause in `admin-zeiterfassung.shared.test.ts`
- drei RED-Month-Anker-/Grenztests in `red-monat.shared.test.ts`

Die Durcharbeit- und Fotoexport-Änderungen kompilieren vollständig; diese vier fremden Erwartungen wurden bewusst nicht verändert.

## Deployment

- [x] Backend-Commit auf `SalesCrew/Spark-Backend` veröffentlicht
- [x] Frontend-Commit auf `SalesCrew/Coke-Spark` veröffentlicht
- [x] Migration `durcharbeit_scope` auf dem Coke-Spark-Supabase-Projekt angewendet und registriert
- Es wurden keine Produktions-Nutzdaten verändert und keine Smoke-Tests ausgeführt.
