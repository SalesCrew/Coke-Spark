import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import postcssConfig from "../postcss.config.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");
const stylesheet = path.join(sourceRoot, "app", "globals.css");
let result;

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

before(async () => {
  const plugins = await Promise.all(
    Object.entries(postcssConfig.plugins).map(async ([name, options]) => {
      const { default: plugin } = await import(name);
      return plugin(options);
    }),
  );
  result = await postcss(plugins).process(await readFile(stylesheet, "utf8"), {
    from: stylesheet,
  });
});

test("Tailwind directory watchers stay inside frontend sources", () => {
  const directories = result.messages.filter((message) => message.type === "dir-dependency");
  assert.ok(directories.length > 0, "Source watching must remain enabled");
  for (const { dir } of directories) {
    assert.ok(isWithin(sourceRoot, dir), `Unexpected watched directory: ${dir}`);
  }
});

test("Log writes, backend files and temporary artifacts cannot invalidate frontend styles", () => {
  const dependencies = result.messages.filter((message) => message.type === "dependency");
  assert.ok(dependencies.length > 0);
  for (const { file } of dependencies) {
    assert.ok(
      isWithin(sourceRoot, file) || isWithin(path.join(projectRoot, "node_modules"), file),
      `Unexpected stylesheet dependency: ${file}`,
    );
  }
});

test("App pages and shared components still participate in style generation", () => {
  const files = new Set(
    result.messages.filter((message) => message.type === "dependency").map(({ file }) => path.resolve(file)),
  );
  for (const file of ["app/layout.tsx", "app/admin/fotoarchiv/page.tsx", "components/Login.tsx", "components/admin/sm/SmDashboardWorkspace.tsx"]) {
    assert.ok(files.has(path.resolve(sourceRoot, file)), `Missing frontend source: ${file}`);
  }
  for (const selector of [".antialiased", ".flex", ".fixed", ".items-center"]) {
    let found = false;
    result.root.walkRules((rule) => {
      if (rule.selector === selector) found = true;
    });
    assert.ok(found, `Missing utility: ${selector}`);
  }
});
