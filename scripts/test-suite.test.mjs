import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse, serialize } from "parse5";
import { REQUIRED_HTML5_TAGS, readFixture } from "./benchmark-task.mjs";
import { checkLegacy } from "./check-legacy-tags.mjs";

const root = path.resolve(import.meta.dirname, "..");
const obsolete = new Set(JSON.parse(fs.readFileSync(path.join(root, "resources/legacy_tags.json"))).tags);

function repairedFixture() {
  const tree = parse(readFixture("norwegian-news"));
  function visit(node) {
    if (obsolete.has(node.tagName)) node.tagName = node.nodeName = "span";
    if (node.attrs) {
      node.attrs = node.attrs.filter(attr => !["style", "role", "color", "size", "face", "bgcolor",
        "align", "valign", "border", "cellpadding", "cellspacing", "width"].includes(attr.name));
      if (node.tagName === "img" && !node.attrs.some(attr => attr.name === "alt")) {
        node.attrs.push({ name: "alt", value: "Illustrasjon" });
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(tree);
  return serialize(tree);
}

function harness(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-suite-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const stub = path.join(dir, "validator.mjs");
  fs.writeFileSync(stub, `
import fs from 'node:fs';
import path from 'node:path';
const [, , script, input, output] = process.argv;
const name = path.basename(script);
if (name === 'run-w3c-validator.mjs') fs.writeFileSync(output, '{"errorCount":0}');
else if (name === 'run-axe.mjs') fs.writeFileSync(output, '{"violations":[],"testEngine":{"version":"test"}}');
else if (name === 'run-qualweb.mjs') {
  const report = {failedCount:0, results:[]};
  if (process.env.TEST_QUALWEB_FAILURE) report.error = 'simulated crash';
  if (process.env.TEST_QUALWEB_SKIPPED) report.note = 'QualWeb skipped - no Chrome found';
  fs.writeFileSync(output, process.env.TEST_QUALWEB_MALFORMED ? 'invalid JSON' : JSON.stringify(report));
}
else throw Error('Unexpected mocked validator: ' + name);
`);
  fs.writeFileSync(path.join(bin, "node"), `#!/bin/bash
case "$1" in
  */run-w3c-validator.mjs|*/run-axe.mjs|*/run-qualweb.mjs)
    exec "${process.execPath}" "${stub}" "$@" ;;
  *) exec "${process.execPath}" "$@" ;;
esac
`, { mode: 0o755 });
  const pa11yStub = path.join(dir, "pa11y.mjs");
  fs.writeFileSync(pa11yStub, `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('test');
} else {
  assert.ok(!args.includes('--chrome-launch-config'), 'Unsupported Pa11y CLI option');
  const index = args.indexOf('--config');
  assert.ok(index >= 0, 'Missing Pa11y --config file');
  const configPath = args[index + 1];
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.chromeLaunchConfig.executablePath, process.env.CHROME_FOR_TESTING_PATH);
  assert.ok(config.chromeLaunchConfig.args.includes('--headless=new'));
  assert.ok(config.chromeLaunchConfig.args.includes('--user-data-dir=' + path.join(path.dirname(configPath), 'pa11y')));
  if (!process.env.TEST_PA11Y_EMPTY) console.log(process.env.TEST_PA11Y_EXIT === '2' ? '[{"message":"test violation"}]' : '[]');
  process.exitCode = Number(process.env.TEST_PA11Y_EXIT ?? 0);
}
`);
  fs.writeFileSync(path.join(bin, "pa11y"), `#!/bin/bash
exec "${process.execPath}" "${pa11yStub}" "$@"
`, { mode: 0o755 });
  return (html, extraEnv = {}, task = "legacy-repair") => {
    const runDir = path.join(dir, `run-${fs.readdirSync(dir).length}`);
    fs.mkdirSync(runDir);
    fs.writeFileSync(path.join(runDir, "index.html"), html);
    if (task === "legacy-repair") {
      fs.writeFileSync(path.join(runDir, "task.json"), JSON.stringify({
        task, fixture: "norwegian-news", task_version: 1
      }));
    }
    // Browser tools are stubs: this tests orchestration and pass gates, not WCAG conformance.
    const run = spawnSync("bash", ["-c", 'OSTYPE=linux; source "$1" "$2"',
      "suite-test", path.join(root, "test-suite.sh"), runDir], {
      encoding: "utf8", timeout: 30000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
        CHROME_FOR_TESTING_PATH: process.execPath, A11Y_SERVE_PORT: "0", ...extraEnv }
    });
    const resultPath = path.join(runDir, "test_results.json");
    return { ...run, result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath)).at(-1) : null };
  };
}

test("Bash repair suite gates on legacy findings AND all required tags including selectedcontent", t => {
  const run = harness(t);
  const coverage = REQUIRED_HTML5_TAGS.map(tag => `<${tag}></${tag}>`).join("");
  const baseline = readFixture("norwegian-news");
  const clean = repairedFixture();
  const cleanReport = checkLegacy(clean, { fixtureHtml: baseline });
  assert.equal(cleanReport.legacy_error_count, 0, JSON.stringify(cleanReport));

  const residual = run(`${baseline}<template>${coverage}</template>`);
  assert.equal(residual.status, 0, residual.stderr);
  assert.equal(residual.result.html_tag_errors, 0);
  assert.equal(residual.result.status, "fail");
  assert.ok(residual.result.legacy_errors > 0);

  const missing = run(`${clean}<template>${coverage.replace("<selectedcontent></selectedcontent>", "")}</template>`);
  assert.equal(missing.status, 0, missing.stderr);
  assert.deepEqual(missing.result.missing_tags, ["selectedcontent"]);
  assert.equal(missing.result.legacy_errors, 0);
  assert.equal(missing.result.status, "fail");

  const passed = run(`${clean}<template>${coverage}</template>`);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.result.status, "pass");
  assert.equal(passed.result.fixture, "norwegian-news");
  assert.equal(passed.result.legacy_errors, 0);
  assert.match(passed.stdout, /STATUS: PASS/);
});

test("Bash repair suite rejects crashed, empty, skipped, and malformed validator scans", t => {
  const run = harness(t);
  for (const env of [{ TEST_PA11Y_EXIT: "1" }, { TEST_PA11Y_EMPTY: "1" },
    { TEST_QUALWEB_FAILURE: "1" }, { TEST_QUALWEB_SKIPPED: "1" }, { TEST_QUALWEB_MALFORMED: "1" }]) {
    const result = run(repairedFixture(), env);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.result, null);
    assert.ok(!result.stdout.includes("STATUS: PASS"));
  }
});

test("Bash repair suite accepts completed Pa11y scans that exit 2 with findings", t => {
  const run = harness(t);
  const result = run(repairedFixture(), { TEST_PA11Y_EXIT: "2" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.result.pa11y_issues, 1);
  assert.equal(result.result.status, "fail");
});

test("Bash showcase suite does not record empty or malformed scans as zero findings", t => {
  const run = harness(t);
  for (const env of [{ TEST_PA11Y_EMPTY: "1" }, { TEST_QUALWEB_MALFORMED: "1" }]) {
    const result = run(repairedFixture(), env, "showcase");
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.result, null);
    assert.ok(!result.stdout.includes("STATUS: PASS"));
  }
});
