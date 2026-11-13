# 🏁 Benchmark Instructions for AI Agents

## Mission
Build a single-page technical showcase that implements every valid HTML5 tag while adhering to **WCAG 2.2 Level AAA** standards. The showcase must include both `index.html` and `style.css` files.

## Legacy-repair task

The optional `legacy-repair` task starts from a synthetic Norwegian front page
instead of a blank page. **Every required HTML5 tag remains mandatory**, including
`selectedcontent`. Preserve the fixture's visible content and link destinations;
extend it with meaningful examples of tags it does not already contain.
Replace obsolete markup rather than adding it to the required tag list.

Run a configured Mistral model locally:

```bash
rtk bash run-benchmark-local.sh mistral-small-latest 20 legacy-repair norwegian-news
```

`MISTRAL_TOKEN` must already be configured. Other fixture IDs are
`community-portal` and `local-directory`. The default task is `showcase`.
For individual generation calls, pass `--task legacy-repair --fixture <id>` to
`scripts/generate-page.mjs`; use the same output/previous directory on later
iterations. All eight providers receive the same task and required-tag contract.
Existing GitHub Actions invocations remain showcase runs unless these arguments
are explicitly added.

The generator persists `task.json`. Both test suites read that file automatically.
Each repair iteration writes `legacy_report.json` after the browser validators
and embeds its metrics in the iteration result. A repair passes only when **tag
coverage, W3C, axe, Pa11y, QualWeb, and legacy errors are all zero**. Tool errors
or missing/invalid repair reports do not count as successful scans.

The versioned [legacy rules](resources/legacy_tags.json) detect obsolete tags,
tag-specific presentation attributes, explicitly presentational tables, clusters
of at least three sibling divs with inline absolute positioning, and unnamed
image links. Ordinary data tables, named image links, and isolated positioned
elements are not banned. Contrast, landmarks, and accessible names are also
checked by the existing accessibility validators.

The preservation guard checks DOM text/link multiplicities and inline visibility.
It is not a full rendered-CSS or functional-equivalence check. Synthetic fixtures
are not copies of particular real sites, and automated passes do not certify all
WCAG 2.2 AAA criteria.

Legacy results have separate dashboard summaries (`legacy_repair_stats`,
`hardest_legacy_patterns`, and `legacy_repair_runs`) and are not mixed into
showcase rankings. Regenerate the repository dashboard data with:

```bash
rtk node scripts/aggregate-stats.mjs
```

## HTML5 Tags Reference
All HTML5 tags required for this benchmark are listed in [resources/html_tags.json](resources/html_tags.json), sourced from the [WHATWG HTML Living Standard](https://html.spec.whatwg.org/multipage/indices.html). This file defines the authoritative set of tags that must be implemented and covered in your solution.

**Reference:**
- [HTML Living Standard — Elements Index](https://html.spec.whatwg.org/multipage/indices.html)
- [resources/html_tags.json](resources/html_tags.json) (full tag list included in this repo)

You must ensure that every tag in this list is used at least once in your `index.html`.
`selectedcontent` is valid and required; use it inside a `button` child of a
customizable `select`. Obsolete `param` is not part of the required set.

## WCAG 2.2 Specification
This benchmark requires strict conformance to the [WCAG 2.2 specification](https://www.w3.org/TR/WCAG22/). The full machine-readable spec is provided in `resources/wcag_22.json` and should be used as the authoritative reference for all accessibility requirements, success criteria, and guideline interpretations.

**Reference:**
- [WCAG 2.2 Overview](https://www.w3.org/TR/WCAG22/)
- [resources/wcag_22.json](resources/wcag_22.json) (full JSON spec included in this repo)

## axe-core Rules for WCAG Level AAA
The accessibility test suite uses [axe-core](https://github.com/dequelabs/axe-core) to check conformance with WCAG 2.2 Level AAA. The full set of axe rules applied in this benchmark is documented in [resources/axe_rules_aaa.md](resources/axe_rules_aaa.md).

**Reference:**
- [axe-core Rule Documentation](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [resources/axe_rules_aaa.md](resources/axe_rules_aaa.md) (full rule list included in this repo)

You must address all axe violations reported by the test suite. For details on each rule, consult the documentation above.

All accessibility fixes and code changes must be justified with reference to the relevant WCAG 2.2 guideline, success criterion, or technique. When logging changes, cite the specific guideline (e.g., "Fixed color contrast — WCAG 2.2 SC 1.4.6").

## Execution Rules
1. **Tool Access**: You are granted permission to use the terminal to run `test-suite.sh`.
2. **Iteration Cap**: You have a maximum of 20 iterations to reach 0 errors.
3. **Logging**: Every attempt must be logged in `benchmark_log.md` with the specific reasoning for code changes.
4. **Self-Termination**: You must only stop when the output of `test-suite.sh` contains `STATUS: PASS` **or** `STATUS: FAIL — Maximum iterations`. Stopping for any other reason is a protocol violation.
5. **WCAG Reference**: For every accessibility-related code change, cite the relevant WCAG 2.2 guideline or success criterion in your log entry (see above).

**Important Note:** Never use `-ExecutionPolicy Bypass` when running PowerShell scripts. This ensures that popups or interruptions related to execution policies are avoided.

## Required tools
In addition to `axe-core/cli` and `serve`, the test suite requires **pa11y** (`npm install -g pa11y`), **qualweb** (`npm install -g @qualweb/cli`), and **w3c-html-validator** (included via `npm ci`). Pa11y is run against an HTTP URL (via a local `python3 -m http.server` instance) with the WCAG2AAA standard and the axe runner — the same approach used for axe-core. Serving via HTTP is required because generated pages include `<base href="/AI-WCAG-Gauntlet/">`, which causes CSS and media resources to resolve to wrong paths under `file://`, making color-contrast and other style-dependent checks unreliable.

## Loop Protocol (follow exactly)
1. Run `test-suite.sh`.
2. Read the `STATUS:` line at the bottom of its output.
   - `STATUS: PASS` → Stop. The benchmark is complete.
   - `STATUS: FAIL — Maximum iterations` → Stop. Report the final results.
   - `STATUS: FAIL — Fix the errors` → Edit `index.html` and/or `style.css` to fix the reported errors, then go to step 1.
3. **Never stop early.** The script always exits with code 0; a zero exit code does NOT mean the benchmark passed. You must check the `STATUS:` line.
4. **Never declare completion based on "false positives".** If `AXE_VIOLATIONS` or `PA11Y_ISSUES` is non-zero in the test output, they are real failures that must be fixed. You are not permitted to stop and claim the remaining issues are false positives — keep iterating until the counts reach 0 or the 20-iteration cap is hit.
5. **Never stop because the task feels done.** As long as `STATUS: FAIL — Fix the errors` is printed and iterations remain, you must continue the loop without asking for confirmation.

## Media resources
HTML5 tags that require media (`<audio>`, `<video>`, `<img>`, `<picture>`, `<source>`, `<track>`, `<embed>`, `<object>`) **must use files from the `resources/` folder** at the repo root.

### ⚠️ Critical: use absolute paths — never relative paths
The benchmark page is served from `benchmarks/<MODEL>/<RUN>/index.html`, which is 3 levels deep. Relative paths like `../../resources/` only go up 2 levels and will resolve to `benchmarks/resources/` — which does not exist and will 404.

**Always use absolute paths from the site root:**

| Absolute path | Use for |
|---|---|
| `/AI-WCAG-Gauntlet/resources/250px-Ordnance_survey_benchmark_Pinhead_icon.svg.png` | `<img>` small |
| `/AI-WCAG-Gauntlet/resources/500px-Ordnance_survey_benchmark_Pinhead_icon.svg.png` | `<img>` medium / `<picture><source>` |
| `/AI-WCAG-Gauntlet/resources/960px-Ordnance_survey_benchmark_Pinhead_icon.svg.png` | `<img>` large / `<picture><source>` |
| `/AI-WCAG-Gauntlet/resources/1280px-Ordnance_survey_benchmark_Pinhead_icon.svg.png` | `<img>` HD / `<picture><source>` |
| `/AI-WCAG-Gauntlet/resources/3840px-Ordnance_survey_benchmark_Pinhead_icon.svg.png` | `<img>` 4K / `<picture><source>` |
| `/AI-WCAG-Gauntlet/resources/Ordnance_survey_benchmark_Pinhead_icon.svg` | `<img>` SVG / `<object>` / `<embed>` |
| `/AI-WCAG-Gauntlet/resources/LL-Q1860_(eng)-Flame,_not_lame-benchmarking.wav` | `<audio>` / `<source>` |
| `/AI-WCAG-Gauntlet/resources/IPCC_Projections_of_Temperature_and_Precipitation_in_the_21st_Century.webm` | `<video>` / `<source>` |

Example correct usage:
```html

<img src="/AI-WCAG-Gauntlet/resources/250px-Ordnance_survey_benchmark_Pinhead_icon.svg.png" alt="Benchmark icon">

<picture>
  <source srcset="/AI-WCAG-Gauntlet/resources/500px-Ordnance_survey_benchmark_Pinhead_icon.svg.png" media="(min-width: 600px)">
  <img src="/AI-WCAG-Gauntlet/resources/250px-Ordnance_survey_benchmark_Pinhead_icon.svg.png" alt="Responsive benchmark icon">
</picture>

<audio controls>
  <source src="/AI-WCAG-Gauntlet/resources/LL-Q1860_(eng)-Flame,_not_lame-benchmarking.wav" type="audio/wav">
</audio>

<video controls width="400">
  <source src="/AI-WCAG-Gauntlet/resources/IPCC_Projections_of_Temperature_and_Precipitation_in_the_21st_Century.webm" type="video/webm">
  <track kind="captions" src="#" srclang="en" label="English" default>
</video>
```

Always include proper `alt`, `aria-label`, or `<track kind="captions">` attributes on media elements to satisfy WCAG 2.2 AAA requirements.

## Folder structure
Benchmark runs are stored under `benchmarks/<MODEL_NAME>/<MODEL_NAME>-<TIMESTAMP>/`:
```
benchmarks/
└── GPT-4o/
    └── GPT-4o-20260405-155342/
        ├── index.html
        ├── style.css
        ├── test_results.json     ← array, one entry per iteration
        ├── html5_tags_report.json
        ├── axe_report.json
        ├── w3c_report.json
        ├── pa11y_report.json
        └── benchmark_log.md
```

Repair runs additionally contain `task.json` and `legacy_report.json`.

## test_results.json schema
`test_results.json` is a JSON **array** — one object is appended for each iteration, so you can track progress over time:
```json
[
  {
    "timestamp":       "2026-04-05T15:53:42Z",
    "iteration":       1,
    "status":          "fail",
    "score":           41.50,
    "html_tag_errors": 107,
    "w3c_errors":      0,
    "axe_violations":  2,
    "pa11y_issues":    3,
    "pa11y_version":   "9.1.1",
    "missing_tags":    ["a", "abbr", "..."],
    "used_tags":       ["body", "h1", "..."]
  },
  { "iteration": 2, "..." : "..." }
]
```

New results include `task`, `task_version`, and `legacy_errors`. Repair results
also include `fixture` and a `legacy` object containing:

```json
{
  "version": 1,
  "legacy_present": [{"tag": "font", "count": 1, "examples": ["<font color=\"red\">"]}],
  "legacy_patterns_matched": [{"id": "presentational-attributes", "count": 1, "examples": []}],
  "legacy_error_count": 2,
  "preservation_errors": [],
  "baseline_legacy_present": [{"tag": "font", "count": 1, "examples": []}],
  "baseline_legacy_patterns": [{"id": "presentational-attributes", "count": 1, "examples": []}],
  "residual_axe": {"color-contrast": 0, "color-contrast-enhanced": 0, "region": 0, "link-name": 0}
}
```

## Scoring Formula
Final Score = Tag_Score + Quality_Score + Efficiency_Score

| Component | PASS run | FAIL run |
|---|---|---|
| **Tag_Score** | `(Used_Tags / 110) × 90` | same |
| **Quality_Score** | **60** | `max(0, 10 − (W3C_Errors + Axe_Violations + Pa11y_Issues))` |
| **Efficiency_Score** | `50 × 0.8^(Iterations − 1)` | **0** |

The Efficiency Score uses **exponential decay** — each additional iteration costs roughly 20% of the previous bonus:

| Iterations | Efficiency Score | Difference from previous |
|:---:|:---:|:---:|
| 1 | 50.0 | — |
| 2 | 40.0 | −10.0 |
| 3 | 32.0 | −8.0 |
| 4 | 25.6 | −6.4 |
| 5 | 20.5 | −5.1 |
| 10 | 5.4 | — |
| 20 | 0.7 | — |

- **PASS range**: ~153 – 203 points
- **FAIL range**: 0 – 103 points
- Guaranteed gap of ≥ 50 points between any passing and any failing run.

The runners also include QualWeb failures in the failed Quality Score penalty.
Repair runs additionally include `legacy_errors` (obsolete-tag occurrences,
pattern occurrences, and preservation failures). The existing tag-score denominator
and showcase score formula are unchanged; aggregation retains recorded scores.

A `STATUS: PASS` requires HTML tag errors, W3C errors, axe violations, Pa11y issues,
and QualWeb failures to be zero; repair runs additionally require zero legacy errors.

## WCAG 2.2 Reference
- [WCAG 2.2 Specification](https://www.w3.org/TR/WCAG22/)
- [resources/wcag_22.json](resources/wcag_22.json)
