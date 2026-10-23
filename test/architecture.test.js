import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

async function sourceFiles(directory) {
  const files = await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : filename;
  }));
  return files.flat().filter(filename => /\.(jsx?|css)$/.test(filename) && !filename.endsWith(".test.js"));
}

async function resolveImport(filename, specifier) {
  const target = path.resolve(path.dirname(filename), specifier);
  for (const candidate of [target, `${target}.js`, `${target}.jsx`]) {
    try { await access(candidate); return candidate; } catch { /* Try the next extension. */ }
  }
  assert.fail(`${path.relative(root, filename)}: import não encontrado: ${specifier}`);
}

test("imports resolvem e respeitam os limites entre compartilhado, funcionalidades e sistemas", async () => {
  for (const filename of await sourceFiles(path.join(root, "src"))) {
    const source = path.relative(path.join(root, "src"), filename).split(path.sep);
    const content = await readFile(filename, "utf8");
    const imports = content.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g);
    for (const [, specifier] of imports) {
      const resolved = await resolveImport(filename, specifier);
      const target = path.relative(path.join(root, "src"), resolved).split(path.sep);
      const description = `${source.join("/")} → ${target.join("/")}`;
      assert.ok(!target.includes(".."), description);
      if (source[0] === "shared") assert.equal(target[0], "shared", description);
      if (source[0] === "systems" && source.length > 2) {
        assert.ok(target[0] === "shared" || (target[0] === "systems" && target[1] === source[1]), description);
      }
    }
  }
});
