import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const docsRoot = join(root, "docs");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return extname(entry.name) === ".md" ? [path] : [];
  }));
  return nested.flat();
}

function localTargets(markdown) {
  const targets = [];
  const link = /\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of markdown.matchAll(link)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(raw)) continue;
    const withoutTitle = raw.split(/\s+["']/u, 1)[0] ?? raw;
    targets.push(decodeURIComponent(withoutTitle.split("#", 1)[0] ?? ""));
  }
  return targets.filter(Boolean);
}

const markdownFiles = await filesUnder(docsRoot);
const failures = [];
for (const file of markdownFiles) {
  const source = await readFile(file, "utf8");
  for (const target of localTargets(source)) {
    const candidate = resolve(dirname(file), target);
    if (!candidate.startsWith(root)) {
      failures.push(`${file}: target escapes repository: ${target}`);
      continue;
    }
    try {
      await stat(candidate);
    } catch {
      failures.push(`${file}: missing ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation link validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation link validation passed for ${markdownFiles.length} Markdown files.`);
}
