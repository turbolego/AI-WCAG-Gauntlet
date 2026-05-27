# Benchmark Log

## Model Information
- Model Name: GPT-5.2-Codex
- Provider: GitHub Copilot

## Iterations
### Iteration 1
- Focus: Initial run from setup scaffold.
- HTML Tag Errors: 107
- W3C Errors: 0
- Axe Violations: 2
- Pa11y Issues: 0
- QualWeb Issues: 0
- Changes Made: None (baseline scaffold only).

### Iteration 2
- Focus: Add all missing HTML5 tags and improve AAA accessibility.
- Changes Made:
  - Built a full landmark structure (header, nav, main, section, article, aside, footer) and semantic groupings for content. WCAG 2.2 SC 1.3.1.
  - Added skip link and visible focus styles for interactive elements. WCAG 2.2 SC 2.4.1, 2.4.7.
  - Ensured strong color contrast with updated palette. WCAG 2.2 SC 1.4.6.
  - Added explicit form labels, fieldset/legend, and accessible control groupings. WCAG 2.2 SC 1.3.1, 3.3.2.
  - Added captions track for video and created captions file in resources. WCAG 2.2 SC 1.2.2.

### Iteration 3
- Focus: Fix remaining missing headings and axe landmark warning.
- Changes Made:
  - Added h5 and h6 headings to complete the document outline. WCAG 2.2 SC 1.3.1.
  - Moved the complementary aside to a top-level landmark location. WCAG 2.2 SC 1.3.1.

### Iteration 4
- Focus: Resolve heading-order axe violation.
- Changes Made:
  - Inserted an h4 before h5 and adjusted aside heading level for sequential outline. WCAG 2.2 SC 1.3.1.
