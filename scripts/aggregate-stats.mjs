#!/usr/bin/env node
/**
 * Scans benchmark run directories and produces benchmark_stats.json
 * in the format expected by the AI WCAG Gauntlet dashboard.
 *
 * Usage: node scripts/aggregate-stats.mjs [--benchDir benchmarks] [--outFile benchmarks/benchmark_stats.json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_HTML5_TAGS } from "./benchmark-task.mjs";

const TOTAL_TAGS = REQUIRED_HTML5_TAGS.length;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith("--") && value != null) {
      args[key.slice(2)] = value;
    }
  }
  return args;
}

/** Normalize model name to lowercase for case-insensitive grouping */
function normalizeModelName(name) {
  return name.toLowerCase();
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(`Cannot read ${filePath}: ${error.message}`);
    return null;
  }
}

/** Compute Agent Performance Score (APS).
 *  Formula: starts at 200, minus penalties for errors and iterations. */
function computeScore(htmlTagErrors, w3cErrors, axeViolations, pa11yIssues, iterationsUsed) {
  const base = 200;
  const tagPenalty = htmlTagErrors * 0.8;
  const w3cPenalty = w3cErrors * 1.0;
  const axePenalty = axeViolations * 3.0;
  const pa11yPenalty = pa11yIssues * 2.0;
  const iterPenalty = Math.max(0, iterationsUsed - 1) * 1.0;
  return Math.max(0, +(base - tagPenalty - w3cPenalty - axePenalty - pa11yPenalty - iterPenalty).toFixed(2));
}

/** Group consecutive run folders by benchmark session.
 *  A session is a sequence of runs for the same model with iteration numbers 1,2,3,... */
export function groupRunsIntoSessions(modelDir, modelName) {
  const entries = fs.readdirSync(modelDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const sessions = [];
  let currentSession = null;

  for (const folderName of entries) {
    const runDir = path.join(modelDir, folderName);
    const metadata = readJSON(path.join(runDir, "metadata.json"));
    const rawResults = readJSON(path.join(runDir, "test_results.json"));
    const htmlReport = readJSON(path.join(runDir, "html5_tags_report.json"))
      ?? readJSON(path.join(runDir, "html5_tag_report.json"));
    const rawAxe = readJSON(path.join(runDir, "axe_report.json"));
    const axeReport = Array.isArray(rawAxe) ? rawAxe[0] : rawAxe;
    const taskRecord = readJSON(path.join(runDir, "task.json"));

    if (!rawResults) continue;
    const results = Array.isArray(rawResults) ? rawResults : [rawResults];
    if (!results.length) continue;

    for (const testResult of results) {
      const iteration = testResult.iteration ?? metadata?.iteration ?? 1;
      const task = testResult.task ?? taskRecord?.task ?? "showcase";
      const fixture = testResult.fixture ?? taskRecord?.fixture ?? null;
      const htmlTagErrors = testResult.html_tag_errors ?? 0;
      const w3cErrors = testResult.w3c_errors ?? testResult.vnu_errors ?? 0;
      const axeViolations = testResult.axe_violations ?? 0;
      const pa11yIssues = testResult.pa11y_issues ?? 0;
      const qualwebReport = readJSON(path.join(runDir, "qualweb_report.json"));
      const qualwebIssues = testResult.qualweb_issues ?? qualwebReport?.failedCount ?? 0;
      const missingTags = testResult.missing_tags ?? htmlReport?.missing_tags ?? htmlReport?.missingTags ?? [];
      const usedTags = testResult.used_tags ?? REQUIRED_HTML5_TAGS.filter(t => !missingTags.includes(t));
      const axeVersion = axeReport?.testEngine?.version ?? null;

      const score = testResult.score ?? computeScore(htmlTagErrors, w3cErrors, axeViolations, pa11yIssues, iteration);

      const iterData = {
        iteration,
        score,
        html_tag_errors: htmlTagErrors,
        w3c_errors: w3cErrors,
        axe_violations: axeViolations,
        pa11y_issues: pa11yIssues,
        qualweb_issues: qualwebIssues,
        status: testResult.status,
        timestamp: testResult.timestamp ?? metadata?.timestamp,
        missing_tags: missingTags,
        used_tags: usedTags,
        legacy: testResult.legacy ?? (task === "legacy-repair" ? readJSON(path.join(runDir, "legacy_report.json")) : null),
      };

      if (iteration === 1 || !currentSession || currentSession.task !== task
        || currentSession.fixture !== fixture
        || (Array.isArray(rawResults) && currentSession.folder !== folderName)) {
        // Start new session
        currentSession = {
          model: normalizeModelName(modelName),
          task,
          fixture,
          run_id: folderName,
          folder: folderName,
          iterations: [iterData],
          axe_version: axeVersion,
          benchmark_url: `benchmarks/${modelName}/${folderName}/index.html`,
          source: metadata?.source ?? 'local',
          provider: metadata?.provider ?? 'unknown',
          providerLabel: metadata?.providerLabel ?? 'Unknown',
          tool: metadata?.tool ?? null,
        };
        sessions.push(currentSession);
      } else {
        // Continue current session
        currentSession.iterations.push(iterData);
        // Update run_id to point to first iteration of session
      }
    }
  }
  return sessions;
}

export function aggregateLegacyStats(sessions) {
  const models = new Map();
  const patterns = new Map();
  for (const session of sessions) {
    const final = session.iterations.at(-1);
    const report = final.legacy;
    if (!report || !Array.isArray(report.baseline_legacy_present)
      || !Array.isArray(report.baseline_legacy_patterns)
      || !Array.isArray(report.legacy_patterns_matched)) {
      throw new Error(`Missing legacy metrics for ${session.model}/${session.run_id}`);
    }
    if (!models.has(session.model)) models.set(session.model, {
      model: session.model, runs: 0, passes: 0, deprecated_tags_removed: 0,
      deprecated_tags_remaining: 0, residual_axe: {}, fixtures: []
    });
    const row = models.get(session.model);
    row.runs++;
    if (final.status === "pass") row.passes++;
    if (!row.fixtures.includes(session.fixture)) row.fixtures.push(session.fixture);
    const baseline = report.baseline_legacy_present;
    row.deprecated_tags_remaining += report.legacy_present.reduce((sum, item) => sum + item.count, 0);
    row.deprecated_tags_removed += baseline.reduce((sum, item) => sum
      + Math.max(0, item.count - (report.legacy_present.find(r => r.tag === item.tag)?.count ?? 0)), 0);
    for (const [id, count] of Object.entries(report.residual_axe ?? {})) {
      row.residual_axe[id] = (row.residual_axe[id] ?? 0) + count;
    }
    for (const item of report.baseline_legacy_patterns) {
      if (!patterns.has(item.id)) patterns.set(item.id, {
        pattern: item.id, exposed_runs: 0, residual_runs: 0, baseline_occurrences: 0, residual_occurrences: 0
      });
      const pattern = patterns.get(item.id);
      const residual = report.legacy_patterns_matched.find(p => p.id === item.id)?.count ?? 0;
      pattern.exposed_runs++;
      pattern.baseline_occurrences += item.count;
      pattern.residual_occurrences += residual;
      if (residual) pattern.residual_runs++;
    }
  }
  return {
    legacy_repair_stats: [...models.values()].map(row => ({
      ...row, pass_rate: +(100 * row.passes / row.runs).toFixed(1)
    })).sort((a, b) => a.model.localeCompare(b.model)),
    hardest_legacy_patterns: [...patterns.values()].map(row => ({
      ...row, residual_rate: +(100 * row.residual_runs / row.exposed_runs).toFixed(1)
    })).sort((a, b) => b.residual_rate - a.residual_rate || a.pattern.localeCompare(b.pattern))
  };
}
function main() {
  const args = parseArgs(process.argv);
  const benchDir = args.benchDir ?? "benchmarks";
  const outFile = args.outFile ?? path.join(benchDir, "benchmark_stats.json");

  if (!fs.existsSync(benchDir)) {
    console.error(`Benchmarks directory not found: ${benchDir}`);
    process.exit(1);
  }

  // Discover model directories
  const modelDirs = fs.readdirSync(benchDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const discoveredSessions = [];
  for (const modelName of modelDirs) {
    const modelPath = path.join(benchDir, modelName);
    const sessions = groupRunsIntoSessions(modelPath, modelName);
    discoveredSessions.push(...sessions);
  }
  const allSessions = discoveredSessions.filter(s => s.task === "showcase");
  const legacySessions = discoveredSessions.filter(s => s.task === "legacy-repair");
  if (args.legacyOnly === "true") {
    console.log(JSON.stringify(aggregateLegacyStats(legacySessions)));
    return;
  }

  // Build leaderboard: one entry per session, using final iteration results
  const leaderboard = allSessions.map(session => {
    const finalIter = session.iterations[session.iterations.length - 1];
    const iterCount = session.iterations.length;
    const coveragePct = +((TOTAL_TAGS - finalIter.html_tag_errors) / TOTAL_TAGS * 100).toFixed(1);

    return {
      model: session.model,
      run_id: session.run_id,
      source: session.source,
      provider: session.provider,
      providerLabel: session.providerLabel,
      tool: session.tool,
      score: finalIter.score,
      html_tag_errors: finalIter.html_tag_errors,
      w3c_errors: finalIter.w3c_errors,
      axe_violations: finalIter.axe_violations,
      pa11y_issues: finalIter.pa11y_issues,
      qualweb_issues: finalIter.qualweb_issues,
      iterations_used: iterCount,
      status: finalIter.status,
      timestamp: finalIter.timestamp,
      tag_coverage_pct: coveragePct,
      axe_version: session.axe_version,
      pa11y_version: null,
      benchmark_url: session.benchmark_url,
    };
  });

  // Sort by score descending and assign ranks
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

  // runs_by_model: flat list sorted by score descending
  const runsByModel = leaderboard.map(entry => ({
    model: entry.model,
    run_id: entry.run_id,
    source: entry.source,
    provider: entry.provider,
    providerLabel: entry.providerLabel,
    tool: entry.tool,
    total_iterations: entry.iterations_used,
    final_score: entry.score,
    final_html_errors: entry.html_tag_errors,
    final_w3c_errors: entry.w3c_errors,
    final_axe_violations: entry.axe_violations,
    final_pa11y_issues: entry.pa11y_issues,
    final_qualweb_issues: entry.qualweb_issues,
    status: entry.status,
    timestamp: entry.timestamp,
    benchmark_url: entry.benchmark_url,
  }));

  // error_breakdown: best run per model (case-insensitive grouping)
  const bestPerModel = {};
  for (const entry of leaderboard) {
    const normalizedModel = normalizeModelName(entry.model);
    if (!bestPerModel[normalizedModel] || entry.score > bestPerModel[normalizedModel].score) {
      bestPerModel[normalizedModel] = entry;
    }
  }
  const errorBreakdown = Object.values(bestPerModel).map(e => ({
    model: e.model,
    score: e.score,
    html_tag_errors: e.html_tag_errors,
    w3c_errors: e.w3c_errors,
    axe_violations: e.axe_violations,
    pa11y_issues: e.pa11y_issues,
    qualweb_issues: e.qualweb_issues,
  }));

  // tag_coverage_by_model: best run per model (case-insensitive grouping)
  const tagCoverageByModel = Object.values(bestPerModel).map(e => ({
    model: e.model,
    used_count: TOTAL_TAGS - e.html_tag_errors,
    missing_count: e.html_tag_errors,
    coverage_pct: e.tag_coverage_pct,
  }));

  // missing_tags_frequency: across all runs' final iterations
  const tagMissCounts = {};
  for (const tag of REQUIRED_HTML5_TAGS) tagMissCounts[tag] = 0;
  const totalRuns = allSessions.length;
  for (const session of allSessions) {
    const finalIter = session.iterations[session.iterations.length - 1];
    for (const tag of (finalIter.missing_tags ?? [])) {
      if (tag in tagMissCounts) tagMissCounts[tag]++;
    }
  }
  const missingTagsFrequency = REQUIRED_HTML5_TAGS.map(tag => ({
    tag,
    miss_count: tagMissCounts[tag],
    miss_pct: totalRuns > 0 ? +((tagMissCounts[tag] / totalRuns) * 100).toFixed(1) : 0,
  }));

  // model_progress: keyed by normalized model name → array of session objects with iterations
  const modelProgress = {};
  for (const session of allSessions) {
    const normalizedModel = normalizeModelName(session.model);
    if (!modelProgress[normalizedModel]) modelProgress[normalizedModel] = [];
    modelProgress[normalizedModel].push({
      run_id: session.run_id,
      iterations: session.iterations.map(it => ({
        iteration: it.iteration,
        score: it.score,
        html_tag_errors: it.html_tag_errors,
        w3c_errors: it.w3c_errors,
        axe_violations: it.axe_violations,
        pa11y_issues: it.pa11y_issues,
        qualweb_issues: it.qualweb_issues,
        status: it.status,
        timestamp: it.timestamp,
      })),
    });
  }

  const uniqueModels = new Set(leaderboard.map(e => normalizeModelName(e.model)));

  const stats = {
    ...aggregateLegacyStats(legacySessions),
    legacy_repair_runs: legacySessions.map(session => ({
      model: session.model, run_id: session.run_id, task: session.task, fixture: session.fixture,
      benchmark_url: session.benchmark_url, iterations: session.iterations,
      status: session.iterations.at(-1).status, score: session.iterations.at(-1).score
    })),
    generated_at: new Date().toISOString(),
    total_runs: totalRuns,
    total_models: uniqueModels.size,
    total_tags: TOTAL_TAGS,
    leaderboard,
    runs_by_model: runsByModel,
    missing_tags_frequency: missingTagsFrequency,
    model_progress: modelProgress,
    error_breakdown: errorBreakdown,
    tag_coverage_by_model: tagCoverageByModel,
  };

  fs.writeFileSync(outFile, JSON.stringify(stats, null, 2), "utf8");
  console.log(`Stats written to ${outFile}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
