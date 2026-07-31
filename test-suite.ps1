# AI WCAG Gauntlet - Test Suite
# Runs axe-core, pa11y, QualWeb, and W3C Nu Html Checker against the benchmark page.
# Mirrors test-suite.sh exactly — same tools, same flags, same output format.
#
# NOTE: This script always exits with code 0. Agents must read the STATUS: line
# at the bottom of output to decide whether to iterate or stop.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TargetDir
)

# --- Resolve paths ---
$SCRIPT_DIR  = $PSScriptRoot
$RESOURCES   = Join-Path $SCRIPT_DIR "resources"

# --- Input folder ---
if (-not $TargetDir) {
    Write-Host "Usage: .\test-suite.ps1 <benchmark-folder>"
    exit 0
}

$TARGET_DIR = (Resolve-Path $TargetDir).Path

Write-Host "Running tests for: $TARGET_DIR"

# --- Validate ---
if (-not (Test-Path $TARGET_DIR)) {
    Write-Host "Error: target folder not found"
    exit 0
}
if (-not (Test-Path (Join-Path $TARGET_DIR "index.html"))) {
    Write-Host "Error: index.html missing"
    exit 0
}
if (-not (Test-Path $RESOURCES)) {
    Write-Host "Error: resources folder missing"
    exit 0
}

# --- Detect Chrome for pa11y and QualWeb ---
function Find-Chrome {
    if ($env:PUPPETEER_EXECUTABLE_PATH -and (Test-Path $env:PUPPETEER_EXECUTABLE_PATH)) {
        return $env:PUPPETEER_EXECUTABLE_PATH
    }

    if ($env:USERPROFILE) {
        $userProfile = $env:USERPROFILE
    } elseif ($env:HOME) {
        $userProfile = $env:HOME
    } else {
        $userProfile = "C:\Users\$env:USERNAME"
    }

    $candidates = @(
        # Puppeteer-managed Chrome (Windows cache path)
        (Join-Path $userProfile ".cache\puppeteer\chrome\win64-*\chrome-win64\chrome.exe"),
        # System Chrome installs
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        # Chocolatey / Scoop / winget locations
        "C:\ProgramData\chocolatey\bin\chrome.exe",
        (Join-Path $userProfile "scoop\apps\googlechrome\current\chrome.exe"),
        # WSL / Linux paths (if running under WSL)
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium"
    )

    foreach ($pattern in $candidates) {
        # Expand wildcards (e.g. puppeteer versioned dirs)
        $resolved = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path $resolved.FullName)) {
            return $resolved.FullName
        }
    }

    # Last resort: PATH lookup
    foreach ($name in @("google-chrome", "chromium-browser", "chromium", "chrome")) {
        $found = Get-Command $name -ErrorAction SilentlyContinue
        if ($found) { return $found.Source }
    }

    return $null
}

$chromePath = Find-Chrome
if ($chromePath) {
    $env:PUPPETEER_EXECUTABLE_PATH = $chromePath
} else {
    Write-Host "Warning: no Chrome/Chromium found — pa11y/QualWeb may fail."
}

# --- Increment iterations counter ---
$ITERATIONS_FILE = Join-Path $TARGET_DIR "iterations_count.txt"
if (-not (Test-Path $ITERATIONS_FILE)) {
    "0" | Out-File $ITERATIONS_FILE -Encoding ASCII
}
$ITERATIONS = [int](Get-Content $ITERATIONS_FILE) + 1
"$ITERATIONS" | Out-File $ITERATIONS_FILE -Encoding ASCII

# --- Start local HTTP server ---
# Pages use <base href="/AI-WCAG-Gauntlet/"> so they must be served over HTTP.
# Serve from the PARENT of the project root so /AI-WCAG-Gauntlet/ resolves
# correctly, matching the GitHub Pages deployment layout.
$SERVE_PORT   = if ($env:A11Y_SERVE_PORT) { [int]$env:A11Y_SERVE_PORT } else { 28763 }
$PARENT_DIR   = Split-Path $SCRIPT_DIR -Parent
$PROJECT_NAME = Split-Path $SCRIPT_DIR -Leaf

$python3 = $null
$python3Cmd = Get-Command "python3" -ErrorAction SilentlyContinue
if ($python3Cmd) { $python3 = $python3Cmd.Source }
if (-not $python3) {
    $pythonCmd = Get-Command "python" -ErrorAction SilentlyContinue
    if ($pythonCmd) { $python3 = $pythonCmd.Source }
}

$serveProcess = $null
if ($python3) {
    $serveProcess = Start-Process -FilePath $python3 `
        -ArgumentList @("-m", "http.server", "$SERVE_PORT", "--directory", $PARENT_DIR) `
        -PassThru -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} else {
    Write-Host "Warning: python3/python not found — HTTP server not started. CSS/resources may fail."
}

# Build the HTTP URL for the target page, URL-encoding the relative path
$psRootFwd  = $SCRIPT_DIR.Replace('\', '/')
$targetFwd  = $TARGET_DIR.Replace('\', '/')
$relTarget  = $targetFwd.Substring($psRootFwd.Length).TrimStart('/')
# URL-encode each path segment individually (preserves /)
$relTargetEnc = ($relTarget -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }
$relTargetEnc = $relTargetEnc -join '/'
$TARGET_HTTP_URL = "http://localhost:$SERVE_PORT/$PROJECT_NAME/$relTargetEnc/index.html"
Write-Host "Testing via HTTP: $TARGET_HTTP_URL"

# Cleanup helper — always stop the HTTP server on exit
function Stop-ServeProcess {
    if ($serveProcess -and -not $serveProcess.HasExited) {
        Stop-Process -Id $serveProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

# --- HTML5 tag test ---
Write-Host "Running HTML5 tag test..."
$HTML_TAG_ERRORS = 0
try {
    Push-Location $TARGET_DIR
    $tagResult = & python3 (Join-Path $RESOURCES "check_html5_tags.py") 2>&1
    if ($LASTEXITCODE -ne 0) { throw "check_html5_tags.py failed: $tagResult" }
    Pop-Location

    $REPORT = Join-Path $TARGET_DIR "html5_tags_report.json"
    if (-not (Test-Path $REPORT)) { throw "html5_tags_report.json not generated" }
    $HTML_TAG_ERRORS = [int](Get-Content $REPORT -Raw | ConvertFrom-Json).missing_tags.Count
} catch {
    Write-Host "Error: $_"
    Stop-ServeProcess
    exit 0
}

# --- W3C HTML validation ---
Write-Host "Running w3c-html-validator..."
$W3C_ERRORS = 0
try {
    Push-Location $TARGET_DIR
    & node (Join-Path $RESOURCES "run-w3c-validator.mjs") "index.html" "w3c_report.json" 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "w3c-html-validator failed" }
    Pop-Location
    $W3C_ERRORS = [int](Get-Content (Join-Path $TARGET_DIR "w3c_report.json") -Raw | ConvertFrom-Json).errorCount
} catch {
    Write-Host "Error: $_"
    Stop-ServeProcess
    exit 0
}

# --- Axe validation ---
Write-Host "Running axe..."
$AXE_VIOLATIONS = 0
$AXE_VERSION    = "unknown"
try {
    Push-Location $TARGET_DIR
    & axe $TARGET_HTTP_URL `
        '--chrome-options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]}' `
        --timeout 60000 `
        --tags "wcag2a,wcag2aa,wcag2aaa,wcag21a,wcag21aa,wcag22aa,best-practice" `
        --save "axe_report.json" `
        2>&1 | Out-Null
    Pop-Location

    $axeReport = Get-Content (Join-Path $TARGET_DIR "axe_report.json") -Raw | ConvertFrom-Json
    if ($axeReport -is [array]) {
        $AXE_VIOLATIONS = ($axeReport | ForEach-Object { $_.violations } | Where-Object { $_ } | Measure-Object).Count
        if ($axeReport[0].testEngine -and $axeReport[0].testEngine.version) {
            $AXE_VERSION = $axeReport[0].testEngine.version
        } else {
            $AXE_VERSION = "unknown"
        }
    } else {
        $AXE_VIOLATIONS = ($axeReport.violations | Where-Object { $_ } | Measure-Object).Count
        if ($axeReport.testEngine -and $axeReport.testEngine.version) {
            $AXE_VERSION = $axeReport.testEngine.version
        } else {
            $AXE_VERSION = "unknown"
        }
    }
} catch {
    Write-Host "Error: axe failed — $_"
    Stop-ServeProcess
    exit 0
}

# --- Pa11y validation ---
Write-Host "Running pa11y..."
$PA11Y_ISSUES  = 0
$PA11Y_VERSION = "unknown"
try {
    $pa11yJson = & pa11y `
        --runner axe `
        --standard WCAG2AAA `
        --reporter json `
        $TARGET_HTTP_URL 2>$null

    # pa11y exits non-zero when issues found — that is expected, so we don't
    # treat $LASTEXITCODE != 0 as a hard error here.

    if ([string]::IsNullOrWhiteSpace($pa11yJson)) {
        $pa11yJson = "[]"
    }

    # Validate JSON
    $pa11yReport = $pa11yJson | ConvertFrom-Json -ErrorAction Stop
    $pa11yJson   | Out-File (Join-Path $TARGET_DIR "pa11y_report.json") -Encoding UTF8

    if ($pa11yReport -is [array]) {
        $PA11Y_ISSUES = $pa11yReport.Count
    } else {
        $PA11Y_ISSUES = ($pa11yReport.issues | Where-Object { $_ } | Measure-Object).Count
    }
} catch {
    Write-Host "Warning: pa11y execution failed ($($_)). Resetting to empty report."
    "[]" | Out-File (Join-Path $TARGET_DIR "pa11y_report.json") -Encoding UTF8
    $PA11Y_ISSUES = 0
}

try {
    $PA11Y_VERSION = (& pa11y --version 2>&1) -join "" -replace "`n",""
} catch { }

# --- QualWeb validation ---
Write-Host "Running qualweb..."
$QUALWEB_ISSUES  = 0
$QUALWEB_VERSION = "unknown"
try {
    # Run from SCRIPT_DIR (same as the .sh script) so relative node_modules resolve
    Push-Location $SCRIPT_DIR
    & node (Join-Path $RESOURCES "run-qualweb.mjs") `
        (Join-Path $TARGET_DIR "index.html") `
        (Join-Path $TARGET_DIR "qualweb_report.json") `
        2>&1 | Out-Null
    Pop-Location

    $qualwebReport = Get-Content (Join-Path $TARGET_DIR "qualweb_report.json") -Raw | ConvertFrom-Json
    if ($qualwebReport.failedCount -ne $null) {
        $QUALWEB_ISSUES = [int]$qualwebReport.failedCount
    } else {
        $QUALWEB_ISSUES = 0
    }
} catch {
    Write-Host "Warning: qualweb failed ($($_)). Continuing with empty report."
    $qualwebFallback = [ordered]@{
        failedCount = 0
        results     = @()
        error       = "qualweb script failed"
    }
    $qualwebFallback | ConvertTo-Json -Depth 10 | Out-File (Join-Path $TARGET_DIR "qualweb_report.json") -Encoding UTF8
    $QUALWEB_ISSUES = 0
}

try {
    $pkgPath = Join-Path $SCRIPT_DIR "node_modules\@qualweb\core\package.json"
    if (Test-Path $pkgPath) {
        $QUALWEB_VERSION = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
    }
} catch { }

# --- Scoring ---
$TAG_COVERAGE = [int](Get-Content (Join-Path $TARGET_DIR "html5_tags_report.json") -Raw | ConvertFrom-Json).used_tags.Count

if ($HTML_TAG_ERRORS -eq 0 -and $W3C_ERRORS -eq 0 -and $AXE_VIOLATIONS -eq 0 -and
    $PA11Y_ISSUES -eq 0 -and $QUALWEB_ISSUES -eq 0) {
    $ITERATION_STATUS = "pass"
    $QUALITY_SCORE    = 60
    $EFFICIENCY_SCORE = [math]::Round(50 * [math]::Pow(0.8, $ITERATIONS - 1), 4)
} else {
    $ITERATION_STATUS = "fail"
    $TOTAL_ERRORS     = $W3C_ERRORS + $AXE_VIOLATIONS + $PA11Y_ISSUES + $QUALWEB_ISSUES
    $QUALITY_SCORE    = [math]::Max(0, 10 - $TOTAL_ERRORS)
    $EFFICIENCY_SCORE = 0
}

$SCORE = [math]::Round(($TAG_COVERAGE / 110 * 90) + $QUALITY_SCORE + $EFFICIENCY_SCORE, 2)
$TIMESTAMP_ISO = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

# --- Missing / used tags for JSON ---
$tagsReport  = Get-Content (Join-Path $TARGET_DIR "html5_tags_report.json") -Raw | ConvertFrom-Json
$missingTags = $tagsReport.missing_tags
$usedTags    = $tagsReport.used_tags

# --- Build iteration result object ---
$iterationResult = [ordered]@{
    timestamp       = $TIMESTAMP_ISO
    iteration       = $ITERATIONS
    status          = $ITERATION_STATUS
    score           = $SCORE
    html_tag_errors = $HTML_TAG_ERRORS
    w3c_errors      = $W3C_ERRORS
    axe_violations  = $AXE_VIOLATIONS
    axe_version     = $AXE_VERSION
    pa11y_issues    = $PA11Y_ISSUES
    pa11y_version   = $PA11Y_VERSION
    qualweb_issues  = $QUALWEB_ISSUES
    qualweb_version = $QUALWEB_VERSION
    missing_tags    = $missingTags
    used_tags       = $usedTags
}

# --- Append to test_results.json (array, one entry per iteration) ---
$RESULTS_JSON = Join-Path $TARGET_DIR "test_results.json"
if (Test-Path $RESULTS_JSON) {
    try {
        $existing = Get-Content $RESULTS_JSON -Raw | ConvertFrom-Json
        if ($existing -isnot [array]) { $existing = @($existing) }
        $updated  = @($existing) + @($iterationResult)
        $updated  | ConvertTo-Json -Depth 100 | Out-File $RESULTS_JSON -Encoding UTF8
    } catch {
        # File corrupt — start fresh
        @($iterationResult) | ConvertTo-Json -Depth 100 | Out-File $RESULTS_JSON -Encoding UTF8
    }
} else {
    @($iterationResult) | ConvertTo-Json -Depth 100 | Out-File $RESULTS_JSON -Encoding UTF8
}

Write-Host "Results written to $RESULTS_JSON"

# --- Console output ---
Write-Host "--------------------------------"
Write-Host "RESULTS:"
Write-Host "HTML_TAG_ERRORS = $HTML_TAG_ERRORS"
Write-Host "W3C_ERRORS      = $W3C_ERRORS"
Write-Host "AXE_VIOLATIONS  = $AXE_VIOLATIONS"
Write-Host "AXE_VERSION     = $AXE_VERSION"
Write-Host "PA11Y_ISSUES    = $PA11Y_ISSUES"
Write-Host "PA11Y_VERSION   = $PA11Y_VERSION"
Write-Host "QUALWEB_ISSUES  = $QUALWEB_ISSUES"
Write-Host "QUALWEB_VERSION = $QUALWEB_VERSION"
Write-Host "ITERATIONS      = $ITERATIONS"
Write-Host "SCORE           = $SCORE"
Write-Host "MISSING_TAGS    = $($missingTags -join ', ')"
Write-Host "--------------------------------"

# Stop HTTP server before exiting
Stop-ServeProcess

# --- Final status line ---
# Always exit 0 so AI agents never treat a test failure as a fatal script error.
# Agents must read the STATUS: line to decide whether to iterate or stop.
if ($ITERATION_STATUS -eq "pass") {
    Write-Host "STATUS: PASS — All tests passed successfully. Do not run test-suite.ps1 again."
    exit 0
} elseif ($ITERATIONS -ge 20) {
    Write-Host "STATUS: FAIL — Maximum iterations (20) reached. Stop and report final results."
    exit 0
} else {
    Write-Host "STATUS: FAIL — Fix the errors above, edit index.html and style.css as needed, then run test-suite.ps1 again."
    exit 0
}
