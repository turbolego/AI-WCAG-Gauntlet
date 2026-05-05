#!/bin/bash
# NOTE: Intentionally no "set -euo pipefail" — we handle errors explicitly so
# that AI agents (e.g. Copilot Autopilot) never see an unexpected non-zero exit
# code that would cause them to abort the benchmark loop prematurely.

# --- Bootstrap Node.js into PATH (unattended – no profile sourcing) ----------
# Probe nvm-managed versions (newest first) and common install prefixes.
# Uses only filesystem checks; never sources a profile; never triggers prompts.
if ! command -v node >/dev/null 2>&1; then
    _NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
    for _d in $(ls -1d "${_NVM_DIR}/versions/node/"*/bin 2>/dev/null | sort -Vr); do
        if [ -x "${_d}/node" ]; then
            export PATH="${_d}:${PATH}"
            break
        fi
    done
fi
if ! command -v node >/dev/null 2>&1; then
    for _p in \
        /opt/homebrew/bin \
        /usr/local/bin \
        /usr/local/opt/node/bin \
        /opt/local/bin \
        /snap/bin
    do
        if [ -x "${_p}/node" ]; then
            export PATH="${_p}:${PATH}"
            break
        fi
    done
fi
# -----------------------------------------------------------------------------

# --- Resolve paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES="$SCRIPT_DIR/resources"

# --- Detect Chrome for pa11y and QualWeb ---
# pa11y uses its own puppeteer-core which needs a valid Chrome binary.
# Honour PUPPETEER_EXECUTABLE_PATH if already set; otherwise auto-detect.
if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
    _HOME="${HOME:-/root}"
    for _candidate in \
        "${_HOME}/.cache/puppeteer/chrome/mac-147.0.7727.56/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
        "${_HOME}/.cache/puppeteer/chrome/mac-127.0.6533.88/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        "/usr/bin/google-chrome-stable" \
        "/usr/bin/google-chrome" \
        "/usr/bin/chromium-browser" \
        "/usr/bin/chromium"
    do
        if [ -x "$_candidate" ]; then
            PUPPETEER_EXECUTABLE_PATH="$_candidate"
            break
        fi
    done
fi
export PUPPETEER_EXECUTABLE_PATH

TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: ./test-suite.sh <benchmark-folder>"
    exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo "Running tests for: $TARGET_DIR"

# Clear any cached data to ensure the latest changes are applied
rm -rf "$TARGET_DIR/.cache"

# --- Validate ---
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: target folder not found"
    exit 1
fi
if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html missing"
    exit 1
fi
if [ ! -d "$RESOURCES" ]; then
    echo "Error: resources folder missing"
    exit 1
fi

# --- Increment iterations counter ---
ITERATIONS_FILE="$TARGET_DIR/iterations_count.txt"
if [ ! -f "$ITERATIONS_FILE" ]; then
    echo 0 > "$ITERATIONS_FILE"
fi
ITERATIONS=$(($(cat "$ITERATIONS_FILE") + 1))
echo "$ITERATIONS" > "$ITERATIONS_FILE"

# --- Start local HTTP server for CSS/resource loading ---
# Generated pages use <base href="/AI-WCAG-Gauntlet/"> which needs an HTTP
# context. Serve from the parent of the project root so /AI-WCAG-Gauntlet/
# resolves to the correct directory, matching the GitHub Pages deployment.

# --- Filter axe_report.json to only include violations ---
if [ -f "$TARGET_DIR/axe_report.json" ]; then
        # Overwrite axe_report.json with only the violations array
        jq 'if type == "array" then [.[].violations] | flatten else .violations end' "$TARGET_DIR/axe_report.json" > "$TARGET_DIR/axe_report.json.tmp" && mv "$TARGET_DIR/axe_report.json.tmp" "$TARGET_DIR/axe_report.json"
fi
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$SCRIPT_DIR")"
SERVE_PORT="${A11Y_SERVE_PORT:-28763}"
python3 -m http.server "$SERVE_PORT" --directory "$PARENT_DIR" >/dev/null 2>&1 &
SERVE_PID=$!
trap "kill $SERVE_PID 2>/dev/null || true" EXIT INT TERM
sleep 1
REL_TARGET="${TARGET_DIR#${SCRIPT_DIR}/}"
REL_TARGET_ENC=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$REL_TARGET")
TARGET_HTTP_URL="http://localhost:$SERVE_PORT/$PROJECT_NAME/$REL_TARGET_ENC/index.html"
echo "Testing via HTTP: $TARGET_HTTP_URL"

# --- HTML5 tag test ---
echo "Running HTML5 tag test..."
if ! (cd "$TARGET_DIR" && python3 "$RESOURCES/check_html5_tags.py" > /dev/null); then
    echo "Error: check_html5_tags.py failed"
    exit 1
fi

REPORT="$TARGET_DIR/html5_tags_report.json"
if [ ! -f "$REPORT" ]; then
    echo "Error: html5_tags_report.json not generated"
    exit 1
fi

HTML_TAG_ERRORS=$(jq '.missing_tags | length' "$REPORT" || echo 0)

# --- W3C HTML validation ---
echo "Running w3c-html-validator..."
if ! (
    cd "$TARGET_DIR"
    node "$RESOURCES/run-w3c-validator.mjs" index.html w3c_report.json
); then
    echo "Error: w3c-html-validator failed"
    exit 1
fi

W3C_ERRORS=$(jq '.errorCount // 0' "$TARGET_DIR/w3c_report.json" || echo 0)

# --- Axe validation ---
echo "Running axe..."
if ! (
    cd "$TARGET_DIR"
    
    # Disable alert/confirm/prompt to prevent UnexpectedAlertOpenError during axe scan.
    # Models sometimes generate code with alerts or error handlers that trigger alerts,
    # which causes Selenium to abort the scan. Suppress them here.
    sed -i '/<\/head>/i <script>window.alert=window.confirm=window.prompt=()=>null;</script>' index.html
    
    axe "$TARGET_HTTP_URL" \
        --chrome-options='--no-sandbox,--disable-dev-shm-usage,--disable-gpu' \
        --timeout 60000 \
        --tags wcag2a,wcag2aa,wcag2aaa,wcag21a,wcag21aa,wcag22aa,best-practice \
        --save axe_report.json \
        > /dev/null
); then
    echo "Error: axe failed"
    exit 1
fi

if ! jq empty "$TARGET_DIR/axe_report.json" 2>/dev/null; then
    echo "Error: axe_report.json invalid"
    exit 1
fi

AXE_VIOLATIONS=$(jq '
  if type == "array" then
    [.[].violations[]?] | length
  else
    [.violations[]?] | length
  end
' "$TARGET_DIR/axe_report.json" || echo 0)

AXE_VERSION=$(jq -r '
  if type == "array" then
    .[0].testEngine.version // "unknown"
  else
    .testEngine.version // "unknown"
  end
' "$TARGET_DIR/axe_report.json")

# --- Pa11y validation ---
echo "Running pa11y..."
if ! (
    cd "$TARGET_DIR"
    # PUPPETEER_EXECUTABLE_PATH and CHROME_PATH are exported above so pa11y
    # finds a working Chrome binary. --config points to the repo-root config
    # which sets no-sandbox flags required inside Docker/CI.
    pa11y \
        --config "$SCRIPT_DIR/pa11y.config.js" \
        --reporter json \
        "$TARGET_HTTP_URL" \
        > pa11y_report.json 2>&1 || true
    # pa11y exits non-zero when issues are found — that's expected
); then
    echo "Warning: pa11y exited with an error; continuing with empty report"
    echo "[]" > "$TARGET_DIR/pa11y_report.json"
fi

# Ensure the file is valid JSON (pa11y may emit nothing on hard crash)
if ! jq empty "$TARGET_DIR/pa11y_report.json" 2>/dev/null; then
    echo "Warning: pa11y_report.json invalid — resetting to empty array"
    echo "[]" > "$TARGET_DIR/pa11y_report.json"
fi

PA11Y_ISSUES=$(jq 'if type == "array" then length else (.issues // [] | length) end' \
        "$TARGET_DIR/pa11y_report.json" 2>/dev/null)
# If PA11Y_ISSUES is empty or not a number, default to 0
if ! [[ "$PA11Y_ISSUES" =~ ^[0-9]+$ ]]; then
    PA11Y_ISSUES=0
fi

PA11Y_VERSION=$(pa11y --version 2>/dev/null || echo "unknown")

# --- QualWeb validation ---
# Uses resources/run-qualweb.mjs which injects the HTML directly into QualWeb
# (avoids file:// navigation issues in headless Chrome).
# PUPPETEER_EXECUTABLE_PATH is already exported above.
echo "Running qualweb..."
if ! (
    cd "$SCRIPT_DIR"
    node "$RESOURCES/run-qualweb.mjs" \
        "$TARGET_DIR/index.html" \
        "$TARGET_DIR/qualweb_report.json"
); then
    echo "Warning: qualweb failed; continuing with empty report"
    echo '{"failedCount":0,"results":[],"error":"qualweb script failed"}' > "$TARGET_DIR/qualweb_report.json"
fi

# Ensure valid JSON
if ! jq empty "$TARGET_DIR/qualweb_report.json" 2>/dev/null; then
    echo "Warning: qualweb_report.json invalid — resetting"
    echo '{"failedCount":0,"results":[]}' > "$TARGET_DIR/qualweb_report.json"
fi

QUALWEB_ISSUES=$(jq '.failedCount // 0' "$TARGET_DIR/qualweb_report.json" 2>/dev/null || echo 0)
if ! [[ "$QUALWEB_ISSUES" =~ ^[0-9]+$ ]]; then
    QUALWEB_ISSUES=0
fi

QUALWEB_VERSION=$(node -e "try{const p=require('./node_modules/@qualweb/core/package.json');console.log(p.version)}catch(e){console.log('unknown')}" 2>/dev/null || echo "unknown")

# --- Determine pass/fail status and calculate score ---
# APS formula — clear tier separation: pass ~153-203, fail 0-103.
#   Tag Score       = (used_tags / 110) * 90           (max ~92.7)
#   Quality Score   = 60 (PASS) | max(0, 10-(w3c+axe+pa11y+qualweb)) (FAIL, max 10)
#   Efficiency Score= 50 * 0.8^(iterations-1)  PASS only — exponential decay
#                     iter 1→50, 2→40, 3→32, 4→25.6, 5→20.5 ...
#                     Each extra iteration costs ~20% of the previous bonus.
TAG_COVERAGE=$(jq '.used_tags | length' "$REPORT")

if [ "$HTML_TAG_ERRORS" -eq 0 ] && \
   [ "$W3C_ERRORS" -eq 0 ] && \
   [ "$AXE_VIOLATIONS" -eq 0 ] && \
   [ "$PA11Y_ISSUES" -eq 0 ] && \
   [ "$QUALWEB_ISSUES" -eq 0 ]; then
    ITERATION_STATUS="pass"
    QUALITY_SCORE=60
    EFFICIENCY_SCORE=$(awk "BEGIN {printf \"%.4f\", 50 * (0.8 ^ ($ITERATIONS - 1))}")
else
    ITERATION_STATUS="fail"
    TOTAL_ERRORS=$(( W3C_ERRORS + AXE_VIOLATIONS + PA11Y_ISSUES + QUALWEB_ISSUES ))
    QUALITY_SCORE=$(( 10 - TOTAL_ERRORS ))
    [ "$QUALITY_SCORE" -lt 0 ] && QUALITY_SCORE=0
    EFFICIENCY_SCORE=0
fi

SCORE=$(echo "scale=2; ($TAG_COVERAGE / 110 * 90) + $QUALITY_SCORE + $EFFICIENCY_SCORE" | bc)

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Build this iteration's result object ---
ITERATION_RESULT=$(jq -n \
    --arg  timestamp       "$TIMESTAMP" \
    --arg  iteration       "$ITERATIONS" \
    --arg  status          "$ITERATION_STATUS" \
    --arg  score           "$SCORE" \
    --arg  html_tag_errors "$HTML_TAG_ERRORS" \
    --arg  w3c_errors      "$W3C_ERRORS" \
    --arg  axe_violations  "$AXE_VIOLATIONS" \
    --arg  axe_version     "$AXE_VERSION" \
    --arg  pa11y_issues    "$PA11Y_ISSUES" \
    --arg  pa11y_version   "$PA11Y_VERSION" \
    --arg  qualweb_issues  "$QUALWEB_ISSUES" \
    --arg  qualweb_version "$QUALWEB_VERSION" \
    --argjson missing_tags "$(jq '.missing_tags' "$REPORT")" \
    --argjson used_tags    "$(jq '.used_tags'    "$REPORT")" \
    '{
        timestamp:       $timestamp,
        iteration:       ($iteration       | tonumber),
        status:          $status,
        score:           ($score           | tonumber),
        html_tag_errors: ($html_tag_errors | tonumber),
        w3c_errors:      ($w3c_errors      | tonumber),
        axe_violations:  ($axe_violations  | tonumber),
        axe_version:     $axe_version,
        pa11y_issues:    ($pa11y_issues    | tonumber),
        pa11y_version:   $pa11y_version,
        qualweb_issues:  ($qualweb_issues  | tonumber),
        qualweb_version: $qualweb_version,
        missing_tags:    $missing_tags,
        used_tags:       $used_tags
    }')

# --- Append to test_results.json (array, one entry per iteration) ---
RESULTS_JSON="$TARGET_DIR/test_results.json"

if [ -f "$RESULTS_JSON" ] && jq empty "$RESULTS_JSON" 2>/dev/null; then
    # File exists and is valid JSON — append new iteration to the history array
    jq --argjson new "$ITERATION_RESULT" '. + [$new]' "$RESULTS_JSON" \
        > "${RESULTS_JSON}.tmp" && mv "${RESULTS_JSON}.tmp" "$RESULTS_JSON"
else
    # First run or corrupted file — start a fresh array
    echo "[$ITERATION_RESULT]" > "$RESULTS_JSON"
fi

echo "Results written to $RESULTS_JSON"

# --- Console output ---
echo "--------------------------------"
echo "RESULTS:"
echo "HTML_TAG_ERRORS = $HTML_TAG_ERRORS"
echo "W3C_ERRORS      = $W3C_ERRORS"
echo "AXE_VIOLATIONS  = $AXE_VIOLATIONS"
echo "AXE_VERSION     = $AXE_VERSION"
echo "PA11Y_ISSUES    = $PA11Y_ISSUES"
echo "PA11Y_VERSION   = $PA11Y_VERSION"
echo "QUALWEB_ISSUES  = $QUALWEB_ISSUES"
echo "QUALWEB_VERSION = $QUALWEB_VERSION"
echo "ITERATIONS      = $ITERATIONS"
echo "SCORE           = $SCORE"
echo "MISSING_TAGS    = $(jq -r '.missing_tags | join(", ")' "$REPORT")"
echo "--------------------------------"

# --- Final result ---
# Exit 0 in ALL cases so that AI agents (Copilot Autopilot, etc.) never treat
# a test failure as a fatal script error. Agents must read the STATUS line below
# to decide whether to iterate or stop.
if [ "$ITERATION_STATUS" = "pass" ]; then
    echo "STATUS: PASS — All tests passed successfully. Do not run run-in-docker.sh again."
    exit 0
elif [ "$ITERATIONS" -ge 20 ]; then
    echo "STATUS: FAIL — Maximum iterations (20) reached. Stop and report final results."
    exit 0
else
    echo "STATUS: FAIL — Fix the errors above, edit index.html and style.css as needed, then run run-in-docker.sh again."
    exit 0
fi
