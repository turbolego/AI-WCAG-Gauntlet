#!/bin/bash
# Creates a fresh benchmark run folder under benchmarks/<MODEL_NAME>/
# Prerequisites: axe-core/cli, w3c-html-validator (via npm ci), serve, and pa11y
#   npm install -g @axe-core/cli pa11y serve

# ── FILL IN THESE VARIABLES BEFORE RUNNING ───────────────────────────────────
# The model name used for benchmarking (used as the folder name)
#MODEL_NAME="Claude Haiku 4.5"
#MODEL_NAME="GPT-4.1"
MODEL_NAME="Gemini 3 Flash (Preview)"


# The provider where the model runs (machine-readable identifier).
# Examples: "github-copilot", "ollama", "openai", "huggingface", "mistral", "openrouter"
PROVIDER="github-copilot"

# Human-readable label for the provider shown in the dashboard Source column.
# Examples: "GitHub Copilot", "Ollama", "OpenAI", "HuggingFace", "Mistral AI", "OpenRouter"
PROVIDER_LABEL="GitHub Copilot"

# The tool/interface used to run the benchmark.
# Examples: "vscode", "github-actions", "cli"
TOOL="vscode"
# ─────────────────────────────────────────────────────────────────────────────

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# e.g. ./benchmarks/GPT-4o/GPT-4o-20260405-155342
BENCHMARK_FOLDER="./benchmarks/${MODEL_NAME}/${MODEL_NAME}-${TIMESTAMP}"
mkdir -p "$BENCHMARK_FOLDER"

# Minimal starter index.html
cat <<EOF > "$BENCHMARK_FOLDER/index.html"
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
EOF

# Minimal starter style.css
cat <<EOF > "$BENCHMARK_FOLDER/style.css"
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
EOF

# Write metadata.json
cat <<EOF > "$BENCHMARK_FOLDER/metadata.json"
{
  "model": "$MODEL_NAME",
  "provider": "$PROVIDER",
  "providerLabel": "$PROVIDER_LABEL",
  "tool": "$TOOL",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "folder": "$(basename "$BENCHMARK_FOLDER")"
}
EOF

echo "Benchmark setup complete: $BENCHMARK_FOLDER"
echo "Run tests with:"
echo "./test-suite.sh $BENCHMARK_FOLDER"
