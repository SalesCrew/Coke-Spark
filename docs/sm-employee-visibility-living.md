# SM-Mitarbeiter: Fahrtzeit und abgesagte Einsätze

Stand 16.09.2026. Lokal umgesetzte und geprüfte Karten „Fahrzeit“ und „Abgesagte Einsätze“ aus dem [FatMD](sm-in-arbeit-2026-09-15-fat-plan.md). Git-Push beauftragt; produktives Deployment separat prüfen.

## Fachliche Regeln

- Bei `profile.travelTimeEnabled=false` ist die ganze Fahrtzeitsektion beim Start/Abschluss verborgen, nicht nur deaktiviert. Historische Minuten bleiben erhalten. Serverberechtigung und HH:MM-Eingabe ändern sich nicht.
- `cancelled` ist nur für den Mitarbeiter unsichtbar. Admin-Historie, Wiederherstellen und gespeicherte Daten bleiben erhalten. `missed` ist keine Absage.
- Der Mitarbeiter-Loader filtert auf dem Server. Kalender, Tagesliste sowie gelesene/geschriebene Planungscaches verwenden zusätzlich dieselbe SM-spezifische Sichtbarkeitsregel.
- Ein bestätigter abgesagter Direktlink beendet die nutzbare Startansicht. Die separate Pending-Answer-Warteschlange wird nicht gelöscht.
- Ein frischer vollständiger Zeitraum ersetzt seinen alten Cache. Nicht mehr enthaltene Vorlade-Einträge werden entfernt, nicht historische Daten oder Pending Answers.
- Fokus, Online-Wechsel und sichtbare Seite führen zum Nachladen; kein periodischer Polling-Timer. Ergebnisse alter Konten/Zeiträume dürfen die neue Ansicht nicht übernehmen.
- Offline kann ein Handy neue Absagen noch nicht kennen. Bereits bekannte Absagen sind verborgen; der Server blockiert einen abgesagten Start. Nach Wiederherstellung kann derselbe Einsatz nach Refresh wieder erscheinen.

## Umsetzung / Nachweis

- Review-Sektion, employee-only SQL-Filter, Cache-Normalisierung, Direktlink-Fehler und kontogebundene Schedule-Anzeige implementiert. Bei einer inzwischen deaktivierten Fahrtzeit lädt ein abgelehnter Abschluss das aktuelle Profil neu, ohne den Antwortentwurf zu löschen. Bereits gespeicherte Fahrtzeiten bleiben historisch.
- `test:sm-management`: 14/14 Frontend-Tests bestanden, darunter deaktivierte/aktivierte Review-Darstellung und vier Cache-/Owner-Fälle. Der Server-Test mit echten SM-Migrationen prüft die Mitarbeiterplanung gegen Admin-Planung, Absage, Wiederherstellung, Verschieben, Direktlink/Start und fremden SM; außerdem historische Fahrtzeit nach Deaktivierung. Breite relevante SM-Regressionsgruppen bestanden.
- Frontend-Produktionsbuild und Backend-TypeScript-Build bestanden. Keine Produktionsdaten für Tests erstellt oder geändert.

## Offene Abnahme

- [x] Automatisierte Render-, Eingabe- und Cachetests bestanden.
- [x] API-Absage/Restore/Direktlink und Cache-/Konto-/Zeitraumwechsel mit isolierten Tests geprüft.
- [x] Relevante SM-Regressionen und beide Builds bestanden; der breite Backend-Gesamtlauf hat vier nicht geänderte GM/RED-Datumsfehler.
- [x] SM-Fragebogen-Management lokal umgesetzt und in [seinem Living MD](sm-fb-management-living.md) isoliert geprüft.
- [ ] Echte Handy-Anmeldung und produktive Wirkung nach gesondert beauftragtem Release prüfen. Ein Offline-Gerät kann eine neue serverseitige Absage weiterhin erst nach Sync kennen.
