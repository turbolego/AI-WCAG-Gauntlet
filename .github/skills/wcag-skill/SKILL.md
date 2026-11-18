---
name: wcag-skill
description: "Build, audit, and repair web content against WCAG 2.2. Use for accessible HTML/CSS/JS, accessibility remediation, reproducible audits, AAA evidence, and AI-WCAG-Gauntlet benchmarks. For benchmarks, preflight tag coverage, W3C, axe, Pa11y, and QualWeb before the first scored test-suite run."
allowed-tools: Bash, Read, Write, Edit, Env
metadata:
  version: 3.0.0
---

# WCAG 2.2: build, then verify

Use native HTML and test rendered content over HTTP. Automated passes mean
**no automated findings**, not WCAG conformance. For benchmark work, read the
unattended benchmark workflow below **before invoking either test suite**.

## Scope and tool discovery

1. Establish the target (`baseline`, `AA`, or `AAA`) and inventory routes,
   breakpoints, controls, dynamic states, errors, frames, and media.
2. Resolve the repository root and read its task instructions. In this
   repository, read [BENCHMARK.md](../../../BENCHMARK.md) for benchmark work,
   [html_tags.json](../../../resources/html_tags.json) for required elements,
   and [wcag_22.json](../../../resources/wcag_22.json) for success criteria.
3. This bundled skill contains only this document. Do not try to run missing
   `scripts/a11y-audit.sh`, `scripts/a11y-audit-limited.sh`,
   `scripts/check-wcag-412.py`, `benchmark/scripts/check-tag-coverage.py`, or
   read absent `references/` files. Use the existing repository tools below.
   In another project, discover its installed equivalents first.
4. Reuse installed dependencies. Install project-local dependencies only
   after a missing-dependency failure or a manifest change. Do not install
   system-wide packages or change host settings. Inspect setup scripts before
   execution; preserve user configuration and avoid global-install branches.

## Actual tools in this repository

All paths and commands below are relative to the **repository root**, not the
skill folder. Prefix CLI commands with `rtk`; `rtk proxy` preserves raw output
when writing JSON reports.

| Purpose | Existing command | Evidence |
|---|---|---|
| Required HTML elements | `rtk node scripts/check-html5-tags.mjs <html> <report>` | `missing_tags`, `used_tags`, `requiredCount` |
| HTML validity | `rtk node resources/run-w3c-validator.mjs <html> <report>` | `errorCount`, `messages` |
| Rendered axe audit | `rtk node scripts/run-axe.mjs <http-url> <report>` | `violations`, `incomplete` |
| Pa11y with its own axe runner | `rtk proxy node node_modules/pa11y/bin/pa11y.js --runner axe --standard WCAG2AAA --config <config> --include-warnings --include-notices --reporter json <http-url>` | JSON array or object's `issues` array |
| QualWeb ACT rules | `rtk node resources/run-qualweb.mjs <html> <report>` | `failedCount`, `results`; reject `error` or `note` |
| Legacy repair and preservation | `rtk node scripts/check-legacy-tags.mjs <html> <report> <original-fixture-html>` | `legacy_error_count`, `preservation_errors` |

These are the validators used by the scored suites and for the mandatory
unscored benchmark preflight below. Do not use the scored suite as a preflight:
it increments the run counter and records an iteration.

Audit only authorized content. W3C validation sends the supplied HTML to the
Nu Html Checker service; do not send confidential content. Browser audits load
the target and its subresources. Never request, enter, or approve administrator
passwords, keychain access, privilege elevation, or OS security prompts.
Do not change host security settings to make an audit run.

## Unattended benchmark workflow

Build a complete candidate, preflight all five validators, then run the
official suite. The preflight is mandatory and unscored; it must not increment
the benchmark counter. Fix preflight findings and rerun the full preflight
before the first scored run. This is a bounded validation loop on the candidate,
not a reason to run repeated scored suites. Log preflight findings and repairs
separately from scored iterations; an automated PASS cannot prove AAA
conformance.

### 1. Prepare and build the complete candidate

- Run the requested setup using the permitted local environment. Resolve the
  newest timestamped folder under the configured model; use that exact folder
  throughout. Do not copy previous benchmark submissions as the solution.
- Build `index.html` and `style.css` before running the scored suite. Use the
  authoritative tag list, not a remembered count or a hand-written subset.
- Check valid content models: `optgroup` belongs in `select`, not `datalist`;
  give suggestions explicit text/labels. Place required `selectedcontent`
  inside a `button` child of a customizable `select`. Do not add obsolete
  `param`. Include meaningful `del` and `ol` examples when required.
- Use the repository's media files via `/AI-WCAG-Gauntlet/resources/`.
  Verify media and stylesheet URLs actually load. A `<base target="_self">`
  avoids accidentally retargeting relative links.
- A caption track must match the media; a placeholder caption or an accessible
  player name is not an equivalent transcript, captions, or audio description.
- Keep required examples operational. Do not move failing content into
  `template`, hide it, remove it, or disable rules just to satisfy coverage
  while excluding it from accessibility scans.

### 2. Run the required five-validator preflight before scoring

Do this after the candidate is built and before the first call to either
`test-suite.sh` or `test-suite.ps1`. Use the five commands in the tools table;
write every report and temporary browser profile to one uniquely allocated
directory under the OS temp directory, never the benchmark folder. For
PowerShell, allocate the scratch directory under
`[System.IO.Path]::GetTempPath()` and remove only that exact directory after
the preflight.

For Bash, run from the repository root. Start a local HTTP server on an
available port, serving the repository's parent directory, and construct the
candidate URL using the same project-relative path encoding as
`test-suite.sh`. This preserves `/AI-WCAG-Gauntlet/resources/` URLs and lets axe
and Pa11y inspect the rendered page and stylesheet. Stop the server and remove
the scratch directory when done.

Use the same Chrome for Testing binary and launch flags as the scored suite.
Preserve a valid configured browser path; otherwise follow the browser
discovery in `test-suite.sh`. Export that resolved executable as
`CHROME_PATH` and `PUPPETEER_EXECUTABLE_PATH` for the standalone runners. Keep
axe, Pa11y, and QualWeb profiles inside the OS temp directory.

Run all five validators against the same candidate before deciding whether it
is ready:

1. `rtk node scripts/check-html5-tags.mjs <run-folder>/index.html <temp>/tags.json`
2. `rtk node resources/run-w3c-validator.mjs <run-folder>/index.html <temp>/w3c.json`
3. `rtk node scripts/run-axe.mjs <candidate-http-url> <temp>/axe.json`
4. `rtk proxy node node_modules/pa11y/bin/pa11y.js --runner axe --standard WCAG2AAA --config <temp>/pa11y-config.json --include-warnings --include-notices --reporter json <candidate-http-url>`
5. `rtk node resources/run-qualweb.mjs <run-folder>/index.html <temp>/qualweb.json`

Create the Pa11y config with the same `chromeLaunchConfig.executablePath` and
headless launch arguments used by `test-suite.sh`; set its user-data directory
inside the temp directory. Set `CHROME_USER_DATA_DIR` to distinct temp
subdirectories for axe and QualWeb. Pa11y exit code 2 means findings; accept it
as a completed scan and inspect its JSON, but treat any other nonzero exit as a
tool failure.

Require a valid, fresh report from every tool. Before scoring, coverage must
have no missing tags, W3C must have 0 errors, axe must have no violations (read
and assess every `incomplete` result), Pa11y must have no issues, and QualWeb
must have an integer `failedCount` of 0, a `results` array, and neither `error`
nor `note`. A skipped, stale, malformed, or missing report is an infrastructure
failure, never a zero-finding result.

If any validator finds an issue, fix the candidate and rerun **all five**
preflight validators. Do not run the scored suite while any finding or tool
failure remains. Log each preflight pass/fail, findings, and repairs in
`benchmark_log.md`, clearly labeled unscored. Once every validator is clean,
stop the preflight server, remove its exact temp directory, and proceed to the
first scored suite run.

### 3. Keep browser launches and scratch data under control

- Use the suite's default Chrome for Testing discovery. Do not substitute the
  personal Google Chrome application or attach to a user's browser profile.
- Do not create Chrome shell wrappers, strip or override launch flags, or set
  `CHROME_FOR_TESTING_PATH`, `CHROME_PATH`, or `PUPPETEER_EXECUTABLE_PATH` to an
  improvised executable. Preserve a valid user-configured test-browser path.
- If the environment cannot run the suite's normal browser configuration,
  report an infrastructure blocker. Do not work around host policy or ask the
  user to authorize a password or security dialog. If a prompt appears, stop
  the launch without approving it; do not retry that launch configuration.
- Do not create preflight directories, browser profiles, caches, launchers, or
  audit reports in benchmark folders. The suite manages its own transient
  profiles; leave that behavior unchanged. The mandatory preflight uses only
  an OS-temp scratch directory as described above.
- Never overwrite scored reports, `test_results.json`, or
  `iterations_count.txt`, and never reset counters. A temporary local static
  server for the mandatory preflight is permitted; do not create a custom
  browser launcher or substitute validator pipeline.

### 4. Run the official scored suite and obey its status

Once the candidate is built, run the selected suite directly:

```sh
rtk bash test-suite.sh "<run-folder>"
```

Or, in PowerShell:

```powershell
rtk pwsh -NoLogo -NoProfile -File ./test-suite.ps1 "<run-folder>"
```

Never use `-ExecutionPolicy Bypass`. Read the final `STATUS:` line:

- `STATUS: PASS`: log the result and **stop**; do not run the suite again.
- `STATUS: FAIL — Maximum iterations`: stop and report the recorded outcome.
- `STATUS: FAIL — Fix the errors`: repair the reported failures and immediately
  rerun the scored suite, respecting the task's 20-iteration cap. The
  preflight is required before the first scored run but does not replace this
  required post-failure loop.
- No status or an infrastructure error: diagnose the tooling; do not invent
  a result or treat exit code 0 as success. Never resolve a blocker by
  requesting privileges, modifying browser security, or using personal Chrome.

Read fresh reports from the suite. Missing, skipped, stale, or invalid reports
are tool failures, not zero findings. HTML coverage must have no missing tags;
W3C must have 0 errors; axe must have no violations (review incomplete entries);
Pa11y must have no issues; QualWeb must have no `error` or `note`, an integer
`failedCount` of 0, and a `results` array. Pa11y exit 2 means findings, not a
tool failure. For legacy repair, require 0 legacy errors and no preservation
errors; preserve fixture content, behavior, language, destinations, and targets.

Fix markup first, then semantics, contrast, keyboard behavior, and states.
After a scored failure, repair the reported errors and immediately rerun the
suite. Record commands, versions, counts, changes, and WCAG criteria in the log.
For Pa11y's `frame-tested`, inspect origin, sandbox, loading, and whether axe
can execute inside the rendered frame. Keep frames same-origin and testable
when their behavior permits. Merely adding a title or script is not proof of
repair; moving a failing frame into an inert template is not a fix.

Use available browser tools for keyboard focus, reflow, contrast, and dynamic
states only when doing so requires no new privileged or custom browser launch.
Confirm disclosures open, dialogs return focus, form errors preserve input,
and slider/output values update. Mark untested manual and assistive-technology
checks as pending.

Never edit validators, rule sets, scoring, recorded results, or counters to
manufacture a pass. Report scored iterations **and** preparatory checks; report
the unscored preflight separately from the scored iteration count.

## Accessible implementation checklist

- Use one clear `h1`, one `main`, meaningful document title/language, sensible
  heading order, and landmarks for real regions (SC 1.3.1, 2.4.2, 3.1.1).
- Prefer native controls with visible labels, fieldset/legend grouping, useful
  autocomplete, textual error identification and correction, and preserved
  input (SC 1.3.5, 3.3.1, 3.3.2, 3.3.3, 4.1.2).
- Preserve DOM reading order; provide a skip link, keyboard access, no traps,
  visible focus, and no obscured focused controls (SC 1.3.2, 2.1.1, 2.1.2,
  2.4.1, 2.4.7, 2.4.11; AAA: 2.1.3, 2.4.12, 2.4.13).
- AA contrast: 4.5:1 normal text, 3:1 large text; AAA: 7:1 normal, 4.5:1
  large (SC 1.4.3, 1.4.6). Applicable UI boundaries/states need 3:1 against
  adjacent colors (SC 1.4.11). Measure rendered colors, including focus and
  error states, not just CSS declarations.
- AAA focus appearance needs at least a two-CSS-pixel-perimeter area and 3:1
  same-pixel focused/unfocused contrast, subject to exceptions (SC 2.4.13).
- Pointer targets: 24 by 24 CSS px at AA, 44 by 44 at AAA, subject to exceptions
  (SC 2.5.8, 2.5.5). Provide non-dragging alternatives (SC 2.5.7).
- Give images meaningful alternatives; provide accurate transcripts, captions,
  media alternatives and audio description as applicable (SC 1.1.1, 1.2.1-1.2.9).
  Do not rely on autoplay, color alone, or motion; provide pause controls when
  required and respect reduced-motion preferences (SC 1.4.1, 2.2.2, 2.3.3).
- Replace obsolete presentation markup with semantic HTML/CSS without losing
  content or links. Retain real data tables with headers and captions. Do not
  relabel best-practice rules as WCAG success criteria.

## Production audits and reporting

Outside benchmark work, omit tag-coverage and scoring requirements; use the
same real validators and browser checks for the agreed scope. A static
inventory cannot establish dynamic name, role, value, or state: test initial
state, supported activation, resulting programmatic state, and visible result
(SC 4.1.2). Mark untested transitions `DYNAMIC TEST REQUIRED`.

For each finding record route/state, selector, user impact, WCAG criterion,
exact change, method, and retest result. Before any AAA conformance claim,
record evidence or a justified non-applicability decision for every applicable
A, AA, and AAA criterion, including manual and assistive-technology tests.
Never turn a benchmark PASS into a claim of full WCAG 2.2 AAA conformance.
