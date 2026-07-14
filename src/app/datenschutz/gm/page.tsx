import type { Metadata } from "next";
import { PrivacyNotice, type PrivacyNoticeSection } from "../PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutz GM / SM | Coke Spark",
  description: "Datenschutzinformation für Gebietsmanager, Shelf Merchandiser und Field Force in Coke Spark.",
};

const retentionRows = [
  ["GM-/SM-Account und Profil", "Für die Dauer des aktiven Einsatzes. Nach Offboarding wird der Login sofort deaktiviert; Spark-Stammdaten werden grundsätzlich innerhalb von 30 Tagen nach Abschluss der operativen Übergabe anonymisiert, sofern keine offene Prüfung oder gesetzliche Pflicht entgegensteht."],
  ["Marktbesuche, Fragebogenantworten, Kommentare, Tags und Status", "3 Jahre nach Ende des betreffenden Kampagnen- oder RED-Jahres. Danach werden personenbezogene Bezüge gelöscht/anonymisiert, soweit nur noch aggregierte Statistik benötigt wird."],
  ["Besuchsfotos, Fotometadaten und Foto-Tags", "3 Jahre nach Ende des betreffenden Kampagnen- oder RED-Jahres. Danach werden Storage-Datei und Metadaten gelöscht, sofern keine Reklamation, Nachweispflicht oder Legal Hold besteht. Offensichtlich private oder sensible Fehlfotos werden nach Prüfung früher entfernt."],
  ["Arbeitszeit, Pausen, Zusatzzeit, Tagesstart/-ende und Kilometerstände", "7 Jahre nach Ende des Kalenderjahres, wenn die Daten für Abrechnung, Diäten, Payroll, Aufwandsersatz oder buchhalterische Nachweise verwendet werden. Rein technische Entwürfe ohne Nachweisfunktion werden früher bereinigt."],
  ["Zeit- und Antwort-Korrekturanfragen", "Zeitanfragen 7 Jahre, wenn sie Arbeitszeit/KM/Abrechnung betreffen. Antwort-/Fragebogenänderungen 3 Jahre gemeinsam mit der jeweiligen Kampagnenhistorie."],
  ["IPP-, KPI-, Bonus- und Prämienwerte", "7 Jahre, soweit Auszahlung, Abrechnung oder buchhalterische Nachweise betroffen sind; sonst 3 Jahre für Qualitätssicherung und Reporting."],
  ["Login-, Auth-, Audit- und Sicherheitslogs", "24 Monate. Incident-relevante Logs werden bis zum Abschluss der Untersuchung und danach bis zu 3 Jahre oder im Legal Hold aufbewahrt."],
  ["Technische Telemetrie und Fehlerlogs", "Detaildaten grundsätzlich 90 Tage. Aggregierte technische Statistiken höchstens 12 Monate."],
  ["Excel-, Foto- und sonstige Exporte", "Arbeitskopien sind nach Zweckerfüllung zu löschen, grundsätzlich innerhalb von 30 Tagen, außer sie werden in einem freigegebenen geschützten Ablageort als Nachweis mit eigener Frist gespeichert."],
  ["Akzeptanz der Nutzungs-/Kontrollvereinbarung", "Für die Dauer des Einsatzes plus 3 Jahre als Nachweis der Information und Zustimmung, länger nur bei Streitfall, Prüfung oder Legal Hold."],
  ["Frag-Kurti-Unterhaltung", "Chatnachrichten werden in Coke Spark 15 Minuten nach der letzten erfolgreichen Unterhaltung gelöscht. Während dieses aktiven Fensters können berechtigte interne Admins den Verlauf über den ebenfalls strikt lesenden Admin-Kurti für konkrete Support-, Qualitäts- oder Fehlerklärungsfälle abrufen; dieser Zugriff verlängert die Frist nicht. Für die Verarbeitung durch den KI-Dienstleister gelten dessen vertragliche Datenkontrollen; standardmäßig können API-Inhalte bis zu 30 Tage in Missbrauchs-/Sicherheitsprotokollen und verschlüsselte Prompt-Cache-Zwischendaten bis zu 24 Stunden verarbeitet werden, sofern keine strengeren Aufbewahrungskontrollen für das API-Projekt aktiviert sind."],
];

const sections: PrivacyNoticeSection[] = [
  {
    title: "1. Verantwortlicher und Kontakt",
    body: [
      "Verantwortlicher: Institut für Verkaufsförderung GmbH, Wagenseilgasse 5, 1120 Wien.",
      "Datenschutz-Anlaufstelle: datenschutz@merch.at.",
      "Diese Information gilt für Gebietsmanager, Shelf Merchandiser und Field-Force-Mitarbeitende, die Coke Spark zur Arbeitsausführung und zum Coca-Cola Reporting verwenden.",
    ],
  },
  {
    title: "2. Zweck von Coke Spark",
    body: [
      "Coke Spark ist ein Arbeitsausführungs- und Reporting-System für die externe Field Force. Die App wird genutzt, um Coca-Cola Retail-Execution-Arbeit zu planen, durchzuführen, nachzuweisen und gegenüber dem Auftraggeber zu berichten.",
      "Verarbeitet werden Daten zur Einsatzplanung, Marktbesuchen, Fragebögen, Foto-Dokumentation, Zeit- und Kilometererfassung, Qualitätssicherung, Fehler-/Missbrauchsvermeidung, Bonus-/Prämienberechnung und zur technischen Absicherung der Plattform.",
      "Coke Spark ersetzt keine private Kommunikation und ist nicht für private Nutzung bestimmt.",
    ],
  },
  {
    title: "3. Welche Daten verarbeitet werden",
    body: [
      "Stammdaten: Name, E-Mail-Adresse, Telefonnummer, Rolle, Region, Accountstatus, interne Zuordnungen, Markt-/Billa-/ID-Filter und zuständige Lager oder Märkte.",
      "Arbeitszeit- und Kilometerdaten: Start und Ende des Arbeitstags, Pausen, Zusatzzeiten, manuelle Korrekturen, Kilometerstände, Heimfahrt/Anfahrt und Zeitverlaufsdaten.",
      "Marktbesuchsdaten: zugewiesene Märkte, Kampagnen, Fragebögen, Start- und Endzeit von Besuchen, Antworten, Kommentare, Tags, Fotos, Fotometadaten, eingereichte Korrekturanfragen und Abschlussstatus.",
      "Auswertungsdaten: Besuchsfortschritt, IPP-/Qualitätskennzahlen, Prämien-/Bonusfortschritt, RED-Month-Zuordnung, Dashboard-Kennzahlen und Exportdaten.",
      "Technische Daten: Login- und Sicherheitsereignisse, Sessiondaten, Geräte-/Browserinformationen, IP-Adresse, Fehlerprotokolle und Telemetrie, soweit dies für Betrieb, Sicherheit und Fehleranalyse erforderlich ist.",
    ],
  },
  {
    title: "4. Wer welche Daten sehen kann",
    body: [
      "Du selbst siehst deine eigenen Arbeits-, Besuchs- und Profilinformationen innerhalb der App.",
      "Berechtigte interne Admins, verantwortliche Manager und Abrechnungs-/HR-nahe Stellen sehen Daten, soweit dies für Einsatzsteuerung, Arbeitszeitnachweise, Qualitätssicherung, Support, Korrekturen, Prämien oder Abrechnung erforderlich ist.",
      "Freigeschaltete Coca-Cola Kunden-Zugänge erhalten nur Zugriff auf Reporting-Inhalte, die für die beauftragte Kampagnen- und Marktberichterstattung erforderlich sind. Dazu können Marktstatus, Antworten, Fotos, Tags, Kampagnenfortschritt, Auswertungen und die für Rückfragen notwendige namentliche Zuordnung zu dir gehören.",
      "Coca-Cola Kunden-Zugänge erhalten im vorgesehenen Setup keinen Zugriff auf deine internen Arbeitszeit-, Kilometer-, Bonus-/Prämien-, HR-, Payroll- oder Sicherheits-/Auditdetails.",
      "Technische Dienstleister verarbeiten Daten nur im Rahmen des Betriebs, Hostings, der Authentifizierung, Speicherung, E-Mail-Funktionen, Fehleranalyse oder Sicherheit.",
    ],
  },
  {
    title: "5. Rechtsgrundlagen",
    body: [
      "Art. 6 Abs. 1 lit. b DSGVO: Verarbeitung zur Durchführung des Arbeits-, Dienst- oder Einsatzverhältnisses, insbesondere Planung, Durchführung und Nachweis der Field-Force-Leistung.",
      "Art. 6 Abs. 1 lit. c DSGVO: Verarbeitung zur Erfüllung gesetzlicher Pflichten, insbesondere Arbeitszeitaufzeichnungen und gesetzlich erforderliche Nachweise.",
      "Art. 6 Abs. 1 lit. f DSGVO: berechtigte Interessen an Auftragserfüllung gegenüber Coca-Cola, Qualitätssicherung, Reporting, Sicherheit, Fehler-/Missbrauchsvermeidung, Nachvollziehbarkeit, Support und Schutz vor falschen oder widersprüchlichen Eingaben.",
      "Art. 88 DSGVO und anwendbares österreichisches Arbeitsrecht sind zu berücksichtigen, soweit personenbezogene Daten im Beschäftigungskontext verarbeitet werden.",
      "Einwilligung ist nicht die primäre Rechtsgrundlage für die normale Nutzung von Coke Spark. Falls einzelne freiwillige Funktionen eine Einwilligung erfordern, wird dies gesondert ausgewiesen.",
    ],
  },
  {
    title: "6. Empfänger und Dienstleister",
    body: [
      "Interne Empfänger sind nur berechtigte Rollen, die die Daten für ihre Aufgabe benötigen.",
      "Externe Empfänger können Coca-Cola bzw. freigeschaltete Kunden-Zugänge sein, soweit die Daten für vereinbartes Reporting, Kampagnenkontrolle, Foto-/Antwortnachweise oder Rückfragen benötigt werden. Diese Kunden-Zugänge sind als lesende Reporting-Zugänge vorgesehen.",
      "Auftragsverarbeiter können insbesondere für Datenbank, Authentifizierung, Speicherung, Hosting, Deployment, E-Mail-Versand, Logging und Infrastruktur eingesetzt werden. Die konkrete Liste der Anbieter und Unterauftragsverarbeiter wird intern dokumentiert.",
    ],
  },
  {
    title: "7. Speicherdauer",
    body: [
      "Die folgenden Fristen sind die Coke-Spark-Regel für operative App-Daten. Längere Speicherung ist nur zulässig, wenn gesetzliche Aufbewahrungspflichten, offene Ansprüche, Prüfungen, Sicherheitsvorfälle oder ein dokumentierter Legal Hold dies erfordern.",
      "Wenn dein aktiver Einsatz endet und deine operative Spark-Identität nicht mehr benötigt wird, wird dein Spark-Nutzerstammdatensatz anonymisiert. Name, E-Mail-Adresse, Telefon, Adresse, PLZ/Ort, Region, Profilfoto und Loginbezug werden entfernt oder durch neutrale Platzhalter ersetzt.",
      "Historische Marktbesuche, Antworten, Fotos, Zeit- und Kilometerdaten bleiben nur so lange personenbezogen, wie dies nach der folgenden Tabelle nötig ist. Danach werden sie gelöscht oder anonymisiert; separate HR-/Payroll-Unterlagen außerhalb von Spark können aufgrund gesetzlicher Pflichten länger personenbezogen aufbewahrt werden.",
    ],
    table: {
      columns: ["Datenkategorie", "Regel / Frist in Spark"],
      rows: retentionRows,
    },
  },
  {
    title: "8. Arbeitszeitaufzeichnung, Einsicht und Korrektur",
    body: [
      "Coke Spark dokumentiert Arbeitszeiten für die gesetzlich und betrieblich erforderliche Arbeitszeitaufzeichnung. Dazu gehören insbesondere Beginn und Ende des Arbeitstags, Tages- und Wochenarbeitszeit, Pausen, Zusatzzeiten, Marktbesuche, Fahrtzeiten, Kilometerstände und nachträglich freigegebene Korrekturen.",
      "Du kannst deine eigenen Zeiterfassungsdaten in der GM-Zeiterfassungsseite einsehen. Wenn ein Eintrag falsch ist, kannst du dort eine Änderung anfragen.",
      "Bei einer Zeitanfrage werden ursprüngliche Zeit, beantragte neue Zeit, Grund/Notiz, Antragsteller, Prüfstatus und Prüfentscheidung gespeichert. Bis zur Freigabe bleibt der ursprüngliche Eintrag maßgeblich; nach Freigabe wird die neue Zeit für Anzeige, Auswertung und Export verwendet.",
      "Berechtigte interne Admins, verantwortliche Manager oder Abrechnungs-/HR-nahe Stellen dürfen Arbeitszeitdaten sehen, korrigieren oder freigeben, soweit dies für Arbeitszeitnachweis, Abrechnung, Kontrolle, Support oder Fehlerkorrektur erforderlich ist. Coca-Cola Kunden-Zugänge erhalten keinen Zugriff auf diese Arbeitszeit-, KM- oder HR-internen Daten.",
    ],
  },
  {
    title: "9. Fotos und Inhalte aus Märkten",
    body: [
      "Fotos dienen als Arbeits- und Kampagnennachweis. Es sollen nur markt- und kampagnenrelevante Inhalte fotografiert werden.",
      "Personen, private Unterlagen, sensible Informationen oder unnötige personenbezogene Details sollen nicht fotografiert werden. Falls solche Inhalte versehentlich erfasst werden, kann eine Löschung oder Einschränkung geprüft werden.",
      "Fotos können mit Frage, Kampagne, Markt, Tags, Uploadzeitpunkt und Nutzerbezug gespeichert werden, damit sie korrekt zugeordnet und ausgewertet werden können.",
      "Coca-Cola Kunden-Zugänge können freigegebene Fotos und Antworten für Reporting- und Nachweiszwecke einsehen oder exportieren. Interne Zeit-, KM-, Bonus- oder HR-Daten werden dadurch nicht offengelegt.",
    ],
  },
  {
    title: "10. KI-Assistent Frag Kurti",
    body: [
      "Frag Kurti ist eine freiwillig nutzbare Lese-, Navigations- und Supporthilfe. Kurti kann keine Einträge ändern, nichts absenden und keine Personal-, Bonus-, Prämien- oder sonstige Entscheidung treffen. Maßgeblich bleiben die in Coke Spark gespeicherten Daten und die Prüfung durch berechtigte interne Stellen.",
      "Bei einer Nachricht werden der Chattext, der bisherige noch aktive 15-Minuten-Chatverlauf und ein begrenzter Kontext aus deinen eigenen Spark-Daten an die OpenAI Responses API übermittelt. Dieser Kontext kann eigene Profilangaben, Arbeitszeit-/KM-Zusammenfassungen, eigene Besuche, aktuelle Kampagnen, offene eigene Fragebögen, eigene Anfragestatus sowie den Status dieser Datenschutz-/Nutzungsinformation enthalten.",
      "Kurti erhält keine Daten anderer GMs, keine Admin-Inhalte, keine Kunden-Zugangsdaten, keine Passwörter oder Tokens, keine technischen Rohlogs und keine direkten Datenbankzugriffe. Bitte gib auch selbst keine Passwörter, Tokens, privaten Unterlagen, Gesundheitsdetails oder andere für die Arbeitsfrage unnötige sensible Informationen in den Chat ein.",
      "Berechtigte interne Admins können deinen noch aktiven Kurti-Verlauf innerhalb desselben 15-Minuten-Fensters über Admin-Kurti lesen, wenn dies für einen konkreten Support-, Qualitäts- oder Fehlerklärungsfall erforderlich ist. Kunden-Zugänge erhalten keinen Zugriff auf diese Chats. Der Admin-Zugriff verlängert die Frist nicht; abgelaufene Nachrichten werden nicht für spätere Suche aufbewahrt.",
      "OpenAI wird als technischer KI-Dienstleister eingesetzt. Die Responses API wird mit deaktivierter Anwendungsspeicherung (store=false) verwendet. Nach den OpenAI API-Datenkontrollen werden API-Inhalte nicht zum Training verwendet, außer der Verantwortliche stimmt einer solchen Nutzung ausdrücklich zu. Davon getrennt können Inhalte standardmäßig bis zu 30 Tage in Missbrauchs-/Sicherheitsprotokollen und verschlüsselte Prompt-Cache-Zwischendaten bis zu 24 Stunden verarbeitet werden; für freigeschaltete Projekte können strengere Modified-Abuse-Monitoring- oder Zero-Data-Retention-Kontrollen gelten.",
      "Die Kurti-Unterhaltung wird in Coke Spark 15 Minuten nach der letzten erfolgreichen Unterhaltung automatisch gelöscht. Kurti-Antworten können fehlerhaft oder unvollständig sein und ersetzen weder eine verbindliche Auskunft von Denise/Doris noch eine Datenschutz- oder Rechtsberatung.",
    ],
  },
  {
    title: "11. Automatisierte Auswertungen",
    body: [
      "Coke Spark berechnet Kennzahlen wie Besuchsfortschritt, IPP, Prämien-/Bonusfortschritt, Zeitverläufe und Kampagnenstatus.",
      "Soweit Kennzahlen Auswirkungen auf Prämien, Qualität oder operative Beurteilung haben, müssen sie intern nachvollziehbar und korrigierbar bleiben. Es ist keine ausschließlich automatisierte finale Entscheidung vorgesehen, die ohne menschliche Prüfmöglichkeit rechtliche oder vergleichbar erhebliche Wirkung entfaltet.",
    ],
  },
  {
    title: "12. Rechte",
    body: [
      "Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Bestimmte Daten können wegen gesetzlicher Aufbewahrungspflichten, Arbeitszeitnachweisen, Nachweisinteressen oder berechtigter Dokumentation nicht sofort gelöscht werden; in solchen Fällen kann eine Einschränkung oder Sperrung geprüft werden.",
      "Anfragen werden intern dokumentiert, die Identität wird geprüft und die Antwort erfolgt grundsätzlich innerhalb eines Monats. Wenn eine Anfrage besonders komplex ist, kann die Frist nach DSGVO verlängert werden; du erhältst dann eine Begründung.",
      "Die interne Bearbeitung erfolgt über die Datenschutzanfragen-Übersicht: Eingang, Frist, verantwortliche Person, Identitätsprüfung, Datenpaket, Entscheidung und Antwort werden dort nachvollziehbar dokumentiert.",
      "Berichtigungen sind über die vorgesehenen Korrekturprozesse möglich. Bei Löschung oder Einschränkung wird geprüft, ob gesetzliche Arbeitszeit-, Abrechnungs-, Nachweis- oder Reportingpflichten entgegenstehen.",
      "Es besteht das Recht auf Beschwerde bei der österreichischen Datenschutzbehörde: dsb.gv.at.",
    ],
  },
  {
    title: "13. Sicherheit und Datenschutzvorfälle",
    body: [
      "Coke Spark nutzt rollenbasierte Zugriffe, serverseitige Berechtigungsprüfungen, private Speicherbereiche, signierte Datei-URLs, Protokollierung und eine backend-only Datenbankzugriffsarchitektur.",
      "Direkte anonyme oder normale Client-Zugriffe auf die Datenbanktabellen sind nicht vorgesehen. Geschäftsdaten werden über die autorisierte Backend-API verarbeitet.",
      "Wenn ein möglicher Datenschutz- oder Sicherheitsvorfall auffällt, muss er sofort intern gemeldet werden. Das zuständige Team sichert Logs und Beweise, bewertet Risiko und Umfang, begrenzt den Vorfall und entscheidet über Meldepflichten.",
      "Wenn nach DSGVO erforderlich, wird die österreichische Datenschutzbehörde grundsätzlich binnen 72 Stunden ab Bekanntwerden informiert. Betroffene Personen werden informiert, wenn voraussichtlich ein hohes Risiko für ihre Rechte und Freiheiten besteht.",
    ],
  },
];

export default function GmDatenschutzPage() {
  return (
    <PrivacyNotice
      eyebrow="Datenschutz · GM / SM"
      title="Datenschutzinformation für Field Force"
      subtitle="Informationen zur Verarbeitung personenbezogener Daten von Gebietsmanagern, Shelf Merchandisern und Field-Force-Mitarbeitenden in Coke Spark."
      audienceLabel="Beschäftigten- und Arbeitsausführungsdaten"
      sections={sections}
      backHref="/gm/profil"
    />
  );
}
