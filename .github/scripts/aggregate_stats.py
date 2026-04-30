#!/usr/bin/env python3
"""
aggregate_stats.py
Walks benchmarks/<MODEL>/<RUN>/ and aggregates test results into benchmark_stats.json
for the GitHub Pages stats dashboard.

Handles two data formats:
  - Local format: test_results.json is an array of iteration objects
  - API format: test_results.json is a single object, metadata.json contains iteration info

Expected folder layout:
  benchmarks/
    GPT-4o/
      GPT-4o-20260405-155342/          (local format)
        test_results.json              ← array of iteration objects
    gpt-4.1/
      gpt-4.1-20260416-180549-1/       (API format)
        test_results.json              ← single object
        metadata.json                  ← {iteration, model, timestamp, ...}
  docs/
    stats/
      benchmark_stats.json  ← written by this script
      index.html            ← static, committed to repo
"""

import json
import datetime
from pathlib import Path
from collections import Counter, defaultdict

REPO_ROOT     = Path(__file__).resolve().parents[2]
BENCHMARKS_DIR = REPO_ROOT / "benchmarks"
OUT_DIR       = REPO_ROOT / "docs" / "stats"
OUT_FILE      = OUT_DIR / "benchmark_stats.json"

ALL_TAGS = [
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base",
    "bdi", "bdo", "blockquote", "body", "br", "button", "canvas", "caption",
    "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del",
    "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset",
    "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5",
    "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img",
    "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map",
    "mark", "menu", "meta", "meter", "nav", "noscript", "object", "ol",
    "optgroup", "option", "output", "p", "picture", "pre", "progress", "q",
    "rp", "rt", "ruby", "s", "samp", "script", "search", "section", "select",
    "selectedcontent", "slot", "small", "source", "span", "strong", "style",
    "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea",
    "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var",
    "video", "wbr",
]
TOTAL_TAGS = len(ALL_TAGS)


def load_runs():
    """
    Return list of run dicts, one per benchmark folder that has test_results.json.
    Handles both:
      - Local format: test_results.json is an array of iteration objects
      - API format: test_results.json is a single object + metadata.json with iteration info
    total_runs = len(load_runs()) → one entry per RUN FOLDER, not per model.
    """
    runs = []
    if not BENCHMARKS_DIR.exists():
        print(f"WARNING: {BENCHMARKS_DIR} does not exist — no data to aggregate.")
        return runs

    for model_dir in sorted(BENCHMARKS_DIR.iterdir()):
        if not model_dir.is_dir():
            continue
        model_name = model_dir.name

        for run_dir in sorted(model_dir.iterdir()):
            if not run_dir.is_dir():
                continue
            results_file = run_dir / "test_results.json"
            if not results_file.exists():
                continue

            try:
                test_data = json.loads(results_file.read_text(encoding='utf-8-sig'))
            except json.JSONDecodeError as e:
                print(f"WARNING: could not parse {results_file}: {e}")
                continue

            # Handle two formats:
            # 1. Array format (local): test_results.json is [iteration_obj, ...]
            # 2. Single object format (API): test_results.json is {status, ...} + metadata.json
            source = None  # Track data source: "local" or "api"
            provider_key   = None
            provider_label = None
            tool           = None

            # Load provider info from metadata.json if present (created/backfilled by setup scripts)
            metadata_file_early = run_dir / "metadata.json"
            if metadata_file_early.exists():
                try:
                    _meta = json.loads(metadata_file_early.read_text(encoding='utf-8-sig'))
                    provider_key   = _meta.get("provider")
                    provider_label = _meta.get("providerLabel")
                    tool           = _meta.get("tool")
                except json.JSONDecodeError:
                    pass

            if isinstance(test_data, list):
                # Local format: array of iterations
                if len(test_data) == 0:
                    continue
                iterations = test_data
                source = "local"
                # Load w3c validation results if available
                w3c_report_file = run_dir / "w3c_report.json"
                if w3c_report_file.exists():
                    try:
                        w3c_report = json.loads(w3c_report_file.read_text(encoding='utf-8-sig'))
                        for it in iterations:
                            it["w3c_errors"] = w3c_report.get("errorCount", 0)
                    except json.JSONDecodeError:
                        pass
                else:
                    # Ensure w3c_errors field exists
                    for it in iterations:
                        if "w3c_errors" not in it:
                            it["w3c_errors"] = 0
            elif isinstance(test_data, dict):
                # API format: single object, iteration info in metadata.json
                metadata_file = run_dir / "metadata.json"
                if not metadata_file.exists():
                    print(f"WARNING: API format run {run_dir.name} has no metadata.json, skipping")
                    continue
                try:
                    metadata = json.loads(metadata_file.read_text(encoding='utf-8-sig'))
                except json.JSONDecodeError as e:
                    print(f"WARNING: could not parse {metadata_file}: {e}")
                    continue
                
                # Convert API format to local format (array with single iteration)
                iteration_num = metadata.get("iteration", 1)
                api_result = test_data.copy()
                api_result["iteration"] = iteration_num
                
                # Load w3c validation results if available
                w3c_report_file = run_dir / "w3c_report.json"
                if w3c_report_file.exists():
                    try:
                        w3c_report = json.loads(w3c_report_file.read_text(encoding='utf-8-sig'))
                        api_result["w3c_errors"] = w3c_report.get("errorCount", 0)
                    except json.JSONDecodeError:
                        pass
                # Normalize legacy field: w3c_errors from test_results.json
                if "w3c_errors" not in api_result:
                    api_result["w3c_errors"] = api_result.get("w3c_errors", 0)
                
                # Load tag information from html5_tag_report.json if available
                tag_report_file = run_dir / "html5_tag_report.json"
                if tag_report_file.exists():
                    try:
                        tag_report = json.loads(tag_report_file.read_text(encoding='utf-8-sig'))
                        api_result["missing_tags"] = tag_report.get("missingTags", [])
                        # used_tags = all tags - missing tags
                        api_result["used_tags"] = [tag for tag in ALL_TAGS if tag not in api_result["missing_tags"]]
                    except json.JSONDecodeError:
                        pass
                
                # Ensure required fields exist for scoring
                if "used_tags" not in api_result:
                    api_result["used_tags"] = []
                if "missing_tags" not in api_result:
                    api_result["missing_tags"] = [tag for tag in ALL_TAGS if tag not in api_result.get("used_tags", [])]
                
                iterations = [api_result]
                source = "api"
                # Also read provider info from metadata if not already loaded above
                if provider_key is None:
                    provider_key   = metadata.get("provider")
                    provider_label = metadata.get("providerLabel")
                    tool           = metadata.get("tool")
            else:
                print(f"WARNING: unexpected format in {results_file}")
                continue

            # Load QualWeb results if available
            qualweb_report_file = run_dir / "qualweb_report.json"
            qualweb_issues = 0
            if qualweb_report_file.exists():
                try:
                    qualweb_report = json.loads(qualweb_report_file.read_text(encoding='utf-8-sig'))
                    qualweb_issues = qualweb_report.get("failedCount", 0)
                except json.JSONDecodeError:
                    pass
            for it in iterations:
                it["qualweb_issues"] = qualweb_issues

            # Recompute scores AND status so historical runs reflect current validators.
            for it in iterations:
                it["score"] = recompute_score(it)
                # Recompute status based on current w3c validation results
                w3c_err   = it.get("w3c_errors", 0)
                html_err  = it.get("html_tag_errors", 0)
                axe_viol  = it.get("axe_violations", 0)
                pa11y_iss = it.get("pa11y_issues", 0)
                if html_err == 0 and w3c_err == 0 and axe_viol == 0 and pa11y_iss == 0:
                    it["status"] = "pass"
                else:
                    it["status"] = "fail"

            runs.append({
                "model":         model_name,
                "run_id":        run_dir.name,
                "source":        source,
                "provider":      provider_key,
                "providerLabel": provider_label,
                "tool":          tool,
                "iterations":    iterations,
            })

    return runs


def recompute_score(it):
    """
    Recompute the APS score from raw iteration data using the current formula.
    This ensures historical runs are scored consistently even if the formula
    has changed since those test_results.json files were written.

    Tiers:
      Pass (all four checks zero): Tag(0-~92) + Quality(60) + Efficiency(0.7-50) -> ~153-203
      Fail (any check non-zero) : Tag(0-~92) + Quality(0-10) + Efficiency(0)     -> 0-103

    Efficiency uses exponential decay: 50 * 0.8^(iteration-1)
      iter 1->50, 2->40, 3->32, 4->25.6, 5->20.5, ...
      Each additional iteration costs ~20% of the previous efficiency bonus,
      creating meaningful gaps between models that solve the task in fewer tries.
    """
    used      = len(it.get("used_tags", []))
    html_err  = it.get("html_tag_errors", 0)
    w3c_err   = it.get("w3c_errors", 0)
    axe_viol  = it.get("axe_violations", 0)
    pa11y_iss = it.get("pa11y_issues", 0)
    iteration = it.get("iteration", 1)

    tag_score = (used / 110) * 90

    if html_err == 0 and w3c_err == 0 and axe_viol == 0 and pa11y_iss == 0:
        quality_score    = 60
        efficiency_score = 50 * (0.8 ** (iteration - 1))
    else:
        total_errors     = w3c_err + axe_viol + pa11y_iss
        quality_score    = max(0, 10 - total_errors)
        efficiency_score = 0

    return round(tag_score + quality_score + efficiency_score, 2)


def final_iteration(iterations):
    return max(iterations, key=lambda it: it.get("iteration", 0))


# ── Leaderboard ────────────────────────────────────────────────────────────────
def build_leaderboard(runs):
    """
    All runs ranked by their final score.
    Keeps EVERY run as its own row (models may appear multiple times).
    """
    rows = []
    for run in runs:
        final = final_iteration(run["iterations"])
        score = final.get("score", 0)
        html_err = final.get("html_tag_errors", TOTAL_TAGS)
        rows.append({
            "model":           run["model"],
            "run_id":          run["run_id"],
            "source":          run.get("source", "unknown"),
            "provider":        run.get("provider"),
            "providerLabel":   run.get("providerLabel"),
            "tool":            run.get("tool"),
            "score":           score,
            "html_tag_errors": html_err,
            "w3c_errors":      final.get("w3c_errors", 0),
            "axe_violations":  final.get("axe_violations", 0),
            "pa11y_issues":    final.get("pa11y_issues", 0),
            "qualweb_issues":  final.get("qualweb_issues", 0),
            "iterations_used": final.get("iteration", len(run["iterations"])),
            "status":          final.get("status", "unknown"),
            "timestamp":       final.get("timestamp", ""),
            "tag_coverage_pct": round(
                max(0, TOTAL_TAGS - html_err) / TOTAL_TAGS * 100, 1
            ),
            "axe_version":     final.get("axe_version", "unknown"),
            "pa11y_version":   final.get("pa11y_version", "unknown"),
            "benchmark_url":   f"benchmarks/{run['model']}/{run['run_id']}/index.html",
        })

    rows.sort(key=lambda x: (-x["score"], x["iterations_used"]))
    for rank, row in enumerate(rows, 1):
        row["rank"] = rank
    return rows


# ── Missing-tag frequency ──────────────────────────────────────────────────────
def build_missing_tags_frequency(runs):
    """
    For each tag: how many *runs* (not iterations) had it missing in their
    final iteration.  miss_pct is relative to total_runs.
    """
    tag_miss_count = Counter()
    total_runs = len(runs)

    for run in runs:
        final = final_iteration(run["iterations"])
        for tag in final.get("missing_tags", []):
            tag_miss_count[tag] += 1

    result = [
        {
            "tag":        tag,
            "miss_count": tag_miss_count.get(tag, 0),
            "miss_pct":   round(tag_miss_count.get(tag, 0) / total_runs * 100, 1)
                          if total_runs else 0,
        }
        for tag in ALL_TAGS
    ]
    result.sort(key=lambda x: -x["miss_count"])
    return result


# ── Per-model iteration progress ───────────────────────────────────────────────
def build_model_progress(runs):
    """
    Keyed by model name → list of run objects, each with its full iteration array.
    The JS uses this for the progress charts.
    """
    by_model = defaultdict(list)
    for run in runs:
        by_model[run["model"]].append({
            "run_id": run["run_id"],
            "iterations": [
                {
                    "iteration":       it.get("iteration"),
                    "score":           it.get("score"),
                    "html_tag_errors": it.get("html_tag_errors"),
                    "w3c_errors":      it.get("w3c_errors", 0),
                    "axe_violations":  it.get("axe_violations"),
                    "pa11y_issues":    it.get("pa11y_issues", 0),
                    "qualweb_issues":  it.get("qualweb_issues", 0),
                    "status":          it.get("status"),
                    "timestamp":       it.get("timestamp", ""),
                }
                for it in run["iterations"]
            ],
        })
    return dict(by_model)


# ── Error breakdown (best run per model, for the stacked chart) ────────────────
def build_error_breakdown(runs):
    seen = {}
    for run in runs:
        model = run["model"]
        final = final_iteration(run["iterations"])
        score = final.get("score", 0)
        if model not in seen or score > seen[model]["score"]:
            seen[model] = {
                "model":           model,
                "score":           score,
                "html_tag_errors": final.get("html_tag_errors", 0),
                "w3c_errors":      final.get("w3c_errors", 0),
                "axe_violations":  final.get("axe_violations", 0),
                "pa11y_issues":    final.get("pa11y_issues", 0),
                "qualweb_issues":  final.get("qualweb_issues", 0),
            }
    return sorted(seen.values(), key=lambda x: -x["score"])


# ── Tag coverage (best run per model) ─────────────────────────────────────────
def build_tag_coverage_by_model(runs):
    best = {}
    for run in runs:
        model = run["model"]
        final = final_iteration(run["iterations"])
        score = final.get("score", 0)
        if model not in best or score > best[model]["score"]:
            best[model] = {
                "model":        model,
                "score":        score,
                "used_tags":    final.get("used_tags", []),
                "missing_tags": final.get("missing_tags", []),
            }
    return [
        {
            "model":         v["model"],
            "used_count":    len(v["used_tags"]),
            "missing_count": len(v["missing_tags"]),
            "coverage_pct":  round(len(v["used_tags"]) / TOTAL_TAGS * 100, 1),
        }
        for v in sorted(best.values(), key=lambda x: -x["score"])
    ]


# ── Per-model run summary (flat list for run-history table) ───────────────────
def build_runs_by_model(runs):
    """
    Flat list of all runs with summary stats — used by the JS run-history table.
    len == total_runs.
    """
    result = []
    for run in runs:
        final = final_iteration(run["iterations"])
        result.append({
            "model":                 run["model"],
            "run_id":                run["run_id"],
            "source":                run.get("source", "unknown"),
            "provider":              run.get("provider"),
            "providerLabel":         run.get("providerLabel"),
            "tool":                  run.get("tool"),
            "total_iterations":      final.get("iteration", len(run["iterations"])),
            "final_score":           final.get("score", 0),
            "final_html_errors":     final.get("html_tag_errors", 0),
            "final_w3c_errors":      final.get("w3c_errors", 0),
            "final_axe_violations":  final.get("axe_violations", 0),
            "final_pa11y_issues":    final.get("pa11y_issues", 0),
            "final_qualweb_issues":  final.get("qualweb_issues", 0),
            "status":                final.get("status", "unknown"),
            "timestamp":             final.get("timestamp", ""),
            "benchmark_url":         f"benchmarks/{run['model']}/{run['run_id']}/index.html",
        })
    result.sort(key=lambda x: (-x["final_score"], x["run_id"]))
    return result


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    runs = load_runs()
    total_runs   = len(runs)
    total_models = len(set(r["model"] for r in runs))
    print(f"Found {total_runs} benchmark run(s) across {total_models} model(s).")

    stats = {
        "generated_at":           datetime.datetime.utcnow().isoformat() + "Z",
        "total_runs":             total_runs,
        "total_models":           total_models,
        "total_tags":             TOTAL_TAGS,
        "leaderboard":            build_leaderboard(runs),
        "runs_by_model":          build_runs_by_model(runs),
        "missing_tags_frequency": build_missing_tags_frequency(runs),
        "model_progress":         build_model_progress(runs),
        "error_breakdown":        build_error_breakdown(runs),
        "tag_coverage_by_model":  build_tag_coverage_by_model(runs),
    }

    OUT_FILE.write_text(json.dumps(stats, indent=2))
    print(f"Written → {OUT_FILE}")
    print(f"  total_runs={total_runs}, total_models={total_models}")


if __name__ == "__main__":
    main()
