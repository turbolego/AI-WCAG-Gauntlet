import { extractAndRepairJson } from "../generate-page.mjs";
import { getModelConfig, getSafeMaxTokens } from "../model-config.mjs";

/**
 * Track TPM (Tokens Per Minute) state across requests.
 * Structure: { limit, resetTime, used, lastUpdate }
 */
let tpmState = {
  limit: null,
  resetTime: null,
  used: 0,
  lastUpdate: 0
};

/**
 * Extract TPM info from rate limit error to track capacity.
 * Cohere includes rate limit info in error messages.
 */
function extractTPMInfo(errorMessage) {
  // Try to extract rate limit info from Cohere error messages
  // Cohere may include TPM info in rate limit responses
  const match = errorMessage.match(/rate limit|too many|limit (\d+)|used (\d+)/i);
  if (match) {
    return { limited: true };
  }
  return null;
}

/**
 * Estimate total tokens for a request (prompt + max_tokens).
 * Rough approximation: 1 token ≈ 4 characters.
 */
function estimateTokens(messages, maxTokens) {
  let promptChars = 0;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg.content) {
        promptChars += String(msg.content).length;
      }
    }
  }
  const promptTokens = Math.ceil(promptChars / 4);
  return promptTokens + maxTokens;
}

/**
 * Check if we should wait before sending a request to avoid exceeding TPM.
 */
function checkTPMCapacity(estimatedTokens) {
  if (!tpmState.limit) {
    return { shouldWait: false, waitMs: 0 };
  }

  const now = Date.now();
  const timeUntilReset = Math.max(0, tpmState.resetTime - now);

  if (timeUntilReset === 0) {
    console.error("[COHERE_TPM] TPM counter reset detected, resetting tracked usage");
    tpmState.used = 0;
    tpmState.resetTime = now + 60000;
  }

  const projectedUsage = tpmState.used + estimatedTokens;
  const available = tpmState.limit - tpmState.used;

  console.error(
    `[COHERE_TPM_CHECK] Limit: ${tpmState.limit}, Currently used: ${tpmState.used}, ` +
    `Estimated: ${estimatedTokens}, Projected: ${projectedUsage}, Available: ${available}`
  );

  if (projectedUsage > tpmState.limit) {
    const overageTokens = projectedUsage - tpmState.limit;
    console.warn(
      `[COHERE_TPM_WAIT] Request would exceed TPM by ${overageTokens} tokens. ` +
      `Waiting ${Math.ceil(timeUntilReset / 1000)}s for TPM reset...`
    );
    return { shouldWait: true, waitMs: timeUntilReset };
  }

  return { shouldWait: false, waitMs: 0 };
}

export async function generateWithCohere({ model, token, iteration, feedback, maxTokens = null }) {
  const modelConfig = getModelConfig(model);
  const safeMaxTokens = maxTokens ?? getSafeMaxTokens(model);
  
  const REQUIRED_HTML5_TAGS = [
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo", "blockquote",
    "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd",
    "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure",
    "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i",
    "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu",
    "meta", "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture",
    "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "search", "section", "select", "slot",
    "small", "source", "span", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template",
    "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr"
  ];

  // Adjust system message for reasoning models
  const isReasoningModel = modelConfig.hasReasoningMode || model.includes("reasoning");
  const systemMessage = isReasoningModel 
    ? "You MUST output ONLY valid JSON. Output the JSON object with keys: html, css, js (all as strings). Valid JSON only. No markdown fences."
    : "You MUST output ONLY valid JSON. Nothing else. No thinking, no explanations, no reasoning, no planning. Start with { immediately. Output the JSON object with keys: html, css, js (all as strings). Valid JSON only. No markdown fences. No apologies. Just JSON.";

  const prompt = [
    "Output ONLY valid JSON with keys: html, css, js (all strings, no markdown fences).",
    isReasoningModel 
      ? "Output JSON immediately."
      : "Do not use reasoning or extended thinking. Output JSON immediately.",
    "",
    "Generate a single-page web app with accessible, valid HTML5 and semantic structure.",
    "Include diverse elements: header, nav, main, article, section, aside, footer, form, table, lists, media, and text-level tags.",
    "Ensure proper nesting, valid attributes, and WCAG compliance.",
    "You do not need to include every possible HTML5 tag—focus on semantic structure and accessibility.",
    "",
    `Iteration ${iteration}.`,
    feedback ? `Issues to fix: ${feedback}` : "Create a diverse, accessible HTML page."
  ].filter(Boolean).join("\n");

  // Debug logging
  console.error("\n" + "=".repeat(80));
  console.error("[COHERE_DEBUG] Iteration:", iteration);
  console.error("[COHERE_DEBUG] Model:", model);
  console.error("[COHERE_DEBUG] Max tokens:", safeMaxTokens);
  console.error("[COHERE_DEBUG] Low token limit model:", modelConfig.lowTokenLimit);
  console.error("[COHERE_DEBUG] System Message:", systemMessage);
  console.error("-".repeat(80));
  console.error("[COHERE_DEBUG] User Prompt (first 500 chars):");
  console.error(prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""));
  if (feedback) {
    console.error("-".repeat(80));
    console.error("[COHERE_DEBUG] Feedback/Reports Provided (first 2000 chars):");
    console.error(feedback.substring(0, 2000) + (feedback.length > 2000 ? "..." : ""));
  }
  console.error("=".repeat(80) + "\n");

  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt }
  ];

  // Check TPM capacity before sending
  let currentMaxTokens = safeMaxTokens;
  let estimatedTokens = estimateTokens(messages, currentMaxTokens);
  let { shouldWait, waitMs } = checkTPMCapacity(estimatedTokens);
  
  if (shouldWait) {
    console.error(`[COHERE_TPM] Waiting ${Math.ceil(waitMs / 1000)}s before sending request...`);
    await new Promise(resolve => setTimeout(resolve, waitMs + 1000));
  }

  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestBody = {
        model,
        messages,
        max_tokens: currentMaxTokens
      };

      console.error("[COHERE_DEBUG] Request attempt", attempt, "- Body keys:", Object.keys(requestBody).join(", "));

      const response = await fetch("https://api.cohere.ai/compatibility/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        const error = `Cohere request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`;

        console.error("\n" + "=".repeat(80));
        console.error("[COHERE_DEBUG_ERROR] Request failed");
        console.error("[COHERE_DEBUG_ERROR] Status:", response.status);
        console.error("[COHERE_DEBUG_ERROR] Error body (first 1000 chars):");
        console.error(errorBody.substring(0, 1000) + (errorBody.length > 1000 ? "\n... [truncated]" : ""));
        console.error("=".repeat(80) + "\n");

        // Handle "too many tokens" errors by reducing max_tokens and retrying
        if (response.status === 400 && errorBody.includes("too many tokens")) {
          const match = errorBody.match(/less than or equal to (\d+)/);
          if (match && attempt < maxRetries) {
            const maxAllowed = parseInt(match[1], 10);
            const newMax = Math.max(2000, Math.floor(maxAllowed * 0.9));
            console.error(`[COHERE_DEBUG] Token limit error detected. Max allowed: ${maxAllowed}, reducing to: ${newMax}`);
            currentMaxTokens = newMax;
            continue;
          }
        }

        // For other 4xx errors, don't retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(error);
        }

        // For rate limit (429) or 5xx errors, retry with backoff
        if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.error(`[COHERE_DEBUG] Retryable error (${response.status}), waiting ${backoffMs}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        throw new Error(error);
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      const messageContent = choice?.message?.content;

      console.error("[COHERE_DEBUG] Response received");
      console.error("[COHERE_DEBUG] Message content length:", messageContent?.length || 0, "characters");

      if (!messageContent) {
        console.error("\n" + "=".repeat(80));
        console.error("[COHERE_DEBUG_ERROR] Cohere API returned no content");
        console.error("[COHERE_DEBUG_ERROR] Full response object (first 1000 chars):");
        console.error(JSON.stringify(payload, null, 2).substring(0, 1000));
        console.error("=".repeat(80) + "\n");
        throw new Error("Cohere response did not include content.");
      }

      // Debug: Log raw API response
      console.error("\n" + "=".repeat(80));
      console.error("[COHERE_DEBUG_RESPONSE] Raw Model Output (first 1500 chars):");
      console.error(messageContent.substring(0, 1500) + (messageContent.length > 1500 ? "\n... [truncated]" : ""));
      console.error("[COHERE_DEBUG_RESPONSE] Total response length:", messageContent.length, "characters");
      console.error("=".repeat(80) + "\n");

      let jsonStr;
      try {
        jsonStr = extractAndRepairJson(messageContent);
        console.error("[COHERE_DEBUG] Successfully extracted JSON (length:", jsonStr.length, "characters)");
      } catch (e) {
        console.error("\n" + "=".repeat(80));
        console.error("[COHERE_DEBUG_ERROR] JSON extraction failed:", e instanceof Error ? e.message : String(e));
        console.error("=".repeat(80) + "\n");
        throw new Error(`Failed to extract JSON from Cohere response: ${e instanceof Error ? e.message : String(e)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
        console.error("[COHERE_DEBUG] Successfully parsed JSON");
        console.error("[COHERE_DEBUG] Parsed keys:", Object.keys(parsed || {}).join(", "));
      } catch (e) {
        console.error("\n" + "=".repeat(80));
        console.error("[COHERE_DEBUG_ERROR] JSON parsing failed:", e instanceof Error ? e.message : String(e));
        console.error("[COHERE_DEBUG_ERROR] Attempted JSON string (first 500 chars):");
        console.error(jsonStr.substring(0, 500));
        console.error("=".repeat(80) + "\n");
        throw new Error(`JSON parsing failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
        console.error("\n" + "=".repeat(80));
        console.error("[COHERE_DEBUG_ERROR] Missing required fields in JSON response");
        console.error("[COHERE_DEBUG_ERROR] html:", parsed?.html ? "present" : "MISSING");
        console.error("[COHERE_DEBUG_ERROR] css:", parsed?.css ? "present" : "MISSING");
        console.error("[COHERE_DEBUG_ERROR] js:", parsed?.js ? "present" : "MISSING");
        console.error("=".repeat(80) + "\n");
        throw new Error("Cohere response JSON missing html/css/js fields.");
      }

      console.error("[COHERE_DEBUG] All required fields present, returning parsed content");
      return {
        html: String(parsed.html),
        css: String(parsed.css),
        js: String(parsed.js),
        usage: payload?.usage || {}
      };
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[COHERE_DEBUG] Attempt ${attempt} failed, retrying:`, errorMsg.substring(0, 200));
    }
  }
}
