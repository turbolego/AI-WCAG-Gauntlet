#!/bin/bash
# Replaces generate-dashboard.ps1
# Scans benchmark runs and regenerates root index.html and benchmark_stats.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCHMARKS_DIR="$SCRIPT_DIR/benchmarks"
STATS_PATH="$BENCHMARKS_DIR/benchmark_stats.json"
DASHBOARD_DIR="$SCRIPT_DIR/dashboard"
DASHBOARD_HTML="$SCRIPT_DIR/index.html"

mkdir -p "$BENCHMARKS_DIR"

# Generate benchmark_stats.json using the Node.js aggregator
node "$SCRIPT_DIR/scripts/aggregate-stats.mjs" \
    --benchDir "$BENCHMARKS_DIR" \
    --outFile  "$STATS_PATH"

# Inline CSS and JS into the HTML template using Python
python3 - \
    "$DASHBOARD_DIR/template.html" \
    "$DASHBOARD_DIR/style.css" \
    "$DASHBOARD_DIR/app.js" \
    "$DASHBOARD_HTML" <<'PYEOF'
import sys
template_path, css_path, js_path, out_path = sys.argv[1:]
template = open(template_path, encoding='utf-8').read()
css      = open(css_path,      encoding='utf-8').read()
js       = open(js_path,       encoding='utf-8').read()
result   = template \
    .replace('/* __INLINE_CSS__ */', css) \
    .replace('/* __INLINE_JS__ */',  js)
open(out_path, 'w', encoding='utf-8').write(result)
print(f"Dashboard generated: {out_path}")
PYEOF

echo "Dashboard generated: $DASHBOARD_HTML"

# Regenerate the GitHub Pages leaderboard (non-fatal)
python3 "$SCRIPT_DIR/.github/scripts/aggregate_stats.py" \
    || echo "Warning: GitHub Pages leaderboard regeneration failed (non-fatal)."
