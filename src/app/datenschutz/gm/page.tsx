import type { Metadata } from "next";
import { PrivacyNotice, type PrivacyNoticeSection } from "../PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutz GM / SM | Coke Spark",
  description: "Datenschutzinformation für Gebietsmanager, Shelf Merchandiser und Field Force in Coke Spark.",
};

const sections: PrivacyNoticeSection[] = [
  {
    title: "1. Verantwortlicher und Kontakt",
    body: [
      "Verantwortlicher: [rechtlichen Namen, Anschrift und Kontakt des Arbeitgebers bzw. der betreibenden Gesellschaft final eintragen].",
      "Datenschutzkontakt: [E-Mail-Adresse final eintragen]. Falls ein Datenschutzbeauftragter bestellt ist, sind dessen Kontaktdaten hier zu ergänzen.",
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
      "Arbeitszeit- und Kilometerdaten werden so lange gespeichert, wie gesetzliche Aufbewahrungs-, Nachweis-, Abrechnungs- oder arbeitsrechtliche Pflichten dies erfordern.",
      "Besuchs-, Fragebogen-, Foto- und Reportingdaten werden so lange gespeichert, wie sie für Coca-Cola Reporting, Qualitätsnachweise, Reklamationen, Kampagnenhistorie, Prämienprüfung oder interne Nachvollziehbarkeit erforderlich sind.",
      "Audit-, Login-, Sicherheits- und Telemetriedaten werden grundsätzlich kürzer gespeichert und nur so lange, wie sie für Sicherheit, Fehleranalyse, Missbrauchsvermeidung und Nachweiszwecke erforderlich sind.",
      "Exports sind Arbeitskopien und dürfen nur zweckgebunden abgelegt werden. Sie sind zu löschen, sobald der Exportzweck erfüllt ist oder die jeweils festgelegte Aufbewahrungsfrist endet.",
      "Wenn dein aktiver Einsatz endet und deine operative Spark-Identität nicht mehr benötigt wird, kann dein Spark-Nutzerstammdatensatz anonymisiert werden. Name, E-Mail-Adresse, Telefon, Adresse, PLZ/Ort, Region, Profilfoto und Loginbezug werden dann entfernt oder durch neutrale Platzhalter ersetzt.",
      "Historische Marktbesuche, Antworten, Fotos, Zeit- und Kilometerdaten bleiben für Statistiken, Nachweise, Reporting und Abrechnung erhalten, werden in Spark aber nur noch mit anonymisierten Mitarbeiterdaten angezeigt. Separate HR-/Payroll-Unterlagen außerhalb von Spark können aufgrund gesetzlicher Pflichten länger personenbezogen aufbewahrt werden.",
    ],
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
    title: "10. Automatisierte Auswertungen",
    body: [
      "Coke Spark berechnet Kennzahlen wie Besuchsfortschritt, IPP, Prämien-/Bonusfortschritt, Zeitverläufe und Kampagnenstatus.",
      "Soweit Kennzahlen Auswirkungen auf Prämien, Qualität oder operative Beurteilung haben, müssen sie intern nachvollziehbar und korrigierbar bleiben. Es ist keine ausschließlich automatisierte finale Entscheidung vorgesehen, die ohne menschliche Prüfmöglichkeit rechtliche oder vergleichbar erhebliche Wirkung entfaltet.",
    ],
  },
  {
    title: "11. Rechte",
    body: [
      "Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Bestimmte Daten können wegen gesetzlicher Aufbewahrungspflichten, Arbeitszeitnachweisen, Nachweisinteressen oder berechtigter Dokumentation nicht sofort gelöscht werden; in solchen Fällen kann eine Einschränkung oder Sperrung geprüft werden.",
      "Es besteht das Recht auf Beschwerde bei der österreichischen Datenschutzbehörde: dsb.gv.at.",
    ],
  },
  {
    title: "12. Sicherheit",
    body: [
      "Coke Spark nutzt rollenbasierte Zugriffe, serverseitige Berechtigungsprüfungen, private Speicherbereiche, signierte Datei-URLs, Protokollierung und eine backend-only Datenbankzugriffsarchitektur.",
      "Direkte anonyme oder normale Client-Zugriffe auf die Datenbanktabellen sind nicht vorgesehen. Geschäftsdaten werden über die autorisierte Backend-API verarbeitet.",
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
