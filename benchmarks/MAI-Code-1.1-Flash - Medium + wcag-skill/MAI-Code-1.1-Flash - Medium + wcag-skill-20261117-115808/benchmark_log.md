# Benchmark Log

## Run
- Model: MAI-Code-1.1-Flash - Medium + wcag-skill
- Folder: MAI-Code-1.1-Flash - Medium + wcag-skill-20261117-115808
- Date: 2026-11-17

## Iteration 1
- Result: `STATUS: FAIL — Fix the errors above, edit index.html and style.css as needed, then run test-suite.sh again.`
- Observed failures:
  - `HTML_TAG_ERRORS = 107`
  - `AXE_VIOLATIONS = 2`
  - `PA11Y_ISSUES = 2`
  - `W3C_ERRORS = 0`
  - `QUALWEB_ISSUES = 0`
- Root cause: the generated scaffold page was only a single heading, so it failed the required HTML5 tag coverage and semantic/accessibility contract.

### Fixes applied
- Replaced the minimal scaffold with a complete semantic showcase page using the required HTML5 elements and landmarks.
- Added accessible labels, visible focus styles, and a skip link to satisfy navigation and keyboard usability needs.
- Included form controls, tables, media elements, dialog, output, datalist, and map-based examples to cover all required tags while preserving a readable single-page structure.
- Added CSS to improve color contrast, spacing, and keyboard focus visibility for WCAG 2.2 AAA alignment.

### WCAG evidence
- Added image alternatives and semantic labeling for media controls — WCAG 2.2 SC 1.1.1, 1.3.1.
- Added skip link and logical document structure with headings/landmarks — WCAG 2.2 SC 2.4.1, 2.4.3.
- Added visible keyboard focus treatment and high-contrast link/button styling — WCAG 2.2 SC 2.4.7, 1.4.3, 1.4.6.
- Ensured form elements and captions use clear labels and groupings — WCAG 2.2 SC 3.3.2, 4.1.2.

## Validation after fix
- Re-ran `./test-suite.sh` against the same run folder.
- Final result: `STATUS: PASS — All tests passed successfully. Do not run test-suite.sh again.`
- Verified counts:
  - `HTML_TAG_ERRORS = 0`
  - `W3C_ERRORS = 0`
  - `AXE_VIOLATIONS = 0`
  - `PA11Y_ISSUES = 0`
  - `QUALWEB_ISSUES = 0`
  - `SCORE = 191.8000`

## Final status
- Benchmark completed successfully.
