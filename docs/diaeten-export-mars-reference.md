# Diätenexport: MarsPets+-Referenz und Coke-Spark-Umsetzung

## Referenz

Die aktuelle Diätenexport-Funktion in `MarsPets+/src/components/admin/ZeiterfassungPage.tsx` wurde vollständig als fachliche und visuelle Referenz gelesen. MarsPets+ bleibt unverändert. Coke Spark übernimmt dieselbe Berechnungslogik, dieselben Excel-Formeln, dieselbe Tabellenstruktur und dieselbe Formatierung. Unterschiede bestehen nur bei den Datenquellen und den Coke-spezifischen Bezeichnungen.

## Welche Zeiten als Dienstreise zählen

- Marktbesuche zählen als berücksichtigte Außendienstzeit.
- Reguläre Zusatzzeiten wie Lager, Sondereinsatz, Werkstatt, Schulung und vergleichbare Tätigkeiten zählen ebenfalls.
- Homeoffice, Arztbesuch/Arzt und Büro bilden harte Unterbrechungen. Sie teilen den Tag in getrennte Außendienstblöcke.
- Pausen und als Unterbrechung markierte Zusatzzeiten werden als Pause behandelt.
- Pro Tag wird der längste zusammenhängende Außendienstblock verwendet, in dem mindestens ein berücksichtigter Termin liegt.
- Nur Pausen, Orte und Gründe innerhalb dieses ausgewählten Blocks fließen in die Diätenzeile ein.
- Tagesbeginn und Tagesende begrenzen den möglichen Zeitraum; KM-Stand Beginn und Ende stammen aus der Tagesaufzeichnung.

## Coke-spezifische Zuordnung

- Marktbesuch: Marktname, Straße, Ort und PLZ werden in `Ort` ausgegeben.
- Lager: Die hinterlegte Lageradresse wird als Ort ausgegeben; der Grund lautet `Lager`.
- Sondereinsatz und andere Zusatzzeiten: `location`, Marktname oder Schulungsort werden in dieser Reihenfolge verwendet.
- Homeoffice und Arztbesuch bleiben wie in MarsPets+ harte Unterbrechungen und erzeugen keinen eigenen Diäten-Ort.
- Coke Spark kann einen frei gewählten Zeitraum exportieren. MarsPets+ erzeugt standardmäßig einen ganzen Kalendermonat. Tabellenaufbau und Formeln bleiben gleich.

## Pausenregel

- Eine tatsächlich eingetragene Pause wird minutengenau verwendet.
- Ist keine Pause eingetragen und die Brutto-Dienstreise dauert mehr als 6 Stunden, zieht die Excel-Formel automatisch 30 Minuten ab.
- Bei exakt 6 Stunden wird keine automatische Pause ergänzt. Diese Grenze entspricht der MarsPets+-Formel `> 0.25` Tage.
- Die Spalte `Dienstreise Dauer` ist Ende minus Beginn.
- Die Spalte `Abwesenheit in h` ist Dienstreise-Dauer minus Pause, auf zwei Dezimalstellen gerundet.

## Taggeld und Versteuerung

### Bis einschließlich April 2026

- Grundbetrag ab 6 Stunden Brutto-Abwesenheit: 9,77 €
- Je zusätzliche volle Netto-Stunde: 4,03 €
- Tagesmaximum: 31,77 €
- Steuerfreier Höchstbetrag: 30,00 €
- Maximal zu versteuern: 1,77 €

### Ab Mai 2026

- Grundbetrag ab 6 Stunden Brutto-Abwesenheit: 10,01 €
- Je zusätzliche volle Netto-Stunde: 4,13 €
- Tagesmaximum: 32,53 €
- Steuerfreier Höchstbetrag: 30,00 €
- Maximal zu versteuern: 2,53 €

### Formellogik

- `Taggeld Inland`: Grundbetrag plus Staffelung nach zusätzlichen vollen Netto-Stunden, gedeckelt auf das Tagesmaximum.
- `Taggeld Inland zu Versteuern`: `MAX(0; Taggeld Inland - 30,00 €)`.
- `Taggeld Inland steuerfrei`: `Taggeld Inland - zu versteuernder Betrag`.
- Alle drei Spalten bleiben echte numerische Excel-Zellen. Ein steuerpflichtiger Betrag von 0 wird nur über das Zahlenformat als `-` dargestellt. Dadurch bleiben Summen und Lohnverarbeitung numerisch und erzeugen keinen `#WERT!`-Fehler.
- Leere, per Formel erzeugte Pausenzellen werden in Rechenformeln ausdrücklich als 0 behandelt. Das behebt den Mars-Randfall bei exakt 6 Stunden, ohne die sichtbare leere Pausenzelle oder die fachliche Berechnung zu verändern.
- Die Arbeitsmappe enthält berechnete Vorschauwerte und ist auf automatische vollständige Neuberechnung beim Öffnen eingestellt.

## Excel-Struktur und Formatierung

- Tabellenblatt: `Diätendokumentation`
- Datumsformat: `DD.MM.YYYY`
- Zeitformat: `HH:MM`
- Euroformat: `#,##0.00 "€"`
- Farben: Violett `F2CFEE`, Kopfzeile `D9D9D9`, Unterkopf `E8E8E8`, Rechenfelder `BFBFBF`.
- Rahmenfarbe: `B0B0B0`.
- Spaltenbreiten: `40, 14, 13, 12, 21, 70, 30, 21, 17, 26, 30, 19, 17, 31, 32, 16`.
- Kopf-, Summen-, Unterschrifts- und Legendenbereiche sowie Zell-Merges entsprechen der MarsPets+-Vorlage.
- Lange Ortslisten werden mit Zeilenumbrüchen ausgegeben; die Zeilenhöhe wächst anhand der Ortsanzahl.

## Technische Schutzregeln

- Formelzellen für Pause, Dauer, Taggeld, steuerfrei, zu versteuern, Nächtigung und Abwesenheit sind numerisch typisiert.
- Nullwerte werden nicht durch Textwerte wie `"-"` ersetzt, sondern nur optisch als Strich formatiert.
- Summenzeilen verwenden echte `SUM`-Formeln.
- Ein unabhängiger TypeScript-Rechner erzeugt ausschließlich die zwischengespeicherten Formelwerte und dient als Test-Oracle; die exportierte Arbeitsmappe bleibt formelbasiert.
- Tests prüfen Tarifsprung, 6-Stunden-Grenze, automatische Pause, Steueraufteilung, Coke-spezifische Orte/Gründe, Formelerhalt nach Serialisierung und numerische Zelltypen.
