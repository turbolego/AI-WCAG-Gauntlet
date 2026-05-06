# Repository Reset and Local Testing Guide

**Date**: May 6, 2026  
**Status**: ✅ Repository reset to last working state

## Summary of Changes

### Problem Identified
- **Latest Groq Benchmark** (May 6 10:28:30): Score stagnant at **20.8-21.7** across 20 iterations
- **HTML Output**: Regressed from 4415 bytes (comprehensive semantic HTML) to **572 bytes** (minimal stub)
- **Root Cause**: Multiple commits introduced breaking changes:
  1. `b33ca2b` (May 5) - Modularized provider implementations
  2. `e2061da` (May 6) - Created `common-prompt.mjs` with broken feedback extraction
  3. `0773134` and following - Attempted fixes made things worse

### Solution Applied
**Reset repository to `5764fdd` (May 3, "reset" commit)**
- Last known working state BEFORE all the modularization chaos
- Supports all providers: Groq, Mistral, OpenRouter, Cohere, etc.
- Uses original monolithic `scripts/generate-page.mjs` (no provider modules)
- Had working Groq benchmarks with **score 90**

## Git Branches

```
* main (5764fdd)                    ← Current: Working code (May 3)
  backup-broken-state (ad47d8f)     ← Previous: Broken code (May 6 latest)
```

### To Restore Broken Code (for analysis)
```bash
git checkout backup-broken-state
```

### To Return to Working Code
```bash
git checkout main
```

## Local Testing Setup

### Prerequisites
```bash
export HF_TOKEN="your_huggingface_token"
export NODE_ENV=development  # Optional, for dotenv support
```

### Test Single Iteration (No Feedback)
```bash
node test-groq-local.mjs --iteration 1 --output-dir /tmp/test-groq
```

### Test with Previous Iteration Feedback
```bash
node test-groq-local.mjs \
  --iteration 2 \
  --previous-dir ./benchmarks/meta-llama-Llama-4-Scout-17B-16E-Instruct/meta-llama-Llama-4-Scout-17B-16E-Instruct-20260504-010641 \
  --output-dir /tmp/test-groq-iter2
```

### Test Different Model
```bash
node test-groq-local.mjs \
  --iteration 1 \
  --model "meta-llama/Llama-4-Scout-17B-16E-Instruct" \
  --output-dir /tmp/test-llama
```

### View Generated HTML
```bash
open /tmp/test-groq/index.html
```

## Expected Results

### Working Code (at 5764fdd)
✅ **HTML Size**: 4000+ bytes  
✅ **Semantic Tags**: Multiple `<article>`, `<section>`, `<nav>`, `<aside>` tags  
✅ **Iteration 1 Score**: ~20-25 (baseline)  
✅ **Iteration 20 Score**: ~90+ (with improvement feedback)  
✅ **Iteration Progression**: Scores should improve across iterations  

### Broken Code (backup-broken-state)
❌ **HTML Size**: ~572 bytes (minimal stub)  
❌ **Semantic Tags**: Only basic `<header>`, `<main>`, `<footer>`  
❌ **All Iteration Scores**: ~20.8-21.7 (flat, no improvement)  
❌ **No Progression**: Model doesn't respond to feedback  

## Files Modified

### Test Harness Created
- `test-groq-local.mjs` - Local testing script for single iterations

### Repository State
- Main branch reset to 5764fdd (May 3)
- Backup branch created with old broken state (ad47d8f, May 6)
- 60 commits diff between working and broken versions

## Next Steps for Local Testing

1. **Run Single Iteration**
   ```bash
   node test-groq-local.mjs --iteration 1 --output-dir /tmp/test1
   ```
   ✅ Should generate comprehensive HTML with many semantic tags

2. **Run Iteration 2 with Feedback from Iteration 1**
   ```bash
   node test-groq-local.mjs \
     --iteration 2 \
     --previous-dir /tmp/test1 \
     --output-dir /tmp/test2
   ```
   ✅ Score should improve (with working feedback loop)

3. **Run Multiple Iterations Loop**
   ```bash
   for i in {1..5}; do
     prev="/tmp/test$((i-1))"
     curr="/tmp/test$i"
     
     if [ $i -eq 1 ]; then
       node test-groq-local.mjs --iteration $i --output-dir "$curr"
     else
       node test-groq-local.mjs --iteration $i --previous-dir "$prev" --output-dir "$curr"
     fi
     
     echo "Iteration $i: $(tail -1 $curr/test_results.json | jq '.score')"
   done
   ```

4. **Compare Versions**
   - Save working iteration results
   - Switch to backup-broken-state
   - Run same iterations
   - Compare HTML sizes and scores

## Code Structure (at 5764fdd)

```
scripts/
├── generate-page.mjs        ← Main entry point
│   ├── generateWithOpenRouter()
│   ├── generateWithMistral()
│   ├── generateWithHuggingFace()  ← Used for Groq
│   ├── generateWithCohere()
│   ├── generateWithCloudflare()
│   └── ...
├── utils.mjs                ← Shared utilities (parseResponseJson, readFeedback, etc.)
├── other-scripts...
└── (NO providers/ directory)  ← Difference from broken version
```

## Reverting Broken Code

If issues are found with working code, the broken version is preserved in `backup-broken-state`:

```bash
# View what changed
git diff main backup-broken-state -- scripts/generate-page.mjs | head -100

# Or analyze a specific broken commit
git show e2061da --stat  # The "common system prompt" that broke things
```

## Performance Expectations

| Metric | Working (5764fdd) | Broken (ad47d8f) |
|--------|------------------|-----------------|
| HTML Size | 4415 bytes | 572 bytes |
| Iter 1 Score | ~23 | ~21.7 |
| Iter 20 Score | ~90 | ~21.7 |
| Progression | ↑ Improving | ➡️ Flat |
| Semantic Tags | Many | Minimal |
| Model Response | Working | Broken |

## Troubleshooting

### `HF_TOKEN not set`
```bash
export HF_TOKEN="hf_your_token_here"
```

### `Command not found: node`
```bash
which node
# or install with: brew install node
```

### `Module not found: dotenv`
```bash
npm install dotenv --save-dev
```

### Test hangs / times out
- Check HuggingFace API status
- Verify token is valid
- Try with `--timeout 120` (not yet implemented)

## Documentation

- Original conversation: See `/memories/session/latest-fixes-may-6.md`
- Regression analysis: See `/memories/repo/ai-wcag-gauntlet-standardization.md`
- This guide: `RESET_GUIDE.md`
