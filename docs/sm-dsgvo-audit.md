# SM Datenschutz- und DSGVO-Audit

Stand: 28. August 2026
Scope: ausschließlich Shelf-Merchandising-Funktionen, SM-Daten und SM-Admin-Zugriffe

## Ergebnis und Grenze

Die technische SM-Implementierung setzt Datenminimierung, Zweckbindung, Zugriffstrennung, begrenzte lokale Speicherung, private Fotos, Korrekturprozesse, Auskunftsvorbereitung und Anonymisierung um. Das ist ein technischer Compliance-Nachweis, keine rechtsverbindliche DSGVO-Zertifizierung. Rechtsgrundlagen, Betriebsvereinbarung, Verzeichnis der Verarbeitungstätigkeiten, Auftragsverarbeiter, Drittlandtransfers, Löschläufe und die Entscheidung über eine Datenschutz-Folgenabschätzung müssen organisatorisch freigegeben und regelmäßig überprüft werden.

## Datenfluss und Schutzmaßnahmen

| Bereich | Personenbezug | Technische Maßnahme | Nachweis |
| --- | --- | --- | --- |
| Account | Name, E-Mail, Kontakt, Rolle | serverseitige Authentifizierung; SM und SM-Admin rollenbegrenzt | `admin-role`, `admin-user-scope` Tests |
| Planung | Marktzuordnung, Einsätze, Sollzeit | eigene `sm_*` Tabellen; SM liest nur eigene effektive Zuordnung | SM Planning API |
| Fragebogen | Antworten, Status, Zeitstempel | Eigentumsprüfung; Pflichtfragen beim Abschluss; optionale Fragen überspringbar | `sm-visit.shared` Tests |
| Offline | Planung, Fragebogen, ungesendete Antworten | nutzergebundener Browser-Cache; 30 Tage TTL; Bereinigung bei Abschluss, Verwerfen, Logout und Identitätswechsel | `privacyCache.test.ts` |
| Fotos | Inhalt, Markt-/Antwortbezug | privater Bucket; 30-Minuten-Signed-URL; signierte URLs werden nicht im dauerhaften Fragebogen-Cache gespeichert | SM Visits API und Cache-Test |
| Zeit | Besuchs-/Fahrtzeit, Korrekturen | versionierte Einreichung und nachvollziehbarer Freigabeprozess | SM Activity/Planning API |
| Nachrichten | Empfänger-Snapshot, Lesestatus | individuelle Empfängerzeilen, Eigentumsprüfung und Sichtbarkeitsregel | `sm-message.shared` Tests |
| Auswertung | OOS-/Marktkennzahlen | nur abgeschlossene Fragebögen; keine Entwürfe; aggregierte Darstellung | `sm-dashboard.shared` Tests |
| Betroffenenrechte | Auskunft, Berichtigung, Löschung | SM-Datenkategorien im DSAR-Paket; Antwort-, Fragebogen- und Zeitanfragen | `sm-privacy.shared` Tests |
| Offboarding | Account und historische Namens-Snapshots | Login-Löschung, Account-Anonymisierung, Entfernen aktiver Marktzuordnung, Anonymisierung der SM-Namens-/Empfänger-Snapshots in einer Transaktion | Admin Users API |

## Rollen- und Systemgrenze

- `sm` erreicht nur ausdrücklich für SM freigegebene Endpunkte.
- `sm_admin` erbt keine normale Admin-Route. SM-Admin-Zugriff muss am jeweiligen SM-Endpunkt ausdrücklich erlaubt sein.
- SM-Admins verwalten nur Benutzer der Rolle `sm`; die Benutzerliste wird serverseitig auf diese Rolle begrenzt.
- GM-Marktverzeichnis, GM-Kurti, RED-Month, Kampagnen, GM-Zeiterfassung und Datenschutzanfragen bleiben für SM und SM-Admin gesperrt.
- Die SM-Oberfläche zeigt SM-Admins nur die Shelf-Merchandising-Verwaltung.
- SM-Tabellen liegen getrennt von GM-Tabellen. Die Produktion verwendet erzwungenes RLS und entzieht `anon`/`authenticated` den direkten Tabellenzugriff; der Browser erhält keinen Service-Role-Schlüssel.

## Betroffenenrechte und Aufbewahrung

Das DSAR-Arbeitspaket zählt für SM-Betroffene Profil, Marktzuordnungen, Einsätze, Submissions, Antworten, Fotos, Zeitdaten, Nachrichten, Änderungs-/Löschanfragen sowie Audit-, Login- und Vereinbarungsnachweise. Es ist bewusst kein ungeprüfter Direkt-Export: Vor Herausgabe werden Identität, Rechte Dritter, Geheimhaltungsinteressen und gesetzliche Aufbewahrungspflichten geprüft.

Interne Regeln:

- Account: nach Offboarding und Übergabe grundsätzlich innerhalb von 30 Tagen anonymisieren.
- Einsätze, Fragebögen, Antworten und Fotos: grundsätzlich drei Jahre.
- Arbeitszeit-/Abrechnungsnachweise: soweit erforderlich sieben Jahre.
- Login-/Sicherheitslogs: grundsätzlich 24 Monate.
- Vereinbarungsnachweise: aktiver Einsatz plus drei Jahre.
- Offline-Cache: höchstens 30 Tage.

Diese Fristen sind als Policy umgesetzt beziehungsweise dokumentiert. Ein automatisierter, nachweisbarer Löschlauf bleibt eine organisatorisch zu betreibende Pflicht; ohne ihn darf nicht behauptet werden, dass jede Serverzeile automatisch exakt am Fristende gelöscht wird.

## Verifikation vor Produktion

- Backend TypeScript Build: bestanden.
- Frontend Next.js Production Build: bestanden, inklusive `/datenschutz/sm`.
- SM Offline-/Signed-URL-Tests: bestanden.
- SM Rollen-, Scope-, DSAR-, Dashboard-, Planning-, Message- und Visit-Tests: bestanden.
- Vollständige Backend-Suite: vier bereits bestehende, nicht SM-bezogene Fehlschläge in GM-Zeitstandard/RED-Month-Datumsankern; keine Änderung der betroffenen Dateien in diesem Scope.
- Keine Migration und keine Produktionsdatenänderung für diesen Audit erforderlich.

## Noch organisatorisch zu erledigen

1. Rechtsgrundlagen und Beschäftigtenkontext durch Datenschutz/Arbeitsrecht freigeben; Betriebsrat/Betriebsvereinbarung prüfen.
2. Auftragsverarbeitungsverträge, Hosting-/Datenbankregionen, Unterauftragsverarbeiter und gegebenenfalls SCC/TIA dokumentieren.
3. DSFA-Schwellenprüfung dokumentieren und bei hohem Risiko eine DSFA durchführen.
4. Automatisierte Löschläufe mit Dry-Run, Legal Hold, Auditnachweis und regelmäßiger Kontrolle betreiben.
5. Incident- und Betroffenenrechte-Prozesse regelmäßig testen; Berechtigungsrezertifizierung für Admin und SM-Admin durchführen.
6. Nutzer organisatorisch anweisen, keine Personen oder sensiblen Unterlagen zu fotografieren und sich auf gemeinsam genutzten Geräten auszuloggen.

## Maßgebliche Quellen

- DSGVO: <https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679>
- Österreichische Datenschutzbehörde, DSGVO-Leitfaden: <https://dsb.gv.at/sites/site0344/media/downloads/dsgvo_leitfaden_2022.pdf>
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase private Storage und Signed URLs: <https://supabase.com/docs/guides/storage/serving/downloads>
