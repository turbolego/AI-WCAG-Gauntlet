# Benchmark log

## Setup
- Created the new `Copilot Fusion-20261113-120737` showcase run with `setup.sh`.
- The setup installed project and global validation dependencies and Chrome for Testing.

## Iteration 1
- Result: `FAIL — Fix the errors`.
- Missing required HTML tags: 107.
- W3C errors: 0; axe violations: 2; Pa11y issues: 0; QualWeb issues: 0.
- Axe findings were `landmark-one-main` and `region`: the starter page had no main landmark and its page content was outside landmarks.

## Iteration 2 changes
- Replaced the starter page with a semantic, labeled HTML field guide covering the required HTML5 elements; added one `<main>` and kept page content inside named header, navigation, main, and footer landmarks (WCAG 2.2 SC 1.3.1).
- Added text alternatives for images, names for embedded media and controls, and a captions track for the video (WCAG 2.2 SC 1.1.1, 1.2.2, and 4.1.2).
- Styled links, controls, focus indicators, and text with high-contrast colors; provided visible keyboard focus and a skip link (WCAG 2.2 SC 1.4.6, 2.4.7, and 2.4.1).
- Added a VTT captions file so the video captions track resolves to a valid local resource (WCAG 2.2 SC 1.2.2).
- Rerunning the full benchmark suite immediately after these repairs.

## Iteration 2
- Result: `FAIL — Fix the errors`.
- Missing required HTML tags: 3 (`dl`, `dt`, `dd`); W3C errors, axe violations, Pa11y issues, and QualWeb issues: 0.

## Iteration 3 changes
- Added a definition list with clear term-definition pairs for keyboard operability and text alternatives, completing the remaining tag coverage and exposing the relationships semantically (WCAG 2.2 SC 1.3.1).
- Rerunning the full benchmark suite immediately after this repair.

## Iteration 3
- Result: `PASS`.
- Missing required HTML tags, W3C errors, axe violations, Pa11y issues, and QualWeb issues: 0.
- Final score: 183.8000.

## Review correction: results withheld
- The reported pass above is invalid: `pa11y_stderr.log` records an unsupported
  `--chrome-launch-config` option, and `pa11y_report.json` is empty. Pa11y did not
  complete any of the recorded scans, so its reported zero counts are not evidence
  of a successful validation.
- Preserved the original iteration history as `unvalidated_test_results.json`.
  There is intentionally no publishable `test_results.json`; both dashboard
  aggregators omit this run until all required validators complete successfully.
  The historical score and pass above must not be used as benchmark results.
- Increased skip-link selector specificity so its dark text is not overridden by
  `.site-header a` when revealed on keyboard focus (WCAG 2.2 SC 1.4.6 and 2.4.1).
- A fresh complete run with the repaired Pa11y configuration is still required;
  no replacement pass or score has been claimed.
