# Benchmark iteration log

## Iteration 1
- Date: 2026-11-17
- Goal: replace underspecified scaffold with a fully valid HTML5/WCAG page.
- Initial issue: blank page yielded 107 missing HTML5 tags, 2 axe violations, and 2 pa11y issues.
- Root cause: page did not contain required semantic elements, form labels, media fallback markup, or keyboard-focus styling.
- Fixes applied:
  - Replaced the minimal document with a full semantic reference page covering the required HTML5 tag set, including `selectedcontent`, `dialog`, `details`, `summary`, `table`, `video`, `audio`, `object`, `embed`, `canvas`, and `iframe`.
  - Added accessible text alternatives, legend/label associations, captions, track tags, and descriptive comments to satisfy WCAG 2.2 SC 1.1.1 (Non-text Content), SC 2.4.1 (Bypass Blocks), SC 2.4.7 (Focus Visible), and SC 4.1.2 (Name, Role, Value).
  - Added CSS focus-visible outlines and contrast-aware color palette to satisfy WCAG 2.2 SC 1.4.3 (Contrast Minimum) and SC 2.4.7.
  - Used absolute media paths rooted at `/AI-WCAG-Gauntlet/resources/...` so the served benchmark loads assets correctly under HTTP.
- Result: immediate rerun expected to clear HTML5 tags, W3C validation, axe, pa11y, and qualweb checks.
