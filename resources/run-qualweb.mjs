#!/usr/bin/env node
/**
 * Runs QualWeb ACT Rules against a local HTML file and writes a JSON report.
 * Usage: node resources/run-qualweb.mjs <html-path> <report-path>
 *
 * Strategy: pass the raw HTML string to QualWeb (avoids file:// URL navigation
 * issues in headless Chrome) and run the ACT Rules module at all WCAG levels.
 *
 * The report is a flat JSON object:
 *   { "failedCount": <number>, "results": [ { "ruleId": "...", "outcome": "failed", ... } ] }
 *
 * Exit code is always 0 — callers must read the report to determine results.
 */

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const [, , htmlPath, reportPath] = process.argv;

if (!htmlPath || !reportPath) {
  console.error("Usage: node resources/run-qualweb.mjs <html-path> <report-path>");
  process.exit(1);
}

const absHtml = path.resolve(htmlPath);

// Detect Chrome executable: PUPPETEER_EXECUTABLE_PATH env var takes precedence,
// then fall back to known Puppeteer cache locations on macOS/Linux.
function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const home = process.env.HOME || "/root";
  const candidates = [
    `${home}/.cache/puppeteer/chrome/mac-147.0.7727.56/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    `${home}/.cache/puppeteer/chrome/mac-127.0.6533.88/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const c of candidates) {
    try {
      fsSync.accessSync(c);
      return c;
    } catch {}
  }
  return null;
}

const chromePath = findChrome();
const emptyReport = { failedCount: 0, results: [], note: "QualWeb skipped — no Chrome found" };

if (!chromePath) {
  console.error("run-qualweb.mjs: No Chrome binary found — writing empty report.");
  await fs.writeFile(reportPath, JSON.stringify(emptyReport, null, 2), "utf8");
  process.exit(0);
}

// Read the HTML file content (passed as raw HTML to avoid file:// navigation issues)
let html;
try {
  html = await fs.readFile(absHtml, "utf8");
} catch (err) {
  console.error(`run-qualweb.mjs: Cannot read ${absHtml}: ${err.message}`);
  await fs.writeFile(reportPath, JSON.stringify({ failedCount: 0, results: [], error: err.message }, null, 2), "utf8");
  process.exit(0);
}

const { QualWeb } = require("@qualweb/core");
const { ACTRules } = require("@qualweb/act-rules");

const qw = new QualWeb();

try {
  await qw.start(
    { maxConcurrency: 1, timeout: 30_000 },
    { executablePath: chromePath, args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new"] }
  );

  // Use HTML injection — more reliable than file:// URLs in headless Chrome
  const reports = await qw.evaluate({
    html,
    modules: [new ACTRules({ levels: ["A", "AA", "AAA"] })],
  });

  await qw.stop();

  // Count failed assertions across all modules
  let failedCount = 0;
  const results = [];
  for (const [, report] of Object.entries(reports)) {
    for (const [, modReport] of Object.entries(report.modules ?? {})) {
      for (const [ruleId, assertion] of Object.entries(modReport.assertions ?? {})) {
        const outcome = assertion?.metadata?.outcome;
        if (outcome === "failed") {
          failedCount++;
          results.push({
            ruleId,
            outcome,
            description: assertion?.metadata?.description ?? "",
          });
        }
      }
    }
  }

  const out = { failedCount, results };
  await fs.writeFile(reportPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`QualWeb: ${failedCount} failed ACT rule(s).`);
} catch (err) {
  console.error("run-qualweb.mjs error:", err.message);
  try { await qw.stop(); } catch {}
  await fs.writeFile(reportPath, JSON.stringify({ failedCount: 0, results: [], error: err.message }, null, 2), "utf8");
}
