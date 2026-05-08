#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCHMARKS_ROOT="$REPO_ROOT/benchmarks"
STATS_PATH="$BENCHMARKS_ROOT/benchmark_stats.json"
DASHBOARD_HTML_PATH="$REPO_ROOT/index.html"
DASHBOARD_DIR="$REPO_ROOT/dashboard"

mkdir -p "$BENCHMARKS_ROOT"

# Generate benchmark_stats.json
echo "Generating benchmark stats..."
node "$REPO_ROOT/scripts/aggregate-stats.mjs" --benchDir "$BENCHMARKS_ROOT" --outFile "$STATS_PATH" || {
  echo "ERROR: Stats aggregation failed. Benchmark run may be incomplete." >&2
  exit 1
}

# Inline dashboard assets
echo "Inlining dashboard assets..."
CSS_CONTENT=$(cat "$DASHBOARD_DIR/style.css")
JS_CONTENT=$(cat "$DASHBOARD_DIR/app.js")
TEMPLATE_PATH="$DASHBOARD_DIR/template.html"

# Use a temporary file for safer sed replacement
_tmp=$(mktemp)
sed -e "s|/\* __INLINE_CSS__ \*/|${CSS_CONTENT//\\/\\\\}|g" "$TEMPLATE_PATH" > "$_tmp"
sed -e "s|/\* __INLINE_JS__ \*/|${JS_CONTENT//\\/\\\\}|g" "$_tmp" > "$DASHBOARD_HTML_PATH"
rm -f "$_tmp"

echo "Dashboard generated: $DASHBOARD_HTML_PATH"

# Regenerate GitHub Pages leaderboard
if [ -f "$REPO_ROOT/.github/scripts/aggregate_stats.py" ]; then
  echo "Regenerating GitHub Pages leaderboard..."
  python3 "$REPO_ROOT/.github/scripts/aggregate_stats.py" || {
    echo "WARNING: GitHub Pages leaderboard regeneration failed (non-fatal)." >&2
  }
fi

echo "Dashboard generation complete."
