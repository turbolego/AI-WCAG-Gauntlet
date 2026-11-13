# Issue #77 implementation plan

## Requirements and decisions

- Both showcase and legacy-repair tasks must use every tag in
  [resources/html_tags.json](resources/html_tags.json), including `selectedcontent`.
  Obsolete `param` is not a required tag. Do not reward deprecated markup.
- The default remains the showcase task. Existing runs without task metadata
  remain readable as showcase runs.
- Legacy repair adds requirements; it does not replace tag coverage or the
  W3C, axe, Pa11y, and QualWeb checks.
- Synthetic fixtures must preserve their meaningful content and link destinations
  after repair. Removing the page is not a successful migration.
- New detector failures and invalid reports must be explicit, not zero-error
  fallbacks. Automated checks are not proof of full WCAG AAA conformance.
- Keep existing showcase scoring unchanged. Report legacy results separately,
  using the same score components with residual legacy errors included in the
  failure penalty and pass gate.

## Implementation sequence

1. **Shared task contract and prompts**
   - Load required tags from the authoritative JSON for every provider.
   - Share task instructions without changing provider transport/retry behavior.
   - Add `--task legacy-repair --fixture <id>` to generation and the local runner.
   - Persist task, fixture, and rule versions with generation/results.
   - Include the input fixture, previous candidate, and compact legacy feedback.
   - Never trim away task requirements during low-token retries.
2. **Legacy detector and fixtures**
   - Add a versioned obsolete-tag and legacy-pattern definition.
   - Add three self-contained synthetic Norwegian front pages with known defects.
   - Use a DOM parser for tags, presentation attributes, layout tables, inline
     absolute-positioned div clusters, and unnamed image links.
   - Avoid blanket bans on data tables, named image links, or positioned elements.
   - Check fixture content/link preservation to prevent deletion-based repairs.
   - Write `legacy_present`, `legacy_patterns_matched`, occurrence counts, and
     actionable examples to `legacy_report.json`.
3. **Suite integration**
   - Integrate the checker in Bash and PowerShell after browser validators.
   - Keep all required-tag checks active for both tasks.
   - Add legacy errors to pass/fail, scoring penalties, console output, and results.
   - Persist baseline/final legacy metrics and focused axe rule counts.
   - Reject missing or malformed legacy reports and tool-error fallbacks in repair
     runs, rather than reporting a successful repair.
4. **Aggregation and dashboard**
   - Normalize object/array result records and singular/plural tag report names.
   - Group runs by task/fixture without merging unrelated repair sessions.
   - Add per-model `legacy_repair_stats` and `hardest_legacy_patterns`, including
     baseline removals, residual contrast/region/link-name issues, and pass rates.
   - Surface legacy results in the repository dashboard without mixing rankings.
   - Do not retrospectively rescore historical showcase results.
5. **Documentation and tests**
   - Update benchmark instructions, schemas, and local invocation examples.
   - Add focused detector, prompt, generation-context, aggregation, and runner
     contract tests, including `selectedcontent` and task-preserving retries.
   - Run the existing tests plus new focused tests and Bash/PowerShell syntax
     checks where the relevant runtimes are installed.
6. **Recorded benchmark and coordinated rollout**
   - Execute a real model run only through an explicitly configured provider;
     never count a fallback page or test stub as a model result.
   - Retain reports and provenance, regenerate stats, and verify dashboard output.
   - Coordinate rule semantics with
     [turbolego/wcag-skill#46](https://github.com/turbolego/wcag-skill/issues/46).
     Changes to that separate repository are not part of this implementation.

## Acceptance checks

- An unchanged fixture fails for its expected legacy defects.
- A repaired candidate retaining content/links and all required HTML5 tags can
  clear the legacy checker; tags mentioned only in comments/scripts do not count.
- Valid data tables, named image links, and isolated positioned divs are allowed.
- Omitting `selectedcontent` fails required-tag coverage in both tasks.
- A missing provider credential cannot produce a recorded successful model run.
- Repair mode clears every validator and the legacy checker before passing.
- Existing showcase runs still aggregate, and legacy runs have separate summaries.

## Known compatibility work

The Bash/PowerShell suites write array-shaped `test_results.json` and
`html5_tags_report.json`; the aggregator currently assumes object-shaped results
and `html5_tag_report.json`. Normalize these directly related formats while adding
the new statistics. Seven providers duplicate a tag array, Groq omits complete
coverage instructions, and the generator contains an unused copied array.

## Implementation status

- Implemented: shared task/prompt contract across all eight providers, complete
  required-tag coverage in both tasks, synthetic fixtures, DOM-based legacy
  detector, preservation checks, Bash/PowerShell integration, separate aggregation,
  both repository dashboards, documentation, and focused regression tests.
- Coverage uses an HTML token stream rather than tree reconstruction: the parser's
  tree builder currently discards `selectedcontent` inside a customizable select.
  The token stream recognizes it while ignoring comments and script strings.
- The deployed dashboard uses `.github/scripts/aggregate_stats.py`, not just the
  JavaScript aggregator. It now excludes repair runs from its existing showcase
  calculations and calls the shared JavaScript legacy aggregation. Its historical
  showcase scoring behavior is otherwise unchanged. The JavaScript dashboard
  aggregator preserves recorded scores.
- Verified: Node tests, Bash syntax, Python syntax, and empty/populated legacy
  dashboard rendering. Bash orchestration tests use explicitly stubbed browser
  validators; these are not real model results or full WCAG scans.
- Pending rollout: a real provider-backed benchmark run (no supported provider
  credentials are configured here), runtime testing on PowerShell (not installed
  here), and coordination with the companion wcag-skill repository.
