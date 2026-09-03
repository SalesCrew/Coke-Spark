# GM Distributionsantworten im Quartal — LivingMD

Status: umgesetzt und geprüft
Stand: 03.09.2026
Scope: Vorbelegung bereits beantworteter Distributionsfragen beim Start eines neuen GM-Marktbesuchs

## Verbindliche Fachlogik

Eine Distributionsantwort bleibt innerhalb genau eines Kalenderquartals als ausgefüllte Antwort sichtbar.

Die Wiederverwendung gilt ausschließlich, wenn alle Identitäten gleich sind:

- derselbe GM;
- derselbe Markt;
- dieselbe technische Frage-ID;
- ein früherer, vollständig abgeschlossener Marktbesuch;
- die frühere Antwort wurde gültig beantwortet;
- frühere Antwort und neuer Marktbesuch liegen im selben Kalenderquartal.

Der vorhandene Kommentar gehört zur Antwort und wird mit übernommen. Die Antwort bleibt im neuen Fragebogen normal editierbar. Nicht beantwortete, ungültige, gelöschte oder nur in einem Entwurf gespeicherte Antworten werden nicht übernommen.

## Harte Quartalsgrenze

Das Zeitfenster ist immer das Kalenderquartal in `Europe/Vienna`:

| Quartal | Einschließlich |
| --- | --- |
| Q1 | 01.01.–31.03. |
| Q2 | 01.04.–30.06. |
| Q3 | 01.07.–30.09. |
| Q4 | 01.10.–31.12. |

Die Laufzeit einer Prämienwelle verändert diese Grenze nicht. Überschreitet eine Welle eine Quartalsgrenze, kann ihre Distributionskonfiguration im neuen Quartal weiterhin gelten, aber Antworten aus dem vorigen Quartal werden nicht übernommen. Die Frage beginnt im neuen Quartal leer.

Beispiel: Eine Welle läuft vom 01.07. bis 15.12. Eine Antwort vom 30.09. wird in einem am 30.09. gestarteten Besuch wiederverwendet. Ein am 01.10. gestarteter Besuch erhält diese Antwort nicht. Erst eine im Q4 abgeschlossene Antwort kann innerhalb von Q4 wiederverwendet werden.

## Abgrenzung zur Prämienwelle

Die Welle dient nur zur Bestimmung, welche konkreten Frage-IDs dem `Distributionsziel` zugeordnet sind. Für diese Zuordnung werden nicht gelöschte Entwurfs- oder aktive Wellen berücksichtigt, deren Datumsbereich das aktuelle Kalenderquartal überlappt. Archivierte Wellen sind ausgeschlossen.

Die Welle wird dabei weder aktiviert noch inhaltlich verändert. Bonusberechnung, Auszahlungsstatus und Wellenstatus bleiben unverändert. Das verhindert insbesondere, dass eine noch in Arbeit befindliche Prämienwelle nur für die Fragebogen-Vorbelegung aktiviert werden müsste.

Die verlängerte Quartalslogik gilt nur für die exakt normalisierte Säule `Distributionsziel`. `Schütten / Displays`, Flex, Qualität und alle anderen Fragen behalten die bestehende Vorbelegung innerhalb des aktuellen RED-Monats.

## Technischer Ablauf

1. Beim Erstellen eines neuen GM-Marktbesuchs wird aus dem aktuellen Zeitpunkt das Wiener Kalenderquartal berechnet.
2. Das Backend ermittelt alle nicht archivierten Wellen, die dieses Quartal zeitlich überlappen.
3. Aus diesen Wellen werden nur nicht gelöschte Quellen der Säule `Distributionsziel` betrachtet, die ebenfalls für Antwortwiederverwendung markiert sind.
4. Die Frage-IDs werden mit den tatsächlich im neuen Besuch enthaltenen Frage-IDs geschnitten.
5. Pro passender Frage wird die jüngste Quelle im gleichen Quartal gesucht, eingeschränkt auf denselben GM und denselben Markt.
6. Als Quelle zählt nur eine nicht gelöschte, gültig beantwortete Antwort aus einer nicht gelöschten, abgeschlossenen Session.
7. Die Antwort wird gegen den aktuellen Fragetyp und die aktuelle Fragekonfiguration erneut validiert. Bei geändertem Typ, entfernten Optionen oder sonstiger Ungültigkeit bleibt die neue Frage leer.
8. Die validierte Antwort, ihre Optionen beziehungsweise Matrixwerte und der Kommentar werden als editierbare Antwort des neuen Besuchs angelegt.

Vorhandene Entwürfe werden nicht nachträglich verändert. Die Logik greift nur beim Erstellen einer neuen Visit-Session; dadurch kann kein bereits begonnener Fragebogen überraschend umgeschrieben werden.

## Wirkung nach dem Vorbelegen

Die übernommene Antwort ist ausdrücklich eine ausgefüllte Antwort des neuen Besuchs, keine reine Lesehilfe. Der GM kann sie unverändert lassen, ändern oder löschen. Wird der neue Besuch abgeschlossen, behandeln die bestehenden Reports und Bonusprozesse den dann gespeicherten Wert genauso wie eine im neuen Besuch manuell eingegebene Antwort. An deren bestehender Berechnung oder Deduplizierung wurde nichts geändert.

## Unveränderte Bereiche

- keine Datenbankmigration und keine Änderung an RLS oder Berechtigungen;
- keine Aktivierung oder Statusänderung einer Prämienwelle;
- keine Änderung der Bonusformeln oder Auszahlungslogik;
- keine Änderung an SM-Fragebögen;
- keine quartalsweite Wiederverwendung für andere Säulen;
- keine Übernahme zwischen unterschiedlichen GMs, Märkten oder Frage-IDs;
- keine Wiederverwendung von Fotos über diese Distributionslogik.

## Sicherheits- und Datenprüfung

Die Produktionsdatenbank wurde ausschließlich lesend geprüft. Für Q3 2026 existiert eine nicht archivierte Entwurfswelle `Prämien Q3 2026` vom 01.07. bis 30.09. mit 13 eindeutig zugeordneten Distributionsfragen. Der produktive Q3-Datenbestand enthält 9.128 gültige, beantwortete Antworten aus abgeschlossenen Sessions in 5.623 eindeutigen GM-Markt-Frage-Gruppen; 373 dieser Antworten besitzen einen übernehmbaren Kommentar. Es wurden keine Zeilen, Wellenstatus oder Schemata verändert.

Die Query bleibt begrenzt auf:

- die wenigen das aktuelle Quartal überlappenden Wellen;
- die Frage-IDs des gerade zu erstellenden Besuchs;
- einen GM und einen Markt;
- abgeschlossene Sessions im exakten Quartalsfenster.

## Verifikation

- Backend-TypeScript-Build: bestanden.
- Fokussierte Tests für Semantik, Quartalsgrenze, Wiener Zeitzone, wellenübergreifende Grenze, Konfigurationsänderungen und Ja/Nein-Multi: bestanden.
- Bestehende Antwortvalidierungs-Tests: bestanden.
- Vollständige Backend-Unit-Suite: 120/124 bestanden; die vier bekannten, fachfremden Baseline-Fehler bleiben unverändert (eine Admin-Zeiterfassung-Pausenerwartung und drei RED-Monats-Datumsannahmen).
- Produktions-Supabase-Prüfung: read-only bestanden; 13 aktuelle Distributionsfragen erkannt.
- `git diff --check`: bestanden.

## Pflegehinweis

Ändert sich die Produktanforderung an Identität, Zeitraum oder Säulenumfang, müssen Implementierung und dieses Dokument gemeinsam angepasst werden. Insbesondere darf die Quartalsgrenze nicht wieder an `start_date`/`end_date` einer Welle oder an den RED-Monat gekoppelt werden.
