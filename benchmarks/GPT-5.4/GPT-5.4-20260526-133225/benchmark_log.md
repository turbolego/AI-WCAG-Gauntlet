# Benchmark Log

## Iteration 1
- Ran `test-suite.sh` against `benchmarks/GPT-5.4/GPT-5.4-20260526-133225`.
- Result: `HTML_TAG_ERRORS=107`, `W3C_ERRORS=0`, `AXE_VIOLATIONS=2`, `PA11Y_ISSUES=0`, `QUALWEB_ISSUES=0`.
- Failures identified:
  - Missing `main` landmark and unlandmarked page content from the starter stub.
  - Nearly all required HTML5 elements were absent.
- Planned fix:
  - Replace the starter stub with a complete semantic page that covers all required tags and keeps all visible content inside landmarks.
  - Add high-contrast, focus-visible styling and explicit labels for interactive controls and media.
- WCAG rationale:
  - Added landmark structure for orientation and region containment, supporting WCAG 2.2 SC 1.3.1 and SC 2.4.1.
  - Added explicit labels, text alternatives, captions hooks, and accessible names to support SC 1.1.1, SC 1.2.2, SC 2.4.6, and SC 4.1.2.
  - Increased contrast and focus visibility in styling to support WCAG 2.2 SC 1.4.6 and SC 2.4.7.

## Iteration 2
- Ran `test-suite.sh` after replacing the starter page.
- Result: `HTML_TAG_ERRORS=0`, `W3C_ERRORS=0`, `AXE_VIOLATIONS=1`, `PA11Y_ISSUES=0`, `QUALWEB_ISSUES=1`.
- Failures identified:
  - Remaining `axe` violation was `color-contrast-enhanced`.
  - Remaining QualWeb failure `QW-ACT-R76` also reported insufficient contrast.
  - The flagged element was the inline accent span in the miscellaneous section.
- Planned fix:
  - Darken the inline accent color so the text exceeds WCAG AAA contrast requirements against the light background.
- WCAG rationale:
  - Strengthened foreground/background contrast to satisfy WCAG 2.2 SC 1.4.6.

## Iteration 3
- Ran `test-suite.sh` after darkening the inline accent color.
- Result: `HTML_TAG_ERRORS=0`, `W3C_ERRORS=0`, `AXE_VIOLATIONS=0`, `PA11Y_ISSUES=0`, `QUALWEB_ISSUES=0`.
- Outcome:
  - Benchmark reached `STATUS: PASS` on iteration 3.
- WCAG rationale:
  - Final contrast adjustment resolved the remaining AAA contrast issue under WCAG 2.2 SC 1.4.6.