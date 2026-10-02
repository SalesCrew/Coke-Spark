import type { DashboardPoint } from "@/types/gm-dashboard";

type Props = {
  questions: NonNullable<DashboardPoint["competitorQuestions"]>;
  loading?: boolean;
};

export function CompetitorQuestionBreakdown({ questions, loading = false }: Props) {
  const cell = { padding: "8px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
  return (
    <section aria-label="Abfrage Mitbewerb – Details" style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.015)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>Abfrage Mitbewerb · je Frage</div>
        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", marginTop: 3 }}>Ausgewähltes Intervall · letzter gültiger Stand je Markt und Frage · Punkte laut Bewertung</div>
      </div>
      {loading ? (
        <div role="status" style={{ padding: 12, fontSize: 11 }}>Mitbewerb-Details werden geladen…</div>
      ) : questions.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: "rgba(0,0,0,0.5)" }}>Keine bewerteten Mitbewerb-Antworten im gewählten Zeitraum.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" }}>
            <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Mitbewerb-Antworten nach Frage, einschließlich Kühler und Großplatzierung</caption>
            <thead style={{ background: "rgba(0,0,0,0.02)", color: "rgba(0,0,0,0.55)" }}>
              <tr>
                <th scope="col" style={cell}>Frage / Modul</th>
                <th scope="col" style={cell}>Ja</th>
                <th scope="col" style={cell}>Nein</th>
                <th scope="col" style={cell}>Märkte</th>
                <th scope="col" style={cell}>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.questionId}>
                  <th scope="row" style={{ ...cell, fontWeight: 600, minWidth: 220 }}>
                    {question.questionText || "Frage ohne Bezeichnung"}
                    {question.moduleName && <div style={{ marginTop: 3, fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>{question.moduleName}</div>}
                  </th>
                  <td style={cell}>{question.yesCount}</td>
                  <td style={cell}>{question.noCount}</td>
                  <td style={cell}>{question.marketCount}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{question.points.toLocaleString("de-AT", { maximumFractionDigits: 4 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
