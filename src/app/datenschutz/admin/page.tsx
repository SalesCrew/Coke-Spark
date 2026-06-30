import type { Metadata } from "next";
import { PrivacyNotice, type PrivacyNoticeSection } from "../PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutz Admin / Kunde | Coke Spark",
  description: "Datenschutzinformation für Admins, verantwortliche Manager und Kunden-Zugänge in Coke Spark.",
};

const sections: PrivacyNoticeSection[] = [
  {
    title: "1. Verantwortlicher und Kontakt",
    body: [
      "Verantwortlicher: [rechtlichen Namen, Anschrift und Kontakt der betreibenden Gesellschaft final eintragen].",
      "Datenschutzkontakt: [E-Mail-Adresse final eintragen]. Falls ein Datenschutzbeauftragter bestellt ist, sind dessen Kontaktdaten hier zu ergänzen.",
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
      "Account-, Rechte- und Auditdaten werden so lange gespeichert, wie der Zugang aktiv ist und danach so lange, wie Nachweis-, Sicherheits-, Compliance- oder gesetzliche Aufbewahrungspflichten dies erfordern.",
      "Reporting-, Kampagnen-, Antwort-, Foto- und Exportdaten werden so lange gespeichert, wie sie für Kundenreporting, Qualitätssicherung, Nachweise, Kampagnenhistorie, Reklamationen oder rechtliche/vertragliche Ansprüche erforderlich sind.",
      "Technische Logs und Telemetrie werden grundsätzlich kürzer gespeichert und nur so lange, wie sie für Betrieb, Sicherheit, Fehleranalyse und Missbrauchsvermeidung erforderlich sind.",
      "Exports sind Arbeitskopien und dürfen nur zweckgebunden abgelegt werden. Sie sind zu löschen, sobald der Exportzweck erfüllt ist oder die jeweils festgelegte Aufbewahrungsfrist endet.",
      "Inaktive GM-/SM-Nutzer können nach Offboarding in Spark anonymisiert werden. Dabei werden personenbezogene Stammdaten und Loginbezug entfernt oder durch neutrale Platzhalter ersetzt; historische operative Einträge bleiben für Statistiken, Nachweise und Reporting erhalten.",
      "Die finalen konkreten Fristen für Löschung, Sperrung, Exportablage und Anonymisierung sind im internen Lösch- und Aufbewahrungskonzept zu dokumentieren und regelmäßig zu prüfen.",
    ],
  },
  {
    title: "11. Drittlandübermittlung",
    body: [
      "Wenn Dienstleister oder Unterauftragnehmer Daten außerhalb des EWR verarbeiten, erfolgt dies nur auf Basis geeigneter Garantien, insbesondere Angemessenheitsbeschlüssen, EU-Standardvertragsklauseln oder vergleichbaren Schutzmechanismen.",
      "Die konkreten Anbieter, Regionen und Garantien sind in der internen Anbieter- und Auftragsverarbeiterliste zu dokumentieren.",
    ],
  },
  {
    title: "12. Automatisierte Auswertungen",
    body: [
      "Coke Spark berechnet Kennzahlen, Fortschritte, IPP, Bonus-/Prämienwerte und Statusinformationen zur operativen Steuerung und zum Reporting.",
      "Diese Auswertungen sollen nachvollziehbar bleiben. Es ist keine ausschließlich automatisierte finale Entscheidung vorgesehen, die ohne menschliche Prüfmöglichkeit rechtliche oder vergleichbar erhebliche Wirkung entfaltet.",
    ],
  },
  {
    title: "13. Rechte",
    body: [
      "Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Bestimmte Daten können wegen gesetzlicher Aufbewahrungspflichten, Auditpflichten, Nachweisinteressen oder Sicherheitserfordernissen nicht sofort gelöscht werden; in solchen Fällen kann eine Einschränkung oder Sperrung geprüft werden.",
      "Es besteht das Recht auf Beschwerde bei der österreichischen Datenschutzbehörde: dsb.gv.at.",
    ],
  },
  {
    title: "14. Sicherheit",
    body: [
      "Coke Spark nutzt rollenbasierte Berechtigungen, serverseitige Zugriffsprüfungen, Backend-only Datenbankzugriffe, private Speicherbereiche, signierte Datei-URLs, Protokollierung und Auditmechanismen.",
      "Direkte anonyme oder normale Client-Zugriffe auf die Datenbanktabellen sind nicht vorgesehen. Geschäftsdaten werden über die autorisierte Backend-API verarbeitet.",
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
