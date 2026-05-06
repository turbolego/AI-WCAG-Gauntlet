# Detailed Analysis: Working vs Broken Code

## Timeline of Regression

```
May 3 (5764fdd) - ✅ WORKING
   └─ Groq benchmarks score 90+ (e.g., 44c6119: meta-llama...20260504-010641)
   └─ HTML generation: 4415 bytes with comprehensive semantic HTML

May 5 (b33ca2b) - ⚠️ MODULARIZATION
   └─ Refactored monolithic generate-page.mjs into modular providers/
   └─ Created scripts/providers/{mistral,openrouter,huggingface,cohere,cloudflare,default}.mjs
   └─ Code still seems functional for May 4 benchmarks

May 6 08:04 (e2061da) - ❌ CRITICAL BREAK
   └─ Created scripts/common-prompt.mjs with broken feedback extraction
   └─ Updated all providers to use shared extractFeedbackSummary()
   └─ extractFeedbackSummary() only looked for OLD text patterns (MISSING_TAGS =, SCORE =)
   └─ But feedback was in NEW JSON format (## test_results.json, ## axe_report.json)
   └─ Models received EMPTY feedback context → scores stagnate at 21.7

May 6 08:25+ - ❌ CASCADING FAILURES
   └─ 0773134: Attempted fix by including full iteration history
   └─ filterTestResults() returned   └─ filterTestResults() returned   └─ filterTestResults() returned   tem   └─ filterTestResults() returned   └─ filterTestResultsll flat   └─ filterTestResults() returnn is   └─ filterTestResults() returned   └─ filterTestResults() retuq    └─ filterTestResults() returned   └─ filterTestResults() return(minimal template)
   └─ No improvement across 20 iterations
```

## Code Differe## Code Differe## Code Differe## Code Difpa## Code Differe## Code Differe## Code Differe## Code Difpa## Code Differe# P## Code Differe## Code Differe## Code Differe## Code Difpa## Code Difback reading with JSON parsing
- HuggingFace/Groq support: Pass `inferenceProvider: "groq"` to usethe Groq provider

```javascript
// Snippet from 5764fdd
async function generateWithHuggasync function generateWithHuggasync function generateWithHuggasync functst clasync function generateWithHuggas;
  
  const prompt = [
    "Create an accessibility-focused single-page web app...",
    "- Use every required HTML5 tag...",
    REQUIRED_HTML5_TAGS.join(", "),
    // ... full requirements
  ].join("\n");
  
  const messages = [
    { role: "system", content: "You produce only valid JSON..." },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];
  
  // Feedback is included directly with full structure
}
```

#### At ad47d8f (BROKEN)
- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modulara- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: geneerateWithHuggingF- Modularized: generater- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Modularized: generate-page.mjs- Mossages = [
    { role: "system", content: "You are an expert..." },
    { role: "user", content: buildUserPrompt(iteration, feedbackSummary)  // ← feedbackSummary is empty    { role: "user", cocripts/common-prompt.mjs (    { rolKEN)

#### A#### A#### A#### A#### A#### A#### A#### A#### A#### A## extractFee#### A#### A#### A#### A#### A#### A#### A#### A#### A#### A## extractFee#### A#### A#### A#### y to extract from JSON sections (new optimized format)
    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch = feedback.matc    const testResultsMatch  catch (e) {
    // Fallback to old regex patterns - BUT THESE DON'T EXIST IN NEW FORMAT!
    // Old patterns were: MISSING_TAGS =, SCORE =, etc.
    // New format is JSON sections with no text patterns
  }
}
```

**Problem**: When feedback is in NEW JSON section format but extractFeedbackSummary tries old text patterns first, it fails and returns EMPTY feedback summary.

### 3. scripts/utils.mjs

#### At 5764fdd (WORKING)
- Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilities included in - Utilitba- Utilities included in - Utilities included in - Utilities included in - Ution** | 4415 bytes (full semantic) | 572 bytes (minimal stub) |
| **Iteration Scores** | 21.7 → 90+ (improving) | 21.7 → | **Iteration Scores** | 21.7 → 90+ (improving) | 21.7 → | **Iteration Scores** | 21.7 → 90+ (improving) | 21.7 → | **Iteration Scores** | 21.7 → 90eedbackSummary() (BROKEN) |

## Root Cause Chain

1. **b33ca2b** (May 5): Modularized code ← Good design
2. **e2061da** (May 6): Created common-prompt.mjs with new extraction logic
3. **Issue**: New extraction assumes feedback in JSON section format
4. **But**: Feedback wasn't being formatted as JSON sections yet
5. **Result**: Extraction returns empty → Model gets no context → Scores stagnate

## Minimal Fix Attempt (Unsuccessful)

The attempted fixes (8fae315, cf65118) tried to:
1. Deduplicate missing_tags in filterTestResults() → Reduced noise but extraction still broken
2. Strengthen prompts to encourage semantic HTML → Didn't help because feedback was already broken

## Proper Solution

### Option A: Revert (✅ CHOSEN)
- Reset to 5764fdd (before broken changes)
- Pro: Simple, proven working
- Con: Loses modularization benefits
- Status: Done ✅

### Option B: Fix Modularized Code
- Keep modular structure but fix extraction
- Proper JSON section formatting in readFeedback()
- Fix extractFeedbackSummary() to handle array f- Fix extests to veri- Fix extractFeedbackSummary() to handle array f- Fix eve- Fix extractFeedbackSummary() to handle array f- Fix extests to veri- Fix/u- Fix extractFeedbackSummary() to handle array f- Fix extests ton formatFeedbackSections(data) {
     return `## test_results.json\n${     return `## test_results.json\n${     return `## test_results.json\n${     retuort)     return `## test_results.json\n$s/c     return `## test_results.json\n${     returs
     return `## test_results.json\n${     return `## test_results.json\n${     return `## test_on     return `## test_results.json\n${     return `## test_results.json\n${     return `## test_on  s**: Ensure they call everything in the right order

4. **Comprehensive tests** to verify extraction before running benchmarks

##################################### a############Option A###############################troduced subtle bugs:
- Extraction logic created without ensuring input format was compatible
- No tests for JSON extraction before running production benchmarks
- Cascading failures made debugging harder

The reset to 5764fdd gives us a known-good baseline to work from.
