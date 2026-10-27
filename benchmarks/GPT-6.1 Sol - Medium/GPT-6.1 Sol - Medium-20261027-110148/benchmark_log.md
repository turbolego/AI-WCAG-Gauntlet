# Benchmark log

- Model: GPT-6.1 Sol - Medium
- Provider: GitHub Copilot
- Created with setup.ps1; existing setup configuration and unrelated changes preserved.
- RTK is unavailable in this environment; commands use a session-local passthrough.

## Iteration 1 - starter baseline

Run the unmodified setup-generated page to establish tag coverage and validation failures before implementing the showcase. No accessibility changes yet.

The attempt incremented the counter but stopped during Axe without a STATUS line: Python was not on PATH, so no HTTP server started. Located the installed Python 3.13 through the Windows launcher and the repository-local Pa11y executable. Add their directories to the test process PATH only; do not modify validators or reset the iteration counter. Rerun the unchanged starter as iteration 2.

## Iteration 2 - baseline result

- STATUS: FAIL -- Fix the errors.
- Missing tags: 107; W3C: 0; Axe: 2 (`landmark-one-main`, `region`); Pa11y: 0.
- Windows PowerShell did not produce the QualWeb report. A direct run with the installed Chrome succeeded (0 failed ACT rules). Use PowerShell 7 for subsequent suite invocations and require a real QualWeb report before accepting success.

## Iteration 3 - complete showcase

- Implement every tag in resources/html_tags.json as a contextual example, with valid nesting and a customizable select for selectedcontent.
- Add main, navigation, header and footer landmarks, sequential headings and a skip link: WCAG 2.2 SC 1.3.1, 2.4.1, 2.4.6 and 2.4.10.
- Add explicit form labels, fieldset/legend, table headers, output and native controls: SC 1.3.1, 2.1.1, 3.3.2 and 4.1.2.
- Add descriptive image/map/canvas/embedded alternatives, audio transcript, video identification and a caption track; all source media uses repository resources: SC 1.1.1, 1.2.1 and 1.2.2. Automated results cannot establish complete human-reviewed media/AAA conformance.
- Add high-contrast text, visible focus, generous control targets, wrapping, responsive media and no autoplay or motion: SC 1.4.6, 1.4.10, 1.4.12, 2.2.2, 2.3.3, 2.4.7, 2.4.13 and 2.5.8.
- Add a native modal dialog with keyboard dismissal and focus return: SC 2.1.1, 2.1.2 and 2.4.3.
- Preserve visible content without JavaScript; only script-dependent controls are hidden when scripting is disabled.
- Immediately rerun the full suite after this coherent fix.

## Iteration 3 - result and iteration 4 fix

- STATUS: FAIL -- Fix the errors.
- Missing tags: 0; W3C: 0; Axe: 1 (`landmark-complementary-is-top-level`); QualWeb: 0 with a fresh real report.
- The raw Pa11y report contains one `frame-tested` incomplete issue despite the suite printing 0 (single-item array counting limitation). Treat the raw report as authoritative and do not accept this as a pass.
- Move the complementary aside outside main and give its heading the appropriate level: SC 1.3.1 and 2.4.10.
- Replace the srcdoc HTML frame with an actual repository SVG document, described by its title and adjacent equivalent text; this also follows the media-resource requirement: SC 1.1.1 and 2.4.1.
- Keep the supplemental landmark aligned with the rest of the responsive layout: SC 1.4.10.
- Immediately rerun the full suite.

## Iteration 4 - terminal result

- Suite output: `STATUS: PASS -- All tests passed successfully. Do not run test-suite.ps1 again.`
- Stopped as explicitly required by the PASS termination rule. No further source edits or suite runs.
- Suite-reported counts: HTML tag errors 0, W3C errors 0, Axe violations 0, Pa11y issues 0, QualWeb issues 0.
- Tag coverage: 113 of 113 required elements. Score: 178.05. Counter: 4, including the first infrastructure-aborted attempt.
- Final report inspection, without another test run, confirms genuine empty Axe violations, no missing tags, no W3C errors and a successful QualWeb report.
- IMPORTANT LIMITATION: the raw Pa11y report still contains one `frame-tested` item for the SVG iframe, marked `needsFurtherReview: true`. The suite's single-item array counting bug prints 0 instead of 1. Therefore this is a suite-reported PASS, not independently verified zero-issue Pa11y or full WCAG AAA conformance. The validator scripts were not changed. Preserving this discrepancy and stopping honors the explicit instruction to stop on PASS rather than silently accepting or hiding the report.
- All generated files and reports remain in this run folder; unrelated worktree changes are untouched.
