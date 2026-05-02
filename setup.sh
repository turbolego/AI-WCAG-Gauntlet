#!/bin/bash
# Creates a fresh benchmark run folder under benchmarks/<MODEL_NAME>/
# Prerequisites: axe-core/cli, w3c-html-validator (via npm ci), serve, and pa11y
#   npm install -g @axe-core/cli pa11y serve

# ── Bootstrap Node.js into PATH (unattended – no profile sourcing) ────────────
# Probe nvm-managed versions (newest first via reverse sort) and common prefixes.
# This runs entirely via filesystem checks; it never sources a shell profile and
# never triggers a sandbox Allow/Skip prompt.
if ! command -v node >/dev/null 2>&1; then
    _NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
    # Collect all nvm-installed node bin dirs, sort newest first
    for _d in $(ls -1d "${_NVM_DIR}/versions/node/"*/bin 2>/dev/null | sort -Vr); do
        if [ -x "${_d}/node" ]; then
            export PATH="${_d}:${PATH}"
            break
        fi
    done
fi
# Fallback: Homebrew (Apple Silicon / Intel) and common system prefixes
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
# ─────────────────────────────────────────────────────────────────────────────

# ── FILL IN THESE VARIABLES BEFORE RUNNING ───────────────────────────────────
# The model name used for benchmarking (used as the folder name)
#MODEL_NAME="Claude Haiku 4.5"
#MODEL_NAME="GPT-4.1"
MODEL_NAME="GPT-4o"
#MODEL_NAME="Gemini 3 Flash (Preview)"

#MODEL_NAME="sorc/qwen3.5-claude-4.6-opus-q4:2b"
#MODEL_NAME="qwen2.5-coder-1.5b"


# The provider where the model runs (machine-readable identifier).
# Examples: "github-copilot", "ollama", "openai", "huggingface", "mistral", "openrouter"
PROVIDER="github-copilot"
#PROVIDER="ollama"

# Human-readable label for the provider shown in the dashboard Source column.
# Examples: "GitHub Copilot", "Ollama", "OpenAI", "HuggingFace", "Mistral AI", "OpenRouter"
PROVIDER_LABEL="GitHub Copilot"
#PROVIDER_LABEL="Ollama"

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
