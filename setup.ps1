# AI WCAG Gauntlet - Setup Script
# Creates a fresh benchmark run folder under benchmarks/<MODEL_NAME>/
# Prerequisites: axe-core/cli, w3c-html-validator (via npm ci), serve, and pa11y
#   npm install -g @axe-core/cli pa11y serve

# ── FILL IN THESE VARIABLES BEFORE RUNNING ────────────────────────────────────
# The model name used for benchmarking (used as the folder name)
#$MODEL_NAME = "Claude Haiku 4.5"
#$MODEL_NAME = "GPT-4.1"
#$MODEL_NAME = "GPT-4o"
#$MODEL_NAME = "Gemini 3 Flash (Preview)"

#$MODEL_NAME = "sorc/qwen3.5-claude-4.6-opus-q4:2b"
#$MODEL_NAME = "qwen2.5-coder-1.5b"
#$MODEL_NAME = "sorc/qwen3.5-claude-4.6-opus-q4:9b"
#$MODEL_NAME = "unsloth/Qwen3.5-9B-Q4_K_M"
#$MODEL_NAME = "qwen35-9b:latest"
#$MODEL_NAME = "Qwen3.6-35B-A3B-Q4_K_M"
#$MODEL_NAME = "Claude Sonnet 5"
$MODEL_NAME = "GPT-6.1 Sol - Medium"

# The provider where the model runs (machine-readable identifier).
# Examples: "github-copilot", "ollama", "openai", "huggingface", "mistral", "openrouter"
$PROVIDER = "github-copilot"
#$PROVIDER = "ollama"
#$PROVIDER = "Cline"

# Human-readable label for the provider shown in the dashboard Source column.
# Examples: "GitHub Copilot", "Ollama", "OpenAI", "HuggingFace", "Mistral AI", "OpenRouter"
$PROVIDER_LABEL = "GitHub Copilot"
#$PROVIDER_LABEL = "Ollama"
#$PROVIDER_LABEL = "llama.cpp"



# The tool/interface used to run the benchmark.
# Examples: "vscode", "github-actions", "cli"
$TOOL = "vscode"
# ──────────────────────────────────────────────────────────────────────────────

$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"

# e.g. .\benchmarks\GPT-4o\GPT-4o-20260405-155342
$BENCHMARK_FOLDER = Join-Path $PSScriptRoot "benchmarks\$MODEL_NAME\$MODEL_NAME-$TIMESTAMP"
New-Item -ItemType Directory -Force -Path $BENCHMARK_FOLDER | Out-Null

# Minimal starter index.html
$indexHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Benchmark</title>
</head>
<body>
    <h1>AI WCAG Gauntlet</h1>
</body>
</html>
"@
$indexHtml | Out-File -FilePath (Join-Path $BENCHMARK_FOLDER "index.html") -Encoding UTF8

# Minimal starter style.css
$styleCss = @"
/* Basic styling for the benchmark */
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 0;
    background-color: #f9f9f9;
    color: #333;
}

h1 {
    text-align: center;
    margin-top: 20px;
}
"@
$styleCss | Out-File -FilePath (Join-Path $BENCHMARK_FOLDER "style.css") -Encoding UTF8

# Write metadata.json
$metadata = [ordered]@{
    model         = $MODEL_NAME
    provider      = $PROVIDER
    providerLabel = $PROVIDER_LABEL
    tool          = $TOOL
    timestamp     = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    folder        = Split-Path $BENCHMARK_FOLDER -Leaf
}
$metadata | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $BENCHMARK_FOLDER "metadata.json") -Encoding UTF8

Write-Host "Benchmark setup complete: $BENCHMARK_FOLDER"
Write-Host "Run tests with:"
Write-Host ".\test-suite.ps1 $BENCHMARK_FOLDER"
