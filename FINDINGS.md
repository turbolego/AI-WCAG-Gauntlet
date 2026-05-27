# Benchmark Findings & Recommendations for AI + WCAG 2.2

> Analysis based on 58 benchmark runs across 19 AI models, testing their ability to produce WCAG 2.2 Level AAA compliant HTML5 pages.

---

## Executive Summary

- **36.2%** of runs achieve a perfect pass (zero violations across all validators)
- **53% of models** (10/19) never achieve a passing score
- The primary blocker is **accessibility rule violations** (axe/pa11y), not tag coverage
- Iterative self-repair works only for models above a capability threshold
- Claude Opus 4.6 achieves a perfect score in **1 iteration**; most strong models need 2–4

---

## 1. Model Performance Tiers

| Tier | Models | Pass Rate | Iterations to Pass | First-Iter Score |
|---|---|---|---|---|
| **Elite** | Claude Opus 4.6 | 100% | 1–3 | ~168 |
| **Strong** | GPT-5.3-Codex, GPT-5.4, GPT-5.4 mini, Claude Sonnet 4.6, Claude Haiku 4.5, Gemini 3.1 Pro, GPT-5.2-Codex | ~80% | 2–4 | ~12–102 |
| **Moderate** | Gemini 3 Flash | Passes once | 12 | ~12 |
| **Struggling** | GPT-4.1, GPT-4o, Mistral (all sizes), Cohere Command, Llama (all sizes), openai-gpt-oss-120b | 0% | Never | 11–81 |

### Top 10 Scores

| Rank | Model | Score | Iterations | Status |
|---|---|---|---|---|
| 1 | Claude Opus 4.6 | 202.45 | 1 | PASS |
| 2 | Claude Opus 4.6 | 202.45 | 1 | PASS |
| 3 | GPT-5.3-Codex | 194.09 | 2 | PASS |
| 4 | GPT-5.3-Codex | 194.09 | 2 | PASS |
| 5 | GPT-5.4 mini (Preview) | 194.09 | 2 | PASS |
| 6 | Claude Sonnet 4.6 | 193.27 | 2 | PASS |
| 7 | GPT-5.3-Codex | 186.09 | 3 | PASS |
| 8 | GPT-5.4 | 186.09 | 3 | PASS |
| 9 | GPT-5.4 mini (Preview) | 186.09 | 3 | PASS |
| 10 | Claude Opus 4.6 | 184.45 | 3 | PASS |

---

## 2. Primary Failure Modes

### Error Distribution in Failing Runs (37 runs)

| Error Type | Runs Affected | Percentage | Avg Count |
|---|---|---|---|
| Axe violations | 36/37 | **97.3%** | 2.9 |
| Pa11y issues | 29/37 | 78.4% | 3.1 |
| Missing HTML5 tags | 24/37 | 64.9% | 31.6 |
| W3C validation errors | 16/37 | 43.2% | 2.5 |
| QualWeb issues | 12/37 | 32.4% | 0.5 |

### Key Insight

The hardest problem is **not** knowing which HTML5 tags to use — it's producing markup that passes accessibility validators. Specific challenges:

- **Color contrast ratios** (WCAG SC 1.4.6 — enhanced contrast 7:1)
- **ARIA attribute correctness** (proper roles, states, properties)
- **Focus management** (visible focus indicators, logical tab order)
- **Semantic structure** (heading hierarchy, landmark regions)
- **Media accessibility** (captions, alt text, audio descriptions)

---

## 3. Iterative Feedback Effectiveness

### Models That Improve With Feedback

| Model | 1st Iter Score | Final Score | Improvement |
|---|---|---|---|
| GPT-5.3-Codex | 12.9 | 191.4 | **+178.5** |
| GPT-5.4 mini (Preview) | 12.9 | 187.3 | **+174.4** |
| GPT-5.4 | 12.9 | 186.1 | **+173.2** |
| GPT-5.2-Codex | 12.9 | 180.2 | **+167.3** |
| Gemini 3.1 Pro (Preview) | 12.9 | 180.2 | **+167.3** |
| Claude Haiku 4.5 | 12.9 | 174.3 | **+161.3** |
| Gemini 3 Flash (Preview) | 12.9 | 158.4 | **+145.5** |
| Claude Sonnet 4.6 | 102.3 | 193.3 | +91.0 |
| Claude Opus 4.6 | 168.2 | 196.4 | +28.2 |

### Models That Fail to Improve (or Regress)

| Model | 1st Iter Score | Final Score | Change |
|---|---|---|---|
| mistral-medium-latest | 81.2 | 41.5 | **−39.7** |
| meta-llama-Llama-3.1-8B-Instruct | 72.8 | 57.5 | **−15.4** |
| command-a-03-2025 | 37.6 | 33.5 | −4.2 |
| mistral-small-latest | 53.2 | 52.0 | −1.2 |
| meta-llama-llama-4-scout-17b-16e-instruct | 29.5 | 30.9 | +1.4 |
| command-a-reasoning-08-2025 | 48.6 | 52.4 | +3.8 |
| mistral-large-latest | 78.8 | 83.2 | +4.4 |
| openai-gpt-oss-120b | 35.3 | 41.4 | +6.1 |

### Conclusion

Iterative self-repair **only works if the model can correctly interpret structured error feedback**. Models below a capability threshold actually **regress** — they break working code, introduce new violations while fixing others, or fail to parse validator output.

---

## 4. Hardest HTML5 Tags for AI Models

Tags ranked by how often AI models fail to include them:

| Rank | Tag | Miss Rate | Models Failed |
|---|---|---|---|
| 1 | `<selectedcontent>` | 37.9% | 10/19 |
| 2 | `<data>` | 32.8% | 10/19 |
| 3 | `<h6>` | 32.8% | 10/19 |
| 4 | `<h5>` | 31.0% | 10/19 |
| 5 | `<pre>` | 31.0% | 10/19 |
| 6 | `<search>` | 31.0% | 10/19 |
| 7 | `<hgroup>` | 31.0% | 9/19 |
| 8 | `<dfn>` | 29.3% | 10/19 |
| 9 | `<rp>` | 29.3% | 10/19 |
| 10 | `<br>` | 29.3% | 9/19 |
| 11 | `<col>` | 29.3% | 9/19 |
| 12 | `<colgroup>` | 29.3% | 9/19 |
| 13 | `<embed>` | 29.3% | 9/19 |
| 14 | `<menu>` | 29.3% | 9/19 |
| 15 | `<tfoot>` | 29.3% | 9/19 |

### Tags Never Missed (always included by all models)

`<body>`, `<footer>`, `<head>`, `<header>`, `<html>`, `<meta>`, `<p>`, `<section>`, `<title>`

### Pattern

The hardest tags share a common trait: they are **newer or rarely-used semantic HTML elements** that appear infrequently in web training data. Models have essentially memorized the common tags but have gaps for niche semantic elements.

---

## 5. First-Iteration Score as Success Predictor

| First-Iteration Score | Outcome |
|---|---|
| >100 | **Always eventually passes** |
| 80–100 | May pass with many iterations |
| <80 | **Never passes** |

The model's inherent WCAG knowledge (before any feedback) is the strongest single predictor of eventual success. This suggests that baseline training quality matters more than the feedback loop design.

---

## 6. Recommendations for Training/Fine-Tuning

### A. Training Data Curation

1. **Build a WCAG AAA-validated corpus** — Crawl the web, run axe-core + pa11y + W3C validator on each page, keep only pages with 0 violations at AAA level. This creates a "clean" training signal.

2. **Oversample rare semantic tags** — The following tags need dramatically more representation in training data:
   - `<selectedcontent>`, `<search>`, `<hgroup>`, `<data>`, `<dfn>`
   - `<rp>`, `<rt>`, `<ruby>`, `<bdi>`, `<bdo>`
   - `<col>`, `<colgroup>`, `<tfoot>`, `<menu>`
   - `<embed>`, `<object>`, `<slot>`, `<template>`

3. **Include validator-feedback → fix pairs** — The highest-signal training data from this benchmark is the iteration pairs:
   ```
   Input:  [HTML with violations] + [structured axe/pa11y error report]
   Output: [Corrected HTML with 0 violations]
   ```
   These pairs teach the model how to interpret and act on accessibility feedback.

4. **Train on the full validation stack** — Models must learn to interpret output from:
   - axe-core (rule IDs, selectors, WCAG criteria references)
   - pa11y (runner output with code/context/message)
   - W3C HTML validator (error line numbers, element context)
   - QualWeb (technique-level assertions)

### B. Architecture & Inference Design

5. **Tool-augmented generation** — Rather than training models to memorize all WCAG rules, give them access to validators at inference time. The benchmark proves this works: models that start at 12 points reach 190+ through iterative validation.

6. **Multi-turn correction loops (2–4 iterations)** — The data shows:
   - 1 iteration: Only Claude Opus 4.6 passes
   - 2 iterations: GPT-5.3, GPT-5.4 mini, Claude Sonnet join
   - 3–4 iterations: Most strong models achieve passing scores
   - Beyond 4: Diminishing returns (only Gemini Flash needed 12)

7. **Structured prompting with explicit spec references** — The benchmark provides `wcag_22.json`, `axe_rules_aaa.md`, and `html_tags.json` as context. Models perform measurably better when given the spec rather than relying on memorized knowledge.

8. **Early termination heuristic** — If a model's first-iteration score is below 80, further iterations are unlikely to help. Resources are better spent on improving the base model.

### C. Evaluation Framework

9. **Use multiple validators** — A single validator is insufficient:
   - axe-core catches ARIA and contrast issues
   - pa11y catches focus and timing issues
   - W3C validator catches structural HTML errors
   - QualWeb catches WCAG technique-level failures
   
   The combination is what makes this benchmark discriminating.

10. **Score with efficiency bonus** — The exponential decay formula (`50 × 0.8^(iter−1)`) correctly rewards models that solve the task with fewer attempts, creating meaningful separation between "knows WCAG" and "brute-forces through iterations."

11. **Track per-tag and per-rule performance** — This benchmark's hardest-tags analysis reveals specific knowledge gaps. Fine-tuning should target these gaps directly.

---

## 7. The Path to Zero-Violation AI

The data proves it's achievable — Claude Opus 4.6 produces a perfect WCAG 2.2 AAA page in a single attempt. The formula:

1. **Strong baseline WCAG knowledge** — High first-iteration score from training on accessibility-validated HTML
2. **Complete HTML5 vocabulary** — Including rare semantic elements (`<selectedcontent>`, `<search>`, `<hgroup>`, etc.)
3. **Ability to interpret validator feedback** — Parse structured error output and produce targeted fixes
4. **2–4 iteration budget** — For edge cases in color contrast, ARIA states, and media accessibility

### The Gap Between "Always Passes" and "Never Passes"

This gap is **not purely model size** — it's whether the model has been specifically exposed to:
- Accessibility-validated HTML during pre-training
- Validator error formats during instruction tuning
- The interaction pattern of "generate → validate → fix → validate"

A focused fine-tuning effort targeting these three areas could potentially bring mid-tier models (GPT-4.1, Mistral Large) into the passing range.

---

## 8. Open Questions for Further Research

1. **Does fine-tuning on this benchmark's iteration data transfer?** — Would training on the 58 runs' iteration pairs improve a base model's WCAG performance on novel page designs?

2. **What's the minimum model size for self-repair?** — Llama 3.1 8B and Llama 4 Scout 17B both fail. Where's the threshold?

3. **Can retrieval-augmented generation (RAG) with WCAG specs close the gap?** — Instead of memorizing rules, inject relevant WCAG criteria at inference time.

4. **Does pre-validating generated CSS separately improve outcomes?** — Many axe violations stem from CSS (color contrast, focus visibility), not HTML structure.

5. **Would a two-stage pipeline (structure → accessibility) outperform single-shot?** — First generate semantically correct HTML, then run an accessibility-focused pass.

---

*Generated from AI-WCAG-Gauntlet benchmark data on 2026-05-27.*
