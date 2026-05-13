# Benchmark Log

## Iteration 1

- Initial run with starter template.
- 107 HTML5 tags missing (see test_results.json and axe_report.json).
- Axe violations:
  1. Document does not have a main landmark (WCAG 2.2, SC 1.3.1, 2.4.1, best-practice)
  2. Some page content is not contained by landmarks (WCAG 2.2, SC 1.3.1, best-practice)
- Next: Add all missing HTML5 tags and wrap content in appropriate landmark elements (main, header, nav, footer, etc.) to resolve violations.

## Iteration 2

- Added all missing HTML5 tags to index.html, using correct absolute paths for media and resources per BENCHMARK.md.
- Wrapped content in <header>, <main>, <footer>, and other landmark elements to resolve axe violations (main landmark, region containment).
- Added accessible navigation, form, table, and ARIA attributes where appropriate.
- Updated style.css to style all new elements and ensure visual clarity and focus outlines for accessibility.
- Next: Rerun test-suite.sh to verify fixes and continue iterating if needed.

**WCAG references:**
- Main landmark: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html), [SC 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html)
- Region containment: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Accessible navigation: [WCAG 2.2 SC 2.4.5](https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html)
- Accessible forms: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html), [SC 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- Accessible media: [WCAG 2.2 SC 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html), [SC 1.2.9](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-prerecorded.html)

## Iteration 3

- Added all remaining missing HTML5 tags: <br>, <cite>, <col>, <colgroup>, <datalist>, <h4>, <h5>, <h6>, <hgroup>, <optgroup>, <q>, <style> to index.html.
- Ensured <colgroup> and <col> are inside <table>, <optgroup> is inside <select>, <datalist> is referenced by an <input>.
- Added <hgroup> with <h2> and <h3>, and included <h4>, <h5>, <h6> for heading coverage.
- Updated <form> to use <optgroup> and <datalist>.
- Added <q> and <cite> for inline and block quotes.
- Added <style> for blockquote color.
- Next: Rerun test-suite.sh to verify fixes and continue iterating if needed.

**WCAG references:**
- Proper use of semantic elements: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Accessible forms and grouping: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)

## Iteration 4

- Fixed W3C validation errors: removed duplicate <main> (only one <main> landmark allowed), ensured proper nesting of elements.
- Added tabindex="-1" to <main> for skip link accessibility.
- Next: Rerun test-suite.sh to verify fixes and continue iterating if needed.

**WCAG references:**
- One main landmark: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Skip link accessibility: [WCAG 2.2 SC 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html)

## Iteration 5

- Fixed W3C and axe issue: moved inline style from <col> to CSS class .col-highlight in style.css.
- Ensured all ARIA attributes are valid and navigation links remain accessible.
- Next: Rerun test-suite.sh to verify fixes and continue iterating if needed.

**WCAG references:**
- Inline style avoidance: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Accessible navigation: [WCAG 2.2 SC 2.4.5](https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways.html)

## Iteration 6

- Fixed W3C errors:
  - <hgroup> now only contains <h2> (moved <h3> outside).
  - Moved <style> blockquote style to <head> (removed from <section>).
  - Fixed <ruby> structure: <rp> and <rt> are now inside <ruby>.
  - Removed text from <selectedcontent> (now empty).
- Next: Rerun test-suite.sh to verify all validation errors are resolved.

**WCAG references:**
- Proper heading structure: [WCAG 2.2 SC 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Valid HTML structure: [WCAG 2.2 SC 4.1.1](https://www.w3.org/WAI/WCAG22/Understanding/parsing.html)

## Iteration 7

- Fixed accessibility issues:
  - Added label and aria-label for datalist input.
  - Added aria-label for <object> element.
  - Improved <iframe> title and added aria-label.
- Next: Rerun test-suite.sh to verify accessibility fixes.

**WCAG references:**
- Form labels: [WCAG 2.2 SC 1.3.1, 3.3.2](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- Accessible names: [WCAG 2.2 SC 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- Frame and object text alternatives: [WCAG 2.2 SC 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)

## Iteration 8

- Fixed color contrast issue for #section1 by setting background to #fff and text color to #000 for maximum accessibility.
- Next: Rerun test-suite.sh to verify all accessibility issues are resolved.

**WCAG references:**
- Color contrast: [WCAG 2.2 SC 1.4.3, 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Iteration 9

- Fixed frame-tested issue by embedding axe-core in the iframe using srcdoc and running axe inside the frame.
- This ensures the iframe is tested for accessibility per WCAG and axe requirements.
- Next: Rerun test-suite.sh to verify all issues are resolved.

**WCAG references:**
- Frame accessibility: [WCAG 2.2 SC 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- axe-core frame-tested: [axe rule](https://dequeuniversity.com/rules/axe/4.11/frame-tested?application=axeAPI)
