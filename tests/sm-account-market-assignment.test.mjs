import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("SM admin can create and edit an inactive Shelf Merchandiser", async () => {
  const page = await read("../src/app/admin/shelfmerchandiser/page.tsx");
  const api = await read("../src/lib/api/backend.ts");
  assert.match(page, /aria-label="Accountstatus"/);
  assert.match(page, /Inaktive SMs können sich nicht anmelden/);
  assert.match(page, /isActive: form\.isActive/);
  assert.match(api, /isActive: payload\.isActive/);
});

test("SM market edit assigns Stammmarkt from SM accounts and Field Service from GM accounts", async () => {
  const page = await read("../src/app/admin/sm/maerkte/page.tsx");
  const backend = await read("../backend/src/routes/sm-markets.ts");
  assert.match(page, /label="Stammmarkt von"[\s\S]*users=\{assignableSmUsers\}/);
  assert.match(page, /label="Field Service Gebietsleiter"[\s\S]*users=\{assignableGmUsers\}/);
  assert.match(page, /fieldServiceManagerUserId: fields\.fieldServiceManagerUserId/);
  assert.match(backend, /loadAssignableUser\(input\.fieldServiceManagerUserId, "gm"\)/);
  assert.match(backend, /fieldServiceManagerName: fieldServiceManager \? smUserDisplayName\(fieldServiceManager\) : ""/);
});
