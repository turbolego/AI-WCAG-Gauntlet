import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { groupRunsIntoSessions, aggregateLegacyStats } from "./aggregate-stats.mjs";
import { legacyRunReport } from "./legacy-run.mjs";
import { readFixture } from "./benchmark-task.mjs";

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-stats-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, filename, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data));
}
function seedRepair(dir, fixture = "norwegian-news") {
  write(dir, "task.json", { task: "legacy-repair", fixture, task_version: 1 });
  fs.writeFileSync(path.join(dir, "index.html"), readFixture(fixture));
  write(dir, "w3c_report.json", { errorCount: 2 });
  write(dir, "axe_report.json", [{
    violations: [{ id: "color-contrast-enhanced", nodes: [{}, {}] }, { id: "region", nodes: [{}] }]
  }]);
  write(dir, "pa11y_report.json", []);
  write(dir, "qualweb_report.json", { failedCount: 0, results: [] });
  return legacyRunReport(dir);
}

test("repair evaluation measures fixture baseline, residual markup and focused axe counts", t => {
  const dir = temporary(t);
  const report = seedRepair(dir);
  assert.equal(report.fixture, "norwegian-news");
  assert.ok(report.legacy_error_count > 0);
  assert.deepEqual(report.baseline_legacy_present, report.legacy_present);
  assert.deepEqual(report.preservation_errors, []);
  assert.equal(report.residual_axe["color-contrast-enhanced"], 2);
  assert.equal(report.residual_axe.region, 1);
  for (const invalid of [
    { failedCount: 0, results: [], error: "browser crashed" },
    { failedCount: 0, results: [], note: "QualWeb skipped - no Chrome found" },
    { failedCount: -1, results: [] },
    { failedCount: 0, results: null }
  ]) {
    write(dir, "qualweb_report.json", invalid);
    assert.throws(() => legacyRunReport(dir), /valid completed scan/);
  }
  write(dir, "qualweb_report.json", { failedCount: 0, results: [] });
  fs.rmSync(path.join(dir, "pa11y_report.json"));
  assert.throws(() => legacyRunReport(dir), /ENOENT/);
});

test("aggregation reads historical objects and array histories without changing recorded scores", t => {
  const dir = temporary(t);
  const old = path.join(dir, "model", "001-old");
  write(old, "metadata.json", { iteration: 1 });
  write(old, "test_results.json", { status: "fail", html_tag_errors: 1, score: 42 });
  write(old, "html5_tag_report.json", { missingTags: ["selectedcontent"] });
  const modern = path.join(dir, "model", "002-array");
  write(modern, "test_results.json", [
    { iteration: 1, status: "fail", score: 54, html_tag_errors: 1, missing_tags: ["selectedcontent"] },
    { iteration: 2, status: "pass", score: 192, html_tag_errors: 0, missing_tags: [] }
  ]);
  const sessions = groupRunsIntoSessions(path.join(dir, "model"), "MODEL");
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].task, "showcase");
  assert.equal(sessions[0].iterations[0].score, 42);
  assert.deepEqual(sessions[0].iterations[0].missing_tags, ["selectedcontent"]);
  assert.equal(sessions[1].iterations.length, 2);
  assert.equal(sessions[1].iterations.at(-1).score, 192);
  const out = path.join(dir, "stats.json");
  const run = spawnSync(process.execPath, ["scripts/aggregate-stats.mjs", "--benchDir", dir, "--outFile", out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const stats = JSON.parse(fs.readFileSync(out));
  assert.deepEqual(stats.leaderboard.map(row => row.score), [192, 42]);
});

test("legacy statistics keep separate task/fixture sessions, baselines, rates and residual issues", t => {
  const dir = temporary(t);
  const modelDir = path.join(dir, "model");
  const first = path.join(modelDir, "001-repair");
  const original = seedRepair(first);
  const cleaned = { ...original, legacy_present: [], legacy_patterns_matched: [],
    legacy_error_count: 0, residual_axe: {} };
  write(first, "test_results.json", [
    { iteration: 1, task: "legacy-repair", fixture: "norwegian-news", status: "fail", score: 50, legacy: original },
    { iteration: 2, task: "legacy-repair", fixture: "norwegian-news", status: "pass", score: 190, legacy: cleaned }
  ]);
  const second = path.join(modelDir, "002-repair");
  const residual = seedRepair(second, "community-portal");
  write(second, "test_results.json", {
    iteration: 3, task: "legacy-repair", fixture: "community-portal", status: "fail", score: 45, legacy: residual
  });

  const sessions = groupRunsIntoSessions(modelDir, "MODEL");
  assert.equal(sessions.length, 2);
  const stats = aggregateLegacyStats(sessions);
  assert.equal(stats.legacy_repair_stats[0].runs, 2);
  assert.equal(stats.legacy_repair_stats[0].pass_rate, 50);
  assert.equal(stats.legacy_repair_stats[0].deprecated_tags_removed,
    original.baseline_legacy_present.reduce((sum, item) => sum + item.count, 0));
  assert.equal(stats.legacy_repair_stats[0].residual_axe.region, 1);
  assert.ok(stats.hardest_legacy_patterns.some(row => row.residual_runs > 0));
  const out = path.join(dir, "stats.json");
  const run = spawnSync(process.execPath, ["scripts/aggregate-stats.mjs", "--benchDir", dir, "--outFile", out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(fs.readFileSync(out));
  assert.equal(output.total_runs, 0);
  assert.equal(output.leaderboard.length, 0);
  assert.equal(output.legacy_repair_runs.length, 2);
  assert.equal(output.legacy_repair_stats[0].runs, 2);
  const python = [
    "import importlib.util, json, pathlib, sys",
    'spec = importlib.util.spec_from_file_location("stats", ".github/scripts/aggregate_stats.py")',
    "stats = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(stats)",
    "print(json.dumps(stats.build_legacy_stats(pathlib.Path(sys.argv[1]))))"
  ].join("\n");
  const published = spawnSync("python3", ["-B", "-c", python, dir], { encoding: "utf8" });
  assert.equal(published.status, 0, published.stderr);
  assert.deepEqual(JSON.parse(published.stdout), stats);
  assert.throws(() => aggregateLegacyStats([{ model: "model", run_id: "missing", iterations: [{}] }]), /Missing legacy metrics/);
});

test("published Python dashboard loader excludes repair runs from showcase scoring", t => {
  const dir = temporary(t);
  const repair = path.join(dir, "model", "repair");
  write(repair, "task.json", { task: "legacy-repair", fixture: "norwegian-news" });
  write(repair, "test_results.json", [{ task: "legacy-repair", legacy_errors: 2, status: "fail", iteration: 1 }]);
  write(path.join(dir, "model", "showcase"), "test_results.json", [{ iteration: 1, status: "fail", html_tag_errors: 1 }]);
  const script = [
    "import importlib.util, pathlib, sys",
    'spec = importlib.util.spec_from_file_location("stats", ".github/scripts/aggregate_stats.py")',
    "stats = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(stats)",
    "stats.BENCHMARKS_DIR = pathlib.Path(sys.argv[1])",
    "runs = stats.load_runs()",
    'assert len(runs) == 1, f"Expected showcase only, got {len(runs)} runs"'
  ].join("\n");
  const run = spawnSync("python3", ["-B", "-c", script, dir], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
});
