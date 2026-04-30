# AI WCAG Gauntlet - Setup Script
# Creates a fresh benchmark run folder under benchmarks/<MODEL_NAME>/

param(
    [string]$ModelName = "GPT-4.1",
    [int]$Iteration = 1,
    [string]$PreviousRunDir,
    # Internal API provider identifier used by scripts/generate-page.mjs
    # Examples: "github", "openai", "huggingface", "mistral", "openrouter", "ollama"
    [string]$Provider = "github",
    # Machine-readable provider identifier written to metadata.json for the dashboard.
    # Fill this in before running for local benchmarks.
    # Examples: "github-copilot", "ollama", "openai", "huggingface", "mistral", "openrouter"
    [string]$ProviderKey = "github-copilot",
    # Human-readable label shown in the dashboard Source column.
    # Examples: "GitHub Copilot", "Ollama", "OpenAI", "HuggingFace", "Mistral AI", "OpenRouter"
    [string]$ProviderLabel = "GitHub Copilot",
    # Tool/interface used to run the benchmark.
    # Examples: "vscode", "github-actions", "cli"
    [string]$Tool = "vscode"
)

$safeModelName = ($ModelName -replace '[^A-Za-z0-9._-]', '-')
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$benchmarkFolder = Join-Path $PSScriptRoot "benchmarks/$safeModelName/$safeModelName-$timestamp-$Iteration"
$resolvedPreviousRunDir = $null

New-Item -ItemType Directory -Force -Path $benchmarkFolder | Out-Null


$generateScript = Join-Path $PSScriptRoot "scripts/generate-page.mjs"
$generateArgs = @(
    $generateScript,
    "--model", $ModelName,
    "--iteration", $Iteration.ToString(),
    "--outputDir", $benchmarkFolder,
    "--provider", $Provider
)

if ($PreviousRunDir -and (Test-Path $PreviousRunDir)) {
    $resolvedPreviousRunDir = (Resolve-Path $PreviousRunDir).Path
    $generateArgs += @("--previousDir", $resolvedPreviousRunDir)
}

& node @generateArgs
if ($LASTEXITCODE -ne 0) {
    throw "AI page generation failed."
}

$metadata = [PSCustomObject]@{
    model         = $ModelName
    safeModel     = $safeModelName
    iteration     = $Iteration
    timestamp     = (Get-Date -Format "o")
    folder        = [System.IO.Path]::GetFileName($benchmarkFolder)
    previous      = if ($resolvedPreviousRunDir) { [System.IO.Path]::GetFileName($resolvedPreviousRunDir) } else { $null }
    provider      = $ProviderKey
    providerLabel = $ProviderLabel
    tool          = $Tool
}
$metadata | ConvertTo-Json -Depth 10 | Out-File (Join-Path $benchmarkFolder "metadata.json") -Encoding UTF8

Write-Host "Benchmark setup complete: $benchmarkFolder"
Write-Output $benchmarkFolder
