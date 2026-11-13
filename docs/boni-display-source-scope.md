# Individuelle Besuchsbereiche für Schütten/Displays

Eine Schütten-/Displays-Messgröße mit `answer_sum` und Prozent-Einheit kann eine
explizite, auf die jeweilige Prämienwelle beschränkte Ausnahme enthalten:

```ts
sourceSectionOverrides: [{ gmId, sections: ["standard", "flex", "billa"] }]
```

Die Ausnahme gilt nur für die angegebene Benutzer-ID und die vorhandenen
Standard-Fragequellen dieser Messgröße. Andere GMs verwenden weiterhin die
ursprüngliche Bereichszuordnung. Frage-IDs, gewertete Antworten, Faktoren,
Punktegewichte, Handelsketten, Mindestfrequenzen und Zählweisen bleiben erhalten.
Kühlerinventur, MHD, Durcharbeit und nicht zugeordnete Fragen werden nicht
zusätzlich eingeschlossen.

Die Auswahl des letzten gültigen Stands bzw. des höchsten Werts bei Zählweise
`once` erfolgt pro Quelle und Markt über die freigegebenen Bereiche gemeinsam.
Dasselbe Frage-/Marktpaar wird dadurch nicht einmal je Fragebogenart addiert.
Die Quellenabdeckung zählt weiterhin die ursprünglichen logischen Quellen.

Die vorhandenen Lade-, Vorschau-, Speicher-, GM-Projektions- und Exportpfade
verwenden dieselbe serverseitige Auswertung. Der Mitarbeiterdialog zeigt nur
beim betroffenen GM einen kurzen Hinweis auf die berücksichtigten Bereiche.
Bestehende Prozentvorgaben und manuelle Ist-Punkte behalten ihren Vorrang;
eine geänderte automatische Vorschau entfernt keine gespeicherte Vorgabe.

Die Ausnahme wird im vorhandenen JSON-Regelmodell gespeichert und mit den
Regeländerungen versioniert. Neue Tabellen oder eine Schema-Migration sind
nicht nötig. Das API prüft bekannte reguläre GMs, eindeutige IDs und Standard
zusammen mit Flex und/oder Billa. Andere Messgrößen und bereits separat
zugeordnete Bereiche können keine solche Ausnahme erhalten.

Ältere Clients, die das optionale Feld bei Vorschau oder Regeländerungen
weglassen, behalten die gespeicherte Ausnahme. Ein ausdrückliches leeres Array
entfernt sie. Eingefrorene Quartalsergebnisse werden unverändert gelesen.

Die konkrete einmalige Konfigurationsoperation verwendet das separat geprüfte
SQL-Template `backend/tests/sql/praemien-display-source-scope.sql`. Sie benötigt
eine eigene Freigabe für den gebundenen GM, die Welle und die Messgröße. Aktive
Q4-Welle, Revision, Quellenanzahl, Standard-Zuordnung und regulärer GM werden
vor dem Schreiben geprüft und gesperrt. Die Operation ergänzt ausschließlich
das Ausnahmefeld und einen Audit-Eintrag mit vorherigem Regelmodell; sie ändert
keine Mitarbeiterwerte, Sollwerte, Antworten oder Fotos.

Prüfung am 13.11.2026: 65 Backend-Tests und beide Builds bestanden. Ausschließlich
disposable synthetische PostgreSQL-Daten wurden verwendet. Der tatsächliche
Admin-UI-Ablauf auf 3037/4037 prüft Flex-Punkte, unveränderte Prozentvorgabe,
ausdrückliches Umschalten, Vorschau, Speichern, erneutes Öffnen und einen GM
ohne Ausnahme. Bei 1280 und 1440 Pixeln trat kein horizontaler Überlauf auf;
keine Browserfehler, fehlgeschlagenen oder externen Requests.
