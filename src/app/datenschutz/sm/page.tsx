import type { Metadata } from "next";
import { PrivacyNotice, type PrivacyNoticeSection } from "../PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutz Shelf Merchandising | Coke Spark",
  description: "Datenschutzinformation für Shelf Merchandiser in Coke Spark.",
};

const sections: PrivacyNoticeSection[] = [
  {
    title: "1. Verantwortlicher und Kontakt",
    body: [
      "Verantwortlicher: Institut für Verkaufsförderung GmbH, Wagenseilgasse 5, 1120 Wien.",
      "Datenschutz-Anlaufstelle: datenschutz@merch.at.",
      "Diese Information gilt für Shelf Merchandiser, die Coke Spark zur Einsatzplanung, Arbeitsausführung und Dokumentation verwenden.",
    ],
  },
  {
    title: "2. Zwecke und Datenkategorien",
    body: [
      "Coke Spark verarbeitet SM-Stammdaten, Marktzuordnungen und Einsätze, Fragebogenantworten, Fotos, Besuchs- und Fahrtzeiten, Nachrichten und Lesestatus sowie Korrektur- und Löschanfragen.",
      "Aus abgeschlossenen Fragebögen werden operative Kennzahlen wie gefundene und behobene Out-of-Stock-Fälle sowie Marktquoten berechnet. Entwürfe fließen nicht in diese Auswertungen ein.",
      "Login-, Vereinbarungs-, Audit- und technische Fehlerdaten werden verarbeitet, soweit dies für sicheren Betrieb, Support und Nachvollziehbarkeit erforderlich ist.",
    ],
  },
  {
    title: "3. Rechtsgrundlagen",
    body: [
      "Art. 6 Abs. 1 lit. b DSGVO für Planung, Durchführung und Nachweis des Arbeits-, Dienst- oder Einsatzverhältnisses.",
      "Art. 6 Abs. 1 lit. c DSGVO für gesetzliche Pflichten, insbesondere erforderliche Arbeitszeit- und Abrechnungsnachweise.",
      "Art. 6 Abs. 1 lit. f DSGVO für Auftragserfüllung, Qualitätssicherung, Reporting, IT-Sicherheit, Fehlerkorrektur und Missbrauchsprävention. Im Beschäftigungskontext sind Art. 88 DSGVO und das anwendbare österreichische Arbeitsrecht zusätzlich zu beachten.",
      "Einwilligung ist nicht die primäre Rechtsgrundlage der normalen SM-Arbeitsausführung.",
    ],
  },
  {
    title: "4. Zugriff und Empfänger",
    body: [
      "Shelf Merchandiser sehen über die SM-Oberfläche nur ihre eigenen Zuordnungen, Einsätze, Antworten, Zeiten, Nachrichten und Anfragen.",
      "Berechtigte interne Admins und SM-Admins erhalten Zugriff nur soweit dies für Planung, Support, Prüfung, Korrektur, Reporting oder Abrechnung erforderlich ist. SM-Admins erhalten über die SM-Verwaltung keinen Zugriff auf den GM-Arbeitsbereich.",
      "Die operative SM-API gewährt Coca-Cola Kunden-Zugängen keinen direkten Zugriff. Eine externe Weitergabe oder ein Export erfordert einen gesondert kontrollierten, zweckgebundenen Prozess.",
      "Technische Dienstleister dürfen Daten nur im erforderlichen Umfang für Datenbank, Authentifizierung, privaten Dateispeicher, Hosting, Deployment, Logging und Sicherheit verarbeiten.",
    ],
  },
  {
    title: "5. Offline-Nutzung auf dem Gerät",
    body: [
      "Damit Einsätze auch bei schlechter Verbindung bearbeitet werden können, speichert der Browser nutzergebunden zugewiesene Planungs- und Fragebogendaten sowie noch nicht synchronisierte Antworten lokal. Diese Zwischenspeicher verfallen spätestens nach 30 Tagen und werden außerdem bei Absenden, Verwerfen, Logout oder Identitätswechsel bereinigt.",
      "Zeitlich begrenzte signierte Foto-Links werden nicht dauerhaft im lokalen Fragebogen-Cache gespeichert. Abgelaufene lokale Datensätze werden beim nächsten Zugriff entfernt.",
      "Auf gemeinsam genutzten Geräten muss nach der Arbeit ausgeloggt werden. Geräte- oder Browserprofile dürfen nicht mit anderen Personen geteilt werden, solange noch ein aktiver SM-Zugang besteht.",
    ],
  },
  {
    title: "6. Fotos und Marktinhalte",
    body: [
      "Fotos werden in einem privaten Speicherbereich abgelegt. Die Anzeige erfolgt über kurzlebige, signierte Links mit einer Laufzeit von 30 Minuten.",
      "Es dürfen nur für die Aufgabe erforderliche Markt- und Produktinhalte fotografiert werden. Personen, private Unterlagen, Gesundheitsdaten oder andere unnötige personenbezogene Informationen sollen nicht aufgenommen werden.",
      "Fehlaufnahmen mit unnötigem Personenbezug können über die vorgesehenen Prüf- und Löschprozesse gemeldet werden.",
    ],
  },
  {
    title: "7. Speicherdauer",
    body: [
      "Die Fristen sind interne Coke-Spark-Regeln. Abweichungen sind nur bei gesetzlicher Pflicht, offener Prüfung, Anspruch, Sicherheitsvorfall oder dokumentiertem Legal Hold zulässig.",
    ],
    table: {
      columns: ["Datenkategorie", "Regel / Frist"],
      rows: [
        ["SM-Account und Profil", "Aktiver Einsatz; nach operativer Übergabe grundsätzlich Anonymisierung innerhalb von 30 Tagen."],
        ["Einsätze, Fragebögen, Antworten und Fotos", "Grundsätzlich 3 Jahre nach Ende des betreffenden Kampagnen- oder Berichtsjahres."],
        ["Besuchs-, Fahrt- und Korrekturzeiten", "Bis zu 7 Jahre, soweit Arbeitszeit, Payroll, Aufwandsersatz oder buchhalterischer Nachweis betroffen ist."],
        ["Nachrichten und Lesestatus", "Nur solange für Einsatzinformation und Nachweis erforderlich, grundsätzlich höchstens 3 Jahre."],
        ["Login- und Sicherheitslogs", "Grundsätzlich 24 Monate; incident-relevante Daten bis zum Abschluss der Prüfung beziehungsweise Legal Hold."],
        ["Vereinbarungsnachweise", "Aktiver Einsatz plus 3 Jahre."],
        ["Lokaler Offline-Zwischenspeicher", "Spätestens 30 Tage; zusätzlich Bereinigung bei Abschluss, Verwerfen, Logout oder Identitätswechsel."],
      ],
    },
  },
  {
    title: "8. Rechte und Korrekturen",
    body: [
      "Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Antwort-, Fragebogen- und Zeiterfassungsfehler können über die SM-Anfrageprozesse zur Prüfung eingereicht werden. Original, Antrag und Entscheidung bleiben nur im erforderlichen Nachweiszeitraum nachvollziehbar.",
      "Datenschutzanfragen werden dokumentiert, die Identität wird geprüft und grundsätzlich innerhalb eines Monats beantwortet. Gesetzliche Aufbewahrungspflichten oder Rechte Dritter können eine sofortige Löschung ausschließen.",
      "Es besteht ein Beschwerderecht bei der österreichischen Datenschutzbehörde: dsb.gv.at.",
    ],
  },
  {
    title: "9. Sicherheit und Datenschutzvorfälle",
    body: [
      "SM-Daten werden über serverseitig authentifizierte, rollen- und eigentumsgeprüfte APIs verarbeitet. Die SM-Datenbanktabellen sind von GM-Daten getrennt, mit Row Level Security geschützt und für anonyme oder normale Browser-Datenbankrollen gesperrt.",
      "Mögliche Datenschutz- oder Sicherheitsvorfälle müssen sofort intern gemeldet werden. Das zuständige Team begrenzt den Vorfall, sichert Nachweise, bewertet das Risiko und prüft gesetzliche Informations- und Meldepflichten.",
    ],
  },
];

export default function SmDatenschutzPage() {
  return (
    <PrivacyNotice
      eyebrow="Datenschutz · SM"
      title="Datenschutzinformation für Shelf Merchandising"
      subtitle="Wie Coke Spark personenbezogene Daten bei SM-Einsätzen verarbeitet, schützt und begrenzt."
      audienceLabel="SM-Arbeitsausführungsdaten"
      sections={sections}
      backHref="/sm/profil"
    />
  );
}
