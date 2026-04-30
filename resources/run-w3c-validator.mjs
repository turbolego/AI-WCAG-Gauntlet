#!/usr/bin/env node
/**
 * Validates an HTML file using the W3C Nu Html Checker API via w3c-html-validator.
 * Usage: node scripts/run-w3c-validator.mjs <html-path> <report-path>
 *
 * Writes a JSON report with { validates, errorCount, messages }.
 */

import { w3cHtmlValidator } from "w3c-html-validator";
import fs from "node:fs/promises";

const [, , htmlPath, reportPath] = process.argv;

if (!htmlPath || !reportPath) {
  console.error("Usage: node scripts/run-w3c-validator.mjs <html-path> <report-path>");
  process.exit(1);
}

const html = await fs.readFile(htmlPath, "utf8");

const results = await w3cHtmlValidator.validate({ html });

const errors = (results.messages ?? []).filter(m => m.type === "error");

const report = {
  validates: results.validates,
  errorCount: errors.length,
  messageCount: (results.messages ?? []).length,
  messages: results.messages ?? [],
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`W3C validation: ${errors.length} error(s), ${report.messageCount} message(s) total`);
