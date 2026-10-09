import assert from "node:assert/strict";
import test from "node:test";

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear() };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function until(predicate: () => boolean) {
  for (let index = 0; index < 30; index++) { if (predicate()) return; await new Promise<void>(done => setImmediate(done)); }
  assert.fail("The expected isolated request did not occur");
}

// Intercept every request before importing the client. No real browser stores, network or env files.
test("SM inbox and campaign requests cannot replay across an account switch", { timeout: 10_000 }, async t => {
  assert.equal(process.env.DATABASE_URL, undefined); assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch, originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const fakeWindow = Object.assign(new EventTarget(), { localStorage: storage(), sessionStorage: storage(), location: { pathname: "/sm" } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  process.env.NEXT_PUBLIC_BACKEND_URL = "https://synthetic-inbox.invalid";
  const calls: Array<{ url: string; init: RequestInit | undefined; reply: ReturnType<typeof deferred<Response>> }> = [];
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith("https://synthetic-inbox.invalid/"), "All external destinations fail closed");
    const reply = deferred<Response>(); calls.push({ url: String(url), init, reply }); return reply.promise;
  };
  const response = (index: number, body: unknown, status = 200) => calls[index]!.reply.resolve(new Response(JSON.stringify(body), { status }));
  const session = (id: string, accessToken = `synthetic-${id}`) => ({
    user: { id: `synthetic-${id}`, role: "sm" as const, email: `${id}@preview.test`, firstName: id, lastName: "Synthetic" },
    session: { accessToken, refreshToken: `synthetic-refresh-${id}`, expiresAt: null },
  });
  try {
    const api = await import("../src/lib/api/backend");
    const setOwner = (id: string) => api.saveAuthSession(session(id), { remember: true });
    await t.test("late bodies and aggregate counts cannot enter the next owner's state", async () => {
      for (const request of [() => api.fetchSmInbox(), () => api.fetchSmMessageUnreadCount()]) {
        setOwner("A"); const index = calls.length, pending = request();
        const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
        setOwner("B"); response(index, { messages: [{ body: "Private A sentinel" }], nextCursor: null, unreadCount: 42 });
        await rejected; assert.equal(api.readAuthSession()?.user.id, "synthetic-B");
      }
    });
    await t.test("an intervening A to B to A switch still rejects the old request", async () => {
      setOwner("A"); const index = calls.length, pending = api.fetchSmMessageUnreadCount();
      const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
      setOwner("B"); setOwner("A"); response(index, { unreadCount: 99 }); await rejected;
    });
    await t.test("a late unauthorized read never refreshes or marks a shared message using the next account", async () => {
      setOwner("A"); const index = calls.length, pending = api.markSmMessageRead("00000000-0000-4000-8000-000000000001");
      const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
      setOwner("B"); response(index, { error: "Expired synthetic token" }, 401); await rejected;
      assert.equal(calls.length, index + 1, "No refresh or mutation replay occurred"); assert.equal(api.readAuthSession()?.user.id, "synthetic-B");
    });
    await t.test("a refresh already in flight cannot restore the previous account or retry its mutation", async () => {
      setOwner("A"); const index = calls.length, pending = api.markSmMessageRead("00000000-0000-4000-8000-000000000002");
      const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
      response(index, { error: "Expired synthetic token" }, 401);
      await until(() => calls.length === index + 2); assert.ok(calls[index + 1]!.url.endsWith("/auth/refresh"));
      setOwner("B"); response(index + 1, session("A", "synthetic-renewed-A")); await rejected;
      assert.equal(calls.length, index + 2); assert.equal(api.readAuthSession()?.user.id, "synthetic-B");
    });
    await t.test("normal token renewal for the same owner preserves explicit read behavior and badge notification", async () => {
      setOwner("A"); const index = calls.length; let changed = 0;
      const onChanged = () => { changed++; }; fakeWindow.addEventListener(api.SM_MESSAGES_CHANGED_EVENT, onChanged);
      const pending = api.markSmMessageRead("00000000-0000-4000-8000-000000000003");
      response(index, { error: "Expired synthetic token" }, 401); await until(() => calls.length === index + 2);
      response(index + 1, session("A", "synthetic-renewed-A")); await until(() => calls.length === index + 3);
      assert.equal((calls[index + 2]!.init?.headers as Record<string, string>).Authorization, "Bearer synthetic-renewed-A");
      response(index + 2, { messageId: "00000000-0000-4000-8000-000000000003", readAt: "2026-10-09T10:00:00Z", alreadyRead: false });
      assert.equal((await pending).alreadyRead, false); assert.equal(changed, 1);
      fakeWindow.removeEventListener(api.SM_MESSAGES_CHANGED_EVENT, onChanged);
    });
    await t.test("campaign publication/start transport uses the same guarded refresh boundary", async () => {
      setOwner("A"); const index = calls.length, pending = api.startMySMDurcharbeitTarget("00000000-0000-4000-8000-000000000004", {
        expectedRevision: 1, followUp: false, mode: "manual", travelMinutes: null, clientSubmissionToken: "synthetic-only-start",
      });
      const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
      setOwner("B"); response(index, { error: "Expired synthetic token" }, 401); await rejected;
      assert.equal(calls.length, index + 1); assert.equal(api.readAuthSession()?.user.id, "synthetic-B");
    });
    await t.test("monthly questionnaire and time-review adapters never retry under another principal", async () => {
      const visit = "00000000-0000-4000-8000-000000000005", reference = `SMDurcharbeit:${visit}`;
      for (const action of [
        () => api.saveSmVisitAnswer(reference, "synthetic-question", { kind: "text", value: "A only" }, { expectedAnswerVersion: 0, clientMutationToken: "synthetic-save" }),
        () => api.submitSmVisit(reference, { visitStartedAt: "2026-10-09T08:00:00Z", visitCompletedAt: "2026-10-09T08:15:00Z" }),
        () => api.requestMySmPlanningTimeChange(reference, { expectedRevision: 1, kind: "deletion", requestedStartedAt: null, requestedCompletedAt: null, reason: "Synthetic A only", clientRequestToken: "synthetic-request" }),
        () => api.reviewAdminSMDurcharbeitTimeRequest(visit, "approve"),
        () => api.fetchSMDurcharbeitTimeHistory(visit, false),
      ]) {
        setOwner("A"); const index = calls.length, pending = action();
        const rejected = assert.rejects(pending, /Zugang hat sich geändert/);
        setOwner("B"); response(index, { error: "Expired synthetic token" }, 401); await rejected;
        assert.equal(calls.length, index + 1, "No new-account refresh or action replay");
        assert.equal(api.readAuthSession()?.user.id, "synthetic-B");
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    if (originalBackendUrl === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL;
    else process.env.NEXT_PUBLIC_BACKEND_URL = originalBackendUrl;
  }
});
