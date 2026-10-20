import assert from "node:assert/strict";
import test from "node:test";
import { prepareSmPhoto, saveSmPhotoJob, smPhotoErrorMessage, type SmPhotoUploadJob } from "../src/lib/sm/photoUpload";

const file = () => new File(["synthetic-photo-bytes"], "shelf.jpg", { type: "image/jpeg" });
function setup(transfer: typeof fetch = async () => new Response("{}")) {
  const job: SmPhotoUploadJob = { source: file() };
  let presigns = 0, commits = 0, prepares = 0;
  const retries: number[] = [];
  const dependencies = {
    isCurrent: () => true,
    prepare: async (source: File) => { prepares++; return new File([await source.arrayBuffer()], source.name, { type: source.type }); },
    initialize: async () => ({ answerId: "synthetic-answer" }),
    presign: async () => { presigns++; return { upload: { path: "synthetic/one.jpg", signedUrl: "http://127.0.0.1/synthetic-upload" } }; },
    commit: async () => { commits++; }, transfer, wait: async () => {}, onRetry: (attempt: number) => { retries.push(attempt); },
  };
  return { job, dependencies, retries, counts: () => ({ presigns, commits, prepares }) };
}

test("copies source bytes into an independent file before upload", async () => {
  const source = file(), stable = await prepareSmPhoto(source);
  assert.notEqual(stable, source); assert.equal(stable.name, source.name);
  assert.equal(await stable.text(), await source.text());
});

test("transient transfer failures retry the same stable bytes and path automatically", async () => {
  let calls = 0;
  const bodies: unknown[] = [];
  const f = setup(async (_url, input) => { bodies.push(input?.body); if (++calls < 3) throw new TypeError("Failed to fetch"); return new Response("{}"); });
  await saveSmPhotoJob(f.job, f.dependencies);
  assert.deepEqual(f.retries, [2, 3]); assert.equal(f.job.committed, true);
  assert.equal(new Set(bodies).size, 1); assert.notEqual(bodies[0], f.job.source);
  assert.deepEqual(f.counts(), { presigns: 1, commits: 1, prepares: 1 });
});

test("bounded failures retain the file and retry state without deleting earlier successes", async () => {
  let online = false, calls = 0;
  const f = setup(async () => { calls++; if (!online) throw new TypeError("Failed to fetch"); return new Response("{}"); });
  await assert.rejects(saveSmPhotoJob(f.job, f.dependencies));
  assert.equal(calls, 3); assert.ok(f.job.prepared); assert.ok(f.job.photo); assert.equal(f.job.committed, undefined);
  assert.doesNotMatch(f.job.error!, /Failed to fetch/);
  online = true; await saveSmPhotoJob(f.job, f.dependencies);
  assert.equal(f.job.error, undefined); assert.equal(f.job.committed, true);
  assert.deepEqual(f.counts(), { presigns: 1, commits: 1, prepares: 1 });
});

test("a lost successful PUT response reconciles duplicate storage objects through commit", async () => {
  let calls = 0;
  const f = setup(async () => { if (++calls === 1) throw new TypeError("Lost response"); return new Response(JSON.stringify({ error: "Duplicate", message: "The resource already exists" }), { status: 400 }); });
  await saveSmPhotoJob(f.job, f.dependencies);
  assert.equal(f.job.committed, true); assert.equal(f.counts().commits, 1);
});

test("lost commit responses retry commit, never re-upload or allocate a second storage object", async () => {
  let transfers = 0, commits = 0;
  const f = setup(async () => { transfers++; return new Response("{}"); });
  f.dependencies.commit = async () => { if (++commits < 3) throw new TypeError("Lost commit response"); };
  await saveSmPhotoJob(f.job, f.dependencies);
  assert.equal(transfers, 1); assert.equal(commits, 3); assert.equal(f.job.committed, true);
  await saveSmPhotoJob(f.job, f.dependencies);
  assert.equal(transfers, 1); assert.equal(commits, 3, "Committed jobs are repeat-safe");
});

test("permanent errors do not loop; identity switches stop retries before another write", async () => {
  const f = setup(async () => new Response("{}", { status: 403 }));
  await assert.rejects(saveSmPhotoJob(f.job, f.dependencies)); assert.deepEqual(f.retries, []);
  let current = true, calls = 0;
  const switched = setup(async () => { calls++; current = false; throw new TypeError("Network error"); });
  switched.dependencies.isCurrent = () => current;
  await assert.rejects(saveSmPhotoJob(switched.job, switched.dependencies), /Zugang/);
  assert.equal(calls, 1); assert.deepEqual(switched.retries, []);
});

test("transient HTTP errors retry and unrelated conflicts do not masquerade as uploaded objects", async () => {
  let calls = 0;
  const f = setup(async () => new Response("{}", { status: ++calls < 3 ? 503 : 200 }));
  await saveSmPhotoJob(f.job, f.dependencies); assert.equal(calls, 3);
  const conflict = setup(async () => new Response(JSON.stringify({ error: "Conflict" }), { status: 409 }));
  await assert.rejects(saveSmPhotoJob(conflict.job, conflict.dependencies)); assert.equal(conflict.counts().commits, 0);
});

test("unreadable gallery files give an actionable message without allocating a storage object", async () => {
  const f = setup();
  f.dependencies.prepare = prepareSmPhoto;
  Object.defineProperty(f.job.source, "arrayBuffer", { value: async () => { throw new Error("NotReadableError"); } });
  await assert.rejects(saveSmPhotoJob(f.job, f.dependencies), /erneut aus/);
  assert.equal(f.counts().presigns, 0);
  assert.match(smPhotoErrorMessage(new TypeError("Failed to fetch")), /gespeicherten Fotos/);
});

test("manual recovery after a prolonged disconnect refreshes an expired upload URL", async () => {
  const f = setup();
  f.job.prepared = file(); f.job.answerId = "synthetic-answer";
  f.job.photo = { storageBucket: "sm-visit-photos", storagePath: "old/expired.jpg", mimeType: "image/jpeg", byteSize: 20 };
  f.job.signedUrl = "http://127.0.0.1/expired"; f.job.signedAtMs = Date.now() - 2 * 60 * 60 * 1000;
  await saveSmPhotoJob(f.job, f.dependencies);
  assert.equal(f.job.photo.storagePath, "synthetic/one.jpg"); assert.equal(f.counts().presigns, 1);
  assert.equal(f.job.committed, true);
});
