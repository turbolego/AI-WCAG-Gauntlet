# 🤖 AI-WCAG-Gauntlet Benchmark

This repository provides a standardized framework for benchmarking AI Agents on their ability to build **WCAG 2.2 Level AAA** compliant webpages using the full **HTML5** tag set.

## The Challenge
The AI must autonomously iterates until it achieves:
1. **0** W3C Validation Errors.
2. **0** axe-core accessibility violations (Level AAA).
3. **100%** HTML5 tag coverage (approx. 110 tags).

## How to Run the Benchmark
1. **Prepare Environment**: Install `axe-core/cli`, `serve`, `pa11y`, and `@qualweb/cli` globally. Run `npm ci` to install `w3c-html-validator` and other dependencies.
   ```bash
   npm install -g @axe-core/cli pa11y @qualweb/cli serve
   npm ci
   ```
2. **Initialize Agent**: Load `BENCHMARK.md` into your AI's Planning/Agent mode.
    > Example prompt used on GPT-4o with `BENCHMARK.md`, `test-suite.ps1` and `setup.ps1` as added context:
    ```
    Create a new benchmark run by executing setup.ps1 or setup.sh. Then find the newest benchmark folder under benchmarks/<MODEL_NAME>/ by timestamp and run test-suite.ps1 or test-suite.sh against that folder. After each run, read the STATUS: line:
    > If STATUS: PASS, stop. If STATUS: FAIL — Fix the errors, edit index.html and/or style.css to resolve all validation failures, including missing HTML5 tags, W3C validation errors, Axe violations, Pa11y issues, and QualWeb issues, then rerun. Continue iterating until STATUS: PASS or STATUS: FAIL — Maximum iterations is reached. Do not stop early.
    ```
3. **Run Loop**: The agent will use `test-suite.sh` to self-correct for up to 20 iterations.
4. **Publish**: The resulting `index.html` and `benchmark_log.md` are pushed to your GitHub Pages.

**Important Note:** Never use `-ExecutionPolicy Bypass` when running PowerShell scripts. This ensures that popups or interruptions related to execution policies are avoided.

## Scoring
The final performance is calculated using the **Agent Performance Score (APS)** formula found in `BENCHMARK.md`.

## 🚀 Unified Benchmark System

This project now supports **two modes of benchmarking**:

### 1. Local Benchmarking
Run AI models locally on your machine using ollama or similar tools.
- Store results in `benchmarks/<MODEL_NAME>/<TIMESTAMP>/`
- Tracks full iteration history in `test_results.json` (array format)
- Use existing `setup.sh` and `test-suite.sh` scripts

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