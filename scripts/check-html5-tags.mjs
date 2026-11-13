import fs from "node:fs/promises";
import { REQUIRED_HTML5_TAGS, findHtmlTags } from "./benchmark-task.mjs";

const [, , htmlPath, reportPath] = process.argv;

if (!htmlPath || !reportPath) {
  console.error("Usage: node scripts/check-html5-tags.mjs <html-path> <report-path>");
  process.exit(1);
}

const htmlContent = await fs.readFile(htmlPath, "utf8");
const foundTags = findHtmlTags(htmlContent);

const missingTags = REQUIRED_HTML5_TAGS.filter((tag) => !foundTags.has(tag));
const report = {
  used_tags: REQUIRED_HTML5_TAGS.filter(tag => foundTags.has(tag)),
  missing_tags: missingTags,
  requiredCount: REQUIRED_HTML5_TAGS.length,
  foundCount: REQUIRED_HTML5_TAGS.length - missingTags.length,
  missingCount: missingTags.length,
  missingTags
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
