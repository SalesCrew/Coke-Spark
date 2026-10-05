import test from "node:test";
import assert from "node:assert/strict";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// These API tests never issue a network request or load environment files.
test("late GM reads cannot replace newer market, inventory or KPI caches", { timeout: 5000 }, async () => {
  const localStorage = storage(), sessionStorage = storage();
  localStorage.setItem("coke_spark_auth_v1", JSON.stringify({
    user: { id: "synthetic-gm", role: "gm", email: "preview@example.test", firstName: "GM", lastName: "Test" },
    session: { accessToken: "synthetic", refreshToken: "synthetic", expiresAt: null },
  }));
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage, sessionStorage, location: { pathname: "/gm" }, addEventListener() {}, removeEventListener() {} } });
  const pending: Array<ReturnType<typeof deferred<Response>>> = [];
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.cache, "no-store");
    const request = deferred<Response>();
    pending.push(request);
    return request.promise;
  };
  const respond = (index: number, data: unknown) => pending[index].resolve(new Response(JSON.stringify(data), { status: 200 }));
  try {
    const api = await import("../src/lib/api/backend");
    const oldMarkets = api.fetchGmAssignedStartMarkets({ force: true });
    const newMarkets = api.fetchGmAssignedStartMarkets({ force: true });
    const market = (name: string) => ({ markets: [{ id: "synthetic-market", name, address: "Testweg", postalCode: "1010", city: "Wien", region: "Wien", activeNowCampaigns: [] }] });
    respond(1, market("New period")); await newMarkets;
    respond(0, market("Old period")); await oldMarkets;
    assert.equal((await api.fetchGmAssignedStartMarkets())[0].market.name, "New period");
    assert.equal(pending.length, 2);

    const oldProgress = api.fetchGmKuehlerMhdProgress({ force: true });
    const newProgress = api.fetchGmKuehlerMhdProgress({ force: true });
    const progress = (current: number) => {
      const section = { current, total: 3, percent: 0, startDate: "2026-10-05", endDate: "2026-10-30", markets: [] };
      return { kuehler: section, mhd: section, durcharbeit: section, generatedAt: "2026-10-05", timezone: "Europe/Vienna", periodFallback: { startDate: section.startDate, endDate: section.endDate } };
    };
    respond(3, progress(0)); await newProgress;
    respond(2, progress(2)); await oldProgress;
    assert.equal((await api.fetchGmKuehlerMhdProgress()).kuehler.current, 0);
    assert.equal(pending.length, 4);

    const oldKpi = api.fetchGmKpiSummary(), newKpi = api.fetchGmKpiSummary();
    respond(5, { ippAllTimeAvg: 6, lastComputedAt: "2026-10-05" }); await newKpi;
    respond(4, { ippAllTimeAvg: 5, lastComputedAt: "2026-10-04" }); await oldKpi;
    assert.equal(api.readCachedGmKpiSummary()?.ippAllTimeAvg, 6);
    assert.equal(api.readCachedGmKpiSummary()?.lastComputedAt, "2026-10-05");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
