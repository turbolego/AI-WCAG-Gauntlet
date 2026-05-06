#!/usr/bin/env bash

# Benchmark runner for local testing
# Usage: bash run-benchmark-local.sh [model] [iterations]
# Examples:
#   bash run-benchmark-local.sh mistral-small-latest 20
#   bash run-benchmark-local.sh openrouter 10

set +e
set -uo pipefail

# Parse arguments
MODEL="${1:-mistral-small-latest}"
ITERATIONS="${2:-20}"
PROVIDER="mistral"

# Handle OpenRouter models
if [[ "$MODEL" == openrouter* ]] || [[ "$MODEL" == "meta-llama"* ]]; then
  PROVIDER="openrouter"
fi

SAFE_MODEL=$(echo "$MODEL" | sed 's/[^A-Za-z0-9._-]/-/g')
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="./benchmarks/$SAFE_MODEL/$SAFE_MODEL-$TIMESTAMP"

# Check for required environment variables
if [ "$PROVIDER" = "mistral" ] && [ -z "${MISTRAL_TOKEN:-}" ]; then
  echo "❌ Error: MISTRAL_TOKEN not set"
  echo "   export MISTRAL_TOKEN=\"your_token\""
  exit 1
fi

if [ "$PROVIDER" = "openrouter" ] && [ -z "${OPENROUTER_TOKEN:-}" ]; then
  echo "❌ Error: OPENROUTER_TOKEN not set"
  echo "   export OPENROUTER_TOKEN=\"your_token\""
  exit 1
fi

# Validate iterations
if [ "$ITERATIONS" -lt 1 ] || [ "$ITERATIONS" -gt 100 ]; then
  echo "❌ Error: iterations must be between 1 and 100"
  exit 1
fi

# Create benchmark directory
mkdir -p "$RUN_DIR"
echo "📁 Benchmark folder: $RUN_DIR"
echo "🎯 Model: $MODEL (provider: $PROVIDER)"
echo "🔄 Iterations: $ITERATIONS"
echo ""

# Initialize test results array
echo "[]" > "$RUN_DIR/test_results.json"

FOUND_PASSING_RUN=false
FAILED_ITERATIONS=0

for i in $(seq 1 "$ITERATIONS"); do
  echo "━━━ Iteration $i/$ITERATIONS ━━━"

  # Generate updated page content for this iteration
  echo "🔧 Generating HTML/CSS/JS with $MODEL..."
  node scripts/generate-page.mjs \
    --model "$MODEL" \
    --provider "$PROVIDER" \
    --outputDir "$RUN_DIR" \
    --iteration "$i" \
    --previousDir "$RUN_DIR"

  GENERATION_JSON="$RUN_DIR/generation.json"
  if [ ! -f "$GENERATION_JSON" ]; then
    echo "❌ Error: generation.json missing after model generation."
    ((FAILED_ITERATIONS++))
    continue
  fi

  GENERATED_BY_MODEL=$(jq -r '.generatedByModel // false' "$GENERATION_JSON")
  if [ "$GENERATED_BY_MODEL" != "true" ]; then
    GEN_ERROR=$(jq -r '.generationError // "unknown generation error"' "$GENERATION_JSON")
    echo "❌ Model generation failed: $GEN_ERROR"
    ((FAILED_ITERATIONS++))
    continue
  fi

  # Run tests
  echo "🧪 Running accessibility tests..."
  bash test-suite.sh "$RUN_DIR"
  TEST_EXIT=$?

  if [ "$TEST_EXIT" -ne 0 ]; then
    echo "⚠️  test-suite.sh failed (exit code $TEST_EXIT). Continuing to next iteration."
    ((FAILED_ITERATIONS++))
    continue
  fi

  # Check test results
  RESULTS_JSON="$RUN_DIR/test_results.json"
  if [ ! -f "$RESULTS_JSON" ]; then
    echo "⚠️  test_results.json missing. Continuing to next iteration."
    ((FAILED_ITERATIONS++))
    continue
  fi

  # Read last iteration's status and score
  STATUS=$(jq -r '.[-1].status' "$RESULTS_JSON")
  SCORE=$(jq -r '.[-1].score // "N/A"' "$RESULTS_JSON")
  TAGS=$(jq -r '.[-1].html_tag_errors // 0' "$RESULTS_JSON")

  echo "✅ Iteration $i: status=$STATUS, score=$SCORE, missing-tags=$TAGS"

  if [ "$STATUS" = "pass" ]; then
    echo "🎉 Stopping early - all tests passed!"
    FOUND_PASSING_RUN=true
    break
  fi
done

echo ""
echo "━━━ BENCHMARK COMPLETE ━━━"
echo "📊 Results:"
echo "   Total iterations: $ITERATIONS"
echo "   Failed iterations: $FAILED_ITERATIONS"
echo "   Passed iterations: $((ITERATIONS - FAILED_ITERATIONS))"

if [ "$FOUND_PASSING_RUN" = "true" ]; then
  echo "   ✅ Found passing run!"
else
  echo "   ⚠️  No fully passing run (all tests passed in all iterations)"
fi

echo ""
echo "📁 Results saved to: $RUN_DIR"
echo "📊 View results: open $RUN_DIR/index.html"

# Final score summary
if [ -f "$RUN_DIR/test_results.json" ]; then
  echo ""
  echo "📈 Score progression:"
  jq -r '.[] | "   Iteration \(.iteration): \(.score) points"' "$RUN_DIR/test_results.json"
fi
