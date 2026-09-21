import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { START_HERE, libraryStats, loadLibrary } from "./library";
import { FREE_TOOLS } from "./tools";

const RESOURCES = path.join(process.cwd(), "public", "resources");

describe("the Library catalogue", () => {
  const shelves = loadLibrary();
  const entries = shelves.flatMap((s) => s.entries);

  it("lists every downloadable file in public/resources exactly once", () => {
    const onDisk = fs
      .readdirSync(RESOURCES, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.(pdf|docx|xlsx)$/i.test(d.name))
      .map((d) =>
        `/resources/${path.relative(RESOURCES, path.join(d.parentPath, d.name)).split(path.sep).join("/")}`,
      )
      .sort();
    const listed = entries.flatMap((e) => e.files.map((f) => f.url)).sort();
    assert.deepEqual(listed, onDisk);
  });

  it("has a written catalogue note for every title", () => {
    for (const entry of entries) {
      assert.ok(entry.description, `${entry.slug} has no description`);
      assert.ok(entry.length, `${entry.slug} has no length`);
    }
  });

  it("gives every title a unique call number", () => {
    const numbers = entries.map((e) => e.callNumber);
    assert.equal(new Set(numbers).size, numbers.length);
  });

  it("only features titles that exist", () => {
    const slugs = new Set(entries.map((e) => e.slug));
    for (const pick of START_HERE) assert.ok(slugs.has(pick.slug), pick.slug);
  });

  it("counts editable titles by their DOCX/XLSX files", () => {
    const stats = libraryStats(shelves);
    assert.equal(stats.total, entries.length);
    assert.equal(
      stats.editable,
      entries.filter((e) => e.files.some((f) => f.format !== "PDF")).length,
    );
  });
});

describe("the free AI tools registry", () => {
  it("points every tool at a real page", () => {
    for (const tool of FREE_TOOLS) {
      const page = path.join(process.cwd(), "app", tool.href, "page.tsx");
      assert.ok(fs.existsSync(page), `${tool.href} has no page`);
    }
  });
});
