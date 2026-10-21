import test from "node:test";
import assert from "node:assert/strict";
import { briefingRenderSizes, briefingPdfFailure } from "../src/lib/gm/briefingPdf";

test("tablet, landscape, dense screens and extreme page ratios stay within bitmap limits", () => {
  for (const width of [360, 780, 1040, 4000]) {
    for (const [pageWidth, pageHeight] of [[595, 842], [1920, 1080], [100, 6000], [6000, 100]]) {
      for (const pixelRatio of [1, 2, 3]) {
        const [normal, reduced] = briefingRenderSizes({ width, pageWidth, pageHeight, pixelRatio });
        assert.ok(normal.width * normal.height <= 2_500_000);
        assert.ok(reduced.width * reduced.height <= 750_000);
        assert.ok(Math.max(normal.width, normal.height) <= 3072);
        assert.ok(Math.max(reduced.width, reduced.height) <= 1536);
        assert.ok(reduced.scale < normal.scale, "retry always lowers resolution");
        assert.ok(reduced.width * reduced.height < normal.width * normal.height);
        assert.equal(normal.cssHeight, width * pageHeight / pageWidth);
        assert.equal(reduced.cssHeight, normal.cssHeight, "retry must preserve the displayed page geometry");
      }
    }
  }
});

test("admin thumbnails receive their own smaller memory limits", () => {
  const [normal, reduced] = briefingRenderSizes({ width: 400, pageWidth: 595, pageHeight: 842, pixelRatio: 3, thumbnail: true });
  assert.ok(normal.width * normal.height <= 250_000);
  assert.ok(reduced.width * reduced.height <= 100_000);
});

test("invalid page dimensions fail safely instead of allocating a canvas", () => {
  for (const invalid of [0, -1, NaN, Infinity]) {
    for (const key of ["width", "pageWidth", "pageHeight"] as const) {
      assert.throws(() => briefingRenderSizes({ width: 780, pageWidth: 595, pageHeight: 842, pixelRatio: 2, [key]: invalid }), RangeError);
    }
  }
  assert.deepEqual(briefingRenderSizes({ width: 780, pageWidth: 595, pageHeight: 842, pixelRatio: NaN }),
    briefingRenderSizes({ width: 780, pageWidth: 595, pageHeight: 842, pixelRatio: 1 }));
});

test("render diagnostics distinguish useful failure classes without logging document content", () => {
  for (const [message, code] of [
    ["Total canvas memory use exceeds limit", "memory_limit"],
    ["Cannot use the same canvas during multiple render() operations", "canvas_in_use"],
    ["Cannot read properties of null (reading getContext)", "canvas_context"],
    ["someBrowserFeature is not a function", "browser_feature"],
    ["Failed to decode image bitmap", "image_decode"],
    ["Failed to fetch https://private.invalid/signed?secret=synthetic", "network"],
    ["Synthetic Person: confidential page text", "other"],
  ]) {
    assert.deepEqual(briefingPdfFailure(new Error(message)), { errorName: "Error", errorCode: code });
  }
  assert.deepEqual(briefingPdfFailure({ name: "Synthetic Person", message: "private.pdf" }), { errorName: "Error", errorCode: "other" });
  assert.deepEqual(briefingPdfFailure(null), { errorName: "Error", errorCode: "other" });
});
