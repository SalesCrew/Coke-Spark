import type { Metadata } from "next";
import { PrivacyNotice, type PrivacyNoticeSection } from "../PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutz Admin / Kunde | Coke Spark",
  description: "Datenschutzinformation für Admins, verantwortliche Manager und Kunden-Zugänge in Coke Spark.",
};

const retentionRows = [
  ["Admin-/Kunde-Account, Rollen und Rechte", "Für die Dauer des aktiven Zugangs. Nach Wegfall des Zwecks wird der Zugang sofort deaktiviert; Stammdaten werden grundsätzlich innerhalb von 30 Tagen nach Abschluss der Übergabe gelöscht oder anonymisiert, sofern keine Prüfung oder gesetzliche Pflicht entgegensteht."],
  ["Marktbesuche, Fragebogenantworten, Kommentare, Tags und Status", "3 Jahre nach Ende des betreffenden Kampagnen- oder RED-Jahres. Danach werden personenbezogene Bezüge gelöscht/anonymisiert, soweit nur noch aggregierte Statistik benötigt wird."],
  ["Besuchsfotos, Fotometadaten und Foto-Tags", "3 Jahre nach Ende des betreffenden Kampagnen- oder RED-Jahres. Danach werden Storage-Datei und Metadaten gelöscht, sofern keine Reklamation, Nachweispflicht oder Legal Hold besteht. Offensichtlich private oder sensible Fehlfotos werden nach Prüfung früher entfernt."],
  ["Arbeitszeit, Pausen, Zusatzzeit, Tagesstart/-ende und Kilometerstände", "7 Jahre nach Ende des Kalenderjahres, wenn die Daten für Abrechnung, Diäten, Payroll, Aufwandsersatz oder buchhalterische Nachweise verwendet werden. Diese Daten gehören nicht in Coca-Cola Kundenansichten oder Kundenexporte."],
  ["Zeit- und Antwort-Korrekturanfragen", "Zeitanfragen 7 Jahre, wenn sie Arbeitszeit/KM/Abrechnung betreffen. Antwort-/Fragebogenänderungen 3 Jahre gemeinsam mit der jeweiligen Kampagnenhistorie."],
  ["IPP-, KPI-, Bonus- und Prämienwerte", "7 Jahre, soweit Auszahlung, Abrechnung oder buchhalterische Nachweise betroffen sind; sonst 3 Jahre für Qualitätssicherung und Reporting. Kunden sehen nur freigegebene Reportingwerte, keine internen HR-/Payrolldetails."],
  ["Login-, Auth-, Audit- und Sicherheitslogs", "24 Monate. Incident-relevante Logs werden bis zum Abschluss der Untersuchung und danach bis zu 3 Jahre oder im Legal Hold aufbewahrt."],
  ["Technische Telemetrie und Fehlerlogs", "Detaildaten grundsätzlich 90 Tage. Aggregierte technische Statistiken höchstens 12 Monate."],
  ["Admin- und GM-Kurti Chat", "Admin-Kurti-Nachrichten werden in Coke Spark 8 Stunden nach der letzten erfolgreichen Admin-Unterhaltung automatisch gelöscht. GM-Kurti-Nachrichten werden weiterhin nach 15 Minuten gelöscht. Admin-Kurti kann einen noch aktiven GM-Verlauf für konkrete berechtigte Support-, Qualitäts- oder Fehlerklärungsfälle lesen; der Zugriff verlängert die GM-Frist nicht. Die technische Verarbeitung durch den KI-Dienst erfolgt nach den dort vereinbarten API-Datenkontrollen; unnötige personenbezogene oder sensible Angaben sollen nicht eingegeben werden."],
  ["Excel-, Foto- und sonstige Exporte", "Arbeitskopien sind nach Zweckerfüllung zu löschen, grundsätzlich innerhalb von 30 Tagen, außer sie werden in einem freigegebenen geschützten Ablageort als Nachweis mit eigener Frist gespeichert."],
  ["Akzeptanz- und Datenschutz-Nachweise", "Für die Dauer des Zugangs plus 3 Jahre als Nachweis der Information, länger nur bei Streitfall, Prüfung oder Legal Hold."],
];

const sections: PrivacyNoticeSection[] = [
  {
    title: "1. Verantwortlicher und Kontakt",
    body: [
      "Verantwortlicher: Institut für Verkaufsförderung GmbH, Wagenseilgasse 5, 1120 Wien.",
      "Datenschutz-Anlaufstelle: datenschutz@merch.at.",
      "Diese Information gilt für interne Admins, verantwortliche Manager, Kunden-/Coca-Cola-Zugänge und sonstige berechtigte Nutzerinnen und Nutzer der Admin- oder Reporting-Oberflächen von Coke Spark.",
    ],
  },
  {
    title: "2. Zweck der Admin- und Kunden-Zugänge",
    body: [
      "Admin-Zugänge dienen der Verwaltung von Nutzern, Märkten, Lagern, Kampagnen, Fragebögen, RED-Month-Zeiträumen, Auswertungen, Fotos, Zeiterfassung, Prämien und Exporten.",
      "Kunden-/Coca-Cola-Zugänge dienen ausschließlich dem vereinbarten Read-only Reporting: Coca-Cola kann freigeschaltete Markt-, Kampagnen-, Antwort-, Foto- und Auswertungsdaten einsehen und, soweit freigegeben, exportieren.",
      "Die Verarbeitung dient außerdem der Zugriffskontrolle, Nachvollziehbarkeit, Sicherheit, Fehleranalyse, Qualitätssicherung, Support und Missbrauchsvermeidung.",
    ],
  },
  {
    title: "3. Welche Daten verarbeitet werden",
    body: [
      "Accountdaten: Name, E-Mail-Adresse, Rolle, Status, Passwort-/Auth-Status, Seitenrechte, Schreib-/Update-Rechte, Exportrechte und Kundenzuordnungen.",
      "Nutzungs- und Sicherheitsdaten: Loginereignisse, Audit-Logs, IP-Adresse, User-Agent, Sessiondaten, Fehlermeldungen, Telemetrie, Exportaktionen und sicherheitsrelevante Ereignisse.",
      "Administrationsdaten: angelegte oder geänderte Nutzer, Märkte, Kampagnen, Fragebögen, Prämienwellen, RED-Month-Zeiträume, Filter, Rechte, Importe und Exporte.",
      "Reportingdaten: je nach Berechtigung Marktstammdaten, Kampagnenstatus, Fragebogenantworten, Fotos, Tags, Besuchsstatus, Markt-/Kampagnen-KPIs und die für das Reporting erforderliche namentliche Zuordnung von Field-Force-Mitarbeitenden.",
      "Interne HR-, Arbeitszeit-, Kilometer-, Bonus-/Prämien- und Sicherheitsdetaildaten sind nicht Bestandteil des normalen Coca-Cola Kunden-Reportings.",
    ],
  },
  {
    title: "4. Wer welche Daten sehen kann",
    body: [
      "Admins und verantwortliche interne Manager sehen Daten entsprechend ihrer betrieblichen Aufgabe und Berechtigung.",
      "Coca-Cola Kunden-Zugänge sehen nur freigeschaltete Reporting-Seiten und nur die Daten, die für Markt-, Kampagnen-, Foto- und Antwort-Reporting erforderlich sind.",
      "Coca-Cola Kunden-Zugänge sind als lesende Reporting-Empfänger vorgesehen. Sie können keine operativen Daten ändern, keine Arbeitszeit-/KM-Daten einsehen und keine internen Bonus-, HR- oder Sicherheitsdaten abrufen, sofern nicht später ausdrücklich eine andere dokumentierte Grundlage geschaffen wird.",
      "Berechtigte technische Dienstleister können Daten im Rahmen von Hosting, Datenbankbetrieb, Authentifizierung, Speicherung, E-Mail-Versand, Logging, Support oder Sicherheit verarbeiten.",
      "Admin-, Kunden- und Exportzugriffe können protokolliert werden, damit sensible Datenzugriffe und Änderungen nachvollziehbar bleiben.",
    ],
  },
  {
    title: "5. Rechtsgrundlagen",
    body: [
      "Art. 6 Abs. 1 lit. b DSGVO: Verarbeitung zur Bereitstellung und Nutzung des jeweiligen Zugangs sowie zur Erfüllung von vertraglichen oder arbeitsbezogenen Aufgaben.",
      "Art. 6 Abs. 1 lit. c DSGVO: Verarbeitung, soweit gesetzliche Nachweis-, Aufbewahrungs-, Arbeitszeit-, Abrechnungs- oder Compliance-Pflichten bestehen.",
      "Art. 6 Abs. 1 lit. f DSGVO: berechtigte Interessen an sicherem Betrieb, Zugriffskontrolle, Qualitätssicherung, Reporting, Support, Fehleranalyse, Missbrauchsvermeidung, Nachvollziehbarkeit und Auftragserfüllung gegenüber Coca-Cola.",
      "Bei Admins und Managern, die Beschäftigte sind, sind Art. 88 DSGVO und anwendbares österreichisches Arbeitsrecht zusätzlich zu berücksichtigen.",
    ],
  },
  {
    title: "6. Coca-Cola Reporting und Datenweitergabe",
    body: [
      "Coca-Cola erhält im vorgesehenen Setup Berichte und lesenden Zugriff auf die für das Kundenreporting erforderlichen Markt-, Kampagnen-, Antwort-, Foto- und Statusdaten.",
      "Coca-Cola kann namentliche GM-/Field-Force-Bezüge sehen, soweit dies für Rückfragen, Kampagnenkontrolle, Qualitätssicherung oder Nachweisführung im Reporting erforderlich ist.",
      "Coca-Cola erhält keinen Zugriff auf interne Arbeitszeit-, Kilometer-, Bonus-, Prämien-, HR-, Payroll- oder interne Sicherheits-/Auditdetails, sofern diese nicht ausdrücklich separat dokumentiert und freigegeben werden.",
      "Coca-Cola ist für die normale Spark-Nutzung nicht Betreiber der Plattform. Die Kunden-Zugänge sind lesende Reporting-Zugänge. Die genaue datenschutzrechtliche Einordnung im Vertrag mit Coca-Cola ist separat zu dokumentieren.",
    ],
  },
  {
    title: "7. Empfänger und Dienstleister",
    body: [
      "Interne Empfänger sind nur Personen und Rollen, die Daten für Administration, Reporting, Abrechnung, Support, Qualitätssicherung, Sicherheit oder Geschäftsführung benötigen.",
      "Externe Empfänger können Coca-Cola bzw. berechtigte Kunden-Zugänge sein, soweit dies durch Vertrag, Reportingauftrag oder freigeschaltete Berechtigung gedeckt ist.",
      "Auftragsverarbeiter können insbesondere für Datenbank, Authentifizierung, Speicherung, Hosting, Deployment, E-Mail-Versand, Logging und Infrastruktur eingesetzt werden. Die finale Dienstleister- und Unterauftragsverarbeiterliste ist intern zu führen.",
    ],
  },
  {
    title: "8. Exporte und Weitergabe",
    body: [
      "Exporte können personenbezogene und operative Daten enthalten. Sie dürfen nur für den jeweils vorgesehenen Zweck verwendet, geschützt abgelegt und nicht unberechtigt weitergegeben werden.",
      "Coca-Cola Kunden-Exporte sind auf Reportingdaten zu beschränken, insbesondere Markt-/Kampagnendaten, Antworten, Fotos, Tags, Status und benötigte Nachweise. Interne Arbeitszeit-, KM-, HR-, Sicherheits- und Bonusdetails gehören nicht in Kundenexporte.",
      "Exportdateien dürfen nicht dauerhaft auf privaten Geräten, in ungeschützten Chatverläufen oder unfreigegebenen Ablagen gespeichert werden. Arbeitskopien sind grundsätzlich innerhalb von 30 Tagen zu löschen, sobald der Zweck erfüllt ist.",
      "Exportaktionen können protokolliert werden, um Missbrauch, versehentliche Offenlegung und unberechtigte Weitergabe nachvollziehen zu können.",
    ],
  },
  {
    title: "9. Arbeitszeitdaten und Korrekturen",
    body: [
      "Admin- und Managerzugänge können Arbeitszeitdaten nur sehen oder bearbeiten, soweit dies für Arbeitszeitaufzeichnung, Abrechnung, Kontrolle, Support, Fehlerkorrektur oder rechtliche Nachweise erforderlich ist.",
      "Zeitanfragen von GMs/SMs zeigen ursprüngliche Zeitwerte und beantragte neue Werte. Freigaben, Ablehnungen, Notizen und Bearbeiter werden protokolliert, damit Korrekturen nachvollziehbar bleiben.",
      "Arbeitszeit-, KM-, HR-, Payroll- und interne Bonus-/Prämiendetails dürfen nicht in Coca-Cola Kundenexporte oder Kundenansichten aufgenommen werden, sofern dafür keine ausdrücklich dokumentierte separate Grundlage besteht.",
    ],
  },
  {
    title: "10. Speicherdauer",
    body: [
      "Die folgenden Fristen sind die Coke-Spark-Regel für operative App-Daten. Längere Speicherung ist nur zulässig, wenn gesetzliche Aufbewahrungspflichten, offene Ansprüche, Prüfungen, Sicherheitsvorfälle oder ein dokumentierter Legal Hold dies erfordern.",
      "Inaktive GM-/SM-Nutzer werden nach Offboarding in Spark anonymisiert. Dabei werden personenbezogene Stammdaten und Loginbezug entfernt oder durch neutrale Platzhalter ersetzt; historische operative Einträge bleiben nur im zulässigen Umfang für Statistiken, Nachweise und Reporting erhalten.",
      "Coca-Cola Kunden-Zugänge dürfen keine Arbeitszeit-, KM-, Payroll-, HR- oder internen Bonus-/Sicherheitsdetails erhalten. Exporte sind Arbeitskopien und müssen nach Zweckerfüllung gelöscht oder in einem freigegebenen geschützten Ablageort verwaltet werden.",
    ],
    table: {
      columns: ["Datenkategorie", "Regel / Frist in Spark"],
      rows: retentionRows,
    },
  },
  {
    title: "11. Drittlandübermittlung",
    body: [
      "Wenn Dienstleister oder Unterauftragnehmer Daten außerhalb des EWR verarbeiten, erfolgt dies nur auf Basis geeigneter Garantien, insbesondere Angemessenheitsbeschlüssen, EU-Standardvertragsklauseln oder vergleichbaren Schutzmechanismen.",
      "Die konkreten Anbieter, Regionen und Garantien sind in der internen Anbieter- und Auftragsverarbeiterliste zu dokumentieren.",
    ],
  },
  {
    title: "12. Admin-Kurti Daten-Assistent",
    body: [
      "Admin-Kurti ist eine freiwillige, ausschließlich für interne Admins freigeschaltete Assistenzfunktion. Sie kann über begrenzte serverseitige Lesefunktionen die Daten abrufen, die ein Admin in Coke Spark für operative Auswertungen, GM-, Markt-, Besuchs-, Zeit-, IPP-, Bonus- und Kampagnenfragen benötigt.",
      "Admin-Kurti kann Daten mehrerer GMs und Bereiche für eine Antwort zusammenführen. Die Funktion ist strikt lesend: Sie darf keine Datensätze ändern, keine Freigaben erteilen und keine verbindlichen Personal-, Bonus- oder sonstigen Entscheidungen treffen. Ergebnisse müssen bei wichtigen Entscheidungen in den jeweiligen Spark-Ansichten geprüft werden.",
      "Zum lesenden Admin-Kontext gehören außerdem Nutzer-/Kundenrechte, redigierte Audit- und Änderungshistorien sowie – nur bei einem konkreten berechtigten Support-, Qualitäts- oder Fehlerklärungsfall – noch aktive GM-Kurti-Verläufe. GM-Chattexte sind vertrauliche Nutzereingaben, dürfen nicht massenhaft oder für automatische Mitarbeiterbewertungen verwendet werden und bleiben höchstens im bestehenden 15-Minuten-Fenster verfügbar.",
      "Für eine Anfrage werden der eingegebene Text, der aktive Admin-Chatverlauf und die von den begrenzten Datenfunktionen gelieferten erforderlichen Informationen an den serverseitig konfigurierten KI-Dienst übermittelt. Die API-Anfrage wird ohne anbieterseitige dauerhafte Antwortspeicherung angefordert; der Admin-Kurti-Verlauf wird 8 Stunden nach der letzten erfolgreichen Admin-Unterhaltung gelöscht. Die getrennte 15-Minuten-Frist für GM-Kurti bleibt unverändert.",
      "In den Chat gehören nur Informationen, die für die konkrete Arbeitsfrage erforderlich sind. Passwörter, API-Schlüssel, private Inhalte und unnötige besondere Kategorien personenbezogener Daten dürfen nicht eingegeben werden. Kunden-Zugänge erhalten keinen Zugriff auf Admin-Kurti.",
    ],
  },
  {
    title: "13. Automatisierte Auswertungen",
    body: [
      "Coke Spark berechnet Kennzahlen, Fortschritte, IPP, Bonus-/Prämienwerte und Statusinformationen zur operativen Steuerung und zum Reporting.",
      "Diese Auswertungen sollen nachvollziehbar bleiben. Es ist keine ausschließlich automatisierte finale Entscheidung vorgesehen, die ohne menschliche Prüfmöglichkeit rechtliche oder vergleichbar erhebliche Wirkung entfaltet.",
    ],
  },
  {
    title: "14. Rechte",
    body: [
      "Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Bestimmte Daten können wegen gesetzlicher Aufbewahrungspflichten, Auditpflichten, Nachweisinteressen oder Sicherheitserfordernissen nicht sofort gelöscht werden; in solchen Fällen kann eine Einschränkung oder Sperrung geprüft werden.",
      "Anfragen werden intern dokumentiert, die Identität und Berechtigung wird geprüft und die Antwort erfolgt grundsätzlich innerhalb eines Monats. Bei komplexen Anfragen kann die Frist nach DSGVO verlängert werden; die betroffene Person erhält dann eine Begründung.",
      "Die interne Bearbeitung erfolgt über die Datenschutzanfragen-Übersicht: Eingang, Frist, verantwortliche Person, Identitätsprüfung, Datenpaket, Entscheidung und Antwort werden dort nachvollziehbar dokumentiert.",
      "Berichtigungen, Löschungen oder Einschränkungen werden nur soweit umgesetzt, wie gesetzliche Arbeitszeit-, Abrechnungs-, Audit-, Reporting- oder Nachweispflichten nicht entgegenstehen.",
      "Es besteht das Recht auf Beschwerde bei der österreichischen Datenschutzbehörde: dsb.gv.at.",
    ],
  },
  {
    title: "15. Sicherheit und Datenschutzvorfälle",
    body: [
      "Coke Spark nutzt rollenbasierte Berechtigungen, serverseitige Zugriffsprüfungen, Backend-only Datenbankzugriffe, private Speicherbereiche, signierte Datei-URLs, Protokollierung und Auditmechanismen.",
      "Direkte anonyme oder normale Client-Zugriffe auf die Datenbanktabellen sind nicht vorgesehen. Geschäftsdaten werden über die autorisierte Backend-API verarbeitet.",
      "Mögliche Datenschutz- oder Sicherheitsvorfälle müssen sofort intern gemeldet werden. Das zuständige Team sichert Logs und Beweise, bewertet Risiko und Umfang, begrenzt den Vorfall und entscheidet über Meldepflichten.",
      "Wenn nach DSGVO erforderlich, wird die österreichische Datenschutzbehörde grundsätzlich binnen 72 Stunden ab Bekanntwerden informiert. Betroffene Personen werden informiert, wenn voraussichtlich ein hohes Risiko für ihre Rechte und Freiheiten besteht.",
    ],
  },
];

export default function AdminDatenschutzPage() {
  return (
    <PrivacyNotice
      eyebrow="Datenschutz - Admin / Kunde"
      title="Datenschutzinformation für Admins und Kunden-Zugänge"
      subtitle="Informationen zur Verarbeitung personenbezogener Daten bei administrativen, leitenden und kundenbezogenen Coke-Spark-Zugängen."
      audienceLabel="Admin-, Rechte-, Audit- und Reportingdaten"
      sections={sections}
      backHref="/admin"
    />
  );
}
