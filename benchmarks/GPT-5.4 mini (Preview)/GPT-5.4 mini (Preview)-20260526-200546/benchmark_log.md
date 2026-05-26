# Benchmark Log

## Iteration 1
- Replaced the starter stub with a single landmarked page built around `main`, `nav`, `header`, `aside`, and `footer` so the axe `landmark-one-main` and `region` failures are addressed at the root.
- Added explicit labels, captions, alt text, and fallback content for media and form controls to align with WCAG 2.2 SC 1.1.1, 1.2.2, 1.2.3, 1.3.1, and 2.4.1.
- Updated the stylesheet to a higher-contrast, responsive layout with visible focus states and accessible control styling.

## Iteration 2
- Moved the complementary note block out of the landmarked content so axe `landmark-complementary-is-top-level` can clear cleanly.
- Added the missing `h4`, `h5`, `h6`, `kbd`, `samp`, `sub`, and `sup` tags to finish HTML5 coverage and reinforce the heading hierarchy for WCAG 2.2 SC 1.3.1 and 2.4.6.