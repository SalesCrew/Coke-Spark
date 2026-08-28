import assert from "node:assert/strict";
import test from "node:test";

import {
  SM_OFFLINE_CACHE_TTL_MS,
  isSmOfflineCacheTimestampFresh,
  sanitizeSmVisitPayloadForPersistentCache,
} from "./privacyCache";
import type { SmVisitPayload } from "../../types/smVisit";

test("persistent SM visit cache never stores signed photo credentials", () => {
  const payload = {
    assignment: { id: "assignment-1" },
    sections: [],
    answers: {},
    answerVersions: {},
    photoFiles: {
      "question-1": [{ id: "photo-1", fileName: "foto.jpg", mimeType: "image/jpeg", byteSize: 123, signedUrl: "https://storage.example/signed?token=secret" }],
    },
  } as unknown as SmVisitPayload;

  const sanitized = sanitizeSmVisitPayloadForPersistentCache(payload);

  assert.equal(sanitized.photoFiles["question-1"]?.[0]?.signedUrl, null);
  assert.equal(payload.photoFiles["question-1"]?.[0]?.signedUrl, "https://storage.example/signed?token=secret");
});

test("SM offline cache timestamps are finite, bounded and expire after 30 days", () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  assert.equal(isSmOfflineCacheTimestampFresh(now, now), true);
  assert.equal(isSmOfflineCacheTimestampFresh(now - SM_OFFLINE_CACHE_TTL_MS, now), true);
  assert.equal(isSmOfflineCacheTimestampFresh(now - SM_OFFLINE_CACHE_TTL_MS - 1, now), false);
  assert.equal(isSmOfflineCacheTimestampFresh(now + 6 * 60 * 1000, now), false);
  assert.equal(isSmOfflineCacheTimestampFresh("not-a-time", now), false);
});
