import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CompetitorQuestionBreakdown } from "../src/components/admin/gm-dashboard/CompetitorQuestionBreakdown";

test("competitor view separates snapshot question labels, explicit Ja/Nein counts and configured points", () => {
  const html = renderToStaticMarkup(<CompetitorQuestionBreakdown questions={[
    { questionId: "cooler", questionText: "Ist ein markeneigener Kühler vorhanden?", moduleName: "Abfrage Mitbewerb", points: 2, marketCount: 2, yesCount: 1, noCount: 1 },
    { questionId: "large", questionText: "Sind Großplatzierungen vom Mitbewerb vorhanden?", moduleName: "Abfrage Mitbewerb", points: -3.5, marketCount: 2, yesCount: 2, noCount: 0 },
  ]} />);
  assert.match(html, /markeneigener Kühler/);
  assert.match(html, /Großplatzierungen/);
  assert.match(html, /Abfrage Mitbewerb/);
  assert.match(html, /scope="col"[^>]*>Ja</);
  assert.match(html, /scope="col"[^>]*>Nein</);
  assert.match(html, /-3,5/);
  assert.doesNotMatch(html, /NaN|Infinity|>\d+%</);
});

test("missing and loading competitor results show an explicit message without invented rows", () => {
  const empty = renderToStaticMarkup(<CompetitorQuestionBreakdown questions={[]} />);
  assert.match(empty, /Keine bewerteten Mitbewerb-Antworten/);
  assert.doesNotMatch(empty, /<tbody|<td/);
  const loading = renderToStaticMarkup(<CompetitorQuestionBreakdown questions={[]} loading />);
  assert.match(loading, /role="status"/);
  assert.match(loading, /werden geladen/);
  assert.doesNotMatch(loading, /Keine bewerteten/);
});
