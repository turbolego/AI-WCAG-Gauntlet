# Benchmark Log — DeepSeek V4 Pro

## Iteration 1 — FAIL (Score: 12.50)
- HTML_TAG_ERRORS: 107
- W3C_ERRORS: 0
- AXE_VIOLATIONS: 2 (landmark-one-main, region)
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0

### Fixes for Iteration 2:
- Add `<main>` landmark to fix axe violations
- Add comprehensive HTML5 tags to dramatically reduce missing tag count

## Iteration 2 — FAIL (Score: 86.40)
- HTML_TAG_ERRORS: 18
- W3C_ERRORS: 0
- AXE_VIOLATIONS: 1 (target-size — nav links < 24px)
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0

### Fixes for Iteration 3:
- Added remaining HTML5 tags: canvas, embed, iframe, menu, noscript, object, ol, pre, rp/rt/ruby, template, slot, wbr, datalist, search
- Added external script (scripts/dummy.js) for the script tag

## Iteration 3 — FAIL (Score: 12.50)
- HTML_TAG_ERRORS: 0
- W3C_ERRORS: 43 (structural: unclosed elements, nested interactive content)
- AXE_VIOLATIONS: 1
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0

### Fixes for Iteration 4:
- Completely rewrote index.html with clean, valid structure
- Removed invalid tag usage in body context (title/base/col/param/link in body)

## Iteration 4 — FAIL (Score: 96.80)
- HTML_TAG_ERRORS: 0
- W3C_ERRORS: 4 (selectedcontent in select, stray fieldset, unclosed section)
- AXE_VIOLATIONS: 1 (target-size)
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0

### Fixes for Iteration 5:
- Moved `<selectedcontent>` out of `<select>` into a `<div>` (validator constraint)
- Removed stray `</fieldset>`
- Added 24px min-height/min-width touch-target CSS to style.css

## Iteration 5 — FAIL (Score: 98.80)
- HTML_TAG_ERRORS: 0
- W3C_ERRORS: 2 (unclosed section id="about")
- AXE_VIOLATIONS: 1 (target-size — CSS not loading due to <base href>)
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0

### Fixes for Iteration 6:
- Closed the unclosed `<section id="about">` before contact section
- Changed style.css link to absolute URL path (base href was breaking relative resolution)
- Added min-height: 24px to inline nav a style as belt-and-suspenders

## Iteration 6 — ✅ PASS (Score: 168.18)
- HTML_TAG_ERRORS: 0
- W3C_ERRORS: 0
- AXE_VIOLATIONS: 0
- PA11Y_ISSUES: 0
- QUALWEB_ISSUES: 0
- MISSING_TAGS: (none)

### Result: ALL TESTS PASSED — benchmark complete in 6 iterations.
