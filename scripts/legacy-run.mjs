import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFixture, validateTask } from "./benchmark-task.mjs";
import { checkLegacy } from "./check-legacy-tags.mjs";

export function legacyRunReport(dir) {
  const read = filename => JSON.parse(fs.readFileSync(path.join(dir, filename), "utf8").replace(/^\uFEFF/, ""));
  const task = read("task.json");
  validateTask(task.task, task.fixture);
  if (task.task !== "legacy-repair") throw new Error("Not a legacy-repair run");
  const fixtureHtml = readFixture(task.fixture);
  const report = checkLegacy(fs.readFileSync(path.join(dir, "index.html"), "utf8"), { fixtureHtml });
  const baseline = checkLegacy(fixtureHtml);
  let axe = read("axe_report.json");
  if (Array.isArray(axe)) axe = axe[0];
  if (!Array.isArray(axe?.violations)) throw new Error("Invalid axe report");
  const pa11y = read("pa11y_report.json");
  if (!Array.isArray(pa11y) && !Array.isArray(pa11y?.issues)) throw new Error("Invalid Pa11y report");
  const qualweb = read("qualweb_report.json");
  if (!qualweb || Object.hasOwn(qualweb, "error") || Object.hasOwn(qualweb, "note")
    || !Number.isInteger(qualweb.failedCount) || qualweb.failedCount < 0 || !Array.isArray(qualweb.results)) {
    throw new Error("QualWeb did not produce a valid completed scan");
  }
  const w3c = read("w3c_report.json");
  if (w3c.error || !Number.isInteger(w3c.errorCount)) throw new Error("Invalid W3C report");
  const residualAxe = Object.fromEntries(["color-contrast", "color-contrast-enhanced", "region", "link-name"]
    .map(id => [id, axe.violations.filter(v => v.id === id).reduce((n, v) => n + v.nodes.length, 0)]));
  return {
    ...report, task: task.task, task_version: task.task_version, fixture: task.fixture,
    baseline_legacy_present: baseline.legacy_present,
    baseline_legacy_patterns: baseline.legacy_patterns_matched,
    residual_axe: residualAxe
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const dir = process.argv[2];
    if (!dir) throw new Error("Usage: node scripts/legacy-run.mjs <run-directory>");
    fs.writeFileSync(path.join(dir, "legacy_report.json"), JSON.stringify(legacyRunReport(dir), null, 2));
  } catch (error) {
    console.error(`Legacy evaluation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
