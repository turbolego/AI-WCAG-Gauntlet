/**
 * Common prompt configuration shared across all providers.
 * This ensures fair benchmarking with consistent instructions.
 */

export const SYSTEM_PROMPT = `Output ONLY valid JSON with string fields: html, css, js. No explanations, no markdown code fences, no text before or after the JSON.`;

export function buildUserPrompt(iteration, feedbackSummary) {
  const basePrompt = [
    "Create a single-page web app as JSON with keys: html, css, js.",
    "- html: complete accessible HTML5 page with header, main, footer, button, form, input",
    "- css: basic styling",
    "- js: button click handler",
    "- Use semantic HTML, labels, landmarks, keyboard support",
    "- Output ONLY raw JSON, no markdown fences.",
    `- Iteration ${iteration}.`,
    feedbackSummary ? "- Improve based on previous test results." : ""
  ].filter(Boolean).join("\n");

  return feedbackSummary
    ? `${basePrompt}\n\nContext: ${feedbackSummary}`
    : basePrompt;
}

export function extractFeedbackSummary(feedback) {
  if (!feedback) return "";

  const missingMatch = feedback.match(/MISSING_TAGS\s*=\s*([^\n]+)/);
  const scoreMatch = feedback.match(/SCORE\s*=\s*([\d.]+)/);
  const errorsMatch = feedback.match(/HTML_TAG_ERRORS\s*=\s*(\d+)/);
  const axeMatch = feedback.match(/AXE_VIOLATIONS\s*=\s*(\d+)/);
  const pa11yMatch = feedback.match(/PA11Y_ISSUES\s*=\s*(\d+)/);

  const parts = [];
  if (errorsMatch) parts.push(`HTML tags missing: ${errorsMatch[1]}`);
  if (axeMatch) parts.push(`Axe issues: ${axeMatch[1]}`);
  if (pa11yMatch) parts.push(`Pa11y issues: ${pa11yMatch[1]}`);
  if (missingMatch) {
    const tags = missingMatch[1].split(',').slice(0, 15).join(',').trim();
    parts.push(`Add: ${tags}`);
  }
  if (scoreMatch) parts.push(`Score: ${scoreMatch[1]}`);
  return parts.join(" | ");
}

export const DEFAULT_MAX_TOKENS = 16384;
