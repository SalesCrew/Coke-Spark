import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = path.resolve("public/pdfjs/6.4.299-legacy");
await mkdir(target, { recursive: true });
await Promise.all(
  ["cmaps", "standard_fonts", "wasm"].map((name) =>
    cp(path.join(source, name), path.join(target, name), { recursive: true }),
  ),
);
await cp(
  path.join(source, "legacy/build/pdf.worker.min.mjs"),
  path.join(target, "pdf.worker.min.mjs"),
);

await cp(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
