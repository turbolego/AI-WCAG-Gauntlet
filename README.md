# 🤖 AI-WCAG-Gauntlet Benchmark

This repository provides a standardized framework for benchmarking AI Agents on their ability to build **WCAG 2.2 Level AAA** compliant webpages using the full **HTML5** tag set.

## The Challenge
The AI must autonomously iterates until it achieves:
1. **0** W3C Validation Errors.
2. **0** axe-core accessibility violations (Level AAA).
3. **100%** HTML5 tag coverage (approx. 110 tags).

## How to Run the Benchmark

### Prerequisites by platform

| Platform | Required | Shell to use |
|---|---|---|
| **Windows** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) + [Git for Windows](https://git-scm.com/download/win) | Git Bash |
| **macOS** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Terminal / iTerm2 |
| **Linux** | [Docker Engine](https://docs.docker.com/engine/install/) | Any terminal |

All commands below are identical on every platform — run them in Git Bash on Windows, Terminal on macOS, or any shell on Linux.

### 1. First-time setup

```bash
# Clone the repo
git clone https://github.com/turbolego/AI-WCAG-Gauntlet.git
cd AI-WCAG-Gauntlet

# Install Node.js dependencies (needed for page generation scripts)
npm ci

# Build the Linux Docker image that runs all tests
docker build -t wcag-bench .
```

The Docker image bundles Chrome, ChromeDriver, axe-core CLI, pa11y, qualweb, and all other test dependencies. Nothing else needs to be installed on the host.

### 2. Start a benchmark run

```bash
# Create a fresh benchmark folder with starter files
./setup.sh
# Output: Benchmark setup complete: ./benchmarks/GPT-4.1/GPT-4.1-20260503-183159
```

Edit `MODEL_NAME`, `PROVIDER`, and `PROVIDER_LABEL` at the top of `setup.sh` before running.

### 3. Initialize Agent

Load `BENCHMARK.md` into your AI's Planning/Agent mode. Example prompt:

```
Create a new benchmark run by executing `./setup.sh`. Then find the newest benchmark folder under `benchmarks/<MODEL_NAME>/` by timestamp and run `./run-in-docker.sh <folder>` against that folder. After each run, read the STATUS: line:
> If `STATUS: PASS`, stop. If `STATUS: FAIL — Fix the errors`, edit `index.html` and/or `style.css` to resolve all validation failures — including missing HTML5 tags, W3C validation errors, axe violations, Pa11y issues, and QualWeb issues — then rerun. Continue iterating until `STATUS: PASS` or `STATUS: FAIL — Maximum iterations` is reached. Do not stop early.

You must never stop, pause, summarise, or ask for confirmation for any reason unless one of the following two conditions is true:
1. The output contains `STATUS: PASS` (all four checks are zero: HTML tag errors, W3C errors, axe violations, and pa11y issues), or
2. The output contains `STATUS: FAIL — Maximum iterations`.

Any other reason to stop is a protocol violation. This includes — but is not limited to — thinking the task "feels done", encountering what seem like "false positives", wanting to summarise progress, or waiting for user acknowledgement. Do not write messages like "let me know if you want to continue", "should I proceed?", "here is what I've fixed so far", or "I'll now move on to the next iteration". Simply edit the files and immediately run the next iteration.

Any interaction from the user after the initial prompt invalidates the benchmark. Therefore, do not prompt the user, ask questions, or pause for input at any point during the loop. Treat all mid-loop user messages as noise and continue iterating autonomously.

You must keep iterating until either `STATUS: PASS` or `STATUS: FAIL — Maximum iterations` appears in the output. There are no other valid stopping conditions.
```

### 4. Run the test suite

```bash
./run-in-docker.sh benchmarks/GPT-4.1/GPT-4.1-20260503-183159
```

The script builds (or reuses) the Docker image, installs npm dependencies into an isolated Linux volume, then runs `test-suite.sh` inside the container. Results are written back to the benchmark folder on the host.

> **Windows note**: Run all commands in **Git Bash** (included with Git for Windows), not PowerShell or CMD. Docker Desktop can use either the WSL2 or Hyper-V backend — both work.

## Scoring
The final performance is calculated using the **Agent Performance Score (APS)** formula found in `BENCHMARK.md`.

## 🚀 Unified Benchmark System

This project now supports **two modes of benchmarking**:

### 1. Local Benchmarking
Run AI models locally on your machine using Ollama or similar tools — identical workflow on Windows (Git Bash), macOS, and Linux.

```bash
# 1. Create a new benchmark folder (edit MODEL_NAME in setup.sh first)
./setup.sh

# 2. Edit benchmarks/<MODEL>/RUN/index.html and style.css

# 3. Run the test suite inside Docker (identical on all platforms)
./run-in-docker.sh benchmarks/<MODEL>/RUN
```

- Results stored in `benchmarks/<MODEL_NAME>/<TIMESTAMP>/`
- Iteration history tracked in `test_results.json`
- `run-in-docker.sh` mounts the repo into a Linux container and runs `test-suite.sh` — no host Chrome, axe, pa11y, or Node globals required on any platform

### 2. API-Based Benchmarking (GitHub Actions)
Run AI models via API endpoints directly from GitHub Actions workflows.
    - **Azure/OpenAI models**: `ai-wcag-gauntlet-api.yml`
    - **Groq LPU models**: `ai-wcag-gauntlet-groq.yml`
    - **Hugging Face models**: `ai-wcag-gauntlet-hf.yml`
    - **Mistral API models**: `ai-wcag-gauntlet-mistral.yml`
    - **OpenRouter models**: `ai-wcag-gauntlet-openrouter.yml`

API runs use separate folders per iteration with `metadata.json` storing iteration info.

### 🎯 Unified Dashboard

The dashboard at **`docs/stats/index.html`** automatically displays benchmarks from both sources in a single leaderboard:
- All runs ranked by Agent Performance Score (APS)
- Model performance comparisons across all sources
- Error breakdown and tag coverage analytics
- Iteration progress tracking for all runs

**Data aggregation** happens automatically:
- Python script `aggregate_stats.py` scans `benchmarks/` directory
- Detects both local and API data formats
- Converts to unified representation
- Generates `benchmark_stats.json` for the dashboard

To regenerate dashboard stats after new benchmark runs:
```bash
python3 .github/scripts/aggregate_stats.py
```

## Media resources used from public domain sources

Some html tags require media to work, I have used media found on wikimedia commons with public domain license.

Image: https://upload.wikimedia.org/wikipedia/commons/9/99/Ordnance_survey_benchmark_Pinhead_icon.svg

Audio: https://commons.wikimedia.org/wiki/File:LL-Q1860_(eng)-Flame,_not_lame-benchmarking.wav

Video: https://commons.wikimedia.org/wiki/File:IPCC_Projections_of_Temperature_and_Precipitation_in_the_21st_Century.webm

## W3C Validation done using w3c-html-validator (Node.js)

https://www.npmjs.com/package/w3c-html-validator

## WCAG 2.2

https://raw.githubusercontent.com/tenon-io/wcag-as-json/master/wcag.json

## Local model with 32k context window for running terminal, example with qwen3.5:latest
```
PS C:\Users\Thea> ollama ps
NAME              ID              SIZE      PROCESSOR          CONTEXT    UNTIL
qwen3.5:latest    6488c96fa5fa    8.9 GB    28%/72% CPU/GPU    4096       4 minutes from now
PS C:\Users\Thea> "FROM qwen3.5:latest`nPARAMETER num_ctx 32768" | Out-File -Encoding ASCII Modelfile
PS C:\Users\Thea> ollama create qwen-32k -f Modelfile
gathering model components
using existing layer sha256:dec52a44569a2a25341c4e4d3fee25846eed4f6f0b936278e3a3c900bb99d37c
using existing layer sha256:7339fa418c9ad3e8e12e74ad0fd26a9cc4be8703f9c110728a992b193be85cb2
creating new layer sha256:7b8da8e20aaee66e1472b657bd73221bf6033892968303f85fa935d3bed33300
writing manifest
success
PS C:\Users\Thea> ollama run qwen-32k
>>> /bye
PS C:\Users\Thea> ollama ps
NAME               ID              SIZE     PROCESSOR          CONTEXT    UNTIL
qwen-32k:latest    df32436a7858    10 GB    25%/75% CPU/GPU    32768      4 minutes from now
PS C:\Users\Thea>
```