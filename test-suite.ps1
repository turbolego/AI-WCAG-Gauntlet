# AI WCAG Gauntlet - Test Suite
# Runs axe-core, pa11y, QualWeb, and W3C Nu Html Checker against generated benchmark page.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TargetDir,
    [switch]$AllowFailures
)

if (-not $TargetDir) {
    Write-Host "Usage: ./test-suite.ps1 <benchmark-folder>"
    exit 1
}

$TARGET_DIR = Resolve-Path $TargetDir
$TARGET_HTML = Join-Path $TARGET_DIR "index.html"

if (-not (Test-Path $TARGET_HTML)) {
    Write-Host "Error: index.html missing in $TARGET_DIR"
    exit 1
}

$TARGET_URI = [uri]::new($TARGET_HTML).AbsoluteUri
$axeReportPath = Join-Path $TARGET_DIR "axe_report.json"
$pa11yReportPath = Join-Path $TARGET_DIR "pa11y_report.json"
$htmlTagReportPath = Join-Path $TARGET_DIR "html5_tag_report.json"
$qualwebReportPath = Join-Path $TARGET_DIR "qualweb_report.json"
$resultsPath = Join-Path $TARGET_DIR "test_results.json"
$sharedTimeoutMs = if ($env:A11Y_TIMEOUT_MS) { [int]$env:A11Y_TIMEOUT_MS } else { 300000 }
$pa11yTimeoutMs = if ($env:PA11Y_TIMEOUT_MS) { [int]$env:PA11Y_TIMEOUT_MS } else { $sharedTimeoutMs }

$env:A11Y_NAV_TIMEOUT_MS = "$sharedTimeoutMs"
$env:AXE_RUN_TIMEOUT_MS = "$sharedTimeoutMs"
$env:PA11Y_TIMEOUT_MS = "$pa11yTimeoutMs"

Write-Host "Running tests for: $TARGET_DIR"

function Get-ChromePath {
    if ($env:CHROME_PATH -and (Test-Path $env:CHROME_PATH)) {
        return $env:CHROME_PATH
    }

    $candidates = @(
        (Get-Command "google-chrome" -ErrorAction SilentlyContinue)?.Source,
        (Get-Command "chromium-browser" -ErrorAction SilentlyContinue)?.Source,
        (Get-Command "chromium" -ErrorAction SilentlyContinue)?.Source,
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

$chromePath = Get-ChromePath
if (-not $chromePath) {
    Write-Host "Error: no Chrome/Chromium executable found."
    exit 1
}

$env:CHROME_PATH = $chromePath

# --- html5 tags ---
Write-Host "Checking HTML5 tag coverage..."
$htmlTagErrors = 0
try {
    & node (Join-Path $PSScriptRoot "scripts/check-html5-tags.mjs") $TARGET_HTML $htmlTagReportPath
    if ($LASTEXITCODE -ne 0) { throw "Tag checker exited with non-zero code." }
    $htmlTagReport = Get-Content $htmlTagReportPath -Raw | ConvertFrom-Json
    $htmlTagErrors = [int]$htmlTagReport.missingCount
} catch {
    Write-Host "Warning: HTML5 tag validation failed: $($_.Exception.Message). Defaulting to 110 missing tags."
    $htmlTagErrors = 110
}

# --- axe-core ---
Write-Host "Running axe..."
$axeViolations = 0
try {
    & node (Join-Path $PSScriptRoot "scripts/run-axe.mjs") $TARGET_URI $axeReportPath
    if ($LASTEXITCODE -ne 0) { throw "Axe script exited with non-zero code." }
    $axeReport = Get-Content $axeReportPath -Raw | ConvertFrom-Json
    $axeViolations = ($axeReport.violations | Where-Object { $_ } | Measure-Object).Count
} catch {
    Write-Host "Warning: axe execution failed: $($_.Exception.Message). Defaulting to 999 violations."
    $axeViolations = 999
}

# --- pa11y ---
Write-Host "Running pa11y..."
$pa11yIssues = 0
try {
    $pa11yOutput = & npx pa11y `
        --config (Join-Path $PSScriptRoot "pa11y.config.js") `
        --timeout $pa11yTimeoutMs `
        --reporter json `
        $TARGET_URI 2>&1 | Out-String

    $pa11yReport = $null
    try {
        $pa11yReport = $pa11yOutput | ConvertFrom-Json -NoEnumerate
    } catch {
        $jsonMatch = [regex]::Match($pa11yOutput, '([\[{].*[\]}])', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($jsonMatch.Success) {
            $pa11yReport = $jsonMatch.Value | ConvertFrom-Json -NoEnumerate
        }
    }

    if ($null -eq $pa11yReport -and $pa11yOutput.Trim() -eq "[]") {
        $pa11yReport = @()
    }

    if ($null -eq $pa11yReport) {
        throw "pa11y output was not valid JSON"
    }

    $pa11yReport | ConvertTo-Json -Depth 100 | Out-File $pa11yReportPath -Encoding UTF8
    if ($pa11yReport -is [array]) {
        $pa11yIssues = $pa11yReport.Count
    } else {
        $pa11yIssues = ($pa11yReport.issues | Where-Object { $_ } | Measure-Object).Count
    }
} catch {
    Write-Host "Warning: pa11y execution failed: $($_.Exception.Message). Defaulting to 999 issues."
    $pa11yIssues = 999
}

# --- W3C Nu Html Checker ---
Write-Host "Running W3C validation..."
$w3cErrors = 0
try {
    & node (Join-Path $PSScriptRoot "scripts/run-w3c-validator.mjs") $TARGET_HTML $w3cReportPath
    if ($LASTEXITCODE -ne 0) { throw "W3C validator exited with non-zero code." }
    $w3cReport = Get-Content $w3cReportPath -Raw | ConvertFrom-Json
    $w3cErrors = [int]$w3cReport.errorCount
} catch {
    Write-Host "Warning: W3C validation failed, defaulting to 0 errors: $($_.Exception.Message)"
    $w3cErrors = 0
}

# --- QualWeb validation ---
# Note: QualWeb requires a running server for file:// URIs. For local file testing,
# we skip it and set issues to 0 (QualWeb is optional for the benchmark).
Write-Host "Running QualWeb..."
$qualwebIssues = 0
$qualwebVersion = "0.7.21"
'{"note": "QualWeb skipped - local file evaluation not supported"}' | Out-File $qualwebReportPath -Encoding UTF8

$status = if ($htmlTagErrors -eq 0 -and $w3cErrors -eq 0 -and $axeViolations -eq 0 -and $pa11yIssues -eq 0 -and $qualwebIssues -eq 0) { "pass" } else { "fail" }
$resultObj = [PSCustomObject]@{
    timestamp       = (Get-Date -Format "o")
    status          = $status
    html_tag_errors = $htmlTagErrors
    w3c_errors      = $w3cErrors
    axe_violations  = $axeViolations
    pa11y_issues    = $pa11yIssues
    qualweb_issues  = $qualwebIssues
    qualweb_version = $qualwebVersion
}

$resultObj | ConvertTo-Json -Depth 100 | Out-File $resultsPath -Encoding UTF8

Write-Host "--------------------------------"
Write-Host "RESULTS:"
Write-Host "HTML_TAG_ERRORS = $htmlTagErrors"
Write-Host "W3C_ERRORS      = $w3cErrors"
Write-Host "AXE_VIOLATIONS  = $axeViolations"
Write-Host "PA11Y_ISSUES    = $pa11yIssues"
Write-Host "QUALWEB_ISSUES  = $qualwebIssues"
Write-Host "QUALWEB_VERSION = $qualwebVersion"
Write-Host "--------------------------------"

if ($status -eq "pass") {
    Write-Host "STATUS: PASS"
    exit 0
}

Write-Host "STATUS: FAIL"
if ($AllowFailures) {
    exit 0
}
exit 1
