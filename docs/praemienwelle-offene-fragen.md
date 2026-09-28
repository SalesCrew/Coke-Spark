# Prämienwelle – offene Fragen

Stand: 28.09.2026. Nutzerantworten eingearbeitet. [Umsetzungsplan](praemienwelle-umsetzungsplan.md), [Quellen und Regeln](praemienwelle-quellen-und-regeln.md).

## Die fünf bisherigen Fragen sind beantwortet

| Nr. | Antwort | Konsequenz |
| --- | --- | --- |
| 1 | Quartalsziele werden eingestellt | Frei konfigurierbare Komponenten statt fester Q3-Regeln. Keine erneute Nachfrage nach einer Q3-Tabelle als Voraussetzung der Planung |
| 2 | Regeln/Ziele **und** zusätzliche manuelle Werte sauber im UI | Einheitlicher Säuleneditor und GM-Messgrößeneditor; automatische Daten bleiben sichtbar, Korrekturen separat |
| 3 | Beträge aus vorhandenen Unterlagen zusammentragen | Q1-/Q2-Stufen rekonstruiert. 86,50 € nicht als neue freigegebene Rate belegt; historische 82,50 € nur in entsprechender Vorlage |
| 4 | Alle | Alle echten GMs, keine Demoliste/Teilnehmerauswahl. Historie inaktiver GMs erhalten |
| 5 | Ja | Laufende Wellen neu rechnen, abgeschlossene Regeln und Ergebnisse einfrieren |

Aktueller Auftrag: lokal implementieren und isoliert prüfen, nicht pushen. Die konfigurierbare/manuelle Auswertung ist umgesetzt; die folgenden Fragen betreffen fachliche Einrichtung bzw. zusätzliche Automatik. Produktionsdaten und SIMPL-Karten bleiben unverändert. Mailentwurf: `praemienwelle-mail-an-doris.md`.

## Vorschläge, die keine neue Klärung voraussetzen

- Leaderboard mit „Dieses Quartal / Gesamt“; Gesamt summiert abgeschlossene Wellen. Das ist ein UI-Vorschlag, weil „alle“ die Personen und nicht die Zeitspanne beantwortet.
- Übererfüllung erhalten, aber keine unbegrenzte oder lineare Mehrprämie: konfigurierte Stufen und Maximum sind maßgeblich.
- Einfaches Ziel als Prozentwert; zusammengesetztes Ziel mit getrennten Komponenten und eigenen Einheiten. Kein Gesamtwert überschreibt alle Komponenten.
- Unbekannte automatische Werte bleiben offen/nicht auswertbar. Bewusste 0, automatische Berechnung und manuelle Bewertung bleiben getrennte Zustände.
- Belegte frühere Vorlagen auswählbar; jedes neue Quartal als Entwurf prüfen. Keine alte Excel-Formel ungeprüft als Regel übernehmen.

## Was für eine vollständige automatische Bewertung noch definiert werden muss

Diese Lücken blockieren den Konfigurations-/Manuell-Plan nicht. Bis zur eindeutigen Datenquelle keine automatische Zahl behaupten.

### Qualität

Gefunden: Q1-Zeitmanagement ab durchschnittlich 11 Minuten Abweichung/Tag 50 %, ab 25 Minuten 0 %; Reporting bis Samstag in Sara; richtige Bildertags. Maxima 110/55/55 €.

Nicht gefunden: genaue Vergleichsbasis der Zeitabweichung, relevante Tage, Behandlung fehlender Erfassung, verbindliche technische Reporting-Deadline und auswertbare Sara-Daten, Methode zur Prüfung „richtiger“ Tags.

Kurze spätere Einrichtungsfragen, falls diese Kriterien automatisch werden sollen:

1. „Womit vergleichen wir die Zeitabweichung – und zählt da SARA oder die SPARK-Zeiterfassung?“
2. „Soll die Samstagsfrist weiterhin für SARA gelten oder für die Abgabe in SPARK? Falls SARA: Welche Auswertung bekommen wir dafür?“
3. „Wer bewertet, ob die Bildertags richtig sind? Gibt es dazu eine feste Liste oder bleibt das eure Bewertung?“

Bis dahin manuelle Prozentbewertung pro Teilziel; nicht pauschal aus Dauer oder Tag-Anzahl automatisch ableiten.

### Platzierungen und Bestände

Gefunden: keine doppelte Displayzählung pro Markt bei wiederholten Quartalsbesuchen; Q1-Flex nur neue Platzierungen; Q2-Kühler netto. Q3 nennt permanente Racks, aber keine vollständige Datendefinition.

Einrichtungsfrage nur bei automatischem Rack-/Displayziel: „Zählt der vorhandene Bestand oder nur neu aufgestellte Platzierungen – und woran erkennen wir dieselbe Platzierung beim zweiten Besuch?“

Die normale Besuchsantwort hat heute nicht durchgehend eine eindeutige Platzierungs-/Ereignis-ID. Deshalb keine sichere Neuplatzierungssumme allein aus wiederholtem Bestand erfinden. Zählregel sichtbar konfigurieren; bei fehlendem Nachweis manuell bewerten.

### Unterschiedliche alte Regeln

- Q1 nennt Zonenbonus +10 %, Q2-Formel nicht. Vorlagen getrennt; gewünschter Faktor wird je Welle eingestellt.
- Q2-Mittelwert enthält neun Distributionsquoten, nicht alle zehn vorhandenen. Produktauswahl und Bezugsmenge im Editor zeigen; nicht heimlich Jack&Coke-Kühler hinzufügen.
- Quellen beantworten das frühere Modell; neue Quartalsbeträge/Grenzen werden bewusst eingerichtet. Keine zusätzliche Zahlen-Nachfrage nötig, solange das Ziel manuell konfiguriert wird.
