import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { addIcons, generateIconsMap, iconIdentifier } from "./index.mjs";

test("icon identifiers use PascalCase and variant suffixes", () => {
  assert.equal(iconIdentifier("arrow-right", "filled"), "TIconArrowRight");
  assert.equal(iconIdentifier("arrow-left", "outline"), "TIconArrowLeftOutline");
});

test("adds both variants, sorts, preserves icons, and is repeatable", async (t) => {
  const root = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), ".test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cacheDirectory = path.join(root, "cache");
  for (const variant of ["filled", "outline"]) {
    await mkdir(path.join(cacheDirectory, variant), { recursive: true });
    for (const name of ["arrow-left", "arrow-right"]) {
      await writeFile(path.join(cacheDirectory, variant, `${name}.svg`), "<svg />");
    }
  }
  await writeFile(path.join(cacheDirectory, ".complete"), "test cache");
  await writeFile(path.join(cacheDirectory, "LICENSE"), "MIT");
  const options = { mobileRoot: root, cacheDirectory };
  await addIcons(["arrow-right", "arrow-left", "arrow-right"], options);
  await addIcons(["arrow-left"], { ...options, variant: "outline" });
  const mapPath = path.join(root, "src/app/assets/icons/iconsMap.ts");
  const first = await readFile(mapPath, "utf8");
  assert.match(first, /TIconArrowLeftOutline/);
  assert.match(first, /TIconArrowRight/);
  assert.match(first, /createAnimatedComponent/);
  assert.ok(
    first.indexOf("import TIconArrowLeft from") < first.indexOf("import TIconArrowRight from"),
  );
  await addIcons(["arrow-right"], options);
  assert.equal(await readFile(mapPath, "utf8"), first);
  assert.deepEqual(await readdir(path.join(root, "src/assets/tabler/filled")), [
    "arrow-left.svg",
    "arrow-right.svg",
  ]);
  await assert.rejects(
    addIcons(["arrow-right", "missing-icon"], { ...options, variant: "outline" }),
    /missing-icon/,
  );
  assert.deepEqual(await readdir(path.join(root, "src/assets/tabler/outline")), ["arrow-left.svg"]);
  assert.equal(await readFile(mapPath, "utf8"), first);
  await assert.rejects(addIcons(["../outside"], options), /Invalid icon name/);
  await assert.rejects(addIcons([], options), /at least one/);
  await assert.rejects(
    addIcons(["arrow-left"], { ...options, variant: "other" }),
    /Unknown variant/,
  );
  const empty = await generateIconsMap(path.join(root, "empty"));
  assert.match(empty, /const tabler = \{\};/);
});
