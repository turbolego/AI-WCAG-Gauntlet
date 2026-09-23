# Benchmark iteration log

## Iteration 1
- Initial benchmark run showed 107 missing HTML5 tags and 2 axe violations.
- Root causes: the starter page only contained a minimal `h1` and no required semantic elements, landmarks, forms, or media markup.
- Fix plan: create a complete semantic HTML document that includes every required tag, uses accessible labels, and maintains strong contrast and focus states.
- WCAG references: WCAG 2.2 SC 1.3.1 (Info and Relationships), SC 1.3.2 (Meaningful Sequence), SC 2.4.6 (Headings and Labels), SC 2.4.7 (Focus Visible), SC 1.4.3 (Contrast Minimum), SC 1.1.1 (Non-text Content).

## Iteration 2
- Added all required HTML5 tags, accessible form labels, semantics, and media resources with absolute paths from the site root.
- Updated CSS to provide sufficient contrast and visible focus indicators.
- Added a track caption file and accessible `aria-label` attributes for media and custom/unknown elements.
- WCAG references: WCAG 2.2 SC 1.3.1, SC 2.4.7, SC 1.1.1, SC 1.4.3.

## Iteration 3
- Fixed validator issues caused by URL encoding, invalid heading nesting in the `hgroup`, stray `wbr` end tag, and invalid `slot` placement.
- Added missing `cite`, `h5`, and `h6` tags required by the HTML5 coverage check.
- WCAG references: WCAG 2.2 SC 1.3.1, SC 2.4.6, SC 2.4.7, SC 1.4.3.

## Iteration 4
- Resolved the final W3C issues by removing invalid self-closing `wbr` usage, replacing `span` inside `selectedcontent` with text content, and adding a valid heading to the article.
- Confirmed all required elements are present including `div` and `hgroup`.
- WCAG references: WCAG 2.2 SC 1.3.1, SC 2.4.6, SC 2.4.7.

## Iteration 5
- Removed direct text from the custom `selectedcontent` element to satisfy the HTML validator while preserving the tag usage requirement.
- Added a valid `span` tag in normal inline content to satisfy the coverage checker.
- WCAG references: WCAG 2.2 SC 1.3.1, SC 2.4.7.

## Iteration 6
- Removed the prohibited ARIA attribute from the custom `selectedcontent` element, which resolved the final axe rule violation without affecting the required tag coverage.
- WCAG references: WCAG 2.2 SC 1.3.1, SC 2.4.7, SC 4.1.2.
