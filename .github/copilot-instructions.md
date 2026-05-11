# RTK — Token-Optimized CLI

**rtk** is a CLI proxy that filters and compresses command outputs, saving 60-90% tokens.

## Golden Rule

**Always prefix shell commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged.

**Important**: Even in command chains with `&&`, prefix each command:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## Examples by Category

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log -10         # Compact log with history
rtk git diff            # Compact diff (80% savings)
rtk git add             # Ultra-compact confirmations
rtk git commit -m "msg" # Ultra-compact confirmations
```

### Node.js & npm (70-85% savings)
```bash
rtk npm ci              # Install dependencies (70% savings)
rtk npm install -g pkg  # Global installs (75% savings)
rtk npm test            # Test failures only (95% savings)
```

### Accessibility Testing (85-95% savings)
```bash
rtk node scripts/generate-page.mjs  # Model generation logs
rtk bash test-suite.sh               # Accessibility test output (pa11y, axe, qualweb)
```

## Meta Commands (Token Savings Analytics)
```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
rtk proxy <cmd>       # Run raw (no filtering) but track usage
```

## Project Setup

RTK has been initialized in this repository with:
- **CLAUDE.md** — Comprehensive RTK instruction guide for Claude Code
- **.rtk/filters.toml** — Custom filter configuration (edit to add project-specific filters)
- **Global shell hook** — Installed for system-wide rtk support

## Why RTK for This Project

The AI-WCAG-Gauntlet benchmark has high logging output from:
- **Accessibility testing tools** (axe, pa11y, qualweb) — 85-95% compression
- **Model generation iterations** — 80-90% compression  
- **Multiple test suites per iteration** — 90-99% compression

Using `rtk` throughout CI/CD workflows (see `.github/workflows/ai-wcag-gauntlet-groq.yml`) prevents token-limit issues when processing benchmark logs.
