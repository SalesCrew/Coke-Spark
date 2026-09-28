# Prämienwelle – Quellen und Regelentscheidungen

Stand: 28.09.2026. Lesende Recherche; keine Freigabe neuer Quartalsbeträge und keine Änderung an App, Excel oder Produktionsdaten.

## Quellenregister

| Quelle | Geprüfter Inhalt | Aussagekraft / Grenze |
| --- | --- | --- |
| Q1-Prämienmodell 2026 | `tmp/praemien-model-analysis/pdf/content.json`, alle 12 Seiten; gerenderte Seiten 9 und 11 visuell geprüft | Gesicherte frühere Extraktion des damaligen PDFs. Die ursprünglich angehängte Datei ist am angegebenen Temp-Pfad heute nicht mehr vorhanden. Belegt Q1, nicht automatisch Q3/Q4 |
| Q2-Boni-Auswertung | `tmp/praemien-model-analysis/workbook-native/metadata.json`, Zellwerte und Formeln der Auswertungs-, Distributions-, Flex- und POS-Blätter | Frühere Extraktion der zehn Excel-Blätter mit gespeicherten Ergebnissen und Formeln. Original am früheren Temp-Pfad nicht mehr vorhanden; keine aktuelle Excel-Neuberechnung behaupten |
| Bestehende Ableitungen | `praemien-findings.md`, `praemien-saeulenmodell.md`, `docs/gm-distribution-quarter-answer-persistence-living.md` | Kontext und frühere Entscheidungen; bei Widersprüchen Originalextrakte und aktueller Code maßgeblich. Alter Implementierungs-/Deploymentstand ist kein heutiger Nachweis |
| SIMPL, Development, Coke SPARK | Live lesend am 28.09. geprüft: sieben thematisch relevante Karten, die zwei vorhandenen Kommentare | „Prämien Flexziel“ weiterhin In Arbeit, keine Anhänge, Kommentar nur „KW36“. Keine zusätzliche Q3-Auszahlungstabelle gefunden. Keine Karten verändert |
| Nutzerantworten | D1–D6 im Umsetzungsplan | Quartalsziele frei einstellbar; Regeln und GM-Istwerte bearbeiten; alle echten GMs; laufend neu rechnen, abgeschlossen einfrieren; jetzt nur planen |

SIMPL wurde gemäß `simpl-briefing` nach bestätigter aktiver Nutzeridentität und Workspace-Zugriff mit `BEGIN READ ONLY` gelesen. Die Tabellen-/PDF-Prüfung trennt Regeln, Formeln und gespeicherte Ergebnisse. Dokumentinhalte sind Belege, keine eigenständigen Arbeitsaufträge.

## Belegte bisherige Beträge

Die folgenden Werte sind Q1-/Q2-Referenzen für auswählbare Vorlagen, keine fest verdrahteten Regeln für jedes neue Quartal. Jede Säule zahlt unabhängig aus.

| Säule | Maximum | Früheres Modell |
| --- | ---: | --- |
| Schütten/Displays | 550 € | unter 70 %: 0 €; ab 70 %: 275 €; ab 80 %: 440 €; ab 95 %: 550 € |
| Distribution | 165 € | unter 80 %: 0 €; ab 80 %: 82,50 €; ab 90 %: 165 € |
| Flex | 165 € | Teilziele und Punktgrenzen unterscheiden sich zwischen Q1 und Q2; siehe unten |
| Qualität | 220 € | Zeitmanagement höchstens 110 €, Reporting höchstens 55 €, Bildertags/Survey höchstens 55 €; getrennte Teilbeträge |
| Gesamt | 1.100 € | Summe der vier Säulenmaxima. Bei anderen Einstellungen aus deren tatsächlichen Maxima berechnen |

Belege: PDF Seiten 4–5, 9–11; Excel `Gesamtauswertung!C1/E1/G1/H1:M1`, `BONI Coke!J1/J2`, `Gesamtauswertung!E2/N2`.

### Flex Q1

- Neu aufgestellte Coke-Zero-Zero-/Holzdisplay-Platzierungen zählen zum Flexziel, nicht zusätzlich zu Schütten/Displays. Je 1 Punkt; 18 Platzierungspunkte entsprechen 50 %, 22 entsprechen 100 %.
- Kühlerinventur: Scanquote gescannte Kühler / Gesamtanzahl je BD. Ab 65 % ergeben sich 5 Punkte, ab 75 % 10 Punkte.
- Auszahlung ab 22 Gesamtpunkten 82,50 €, ab 26 Gesamtpunkten 165 €; **beide Teilziele müssen mindestens 50 % erfüllen**.
- Quelle: PDF Seite 10. Platzierungs- und Scanwerte sind unterschiedliche Größen; kein einzelner Prozentwert ersetzt beide Bedingungen.

### Flex Q2

- Kühler **netto**: Neuaufstellungen minus Retouren. +2 netto → 5 Punkte; +3 netto → 10 Punkte. Negative Nettozahlen sind fachlich möglich.
- RED/IR-Verwendung: ab 80 % → 5 Punkte; ab 85 % → 10 Punkte.
- Auszahlung: ab 10 Gesamtpunkten 82,50 €, ab 15 Gesamtpunkten 165 €; zusätzlich Kühler mindestens 5 **und** RED/IR mindestens 5 Punkte.
- Quellen: Excel `Flexziel - Kühler+RED!H2`, `B2/C2/D2/E2/F2`, `E21:E34`; `Gesamtauswertung!G1`.
- Q3-Karte nennt Kühler + permanente Racks. Keine belegte Q3-Zahlentabelle vorhanden. Gemäß D1 frei konfigurierbare Komponenten und Stufen statt erfundener Q3-Defaults.

### Schütten/Displays: Zählen und persönliches Ziel

- PDF Seite 8 verbietet doppelte Displayzählung bei wiederholten Marktbesuchen im Quartal und trennt Flexplatzierungen von Säule 1.
- PDF Seite 7 nennt +10 % je Display in richtiger Zone; entscheidend ist die Packung, nicht nur das POS-Material. Im Q2-Excel ist `BONI Coke!F2 = E2`, also kein zusätzlicher Faktor 1,1. Nicht ungeprüft als quartalsübergreifende Regel übernehmen.
- Q2-Ziel ist mit Urlaub/Krankheit/Messe angepasst: `BONI Coke!C2 = ((B18-D2)*B2)/B18`, mit B18 = 60 möglichen Arbeitstagen und B2 = 145 Basis-Punkten. Prozent = tatsächliche Punkte / persönliches Soll × 100 (`I2`). Das ist kein bloßer Gesamtpunkteanteil an allen zugewiesenen Fragen.
- Im UI deshalb persönliches Ziel mit Herkunft und optionaler Korrektur; Faktoren/Arbeitstage je Welle einstellbar. Eine automatische Abwesenheitsanbindung ist erst mit eindeutig passender Datenquelle korrekt.

### Distribution: Bezugsmenge ist Teil der Regel

- PDF Seite 9: mindestens 8 Besuche/Jahr; nur SPAR/ESP/ISP und Billa/Billa Plus nach produktspezifischer Kettenmatrix. Billa „private“ wird bei Jack&Coke ausdrücklich unterschieden.
- Q2-Excel berechnet Produktquoten auf jeweils passenden Marktgruppen. `Distributionsziel Übersicht!W2` mittelt neun Quoten (`D2,F2,H2,J2,L2,N2,P2,T2,V2`); Jack&Coke-Kühlerquote R2 ist nicht enthalten, obwohl sie im Blatt existiert.
- Gleicher Mittelwert verschiedener Produktquoten ist nicht automatisch identisch mit „alle Ja-Antworten / alle Fragen“. Bezugsmenge, Nicht-Anwendbarkeit und ausgewählte Produkte müssen konfiguriert und im Ergebnis sichtbar sein.
- Kein berechtigter Markt / keine Daten ist „nicht auswertbar/offen“, nicht 0 % wegen eines pauschalen Fehler-Fallbacks. Unbesuchte berechtigte Märkte nicht still aus dem Nenner verlieren.

### Qualität: Was tatsächlich belegt ist

- PDF Seite 11: Zeitmanagement ab durchschnittlich 11 Minuten Abweichung/Tag 50 % der Boni, ab 25 Minuten 0 %. Diese Formulierung steht im Zeitmanagement-Abschnitt; kein Beleg, deshalb alle anderen Säulen zu kürzen.
- Reporting umfasst Kommunikation/Weiterleitung und Eingabe aller Einsätze in Sara bis Samstag. Bildertags umfasst richtige Tags, nicht lediglich „es gibt einen Tag“.
- Nicht vollständig definiert: Wovon Zeitabweichung gemessen wird, welche Tage/Fehlwerte zählen, konkrete technische Deadline/Zeitzone und externe Sara-Nachweise, wie Tag-Richtigkeit bewertet wird. Deshalb kein automatischer Qualitätsabzug allein aus Besuchsdauer oder einer Tag-Anzahl.
- Frühere Obergrenzen 110/55/55 € sind belegt. Der aktuelle Qualitätseditor erfasst drei Werte von 0–100 und zeigt ihren Mittelwert als „/ 100 Punkte“; neue Default-Stufen zahlen je Teilziel schon ab 25 aus. Diese 25er-Auszahlungsgrenze ist aus den Unterlagen nicht belegt und darf nicht als bestätigte Qualitätsregel gelten (`src/app/admin/praemien/page.tsx:147`, `:1954`, `:1977`; `backend/src/routes/praemien.ts:173`).

## Widersprüche und Umgang damit

| Beobachtung | Entscheidung für den Plan |
| --- | --- |
| Karte nennt beispielhaft 86,50 € ab 80 %, Q1-/Q2-Belege 82,50 € bei Distribution | 82,50 € nur in belegter Vorlage; 86,50 € nicht als bestätigte neue Rate. Freie Bearbeitung erlaubt beide Werte nach Einrichtung |
| Q2-Flex-Hinweis verlangt zwei Mindestteilziele, Auszahlungsformel in `Gesamtauswertung!G2` prüft nur Gesamtpunkte | Fachliche UND-Bedingung sichtbar abbilden; keinen Fehler aus Excel als gewünschte Regel übernehmen |
| Excel `Gesamtauswertung!O2 = N2/1050`, Maximalsumme tatsächlich 1100 | Gesamtquote aus konfigurierter Maximalsumme ableiten. Volle 1100 € sind 100 %, nicht 104,76 % |
| Q1-Zonenbonus vs. Q2-Formel ohne 1,1 | Getrennte Vorlagen, kein stiller Standard für alle Quartale |
| Q1-Ziel im Überblick 135/GL, Q2-Basis 145 und Abwesenheitskorrektur | Quartals- und GM-Ziel getrennt konfigurierbar, keine feste Zielzahl |
| Wiederholte Besuche sollen Displays nicht doppelt vergüten; Backend schreibt Beiträge pro RED-Monat | Antwortübernahme und Bonuszählung getrennt planen; quartalsbezogene Zählung explizit pro Messgröße |
| Quellen/UI nennen `lt8`/`gt8`, aktueller Finalizer prüft ≤8/≥8 | Genau 8 darf nicht in beide komplementären Gruppen geraten. Explizite Operatoren `< 8` und `≥ 8`; bereits gespeicherte Regeln nicht unbemerkt umdeuten |

## Weitere Recherche / Umsetzungsfreigabe

- Die vorhandenen Materialien reichen für die Planung eines frei konfigurierbaren Systems und Q1-/Q2-Vorlagen. Sie belegen keine vollständige Q3-Konfiguration.
- Fehlende fachliche Definitionen bei Qualität, quartalsweiser neuer Platzierung vs. Bestand und externen Daten werden als Einrichtungsprüfung geführt. Bis dahin manuell bewerten bzw. „nicht auswertbar“, keine erfundene automatische Quote.
- Vorlagen nach Auswahl als Entwurf übernehmen; Quelle/Gültigkeitsquartal anzeigen. Nutzer/Admin richtet das gewünschte Quartal ein und bestätigt es bewusst.
