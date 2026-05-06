import { parseResponseJson } from "../utils.mjs";
import { SYSTEM_PROMPT, buildUserPrompt, extractFeedbackSummary } from "../common-prompt.mjs";

export default async function generateWithMistral({ model, token, iteration, feedback }) {
  // Debug: log what feedback we received
  if (feedback) {
    const hasHtml5 = feedback.includes('html5_tags_report');
    const hasAxe = feedback.includes('axe_report');
    const hasPa11y = feedback.includes('pa11y_report');
    const hasQualweb = feedback.includes('qualweb_report');
    console.log(`[Mistral] Feedback received: ${feedback.length} chars - html5:${hasHtml5} axe:${hasAxe} pa11y:${hasPa11y} qualweb:${hasQualweb}`);
  } else {
    console.log(`[Mistral] No feedback provided (iteration ${iteration})`);
  }

  const prompt = [
    "Create a single-page web app as JSON with keys: html, css, js.",
    "- html: complete accessible HTML5 page with header, main, footer, button, form, input",
    "- css: basic styling",
    "- js: button click handler",
    "- Use semantic HTML, labels, landmarks, keyboard support",
    "- Output ONLY raw JSON, no markdown fences.",
    `- Iteration ${iteration}.`,
    feedback ? "- Improve based on previous test results." : ""
  ].filter(Boolean).join("\n");

  // Extract key metrics from feedback to keep it concise
  let feedbackSummary = "";
  if (feedback) {
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
    feedbackSummary = parts.join(" | ");
  }

  const messages = [
    { role: "system", content: "Output ONLY valid JSON with string fields html, css, js. No markdown, no explanations." },
    { role: "user", content: `${prompt}${feedbackSummary ? `\n\nContext: ${feedbackSummary}` : ""}` }
  ];

  // Debug: log total message size
  const totalChars = JSON.stringify(messages).length;
  console.log(`[Mistral] Sending message to model: ${totalChars} total chars`);

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ model, messages, max_tokens: 16384 })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Mistral request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const choice = payload?.choices?.[0];
  const finishReason = choice?.finish_reason ?? "unknown";
  const messageContent = choice?.message?.content;
  if (!messageContent) {
    throw new Error(`Mistral response did not include content (finish_reason=${finishReason}).`);
  }

  // Try to parse JSON - with lenient fallback
  try {
    return parseResponseJson(messageContent);
  } catch (parseError) {
    // Try to extract JSON object from response
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return parseResponseJson(jsonMatch[0]);
      } catch (e) {
        // If still invalid, continue
      }
    }

    // Lenient regex fallback
    const htmlMatch = messageContent.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const cssMatch = messageContent.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const jsMatch = messageContent.match(/"js"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    
    if (htmlMatch && cssMatch && jsMatch) {
      const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return {
        html: unescape(htmlMatch[1]),
        css: unescape(cssMatch[1]),
        js: unescape(jsMatch[1])
      };
    }

    throw parseError;
  }
}
