import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function compileComponent(source, url, name) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: fileURLToPath(url),
  });
  const componentModule = { exports: {} };
  runInNewContext(outputText, {
    module: componentModule,
    exports: componentModule.exports,
    require: createRequire(url),
  });
  return componentModule.exports[name];
}

const smUrl = new URL("../src/components/admin/sm/SmFragebogenSkeleton.tsx", import.meta.url);
const SmSkeleton = compileComponent(await readFile(smUrl, "utf8"), smUrl, "SmFragebogenSkeleton");
const markup = renderToStaticMarkup(createElement(SmSkeleton));
const workspace = await readFile(new URL("../src/components/admin/sm/SmFragebogenWorkspace.tsx", import.meta.url), "utf8");

test("SM matches the existing GM header, divider, card and seven placeholder rows", async () => {
  const gmUrl = new URL("../src/app/admin/fragebogen/page.tsx", import.meta.url);
  const gmSource = await readFile(gmUrl, "utf8");
  const ast = ts.createSourceFile(fileURLToPath(gmUrl), gmSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const skeleton = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "FragebogenPageSkeleton");
  assert.ok(skeleton, "GM reference skeleton must exist");
  // Compile only the pure GM skeleton; no GM contexts, requests or mutations execute.
  const GmSkeleton = compileComponent(`${skeleton.getText(ast)}\nexport { FragebogenPageSkeleton };`, gmUrl, "FragebogenPageSkeleton");
  const normalize = (html) => html.replace(/ (?:role|aria-[\w-]+)="[^"]*"/g, "").replace(/max-width:100%;?/g, "");
  assert.equal(normalize(markup), normalize(renderToStaticMarkup(createElement(GmSkeleton))));
  assert.equal([...markup.matchAll(/height:40px/g)].length, 7);
});

test("SM loading is accessible, fits narrow containers and has no interactive controls", () => {
  assert.ok(markup.includes('role="status"'));
  assert.ok(markup.includes('aria-label="SM-Fragebogen werden geladen"'));
  assert.equal([...markup.matchAll(/aria-hidden="true"/g)].length, 3);
  assert.ok(markup.includes("max-width:100%"));
  assert.doesNotMatch(markup, /<(button|input|a)\b/);
  assert.equal(renderToStaticMarkup(createElement(SmSkeleton)), markup);
});

test("All SM tabs show only the full-page skeleton until loading finishes", () => {
  const guard = workspace.indexOf("if (isLoading) return <SmFragebogenSkeleton />;");
  assert.ok(guard > 0);
  assert.ok(guard < workspace.indexOf('<div className="sm-fb-page">'));
  assert.ok(guard > workspace.lastIndexOf("useEffect("), "Loading guard must follow all hooks");
  assert.doesNotMatch(workspace, /<strong>SM-Fragebogen werden geladen<\/strong>/);
});

test("A failed load does not also display empty questions or questionnaires", () => {
  assert.match(workspace, /!loadError && activeTab === "fragen" \? \(/);
  assert.match(workspace, /!loadError && activeTab === "fragebogen" \? \(/);
  assert.ok(workspace.includes("Erneut versuchen"));
});
