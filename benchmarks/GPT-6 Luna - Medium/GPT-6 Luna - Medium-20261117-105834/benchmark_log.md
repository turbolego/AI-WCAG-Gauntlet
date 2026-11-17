# Benchmark Log

## Iteration 1
- Setup created a fresh starter page for GPT-6 Luna - Medium.
- Validation found 107 missing required HTML5 tags, two landmark warnings (axe), and two matching Pa11y issues; W3C and QualWeb reported zero.

## Iteration 2
- Replaced the starter with a semantic reference page covering the required HTML5 elements and used media assets from `resources/`.
- Added a main landmark and grouped all page content into landmarks to address WCAG 2.2 SC 1.3.1 (Info and Relationships) and SC 2.4.1 (Bypass Blocks).
- Added readable, high-contrast styling, visible keyboard focus, and labeled form/media examples; running validation immediately after these fixes.
- Results: full tag coverage and zero W3C, axe, and Pa11y issues; QualWeb reported one object accessible-name failure.

## Iteration 3
- Added a descriptive `title` to the SVG `object` so the non-text object has an accessible name, addressing WCAG 2.2 SC 1.1.1 (Non-text Content).
- Reran the complete validation suite immediately: PASS. HTML tag errors 0, W3C errors 0, axe violations 0, Pa11y issues 0, and QualWeb failures 0. Final score: 183.8000.
