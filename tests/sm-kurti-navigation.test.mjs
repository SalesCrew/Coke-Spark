import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("SM Kurti's guide covers the actual SM admin navigation",async()=>{
 const [nav,tools]=await Promise.all([
  readFile(new URL("../src/components/ui/adminNavigation.ts",import.meta.url),"utf8"),
  readFile(new URL("../backend/src/lib/sm-kurti-tools.ts",import.meta.url),"utf8")
 ]);
 const expected=[...nav.matchAll(/href: "([^"]+)"[^\n]*workspace: "sm"/g)].map(m=>m[1]).sort();
 const actual=[...tools.matchAll(/href:"([^"]+)"/g)].map(m=>m[1]).sort();
 assert.ok(expected.length>=12);
 assert.deepEqual(actual,expected);
});

