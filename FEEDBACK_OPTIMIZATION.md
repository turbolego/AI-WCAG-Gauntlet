# Feedback Optimization Report

## Problem Identified
The feedback provided to LLM models during iterations was around **9,000-11,000 characters** every iteration, containing a significant amount of **noise** and redundant data that wasn't useful for code generation:

### Initial Analysis
- **axe_report.json**: 560KB file, but only 2,500 chars sent (truncated)
  - Contained metadata: testEngine, testRunner, testEnvironment, toolOptions (~390 chars of pure noise)
  - Contained 39 "inapplicable" rules with 0 actual violations (~15KB of metadata)
  
- **test_results.json**: 40KB file with full iteration history
  - Only the latest iteration metrics are relevant

- **w3c_report.json**: 2.7KB with mixed warnings, errors, and metadata
  - Only actual errors needed, not warnings

## Solution Implemented

### Optimizations in `scripts/utils.mjs`

#### 1. **Axe Report Filtering** (-25%)
```javascript
// Before: Sent full report with metadata
// After: Compact format with only violations and incomplete items
{
  "violations": [
    { "id": "target-size", "impact": "serious", "nodes": 12 }
  ],
  "incomplete": [...]
}
```

#### 2. **Test Results Filtering** (-88%)
```javascript
// Before: Sent full history array (40KB truncated to 2500 chars)
// After: Only latest iteration with essential metrics
{
  "iteration": 20,
  "status": "fail",
  "score": 79.4,
  "html_tag_errors": 18,
  "w3c_errors": 5,
  "axe_violations": 1,
  "pa11y_issues": 2,
  "qualweb_issues": 0,
  "missing_tags": [...]
}
```

#### 3. **W3C Report Filtering** (-85%)
```javascript
// Before: Full report with metadata and all message types
// After: Compact errors only
{
  "errorCount": 5,
  "errors": [
    { "line": 10, "column": 5, "message": "..." }
  ]
}
```

#### 4. **Safe JSON Truncation**
- Prevents truncation in the middle of JSON structures
- Properly closes arrays and objects when truncation is needed

## Results

### Size Reduction
| File | Before | After | Reduction |
|------|--------|-------|-----------|
| **test_results.json** | 2,502 | 292 | -88% |
| **w3c_report.json** | 2,502 | 387 | -85% |
| **axe_report.json** | 2,502 | 1,864 | -25% |
| **html5_tags_report.json** | 1,913 | 1,913 | - |
| **pa11y_report.json** | 1,452 | 1,452 | - |
| **qualweb_report.json** | 39 | 39 | - |
| **TOTAL** | **11,039** | **6,076** | **-45%** |

### Efficiency Gains
- ✅ **45% reduction** in feedback size
- ✅ **~1,241 fewer tokens** per iteration (~4 chars/token)
- ✅ **Cost savings**: ~45% fewer tokens to process
- ✅ **All JSON remains valid** and properly structured

## Verification

Tested on: `benchmarks/mistral-large-latest/mistral-large-latest-20260503-205837`

✅ All 6 report files produce valid JSON after optimization
✅ No loss of critical violation/error information
✅ Metadata and noise completely removed

## Implementation Details

### Changes Made
**File**: `scripts/utils.mjs`

- Added `safeJsonTruncate()` function for proper JSON truncation
- Added `filterAxeReport()` to extract violations only
- Added `filterW3CReport()` to extract errors only  
- Added `filterTestResults()` to keep only latest iteration
- Updated `readFeedback()` to use file-specific filters

### Testing
Run the comparison script to verify:
```bash
node scripts/compare-feedback.mjs
```

## Impact on Model Performance

By reducing feedback size by 45%:
- Models spend less time processing irrelevant data
- More context window available for actual output generation
- Faster API responses and lower costs
- No loss of important constraint information for improving code
