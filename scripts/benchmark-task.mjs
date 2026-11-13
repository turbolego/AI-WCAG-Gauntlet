import { readFileSync } from "node:fs";
import { SAXParser } from "parse5-sax-parser";

export const REQUIRED_HTML5_TAGS = Object.freeze(
  JSON.parse(readFileSync(new URL("../resources/html_tags.json", import.meta.url), "utf8")).tags
);
export const FIXTURES = Object.freeze(["norwegian-news", "community-portal", "local-directory"]);

export function validateTask(task = "showcase", fixture = null) {
  if (!["showcase", "legacy-repair"].includes(task)) {
    throw new Error(`Unknown benchmark task: ${task}`);
  }
  if (task === "legacy-repair" && !FIXTURES.includes(fixture)) {
    throw new Error(`Legacy repair requires --fixture ${FIXTURES.join("|")}`);
  }
  if (task === "showcase" && fixture != null) {
    throw new Error("--fixture is only supported for legacy-repair");
  }
  return { task, fixture, task_version: 1 };
}

export function readFixture(fixture) {
  validateTask("legacy-repair", fixture);
  return readFileSync(new URL(`../resources/fixtures/legacy/${fixture}.html`, import.meta.url), "utf8");
}

export function findHtmlTags(html) {
  const found = new Set();
  // Tokenize source so newer elements are not discarded by tree-building rules.
  const parser = new SAXParser();
  parser.on("startTag", token => found.add(token.tagName));
  parser.end(html);
  return found;
}

export function buildTaskPrompt({ iteration, task = "showcase", fixture = null,
  fixtureHtml = "", candidateHtml = "", candidateCss = "" }) {
  validateTask(task, fixture);
  if (task === "legacy-repair" && !fixtureHtml) throw new Error("Missing legacy fixture HTML");
  return [
    "Output ONLY valid JSON with string fields html, css, js. No markdown fences or explanations.",
    task === "legacy-repair"
      ? "Repair the supplied legacy page into valid semantic HTML5 meeting WCAG 2.2 AAA. Preserve all meaningful visible content and link destinations. Replace deprecated elements and presentation attributes with semantic markup and CSS; remove layout tables, absolute-positioned div clusters and unnamed image links."
      : "Build a single-page technical showcase meeting WCAG 2.2 AAA.",
    "Use EVERY required HTML5 tag at least once, in BOTH tasks:",
    REQUIRED_HTML5_TAGS.join(", "),
    "selectedcontent is required: place it inside the button child of a customizable select. Do not use obsolete param.",
    "Use valid nesting, labels, landmarks, accessible names, keyboard controls, captions, and AAA contrast.",
    "Link style.css and script.js when used. Use existing media under /AI-WCAG-Gauntlet/resources/.",
    `Iteration ${iteration}.`,
    fixtureHtml ? `Original synthetic fixture (${fixture}):\n${fixtureHtml}` : "",
    candidateHtml ? `Previous candidate HTML (repair this, do not restart):\n${candidateHtml}` : "",
    candidateCss ? `Previous candidate CSS:\n${candidateCss}` : ""
  ].filter(Boolean).join("\n");
}
