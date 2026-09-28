import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { bonusEmptyState } from "../src/lib/gm-dashboard/bonus-empty-state";
import { BonusEmptyState } from "../src/components/admin/gm-dashboard/BonusEmptyState";
import { BonusOverviewCard } from "../src/components/admin/gm-dashboard/BonusOverviewCard";
import { RealDashboardProvider } from "../src/components/admin/gm-dashboard/RealGmDashboard";
import { RedMonthProvider } from "../src/context/RedMonthContext";

const ready = {
  loading: false,
  ready: true,
  error: null,
  waveCount: 1,
  waveSelected: true,
  workspaceLoaded: true,
  hasParticipant: true,
  goalCount: 4,
};
const noop = () => {};

test("bonus empty states distinguish loading, configuration, errors, waves, participants and goals", () => {
  assert.equal(
    bonusEmptyState({ ...ready, loading: true })!.status,
    "Wird geladen …",
  );
  assert.equal(
    bonusEmptyState({ ...ready, ready: false })!.status,
    "Nicht eingerichtet",
  );
  assert.equal(
    bonusEmptyState({ ...ready, ready: null, error: "Failed to fetch" })!
      .status,
    "Nicht geladen",
  );
  assert.equal(
    bonusEmptyState({ ...ready, waveCount: 0 })!.status,
    "Keine Prämienwelle",
  );
  assert.equal(
    bonusEmptyState({ ...ready, waveSelected: false })!.status,
    "Welle wählen",
  );
  assert.equal(
    bonusEmptyState({ ...ready, workspaceLoaded: false })!.loading,
    true,
  );
  assert.equal(
    bonusEmptyState({ ...ready, hasParticipant: false })!.status,
    "Keine Teilnehmer",
  );
  assert.equal(
    bonusEmptyState({ ...ready, goalCount: 0 })!.status,
    "Keine Bonusziele",
  );
  // A configured result is not empty merely because earnings/progress are zero.
  assert.equal(bonusEmptyState(ready), null);
});

test("empty bonus panels have a clear accessible message and no pretend chart, amounts or zero progress", () => {
  const state = bonusEmptyState({ ...ready, ready: false })!;
  for (const kind of ["categories", "goal"] as const) {
    const html = renderToStaticMarkup(
      <BonusEmptyState state={state} kind={kind} onRetry={noop} />,
    );
    assert.match(html, /Prämien noch nicht eingerichtet/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(
      html,
      /role="img"|viewBox="0 0 174 174"|€|0%|—|Produktivdaten|Erneut versuchen/,
    );
  }
  const retry = renderToStaticMarkup(
    <BonusEmptyState
      state={bonusEmptyState({ ...ready, error: "Failed to fetch" })!}
      kind="categories"
      onRetry={noop}
    />,
  );
  assert.match(retry, /<button[^>]*type="button"/);
  assert.match(retry, /Erneut versuchen/);
  assert.doesNotMatch(retry, /Failed to fetch/);
});

test("actual bonus card renders two loading panels, not placeholder bars/ring, before data arrives", () => {
  const html = renderToStaticMarkup(
    <RedMonthProvider>
      <RealDashboardProvider register={noop}>
        <BonusOverviewCard />
      </RealDashboardProvider>
    </RedMonthProvider>,
  );
  assert.match(html, /Bonus nach Kategorie/);
  assert.match(html, /Bonusziel/);
  assert.equal((html.match(/Prämien werden geladen/g) ?? []).length, 2);
  assert.doesNotMatch(
    html,
    /role="img"|Aktueller Bonus|von —|Erreicht|Produktivdaten/,
  );
  assert.equal((html.match(/aria-busy="true"/g) ?? []).length, 2);
});
