# Benchmark execution log

## Setup

- Setup command: `rtk proxy env NPM_CONFIG_PREFIX=/tmp/ai-wcag-gauntlet-20261118-npm-global bash setup.sh`
- Setup created `GPT-6 Luna - Medium + wcag-skill-20261118-123229`; this was the newest timestamped folder under the configured model.
- The global npm prefix was redirected to an isolated temporary directory. The script installed Chrome for Testing in the existing Puppeteer cache; the benchmark suite will select its newest cached test browser.
- Candidate uses the authoritative 113-element list from `resources/html_tags.json`.

## Candidate build

- Added a semantic showcase using native landmarks, ordered headings, labelled form controls, a real data table, operational disclosure/dialog/range/note controls, and text alternatives for canvas and media. These choices support WCAG 2.2 SC 1.3.1, 1.3.2, 1.1.1, 1.2.1, 2.1.1, 2.4.1, 2.4.6, and 4.1.2.
- Added responsive layout, high-contrast text and controls, visible keyboard focus, 44px control targets, and reduced-motion handling (SC 1.4.3, 1.4.6, 1.4.11, 2.4.7, 2.4.13, 2.5.5).
- Used the repository's media resources through `/AI-WCAG-Gauntlet/resources/`. Added timed captions and a transcript based on NASA's official transcript. Caption timing and assistive-technology testing remain pending manual verification.
- Preflight: not yet run.
- Scored iterations: 0.

## Unscored preflight 1

- Candidate URL: served from the repository parent at `http://localhost:57138/AI-WCAG-Gauntlet/benchmarks/GPT-6%20Luna%20-%20Medium%20%2B%20wcag-skill/GPT-6%20Luna%20-%20Medium%20%2B%20wcag-skill-20261118-123229/index.html`.
- Chrome for Testing: `mac-158.0.8127.36`.
- Results: tags 3 missing (`rp`, `rt`, `ruby`); W3C 1 error; axe 2 violations and incomplete contrast/frame/video-caption checks; Pa11y 6 issues; QualWeb 2 failed rules (`QW-ACT-R38`, `QW-ACT-R16`).
- Repairs: added meaningful ruby annotation; removed a footer nested inside the article header (SC 1.3.1); connected the range label to the actual input (SC 3.3.2 and 4.1.2); gave customizable selected content and its parent section explicit contrasting colors (SC 1.4.3 and 1.4.6); embedded and executes axe-core in the same-origin frame; added timed captions and a transcript link/summary for the supplied NASA video (SC 1.2.2); added the remaining video text transcript.
- Next: rerun all five validators as unscored checks. No scored iteration has been run.

## Unscored preflight 2

- Results: all 113 required tags found; axe had 0 violations; W3C had 1 output/label association error; Pa11y reported 2 issues (contrast ambiguity in the search section and `frame-tested`); QualWeb reported 1 failed rule (`QW-ACT-R38`).
- Inspected the rendered page: the `srcdoc` frame did load axe, but its own document had 4 violations and Pa11y still did not consider it tested. The search section's computed background is white; its unassigned light-DOM slot had a zero-size box.
- Repairs: separated the output from its associated label (SC 3.3.2); moved the slot into a real custom-element shadow tree with visible assigned content; changed the embedded note to a same-origin HTML document, removed lazy loading, and made it run axe itself; set the native `menu` role to `list` to align its list-item children with required owned roles.
- Next: rerun all five validators as unscored checks. No scored iteration has been run.

## Unscored preflight 3

- Results: all 113 required tags found; W3C had 0 errors; axe had 1 `landmark-unique` violation; Pa11y reported only `frame-tested`; QualWeb had 1 `QW-ACT-R38` failure.
- QualWeb detail: the failed target was the empty review-notes list. Axe's frame report was clean, but Pa11y still requested frame testing.
- Repairs: named the main landmarks in the top-level and embedded documents (SC 2.4.1); added a meaningful initial list item and remove it when the first user note is added (SC 1.3.1); keep investigating the remaining Pa11y frame finding with the same-origin frame and its own axe execution.
- Next: rerun all five validators as unscored checks. No scored iteration has been run.
- Follow-up investigation: verified in the rendered browser that the same-origin frame loaded axe and completed with 0 violations. Pa11y's runner bundles axe 4.13, while the frame initially loaded the root axe 4.14 package; the frame now loads Pa11y's exact bundled axe 4.13 to keep frame testing consistent.

## Unscored preflight 4

- Results: all 113 required tags found; W3C 0 errors; axe 0 violations; Pa11y 0 issues; QualWeb `failedCount` 0 with a valid results array.
- Tool versions: Node.js 26.0.0; axe 4.14.0; Pa11y 10.0.0 (bundled axe 4.13.0); W3C validator package 2.2.3; QualWeb core 0.9.5 and ACT rules 0.8.6; Chrome for Testing 158.0.8127.36.
- The only axe `incomplete` result was `frame-tested`. Manually verified the same-origin iframe loaded Pa11y's axe 4.13.0, ran it, and recorded 0 violations. Pa11y itself reported no frame issue.
- Manual browser checks: range/output synchronization, form submission status, disclosure toggle, note insertion, iframe audit, and dialog close-button focus return all worked. A 320px viewport exposed 15px of horizontal overflow due to a fixed `body` minimum width; removed that width to support reflow (SC 1.4.10).
- Next: rerun all five unscored validators after the reflow adjustment. No scored iteration has been run.

## Unscored preflight 5 — clean

- Candidate served over HTTP with Chrome for Testing 158.0.8127.36; isolated reports and profiles were under `/tmp/ai-wcag-preflight.3zv475`.
- Commands: `scripts/check-html5-tags.mjs`, `resources/run-w3c-validator.mjs`, `scripts/run-axe.mjs`, Pa11y 10.0.0 with `--runner axe --standard WCAG2AAA --include-warnings --include-notices`, and `resources/run-qualweb.mjs`.
- Results: 113/113 required tags; W3C 0 errors; axe 0 violations; Pa11y 0 issues (exit 0); QualWeb 0 failed rules with a valid `results` array and no `error`/`note`.
- Versions: Node.js 26.0.0; axe 4.14.0; Pa11y 10.0.0 using axe 4.13.0 in the iframe; W3C validator 2.2.3; QualWeb core 0.9.5 / ACT rules 0.8.6.
- Reviewed axe's sole `frame-tested` incomplete result: the same-origin `frame-note.html` loaded Pa11y's axe 4.13.0 and recorded 0 violations; Pa11y reported no issue.
- Browser verification: stylesheet and all media, caption, description, iframe, and axe script URLs returned HTTP 200; captions loaded; 320px viewport had no horizontal overflow. Dynamic range, form, disclosure, note insertion, and dialog close-button/focus-return checks passed. Caption timing and assistive-technology review remain pending.
- Scored iterations: 0. Automated results are not a claim of full WCAG 2.2 AAA conformance.

## Scored iteration 1 — PASS

- Command: `rtk bash test-suite.sh "benchmarks/GPT-6 Luna - Medium + wcag-skill/GPT-6 Luna - Medium + wcag-skill-20261118-123229"`.
- Result: `STATUS: PASS — All tests passed successfully. Do not run test-suite.sh again.`
- Counts: 113/113 required tags; 0 W3C errors; 0 axe violations; 0 Pa11y issues; 0 QualWeb failures; 0 legacy errors.
- Versions: axe 4.14.0; Pa11y 10.0.0; QualWeb 0.9.5. Score: 201.80.
- Verified `test_results.json` contains exactly one passing iteration and `iterations_count.txt` is 1; all five scored reports are valid and match the zero-finding counts.
- Stopped after PASS as required; no further scored run will be made.
- Manual follow-up: the integrated browser did not dismiss the native dialog on the Escape key during testing; its visible close button did close it and returned focus to the opener. Escape-key behavior remains pending verification in a standard browser/assistive-technology test, and no full WCAG conformance claim is made.
