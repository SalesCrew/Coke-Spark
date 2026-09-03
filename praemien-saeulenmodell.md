# Prämienmodell – belastbare Säulenlogik

Stand: 14.07.2026
Status: fachliche Rekonstruktion und lokales Säulenfundament abgeschlossen; keine Migration angewendet, kein Commit, kein Push.

## Zweck dieses Dokuments

Dieses Dokument ist die dauerhafte Arbeitsgrundlage für den Umbau der SPARK-Prämien. Es fasst die gelieferte PDF **„Prämienmodell Q1 2026“**, sämtliche Tabellenblätter der Excel-Datei **„00_Boni_Auswertung Q2“**, die Hinweise von Doris und den aktuellen Stand der Anwendung zusammen.

Der wichtigste Grundsatz lautet:

> Jede Säule wird separat bewertet und bezahlt. Punkte oder Übererfüllung einer Säule dürfen niemals eine andere Säule freischalten oder deren fehlende Leistung kompensieren.

Der Quartalsbonus ist daher die Summe der innerhalb jeder Säule erreichten Auszahlungsstufen – keine globale Punkte-Leiter.

## Quellen und geprüfter Umfang

### PDF: Prämienmodell Q1 2026

Alle 12 Seiten wurden als Text, Tabellen und gerenderte Seiten geprüft. Die Präsentation beschreibt die fachliche Struktur für Q1 2026.

### Excel: 00_Boni_Auswertung Q2

Alle zehn Tabellenblätter wurden inhaltlich und formelseitig geprüft:

1. Gesamtauswertung
2. BONI Coke
3. BONI Übersicht
4. POS Detail
5. Distributionsziel Übersicht
6. Distributionsziel
7. Flexziel - Kühler+RED
8. Flexziel - RED
9. Monster Detail
10. Monster Zusatzziel

Die Blätter „Monster Detail“ und „Monster Zusatzziel“ sind Alt-/Zusatzboni und werden für den aktuellen Säulenumbau ausdrücklich nicht berücksichtigt.

## Stabile fachliche Architektur

Der maximale Quartalsbonus beträgt **1.100 € brutto**. Er besteht aus vier voneinander unabhängigen Säulen:

| Säule | Maximalbetrag | Anteil am Gesamtbonus |
|---|---:|---:|
| Schütten / Displays | 550 € | 50 % |
| Distribution / Verfügbarkeit | 165 € | 15 % |
| Flex-Ziel | 165 € | 15 % |
| Qualitative Ziele / Merch | 220 € | 20 % |
| **Gesamt** | **1.100 €** | **100 %** |

Die qualitativen Ziele bilden fachlich eine Säule mit drei separat vergüteten Teilzielen:

| Teilziel | Maximalbetrag | Anteil am Gesamtbonus |
|---|---:|---:|
| Zeitmanagement | 110 € | 10 % |
| Reporting | 55 € | 5 % |
| Bilderkennung / Survey-Genauigkeit | 55 € | 5 % |

### Nicht verhandelbare Rechenregeln

1. Jede Säule besitzt ihre eigenen Messgrößen, Stufen, Bedingungen und Auszahlungen.
2. Pro Säule gilt die höchste vollständig erfüllte Auszahlungsstufe.
3. Die Auszahlung einer Säule ist auf ihren Maximalbetrag begrenzt.
4. Mehrleistung in Säule A erhöht niemals die Auszahlung von Säule B.
5. Der Gesamtbonus ist ausschließlich die Summe der verdienten Säulenbeträge.
6. Der Gesamtfortschritt wird gegen 1.100 € gerechnet, nicht gegen 1.050 €.
7. Bei zusammengesetzten Säulen müssen alle fachlich geforderten Mindestbedingungen erfüllt sein.
8. Regeln sind quartalsspezifisch konfigurierbar; die Architektur bleibt stabil.

### Bestätigung aus dem fachlichen Feedback vom 14.07.2026

Die in der Auswertung gezeigten Stufen **70–79,9 % / 80–94,9 % / ab 95 %** und die Beträge **275 € / 440 € / 550 €** können konkret der Säule **Schütten / Displays** entsprechen. Sie sind deshalb keine allgemeine Bonusleiter für alle Säulen.

Der **Säulenanteil variiert**. Daraus folgt verbindlich:

- Maximalbetrag und Anteil werden pro Säule und Quartal konfiguriert.
- Die Auszahlungsstufen einer Säule werden nicht aus einem globalen Prozentsatz abgeleitet.
- Die genannten 275/440/550 € sind eine konkrete Konfiguration von Säule 1, keine unveränderliche Systemkonstante.
- Ändert sich der Säulenanteil, müssen Maximalbetrag und Stufenbeträge dieser Säule im Admin-Editor angepasst werden können, ohne andere Säulen zu verändern.

Das gebaute Modell erfüllt dies bereits über `max_reward_eur` und die frei konfigurierbaren Auszahlungsstufen je Säule.

## Q1-Regeln aus der PDF

### Säule 1: Schütten / Displays

| Zielerreichung | Säulenanteil | Auszahlung |
|---:|---:|---:|
| unter 70 % | 0 % | 0 € |
| 70–79,9 % | 50 % | 275 € |
| 80–94,9 % | 80 % | 440 € |
| ab 95 % | 100 % | 550 € |

Weitere Q1-Regeln:

- Eine Platzierung in der korrekten Zone wird laut PDF mit **+10 % je Display** bewertet.
- Eine Platzierung darf nicht doppelt gezählt werden.
- Bestimmte Platzierungen bzw. Ausnahmen sind laut Präsentation ausgeschlossen.

### Säule 2: Distribution / Verfügbarkeit

| Zielerreichung | Säulenanteil | Auszahlung |
|---:|---:|---:|
| unter 80 % | 0 % | 0 € |
| 80–89,9 % | 50 % | 82,50 € |
| ab 90 % | 100 % | 165 € |

### Säule 3: Flex-Ziel Q1

Das Q1-Flexziel besteht aus zwei Komponenten:

1. Platzierungen, z. B. ZZ/Holzrack:
   - 18 Punkte = 50 % der Komponente
   - 22 Punkte = 100 % der Komponente
2. Kühler-Scanning:
   - 65 % Scanrate = 5 Punkte / 50 % der Komponente
   - 75 % Scanrate = 10 Punkte / 100 % der Komponente

Auszahlungsstufen der Säule:

| Kombinierte Flex-Punkte | Auszahlung |
|---:|---:|
| unter 22 | 0 € |
| ab 22 | 82,50 € |
| ab 26 | 165 € |

Harte Zusatzbedingung: **Beide Komponenten müssen jeweils mindestens ihre 50-%-Stufe erreichen.** Ein hoher Wert in nur einer Komponente darf keine Auszahlung auslösen.

### Säule 4: Qualitative Ziele Q1

- Zeitmanagement: bis 110 €
- Reporting: bis 55 €
- Bilderkennung / Survey-Genauigkeit: bis 55 €

Die konkreten Erfassungs-/Bewertungsregeln können je Quartal angepasst werden; die drei Beträge werden separat verdient und anschließend innerhalb der qualitativen Säule summiert.

## Q2-Regeln aus der Excel-Auswertung

### Gesamtauswertung: Spaltenpaare

Das erste Blatt zeigt jede Messgröße direkt neben ihrer Auszahlung:

- B: Schütten/Display %, C: Auszahlung
- D: Distribution %, E: Auszahlung
- F: Flex-Punkte, G: Auszahlung
- H: Merch Reporting %, I: Auszahlung
- J: Merch Surveyerhebung %, K: Auszahlung
- L: Zeitmanagement %, M: Auszahlung
- N: Gesamtbonus
- O: Gesamtprozentsatz

Damit bestätigt die Datei eindeutig: **N ist die Summe separater Säulenauszahlungen.** Es gibt keine globale Punkte-Schwelle, über die man die nächste Säule „mitverdienen“ kann.

### Säule 1: Schütten / Displays Q2

Die Auszahlung entspricht Q1:

- ab 70 % → 275 €
- ab 80 % → 440 €
- ab 95 % → 550 €

Der persönliche Quartalszielwert wird anhand Abwesenheit reduziert:

`angepasstes Ziel = ((60 - Abwesenheitstage) × 145) / 60`

`Zielerreichung = erreichte Platzierungspunkte / angepasstes Ziel × 100`

Die Excel-Auswertung summiert mehrere Frage-/Platzierungsarten mit unterschiedlichen Gewichten, unter anderem 0,5-, 1-, 2- und 3-fache Punkte.

### Säule 2: Distribution Q2

- ab 80 % → 82,50 €
- ab 90 % → 165 €

Die Detailauswertung enthält zehn Frage-/Metrikpaare. Die finale Durchschnittsformel verwendet allerdings nur neun davon und lässt „Jack & Coke Kühler“ aus. Ob diese Kennzahl bewusst ausgeschlossen oder versehentlich vergessen wurde, muss fachlich bestätigt werden.

#### Laufzeit bereits beantworteter Distributionsfragen

Distributionsantworten werden innerhalb eines Kalenderquartals für denselben GM, denselben Markt und dieselbe technische Frage-ID als ausgefüllte, editierbare Antwort weitergeführt. Der vorhandene Kommentar wird mit übernommen. Nur gültige Antworten aus abgeschlossenen Marktbesuchen sind zulässig.

Die Quartalsgrenze ist unabhängig von der Laufzeit der Prämienwelle. Reicht eine Welle in das nächste Quartal, bleiben ihre zugeordneten Distributionsfragen dort gültig, aber die Antworten aus dem vorigen Quartal werden nicht übernommen. Der erste Besuch im neuen Quartal beginnt für diese Fragen leer. Andere Prämien-Säulen behalten die bestehende RED-Monatslogik.

Die genaue Laufzeit-, Auswahl- und Sicherheitslogik ist im LivingMD [`docs/gm-distribution-quarter-answer-persistence-living.md`](docs/gm-distribution-quarter-answer-persistence-living.md) dokumentiert.

### Säule 3: Flex Q2

Komponente Kühler-Nettoaufbau:

- +2 Kühler netto → 5 Punkte
- ab +3 Kühler netto → 10 Punkte

Komponente RED/IR-Nutzung:

- ab 80 % → 5 Punkte
- ab 85 % → 10 Punkte

Auszahlung:

- mindestens 10 kombinierte Punkte → 82,50 €
- mindestens 15 kombinierte Punkte → 165 €

Harte Zusatzbedingung laut Regeltext: **Kühler und RED müssen jeweils mindestens 5 Punkte erreichen.**

### Säule 4: Qualitative Ziele Q2

- Reporting → 55 €
- Survey/Bilder → 55 €
- Zeitmanagement → 110 €

Diese Teilziele sind unabhängig voneinander zahlbar und werden innerhalb der qualitativen Säule addiert.

## Erkannte Fehler und Widersprüche der Quelldateien

Diese Punkte dürfen nicht ungeprüft nachgebaut werden:

1. **Falscher Nenner im Gesamtprozentsatz:** Das Excel-Blatt berechnet Spalte O mit `Gesamtbonus / 1.050`. Der korrekte Maximalbonus ist 1.100 €. Deshalb zeigt die Datei bei 1.100 € fälschlich rund 104,76 % bzw. 105 %.
2. **Flex-Gate fehlt in der tatsächlichen Q2-Auszahlungsformel:** Der Regeltext verlangt mindestens 5 Punkte in Kühler und 5 Punkte in RED. Die Formel auf der Gesamtauswertung prüft nur die Summe. Dadurch erhalten beispielsweise Personen mit 10 Kühlerpunkten und 0 RED-Punkten fälschlich 82,50 €.
3. **Distributionsdurchschnitt verwendet nur 9 von 10 Kennzahlen:** „Jack & Coke Kühler“ ist nicht Teil der finalen Durchschnittsformel. Fachliche Klärung nötig.
4. **Zonenbonus widersprüchlich:** Die Q1-PDF fordert +10 % für korrekte Zone; in den geprüften Q2-Formeln ist kein eindeutiger Faktor 1,1 sichtbar. Das kann eine Quartalsänderung oder ein Fehler sein.
5. **Hilfsformeln bei Schütten uneinheitlich:** Einzelne Zeilen rechnen den Rest bis 100 %, andere bis zur tatsächlichen Vollauszahlung bei 95 %. Diese Hilfsanzeige darf die Auszahlung nicht beeinflussen.
6. **Externe Excel-Verknüpfung:** Die Arbeitsmappe enthält einen Link auf eine externe FC-Kundenliste. Gerenderte `#VALUE!`-Zellen entstehen ohne diese Datei; die in Excel gespeicherten Werte selbst sind vorhanden.
7. **PDF-Typo:** Eine Q1-Folie nennt „relevant für den Bonus im Q4“. Das ist sehr wahrscheinlich ein übernommener Alttext und keine Modellregel.

## Anforderungen von Doris

- Alle Säulen und deren Vorgaben müssen durch Admins veränderbar sein.
- Jede Säule kann eine eigene prozentuale Zielerreichung und eigene Auszahlung besitzen.
- Quartalsspezifische Sonderfälle müssen konfigurierbar sein.
- Beim Distributionsziel müssen Regeln nicht nur nach Handelskette, sondern auch nach Produkt-/Fragekombination eingeschränkt werden können, z. B. ein Produkt gilt nur für bestimmte Billa-Varianten.

## Konsequenzen für das SPARK-Datenmodell

Das bereits begonnene Modell „ein Ziel + ein Betrag pro Säule“ reicht nicht aus. Benötigt werden:

### 1. Säule

- Name, Beschreibung, Farbe, Reihenfolge
- Maximalbetrag
- Berechnungsmodus (automatisch, manuell oder zusammengesetzt)
- zugeordnete Frage-/Datenquellen

### 2. Messgrößen einer Säule

Beispiele:

- `achievement_percent` für Schütten
- `availability_percent` für Distribution
- `cooler_points`, `red_points`, `total_points` für Flex
- `time_management_percent`, `reporting_percent`, `survey_accuracy_percent` für Qualität

Jede Messgröße braucht eine Einheit und eine klare Herkunft. Rohdaten, berechnete Kennzahlen und manuelle Eingaben müssen unterscheidbar bleiben.

### 3. Auszahlungsstufen je Säule

Eine Säule besitzt null bis mehrere geordnete Stufen. Jede Stufe enthält:

- Bezeichnung
- Reihenfolge
- Auszahlungsbetrag
- optionalen Anteil am Säulenmaximum
- eine oder mehrere Bedingungen

### 4. Bedingungen je Stufe

Eine Bedingung referenziert eine Messgröße, einen Vergleichsoperator und einen Zielwert. Innerhalb einer Stufe gelten Bedingungen standardmäßig als AND.

Beispiel Flex Q2, 50-%-Stufe:

- `cooler_points >= 5`
- `red_points >= 5`
- `total_points >= 10`
- Auszahlung 82,50 €

Beispiel Flex Q2, 100-%-Stufe:

- `cooler_points >= 5`
- `red_points >= 5`
- `total_points >= 15`
- Auszahlung 165 €

### 5. Berechnetes Ergebnis pro GM, Welle und Säule

Das Ergebnis muss revisionsfähig speichern:

- alle verwendeten Messwerte
- die erreichte Stufe
- den verdienten Betrag
- Berechnungszeitpunkt
- optional einen Regel-/Konfigurations-Snapshot

Dadurch bleibt nachvollziehbar, warum eine Person einen Betrag erhalten hat, auch wenn Regeln später geändert werden.

## UI-Zielbild

Die bisherige globale „Bonusstufen“-Karte ist für das Säulenmodell fachlich falsch und soll nicht das primäre Bedienelement bleiben.

### Admin-Konfiguration

Jede Säulenkarte zeigt:

- Maximalbetrag und Anteil am Gesamtbonus
- eigene Auszahlungsstufen
- Bedingungen jeder Stufe
- Messgrößen und Quellen
- sofortige Validierung bei Lücken, Überschneidungen oder Betrag über Säulenmaximum

Für zusammengesetzte Säulen wie Flex zeigt die UI die Teilkomponenten sichtbar nebeneinander und kennzeichnet die Mindestbedingungen als „alle erforderlich“.

Die qualitative Säule zeigt drei Teilziele, deren Beträge unabhängig addiert werden.

### GM-Ansicht

Jede Säule zeigt separat:

- aktuellen Wert
- nächste erreichbare Stufe
- erreichten Betrag / Maximalbetrag
- noch fehlende Leistung
- bei zusammengesetzten Säulen den Status jeder Pflichtkomponente

Der Gesamtbonus wird nur als Summe darunter angezeigt. Die UI darf nicht suggerieren, dass zusätzliche Punkte in einer Säule die nächste allgemeine Bonusstufe freischalten.

## Abwärtskompatibilität

Bestehende Wellen mit dem alten globalen Schwellenmodell müssen lesbar bleiben. Neue bzw. bewusst umgestellte Wellen verwenden das Säulenstufenmodell. Eine automatische Umstellung alter Wellen ohne explizite Admin-Aktion ist ausgeschlossen.

## Lokal gebauter Stand

Der lokale Code enthält nun drei klar getrennte Rechenmodelle:

- `global_thresholds`: bestehende Wellen bleiben unverändert lesbar und rechenbar.
- `pillar_targets`: das zuvor begonnene einfache Übergangsmodell bleibt abwärtskompatibel.
- `pillar_tiers`: das neue fachlich korrekte Modell mit unabhängigen Säulen.

Für `pillar_tiers` wurden lokal umgesetzt:

- normalisierte Messgrößen je Säule
- beliebig viele Auszahlungsstufen je Säule
- mehrere AND-Bedingungen pro Stufe
- Modus „höchste erreichte Stufe“ für Schütten, Distribution und Flex
- Modus „erreichte Teilziele addieren“ für die qualitative Säule
- revisionsfähige Ergebnisfelder mit Messwerten, erreichten Stufen, nächster Stufe und Betrag
- getrennte Flex-Erfassung für Kühler- und RED-Punkte
- Admin-Editor für Maximalbetrag, Zielwerte und Auszahlungen direkt in jeder Säule
- GM-Detailansicht, die jede Säule mit eigenem Betrag statt einer globalen Leiter zeigt
- neue Wellen mit dem bekannten 1.100-€-Grundmodell als editierbarer Ausgangskonfiguration

Wichtig: Die Architektur und Auszahlungslogik sind vollständig gebaut. Die endgültige automatische Ermittlung einzelner fachlicher Kennzahlen – insbesondere das persönlich abwesenheitsbereinigte Schüttenziel und die endgültige Auswahl der Distributionsfragen – bleibt bis zur fachlichen Bestätigung der offenen Punkte konfigurations- bzw. datenquellenseitig zu vervollständigen. Die Anwendung darf dabei nicht die fehlerhaften Excel-Formeln übernehmen.

## Noch fachlich zu bestätigen

1. Soll die qualitative Säule im Editor als eine Säule mit drei Teilzielen oder als drei optisch untergeordnete Mini-Säulen erscheinen? Rechnerisch bleibt sie eine 220-€-Säule.
2. Ist „Jack & Coke Kühler“ in Q2 bewusst vom Distributionsdurchschnitt ausgeschlossen?
3. Gilt der +10-%-Zonenbonus in Q2 weiter oder wurde er abgeschafft?
4. Welche Q3-Regeln und Zielwerte sollen als Startkonfiguration verwendet werden?
5. Wie werden Urlaub, Krankheit und Messe künftig aus der SPARK-Zeiterfassung in das persönliche Schüttenziel übernommen?

## Umsetzungs- und Wiederaufnahmecheckliste

- [x] PDF komplett prüfen
- [x] alle Excel-Blätter und Formeln prüfen
- [x] stabile Säulenarchitektur bestimmen
- [x] Quelldateifehler dokumentieren
- [x] aktuelles SPARK-Modell gegen Fachmodell abgleichen
- [x] Backend auf Auszahlungsstufen und Bedingungen je Säule umbauen
- [x] revisionsfähige GM-Säulenergebnisse ergänzen
- [x] Admin-UI von globaler Leiter auf Säulenkonfiguration umbauen
- [x] GM-Anzeige auf unabhängige Säulenfortschritte umbauen
- [x] Unit-/Build-Prüfungen ohne Smoke- oder Live-Datenbanktests ausführen
- [ ] Migration erst nach ausdrücklicher Freigabe anwenden
- [ ] Commit/Push erst nach ausdrücklicher Freigabe
