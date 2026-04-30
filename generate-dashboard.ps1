# AI WCAG Gauntlet - Dashboard Generator
# Scans benchmark runs and regenerates root index.html and benchmarks/benchmark_stats.json.

$repoRoot = $PSScriptRoot
$benchmarksRoot = Join-Path $repoRoot "benchmarks"
$dashboardDir = Join-Path $repoRoot "dashboard"
$statsPath = Join-Path $benchmarksRoot "benchmark_stats.json"
$dashboardHtmlPath = Join-Path $repoRoot "index.html"

New-Item -ItemType Directory -Path $benchmarksRoot -Force | Out-Null

# Generate benchmark_stats.json using the Node.js aggregator
& node (Join-Path $repoRoot "scripts/aggregate-stats.mjs") --benchDir $benchmarksRoot --outFile $statsPath
if ($LASTEXITCODE -ne 0) {
    throw "Stats aggregation failed."
}

# Read dashboard assets and inline them into index.html
$cssContent = Get-Content (Join-Path $dashboardDir "style.css") -Raw
$jsContent = Get-Content (Join-Path $dashboardDir "app.js") -Raw
$templatePath = Join-Path $dashboardDir "template.html"
$dashboardHtml = Get-Content $templatePath -Raw
$dashboardHtml = $dashboardHtml.Replace('/* __INLINE_CSS__ */', $cssContent)
$dashboardHtml = $dashboardHtml.Replace('/* __INLINE_JS__ */', $jsContent)

Set-Content -Path $dashboardHtmlPath -Value $dashboardHtml -Encoding UTF8

Write-Host "Dashboard generated: $dashboardHtmlPath"

# Also regenerate the GitHub Pages leaderboard dashboard (docs/stats/)
Write-Host "Regenerating GitHub Pages leaderboard..."
& python3 (Join-Path $repoRoot ".github/scripts/aggregate_stats.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: GitHub Pages leaderboard regeneration failed (non-fatal)."
}
