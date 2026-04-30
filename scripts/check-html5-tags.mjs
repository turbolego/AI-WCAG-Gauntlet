import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlTagsPath = path.resolve(__dirname, "..", "resources", "html_tags.json");
const REQUIRED_HTML5_TAGS = JSON.parse(readFileSync(htmlTagsPath, "utf8")).tags;

const [, , htmlPath, reportPath] = process.argv;

if (!htmlPath || !reportPath) {
  console.error("Usage: node scripts/check-html5-tags.mjs <html-path> <report-path>");
  process.exit(1);
}

const htmlContent = await fs.readFile(htmlPath, "utf8");
const foundTags = new Set();

const tagRegex = /<\s*([a-zA-Z][a-zA-Z0-9-]*)\b/g;
for (const match of htmlContent.matchAll(tagRegex)) {
  foundTags.add(match[1].toLowerCase());
}

const missingTags = REQUIRED_HTML5_TAGS.filter((tag) => !foundTags.has(tag));
const report = {
  requiredCount: REQUIRED_HTML5_TAGS.length,
  foundCount: REQUIRED_HTML5_TAGS.length - missingTags.length,
  missingCount: missingTags.length,
  missingTags
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
