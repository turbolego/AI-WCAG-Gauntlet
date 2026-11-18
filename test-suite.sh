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

# --- Resolve a single shared Chrome for Testing binary (all tools use this) ---
CHROME_FOR_TESTING_PATH="${CHROME_FOR_TESTING_PATH:-}"
if [ -n "$CHROME_FOR_TESTING_PATH" ] && [ ! -x "$CHROME_FOR_TESTING_PATH" ]; then
    echo "Warning: configured Chrome is unavailable; searching installed browsers instead."
    CHROME_FOR_TESTING_PATH=""
fi
if [ -z "$CHROME_FOR_TESTING_PATH" ]; then
    # Windows Chrome installation
    if command -v win_chrome >/dev/null 2>&1; then
        CHROME_FOR_TESTING_PATH="$(win_chrome)"
    elif [ -f "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ]; then
        CHROME_FOR_TESTING_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    elif [ -f "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" ]; then
        CHROME_FOR_TESTING_PATH="C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    else
        _HOME="${HOME:-/root}"

        # macOS cache layout
        while IFS= read -r _candidate; do
            if [ -x "$_candidate" ]; then
                CHROME_FOR_TESTING_PATH="$_candidate"
                break
            fi
        done < <(ls -1d "${_HOME}/.cache/puppeteer/chrome/"*/chrome-mac-*/"Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" 2>/dev/null | sort -Vr)

        # Linux cache layout fallback
        if [ -z "$CHROME_FOR_TESTING_PATH" ]; then
            while IFS= read -r _candidate; do
                if [ -x "$_candidate" ]; then
                    CHROME_FOR_TESTING_PATH="$_candidate"
                    break
                fi
            done < <(ls -1d "${_HOME}/.cache/puppeteer/chrome/"*/chrome-linux*/chrome 2>/dev/null | sort -Vr)
        fi
    fi
fi

if [ -z "$CHROME_FOR_TESTING_PATH" ] || [ ! -x "$CHROME_FOR_TESTING_PATH" ]; then
    echo "Error: Chrome for Testing not found."
    echo "Run setup.sh first (it installs Chrome for Testing), then retry."
    exit 1
fi

# Force all browser-based tools to use the same executable.
export CHROME_FOR_TESTING_PATH
export CHROME_PATH="$CHROME_FOR_TESTING_PATH"
export PUPPETEER_EXECUTABLE_PATH="$CHROME_FOR_TESTING_PATH"
export CHROME_BIN="$CHROME_FOR_TESTING_PATH"
echo "[DEBUG] Shared Chrome for Testing: $CHROME_FOR_TESTING_PATH"

# Clean stale macOS code-sign clone bundles to avoid temp disk growth.
cleanup_macos_chrome_code_sign_clones() {
    if [[ "$OSTYPE" != darwin* ]]; then
        return 0
    fi

    local max_age_seconds="${CHROME_CLONE_MAX_AGE_SECONDS:-21600}"
    local tmp_base="${TMPDIR%/}"
    [ -z "$tmp_base" ] && tmp_base="/tmp"
    local clone_root
    clone_root="$(dirname "$tmp_base")/X/com.google.Chrome.code_sign_clone"

    [ -d "$clone_root" ] || return 0

    local now
    now=$(date +%s)
    local removed=0

    for clone_dir in "$clone_root"/code_sign_clone.*; do
        [ -d "$clone_dir" ] || continue
        local modified
        modified=$(stat -f %m "$clone_dir" 2>/dev/null || true)
        [ -n "$modified" ] || continue

        if [ $((now - modified)) -ge "$max_age_seconds" ]; then
            rm -rf "$clone_dir" 2>/dev/null && removed=$((removed + 1))
        fi
    done

    if [ "$removed" -gt 0 ]; then
        echo "[cleanup] Removed $removed stale Chrome code-sign clone folder(s)."
    fi
}

cleanup_on_exit() {
    kill "${SERVE_PID:-}" 2>/dev/null || true
    if [ -n "${CHROME_PROFILE_ROOT:-}" ] && [ -d "$CHROME_PROFILE_ROOT" ] && [ "${KEEP_CHROME_PROFILE:-0}" != "1" ]; then
        rm -rf "$CHROME_PROFILE_ROOT" 2>/dev/null || true
    fi
    cleanup_macos_chrome_code_sign_clones
}

trap cleanup_on_exit EXIT INT TERM

# --- Input folder ---
TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: ./test-suite.sh <benchmark-folder>"
    exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo "Running tests for: $TARGET_DIR"
TASK="showcase"
if [ -f "$TARGET_DIR/task.json" ]; then
    TASK=$(jq -er '.task | select(. == "showcase" or . == "legacy-repair")' "$TARGET_DIR/task.json") || {
        echo "Error: invalid task.json"
        exit 1
    }
fi

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
if [ "$TASK" = "legacy-repair" ]; then
    for report in w3c_report.json axe_report.json pa11y_report.json qualweb_report.json legacy_report.json; do
        if ! rm -f "$TARGET_DIR/$report"; then
            echo "Error: cannot clear stale $report"
            exit 1
        fi
    done
fi

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
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$SCRIPT_DIR")"
SERVE_PORT="${A11Y_SERVE_PORT:-28763}"
python3 -m http.server "$SERVE_PORT" --directory "$PARENT_DIR" >/dev/null 2>&1 &
SERVE_PID=$!
sleep 1
REL_TARGET="${TARGET_DIR#${SCRIPT_DIR}/}"
REL_TARGET_ENC=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$REL_TARGET")
TARGET_HTTP_URL="http://localhost:$SERVE_PORT/$PROJECT_NAME/$REL_TARGET_ENC/index.html"
echo "Testing via HTTP: $TARGET_HTTP_URL"

CHROME_PROFILE_ROOT="$TARGET_DIR/.chrome-profile"
mkdir -p "$CHROME_PROFILE_ROOT"
export CHROME_USER_DATA_DIR="$CHROME_PROFILE_ROOT/shared"

# --- HTML5 tag test ---
echo "Running HTML5 tag test..."
if ! node "$SCRIPT_DIR/scripts/check-html5-tags.mjs" "$TARGET_DIR/index.html" "$TARGET_DIR/html5_tags_report.json"; then
    echo "Error: check-html5-tags.mjs failed"
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

# Retry logic for axe (known to crash after ~4 minutes in CI environments)
AXE_RETRY_COUNT=0
AXE_MAX_RETRIES=2
while [ $AXE_RETRY_COUNT -lt $AXE_MAX_RETRIES ]; do
    if (
        cd "$TARGET_DIR"
        
        # Disable alert/confirm/prompt to prevent UnexpectedAlertOpenError during axe scan.
        # Models sometimes generate code with alerts or error handlers that trigger alerts,
        # which causes Selenium to abort the scan. Suppress them here.
        # Use perl for cross-platform compatibility (macOS and Linux)
        perl -i -pe 's{</head>}{<script>window.alert=window.confirm=window.prompt=()=>null;</script>\n</head>}i' index.html
        
        # Run axe with a 3-minute timeout (180s) to catch hangs before the 4-minute tab crash
        # Use gtimeout if available (GNU coreutils on macOS), otherwise use timeout or run without
        TIMEOUT_CMD=""
        if command -v gtimeout >/dev/null 2>&1; then
            TIMEOUT_CMD="gtimeout 180"
        elif command -v timeout >/dev/null 2>&1; then
            TIMEOUT_CMD="timeout 180"
        fi
        
        AXE_RUN_TIMEOUT_MS=60000 \
        A11Y_NAV_TIMEOUT_MS=120000 \
        CHROME_USER_DATA_DIR="$CHROME_PROFILE_ROOT/axe" \
        $TIMEOUT_CMD node "$SCRIPT_DIR/scripts/run-axe.mjs" "$TARGET_HTTP_URL" axe_report.json > /dev/null
    ); then
        break
    else
        AXE_EXIT=$?
        AXE_RETRY_COUNT=$((AXE_RETRY_COUNT + 1))
        if [ $AXE_RETRY_COUNT -lt $AXE_MAX_RETRIES ]; then
            if [ $AXE_EXIT -eq 124 ]; then
                echo "Warning: axe scan timed out (likely tab crash). Retrying (attempt $((AXE_RETRY_COUNT + 1))/$AXE_MAX_RETRIES)..."
                sleep 2
                continue
            else
                echo "Warning: axe failed with exit code $AXE_EXIT. Retrying (attempt $((AXE_RETRY_COUNT + 1))/$AXE_MAX_RETRIES)..."
                sleep 2
                continue
            fi
        else
            echo "Error: axe failed after $AXE_MAX_RETRIES attempts"
            exit 1
        fi
    fi
done

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
' "$TARGET_DIR/axe_report.json" 2>/dev/null || echo 0)

AXE_VERSION=$(jq -r '
  if type == "array" then
    .[0].testEngine.version // "unknown"
  else
    .testEngine.version // "unknown"
  end
' "$TARGET_DIR/axe_report.json" 2>/dev/null || echo "unknown")

# --- Pa11y validation ---
echo "Running pa11y..."
PA11Y_CONFIG="$CHROME_PROFILE_ROOT/pa11y-config.json"
if ! jq -n --arg executable "$PUPPETEER_EXECUTABLE_PATH" --arg profile "$CHROME_PROFILE_ROOT/pa11y" \
    '{chromeLaunchConfig: {executablePath: $executable, args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", ("--user-data-dir=" + $profile)]}}' \
    > "$PA11Y_CONFIG"; then
    echo "Error: cannot write Pa11y configuration"
    exit 1
fi
if ! (
    cd "$TARGET_DIR"
    PA11Y_STDERR_TEMP="pa11y_stderr.log.tmp"
    if ! rm -f pa11y_stderr.log "$PA11Y_STDERR_TEMP"; then
        echo "Error: cannot prepare Pa11y stderr log"
        exit 1
    fi
    # PUPPETEER_EXECUTABLE_PATH is exported above so pa11y's bundled
    # puppeteer-core finds a working Chrome binary.
    pa11y \
        --runner axe \
        --standard WCAG2AAA \
        --config "$PA11Y_CONFIG" \
        --include-warnings \
        --include-notices \
        --reporter json \
        "$TARGET_HTTP_URL" \
        > pa11y_report.json 2>"$PA11Y_STDERR_TEMP"
    PA11Y_EXIT=$?
    if [ -s "$PA11Y_STDERR_TEMP" ]; then
        if ! mv "$PA11Y_STDERR_TEMP" pa11y_stderr.log; then
            echo "Error: cannot save Pa11y stderr log"
            exit 1
        fi
    elif ! rm -f "$PA11Y_STDERR_TEMP"; then
        echo "Error: cannot remove empty Pa11y stderr log"
        exit 1
    fi
    if [ "$PA11Y_EXIT" -ne 0 ] && [ "$PA11Y_EXIT" -ne 2 ]; then
        echo "Error: Pa11y scan failed (exit $PA11Y_EXIT); see pa11y_stderr.log"
        exit 1
    fi
    # pa11y exits non-zero when issues are found — that's expected
); then
    echo "Error: Pa11y scan did not complete"
    exit 1
fi

# Ensure the file is valid JSON (pa11y may emit nothing on hard crash)
if ! jq -e 'type == "array" or (type == "object" and (.issues | type == "array"))' \
    "$TARGET_DIR/pa11y_report.json" >/dev/null 2>&1; then
    echo "Error: invalid Pa11y report"
    exit 1
fi

PA11Y_ISSUES=$(jq 'if type == "array" then length else (.issues // [] | length) end' \
        "$TARGET_DIR/pa11y_report.json" 2>/dev/null)
if ! [[ "$PA11Y_ISSUES" =~ ^[0-9]+$ ]]; then
    echo "Error: invalid Pa11y issue count"
    exit 1
fi

PA11Y_VERSION=$(pa11y --version 2>/dev/null || echo "unknown")

# --- QualWeb validation ---
# Uses resources/run-qualweb.mjs which injects the HTML directly into QualWeb
# (avoids file:// navigation issues in headless Chrome).
# PUPPETEER_EXECUTABLE_PATH is already exported above.
echo "Running qualweb..."
if ! (
    cd "$SCRIPT_DIR"
    CHROME_USER_DATA_DIR="$CHROME_PROFILE_ROOT/qualweb" \
    node "$RESOURCES/run-qualweb.mjs" \
        "$TARGET_DIR/index.html" \
        "$TARGET_DIR/qualweb_report.json"
); then
    echo "Error: QualWeb scan did not complete"
    exit 1
fi

if ! jq -e 'type == "object" and (has("error") | not) and (has("note") | not)
    and (.failedCount | type == "number" and . >= 0 and . == floor)
    and (.results | type == "array")' "$TARGET_DIR/qualweb_report.json" >/dev/null 2>&1; then
    echo "Error: invalid or skipped QualWeb report"
    exit 1
fi

if ! QUALWEB_ISSUES=$(jq '.failedCount' "$TARGET_DIR/qualweb_report.json"); then
    echo "Error: cannot read QualWeb issue count"
    exit 1
fi
if ! [[ "$QUALWEB_ISSUES" =~ ^[0-9]+$ ]]; then
    QUALWEB_ISSUES=0
fi

QUALWEB_VERSION=$(node -e "try{const p=require('./node_modules/@qualweb/core/package.json');console.log(p.version)}catch(e){console.log('unknown')}" 2>/dev/null || echo "unknown")

LEGACY_ERRORS=0
if [ "$TASK" = "legacy-repair" ]; then
    if ! node "$SCRIPT_DIR/scripts/legacy-run.mjs" "$TARGET_DIR"; then
        echo "Error: legacy repair evaluation failed"
        exit 1
    fi
    LEGACY_ERRORS=$(jq -er '.legacy_error_count | select(type == "number" and . >= 0)' "$TARGET_DIR/legacy_report.json") || exit 1
fi

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
   [ "$QUALWEB_ISSUES" -eq 0 ] && \
   [ "$LEGACY_ERRORS" -eq 0 ]; then
    ITERATION_STATUS="pass"
    QUALITY_SCORE=60
    EFFICIENCY_SCORE=$(awk "BEGIN {printf \"%.4f\", 50 * (0.8 ^ ($ITERATIONS - 1))}")
else
    ITERATION_STATUS="fail"
    TOTAL_ERRORS=$(( W3C_ERRORS + AXE_VIOLATIONS + PA11Y_ISSUES + QUALWEB_ISSUES + LEGACY_ERRORS ))
    QUALITY_SCORE=$(( 10 - TOTAL_ERRORS ))
    [ "$QUALITY_SCORE" -lt 0 ] && QUALITY_SCORE=0
    EFFICIENCY_SCORE=0
fi

SCORE=$(echo "scale=2; ($TAG_COVERAGE / 110 * 90) + $QUALITY_SCORE + $EFFICIENCY_SCORE" | bc)

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Build this iteration's result object ---
ITERATION_RESULT=$(jq -n \
    --arg task "$TASK" \
    --argjson legacy_errors "$LEGACY_ERRORS" \
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
        task: $task,
        task_version: 1,
        legacy_errors: $legacy_errors,
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

if [ "$TASK" = "legacy-repair" ]; then
    ITERATION_RESULT=$(jq --slurpfile legacy "$TARGET_DIR/legacy_report.json" \
        '. + {fixture: $legacy[0].fixture, legacy: $legacy[0]}' <<< "$ITERATION_RESULT") || exit 1
fi

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
echo "TASK            = $TASK"
echo "LEGACY_ERRORS   = $LEGACY_ERRORS"
echo "ITERATIONS      = $ITERATIONS"
echo "SCORE           = $SCORE"
echo "MISSING_TAGS    = $(jq -r '.missing_tags | join(", ")' "$REPORT")"
echo "--------------------------------"

# --- Final result ---
# Exit 0 in ALL cases so that AI agents (Copilot Autopilot, etc.) never treat
# a test failure as a fatal script error. Agents must read the STATUS line below
# to decide whether to iterate or stop.
if [ "$ITERATION_STATUS" = "pass" ]; then
    echo "STATUS: PASS — All tests passed successfully. Do not run test-suite.sh again."
    exit 0
elif [ "$ITERATIONS" -ge 20 ]; then
    echo "STATUS: FAIL — Maximum iterations (20) reached. Stop and report final results."
    exit 0
else
    echo "STATUS: FAIL — Fix the errors above, edit index.html and style.css as needed, then run test-suite.sh again."
    exit 0
fi
