import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import postcss from "postcss";
import ts from "typescript";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [page, layout, client, stylesheet] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/app/layout.tsx"),
  read("src/components/LoginPage.tsx"),
  read("src/components/login.css"),
]);
const css = postcss.parse(stylesheet);

function viewport(source) {
  const file = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statement = file.statements.find((node) => ts.isVariableStatement(node)
    && node.declarationList.declarations.some((item) => item.name.getText(file) === "viewport"));
  const declaration = statement?.declarationList.declarations.find((item) => item.name.getText(file) === "viewport");
  assert.ok(declaration && ts.isObjectLiteralExpression(declaration.initializer));
  return Object.fromEntries(declaration.initializer.properties.map((property) => [
    property.name.getText(file), property.initializer.getText(file).replace(/^"|"$/g, ""),
  ]));
}

function values(selector, property, media) {
  const found = [];
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const ruleMedia = rule.parent.type === "atrule" ? rule.parent.params : undefined;
    if (ruleMedia !== media) return;
    rule.walkDecls(property, (declaration) => found.push(declaration.value));
  });
  return found;
}

test("only the server-rendered login route opts into edge-to-edge viewport coverage", () => {
  assert.doesNotMatch(page, /^\s*["']use client["']/);
  assert.equal(viewport(page).viewportFit, "cover");
  assert.equal(viewport(layout).viewportFit, undefined, "Dashboard viewport behavior must not change");
  assert.match(page, /return <LoginPage \/>/);
  assert.match(client, /^"use client"/);
});

test("document background and Safari theme match the login red without affecting other routes", () => {
  const red = values(".cs-login-page", "--coke-red")[0];
  assert.equal(viewport(page).themeColor, red);
  for (const selector of ["html:has(.cs-login-page)", "body:has(.cs-login-page)"]) {
    assert.deepEqual(values(selector, "background-color"), [red]);
  }
  assert.deepEqual(values("html", "background-color"), []);
  assert.deepEqual(values("body", "background-color"), []);
});

test("login fills the changing mobile viewport and protects content at all four safe edges", () => {
  assert.deepEqual(values(".cs-login-page", "min-height"), ["100vh", "100dvh"]);
  const padding = values(".cs-login-page", "padding")[0];
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.ok(padding.includes(`env(safe-area-inset-${edge}, 0px)`));
  }
  assert.deepEqual(values(".cs-login-page", "padding-bottom", "(max-width: 980px)"), [
    "calc(42px + env(safe-area-inset-bottom, 0px))",
  ]);
});

test("fixed footer and landscape form stay clear of the home indicator and notch", () => {
  for (const media of ["(max-width: 980px)", "(min-width: 981px)"]) {
    assert.match(values(".cs-brand-foot", "bottom", media)[0], /env\(safe-area-inset-bottom, 0px\)/);
    assert.match(values(".cs-brand-foot", "left", media)[0], /env\(safe-area-inset-left, 0px\)/);
  }
  const media = "(min-width: 700px) and (max-width: 980px)";
  for (const edge of ["left", "right"]) {
    assert.deepEqual(values(".cs-login-pane", edge, media), [`env(safe-area-inset-${edge}, 0px)`]);
  }
});
