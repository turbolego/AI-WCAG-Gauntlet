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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlTagsPath = path.resolve(__dirname, "..", "resources", "html_tags.json");
const REQUIRED_HTML5_TAGS = JSON.parse(fs.readFileSync(htmlTagsPath, "utf8")).tags;
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

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
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
function groupRunsIntoSessions(modelDir, modelName) {
  const entries = fs.readdirSync(modelDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const sessions = [];
  let currentSession = null;

  for (const folderName of entries) {
    const runDir = path.join(modelDir, folderName);
    const metadata = readJSON(path.join(runDir, "metadata.json"));
    const testResult = readJSON(path.join(runDir, "test_results.json"));
    const htmlReport = readJSON(path.join(runDir, "html5_tag_report.json"));
    const axeReport = readJSON(path.join(runDir, "axe_report.json"));

    if (!testResult) continue;

    const iteration = metadata?.iteration ?? 1;
    const htmlTagErrors = testResult.html_tag_errors ?? 0;
    const w3cErrors = testResult.w3c_errors ?? testResult.vnu_errors ?? 0;
    const axeViolations = testResult.axe_violations ?? 0;
    const pa11yIssues = testResult.pa11y_issues ?? 0;
    const missingTags = htmlReport?.missingTags ?? [];
    const foundCount = htmlReport?.foundCount ?? (TOTAL_TAGS - htmlTagErrors);
    const usedTags = REQUIRED_HTML5_TAGS.filter(t => !missingTags.includes(t));
    const axeVersion = axeReport?.testEngine?.version ?? null;

    const score = computeScore(htmlTagErrors, w3cErrors, axeViolations, pa11yIssues, iteration);

    const iterData = {
      iteration,
      score,
      html_tag_errors: htmlTagErrors,
      w3c_errors: w3cErrors,
      axe_violations: axeViolations,
      pa11y_issues: pa11yIssues,
      status: testResult.status,
      timestamp: testResult.timestamp ?? metadata?.timestamp,
      missing_tags: missingTags,
      used_tags: usedTags,
    };

    if (iteration === 1 || !currentSession) {
      // Start new session
      currentSession = {
        model: modelName,
        run_id: folderName,
        folder: folderName,
        iterations: [iterData],
        axe_version: axeVersion,
        benchmark_url: `benchmarks/${modelName}/${folderName}/index.html`,
      };
      sessions.push(currentSession);
    } else {
      // Continue current session
      currentSession.iterations.push(iterData);
      // Update run_id to point to first iteration of session
    }
  }

  return sessions;
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

  const allSessions = [];
  for (const modelName of modelDirs) {
    const modelPath = path.join(benchDir, modelName);
    const sessions = groupRunsIntoSessions(modelPath, modelName);
    allSessions.push(...sessions);
  }

  // Build leaderboard: one entry per session, using final iteration results
  const leaderboard = allSessions.map(session => {
    const finalIter = session.iterations[session.iterations.length - 1];
    const iterCount = session.iterations.length;
    const coveragePct = +((TOTAL_TAGS - finalIter.html_tag_errors) / TOTAL_TAGS * 100).toFixed(1);

    return {
      model: session.model,
      run_id: session.run_id,
      score: computeScore(
        finalIter.html_tag_errors, finalIter.w3c_errors,
        finalIter.axe_violations, finalIter.pa11y_issues, iterCount
      ),
      html_tag_errors: finalIter.html_tag_errors,
      w3c_errors: finalIter.w3c_errors,
      axe_violations: finalIter.axe_violations,
      pa11y_issues: finalIter.pa11y_issues,
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
    total_iterations: entry.iterations_used,
    final_score: entry.score,
    final_html_errors: entry.html_tag_errors,
    final_w3c_errors: entry.w3c_errors,
    final_axe_violations: entry.axe_violations,
    final_pa11y_issues: entry.pa11y_issues,
    status: entry.status,
    timestamp: entry.timestamp,
    benchmark_url: entry.benchmark_url,
  }));

  // error_breakdown: best run per model
  const bestPerModel = {};
  for (const entry of leaderboard) {
    if (!bestPerModel[entry.model] || entry.score > bestPerModel[entry.model].score) {
      bestPerModel[entry.model] = entry;
    }
  }
  const errorBreakdown = Object.values(bestPerModel).map(e => ({
    model: e.model,
    score: e.score,
    html_tag_errors: e.html_tag_errors,
    w3c_errors: e.w3c_errors,
    axe_violations: e.axe_violations,
    pa11y_issues: e.pa11y_issues,
  }));

  // tag_coverage_by_model: best run per model
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

  // model_progress: keyed by model → array of session objects with iterations
  const modelProgress = {};
  for (const session of allSessions) {
    if (!modelProgress[session.model]) modelProgress[session.model] = [];
    modelProgress[session.model].push({
      run_id: session.run_id,
      iterations: session.iterations.map(it => ({
        iteration: it.iteration,
        score: it.score,
        html_tag_errors: it.html_tag_errors,
        w3c_errors: it.w3c_errors,
        axe_violations: it.axe_violations,
        pa11y_issues: it.pa11y_issues,
        status: it.status,
        timestamp: it.timestamp,
      })),
    });
  }

  const uniqueModels = new Set(leaderboard.map(e => e.model));

  const stats = {
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

main();
