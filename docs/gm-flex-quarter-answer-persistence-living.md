# GM Flexziel: Quartalsübernahme — LivingMD

Stand: 29.09.2026. Status: umgesetzt und lokal mit DB-/API-Integrationstests geprüft; Produktionsrelease vom Nutzer jetzt ausdrücklich beauftragt.

## Entscheidung und Abgrenzung

Doris bestätigt: Flex- und Distributionswerte bleiben über das Kalenderquartal erhalten. Eingaben sind Gesamtstände, nicht neue Stückzahlen je Besuch (erst 1, danach insgesamt 3). Für Flex sind ausschließlich die unter **Prämienwelle → Regeln & Quellen → Flexziel** verknüpften technischen Frage-IDs betroffen. Ein Flex-Besuch oder ein Modulname allein aktiviert die Übernahme nicht. Es wird kein neues Frage-Tag eingeführt.

## Ablauf und UI

Beim Start eines neuen GM-Marktbesuchs werden die letzten gültig abgeschlossenen Antworten desselben GMs, Markts und derselben Frage-ID aus dem aktuellen Wiener Kalenderquartal vorbelegt. Die vorhandenen Eingabefelder und Kommentare bleiben normal bearbeitbar. Unverändert abgeschlossene Antworten dürfen keine zusätzliche Stückzahl erzeugen: Für kumulative Bestände verwendet die Prämienquelle weiterhin **Letzter Wert je Markt**, nicht die Summe aller Besuche.

Beispiel: Juli 1 Rack → August vorbelegt 1 → GM ändert auf 3 → September vorbelegt 3. Bei Faktor 3 sind das 9 Punkte, auch wenn der Septemberbesuch unverändert abgeschlossen wird. Andere Quellen (z. B. E3) zählen mit ihrem eigenen Gewicht dazu.

Am 01.01., 01.04., 01.07. und 01.10. beginnt ein neues Kalenderquartal (`Europe/Vienna`): Es wird keine Antwort aus dem Vorquartal übernommen, selbst wenn die Prämienwelle länger läuft. Nicht verknüpfte Fragen behalten die bestehende RED-Monatslogik. Bestehende Entwürfe und historische Besuche werden nicht umgeschrieben.

## Technische Entscheidungen

- Beide vorhandenen Konfigurationen unterstützen: Legacy-Säule exakt `Flexziel` sowie Workspace-Säule mit `kind: flex`, unabhängig vom Anzeigenamen.
- Alte Legacy-Flexquellen hatten noch kein Übernahme-Flag. Ihre explizite Quellenverknüpfung genügt, ohne DB-Backfill oder erneutes Speichern.
- Unverändert: nicht archivierte, nicht gelöschte Wellen mit Quartalsüberlappung, einschließlich Entwürfen. Geschlossene Workspace-Snapshots werden nicht als neue Konfiguration verwendet.
- Die Quelle muss beantwortet und gültig sein; Entwürfe, gelöschte Daten und andere GMs/Märkte sind ausgeschlossen. Erneute Validierung gegen die aktuelle Fragekonfiguration schützt vor geänderten Typen, Optionen und Wertebereichen.
- Fotos sind von der Quartalsübernahme ausgeschlossen, damit kein altes Foto als neue Besuchsleistung gilt.
- Keine Schema-, Auth-, RLS-, Fragebogen-Erstellungs- oder Bonusformeländerung erforderlich. Bestehende GM-Felder zeigen die gespeicherte Vorbelegung bereits an.

## Fortschritt / Verifikation

- [x] Fachlogik und Abgrenzung dokumentiert.
- [x] Legacy- und Workspace-Auswahl auf explizit verknüpfte Flexziel-Fragen erweitert.
- [x] Persistierte Monats-/Quartalswechsel, Identität und Bearbeitung lokal geprüft.
- [x] Bonusprüfung: 1 → 3 → 3 bleibt 3; unterschiedliche Quellen addieren ihre Punkte.
- [x] Regressionstests, Backend-Build und Diff-Prüfung.

## Nachweis und Prüfgrenzen

Die bisher im Visit-Router enthaltenen Lade-/Kopierfunktionen wurden ohne Änderung ihrer RED-Monatssemantik in `backend/src/lib/visit-answer-reuse.ts` ausgelagert. Der echte Visit-Start verwendet diese Funktionen weiterhin innerhalb seiner bisherigen Erstellung/Transaktion. Dadurch testen wir die produktiven Quartalsqueries und das tatsächliche Anlegen neuer Antwort-, Options-, Matrix- und Kommentarzeilen gegen eine isolierte PGlite/PostgreSQL-Datenbank, statt eine zweite Übernahme-Implementierung zu testen.

29 fokussierte Tests bestehen gemeinsam: Quartalssemantik, Bonusregeln, Prämien-Workspace-HTTP, Übernahme/Persistenz und Antwortvalidierung. Geprüft sind alte Legacy-Verknüpfungen ohne erneutes Speichern, beliebige Anzeigenamen bei `kind: flex`, gültige Werte einschließlich 0, Kommentare/Optionen/Matrixzellen, unveränderte Quellantworten, ungültige/gelöschte/Entwurfsantworten, andere GMs/Märkte/Frage-IDs, gelöschte Quellen/Säulen und archivierte Wellen. September/Oktober wird exakt an der Wiener Mitternachtsgrenze geprüft, auch bei einer über Q4 verlängerten Welle.

Beispiel im gespeicherten Testablauf: 1 → 3 → 3 Racks mit Faktor 3 ergibt 9 Punkte; 1 E3 mit Faktor 5 ergibt zusätzlich 5; insgesamt 14, nicht 26. Der letzte Gesamtstand pro Markt wird von der bereits vorhandenen Prämienberechnung verwendet.

Backend-Build und Diff-/Whitespace-Prüfung bestehen. Die allgemeine Unit-Suite hat weiterhin vier fachfremde, unveränderte Fehler: Admin-Zeiterfassung (Standardpause) und drei RED-Monats-Ankererwartungen. Kein Fix dieser Bereiche ist Teil dieses Auftrags.

Frontend-Lesepfad geprüft: `hydrateFromSessionPayload` auf der GM-Marktbesuchsseite übernimmt gespeicherte Zahlen, Optionen, Matrixwerte und Kommentare in die vorhandenen editierbaren Eingabefelder. Dafür ist keine neue UI nötig. Ein vollständiger Browser-Durchlauf über Auth und den gesamten GM-HTTP-Router wurde nicht ausgeführt; die lokale Vollapp ist schreibgeschützt und nutzt produktive Lesedaten. Die Integrationstests verwenden synthetische Auth für die Prämien-API und prüfen die produktiven Visit-Lade-/Kopierfunktionen direkt; FK/Auth/RLS sind keine Bestandteile der isolierten Fixture.

Reproduzierbar im Backend: `npm run test:visit-answer-reuse`, `npm run test:praemien-workspace` und `npm run build`.

Produktionsdaten wurden für diese Verifikation nicht verändert. Der Nutzer hat anschließend ausdrücklich den Push der Inaktiv-Marker und neuesten Boni-/Flex-Änderungen nach Produktion beauftragt. Die Inaktiv-Migration und vorherige UI waren bereits live; das neue Quartalsverhalten benötigt nur ein Backend-Code-Release, keine weitere Migration oder Umschreibung historischer Antworten.

## Produktionsrelease

- Produktion vor Release geprüft: Frontend `939a897` auf Vercel READY; Inaktiv-Migration `20260929140742` vorhanden, `module_catalog_state` mit RLS und `praemien_wave_settings` vorhanden.
- Produktives Frontend verwendet `spark-backend-production-0fae.up.railway.app`. Release ausschließlich über die bestehenden `master`-Git-Integrationen, Backend zuerst, dann Root mit aktualisiertem Backend-Gitlink.
- Keine Übernahme fremder lokaler Änderungen oder Railway-Konfigurationsentwürfe; keine Produktions-Testdatensätze.
- Neuer Backend-/Root-Commit und bestätigte Deployment-IDs werden nach dem Release ergänzt.
