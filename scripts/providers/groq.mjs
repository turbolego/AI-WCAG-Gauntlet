import { extractAndRepairJson } from "../generate-page.mjs";
import { buildTaskPrompt } from "../benchmark-task.mjs";

/**
 * Track TPM (Tokens Per Minute) state across requests.
 * Structure: { limit, resetTime, used, lastUpdate }
 * - limit: TPM limit for this model/tier
 * - resetTime: Epoch ms when TPM counter resets
 * - used: Tokens used so far in current minute
 * - lastUpdate: When we last saw TPM info from API
 */
let tpmState = {
  limit: null,
  resetTime: null,
  used: 0,
  lastUpdate: 0
};

/**
 * Extract TPM info from rate limit error to track capacity.
 * Returns { limit, used, requested } or null
 * Works for both 429 (rate limit) and 413 (request too large) errors
 */
function extractTPMInfo(errorMessage) {
  const match = errorMessage.match(/Limit (\d+),\s*(?:Used (\d+),\s*)?Requested (\d+)/);
  if (match) {
    return {
      limit: parseInt(match[1], 10),
      used: match[2] ? parseInt(match[2], 10) : 0,
      requested: parseInt(match[3], 10)
    };
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
 * Update TPM state when we receive TPM info from the API.
 * Sets reset time to 1 minute from now.
 */
function updateTPMState(tpmInfo) {
  if (!tpmInfo) return;
  tpmState.limit = tpmInfo.limit;
  tpmState.used = tpmInfo.used;
  tpmState.resetTime = Date.now() + 60000; // Reset in 1 minute
  tpmState.lastUpdate = Date.now();
  console.error(`[GROQ_TPM] Updated state — Limit: ${tpmInfo.limit}, Used: ${tpmInfo.used}, Reset in: ~60s`);
}

/**
 * Check if we should wait before sending a request to avoid exceeding TPM.
 * Returns { shouldWait, waitMs } where waitMs is how long to wait (if shouldWait=true).
 */
function checkTPMCapacity(estimatedTokens) {
  if (!tpmState.limit) {
    // Don't know TPM limit yet, proceed cautiously
    return { shouldWait: false, waitMs: 0 };
  }

  const now = Date.now();
  const timeUntilReset = Math.max(0, tpmState.resetTime - now);

  // If TPM counter has reset, reset our tracked usage
  if (timeUntilReset === 0) {
    console.error("[GROQ_TPM] TPM counter reset detected, resetting tracked usage");
    tpmState.used = 0;
    tpmState.resetTime = now + 60000;
  }

  const projectedUsage = tpmState.used + estimatedTokens;
  const available = tpmState.limit - tpmState.used;

  console.error(
    `[GROQ_TPM_CHECK] Limit: ${tpmState.limit}, Currently used: ${tpmState.used}, ` +
    `Estimated: ${estimatedTokens}, Projected: ${projectedUsage}, Available: ${available}`
  );

  if (projectedUsage > tpmState.limit) {
    const overageTokens = projectedUsage - tpmState.limit;
    console.warn(
      `[GROQ_TPM_WAIT] Request would exceed TPM by ${overageTokens} tokens. ` +
      `Waiting ${Math.ceil(timeUntilReset / 1000)}s for TPM reset...`
    );
    return { shouldWait: true, waitMs: timeUntilReset };
  }

  return { shouldWait: false, waitMs: 0 };
}

export async function generateWithGroq({ model, token, iteration, feedback, maxTokens = 6000, taskContext = {} }) {
  const buildPrompt = (feedbackText, trimmed = false) => {
    const lines = [
      "Output ONLY valid JSON with keys: html, css, js (all strings, no markdown fences).",
      "Do not use reasoning or extended thinking. Output JSON immediately.",
      "",
      buildTaskPrompt({ iteration, ...taskContext }),
      "Include diverse elements: header, nav, main, article, section, aside, footer, form, table, lists, media, and text-level tags.",
      "Ensure proper nesting, valid attributes, and WCAG compliance.",
      trimmed ? "Prioritize the top issues without dropping task requirements." : "",
      "",
      `Iteration ${iteration}.`,
    ];
    if (feedbackText) {
      const displayFeedback = trimmed ? feedbackText.substring(0, 500) : feedbackText;
      lines.push(`Issues to fix: ${displayFeedback}`);
    } else {
      lines.push("Create a diverse, accessible HTML page.");
    }
    return lines.filter(Boolean).join("\n");
  };

  let currentPrompt = buildPrompt(feedback, false);

  const systemMessage = "You MUST output ONLY valid JSON. Nothing else. No thinking, no explanations, no reasoning, no planning. Start with { immediately. Output the JSON object with keys: html, css, js (all as strings). Valid JSON only. No markdown fences. No apologies. Just JSON.";

  let currentMessages = [
    { role: "system", content: systemMessage },
    { role: "user", content: currentPrompt }
  ];

  // Debug logging
  console.error("\n" + "=".repeat(80));
  console.error("[GROQ_DEBUG] Iteration:", iteration);
  console.error("[GROQ_DEBUG] Model:", model);
  console.error("[GROQ_DEBUG] System Message:", systemMessage);
  console.error("-".repeat(80));
  console.error("[GROQ_DEBUG] User Prompt (first 500 chars):");
  console.error(currentPrompt.substring(0, 500) + (currentPrompt.length > 500 ? "..." : ""));
  if (feedback) {
    console.error("-".repeat(80));
    console.error("[GROQ_DEBUG] Feedback/Reports Provided (first 2000 chars):");
    console.error(feedback.substring(0, 2000) + (feedback.length > 2000 ? "..." : ""));
  }
  console.error("=".repeat(80) + "\n");

  // Check TPM capacity before sending any request.
  // This proactively prevents 413/429 errors instead of retrying after they occur.
  let currentMaxTokens = maxTokens;
  let estimatedTokens = estimateTokens(currentMessages, currentMaxTokens);
  let { shouldWait, waitMs } = checkTPMCapacity(estimatedTokens);
  
  if (shouldWait) {
    console.error(`[GROQ_TPM] Waiting ${Math.ceil(waitMs / 1000)}s before sending request...`);
    await new Promise(resolve => setTimeout(resolve, waitMs + 1000)); // +1s buffer
  }
  
  // Even after waiting, if we know the TPM limit, ensure estimated request won't exceed it
  if (tpmState.limit && estimatedTokens > tpmState.limit) {
    const availableTokens = tpmState.limit - tpmState.used - 500; // Conservative buffer
    if (availableTokens > 0) {
      const reducedMaxTokens = Math.max(2000, Math.floor(availableTokens));
      console.warn(
        `[GROQ_TPM] Estimated request (${estimatedTokens} tokens) exceeds TPM limit (${tpmState.limit}). ` +
        `Reducing max_tokens from ${currentMaxTokens} to ${reducedMaxTokens}`
      );
      currentMaxTokens = reducedMaxTokens;
      estimatedTokens = estimateTokens(currentMessages, currentMaxTokens);
    }
  }

  // Retry logic for transient Groq API failures (500+ errors only, not rate limits)
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Recheck TPM capacity before each attempt (including retries)
      if (attempt > 1) {
        const retryEstimatedTokens = estimateTokens(currentMessages, currentMaxTokens);
        const retryCheck = checkTPMCapacity(retryEstimatedTokens);
        if (retryCheck.shouldWait) {
          console.error(`[GROQ_TPM] Retry attempt needs to wait ${Math.ceil(retryCheck.waitMs / 1000)}s for TPM reset...`);
          await new Promise(resolve => setTimeout(resolve, retryCheck.waitMs + 1000));
        }
      }
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ model, messages: currentMessages, max_tokens: currentMaxTokens })
      });

      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        const error = `Groq request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`;
        
        // Extract and update TPM info from error (both 413 and 429 include this)
        let tpmInfo = null;
        try {
          const errorObj = JSON.parse(errorBody);
          const errorMessage = errorObj?.error?.message || errorBody;
          tpmInfo = extractTPMInfo(errorMessage);
          if (tpmInfo) {
            updateTPMState(tpmInfo);
          }
        } catch (e) {
          // Couldn't parse error details, continue with error handling
        }

        // For rate limit errors (413, 429), we've already checked TPM before sending.
        // If we still hit a limit, it means Groq has stricter limits or the
        // estimate was off. On retry, use more conservative settings to prevent
        // the model from entering reasoning mode (which triggers token overage).
        if ((response.status === 413 || response.status === 429) && attempt < maxRetries) {
          // For second attempt, use very conservative max_tokens to avoid reasoning mode
          const reducedTokens = Math.max(1500, Math.floor(currentMaxTokens * 0.5));
          console.warn(
            `[GROQ_TPM] Hit ${response.status} despite pre-check. Reducing max_tokens ` +
            `from ${currentMaxTokens} to ${reducedTokens} and trimming feedback for safer retry...`
          );
          currentMaxTokens = reducedTokens;
          
          // Rebuild prompt with trimmed feedback to reduce token pressure
          currentPrompt = buildPrompt(feedback, true);
          currentMessages = [
            { role: "system", content: systemMessage },
            { role: "user", content: currentPrompt }
          ];
          
          // Wait longer to ensure TPM has more room
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        // For other 5xx errors, retry with exponential backoff
        if (attempt < maxRetries && response.status >= 500) {
          const backoff = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
          console.warn(`${error} (attempt ${attempt}/${maxRetries}). Retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
        throw new Error(error);
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      const finishReason = choice?.finish_reason ?? "unknown";
      const messageContent = choice?.message?.content;
      const reasoning = choice?.message?.reasoning;
      
      // If finish_reason is "length" (output truncated), it typically means we asked for too many tokens
      // Don't retry with more tokens as that may hit TPM limits. Instead, continue with what we have.
      if (finishReason === "length" && !messageContent && reasoning && attempt < maxRetries) {
        // Model used reasoning but ran out of tokens for actual output
        console.warn(`[GROQ_REASONING] Model used reasoning (extended thinking) but produced no output content. Finish reason: length. Continuing with partial response...`);
        // Don't retry - attempting to increase tokens will just hit TPM limits again
      }
      
      if (!messageContent) {
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG_ERROR] Groq API returned no content");
        if (reasoning) {
          console.error("[GROQ_DEBUG_ERROR] Model produced reasoning (extended thinking) but no output content");
          console.error("[GROQ_DEBUG_ERROR] Reasoning (first 500 chars):");
          console.error(reasoning.substring(0, 500));
        }
        console.error("[GROQ_DEBUG_ERROR] Full response object (first 1000 chars):");
        console.error(JSON.stringify(payload, null, 2).substring(0, 1000));
        console.error("=".repeat(80) + "\n");
        throw new Error(`Groq response did not include content (finish_reason=${finishReason}, has_reasoning=${!!reasoning}).`);
      }

      // Debug: Log raw API response
      console.error("\n" + "=".repeat(80));
      console.error("[GROQ_DEBUG_RESPONSE] Raw Model Output (first 1500 chars):");
      console.error(messageContent.substring(0, 1500) + (messageContent.length > 1500 ? "\n... [truncated]" : ""));
      console.error("[GROQ_DEBUG_RESPONSE] Total response length:", messageContent.length, "characters");
      console.error("[GROQ_DEBUG_RESPONSE] finish_reason:", finishReason);
      console.error("=".repeat(80) + "\n");

      if (finishReason === "length") {
        console.warn(`Groq response truncated (finish_reason=length, content length=${messageContent.length}). Attempting repair.`);
      }

      if (finishReason === "error") {
        console.warn(`Groq API error (finish_reason=error). Response content length: ${messageContent.length}. This may indicate API overload or model limits. Attempting to parse partial response.`);
      }

      let jsonStr;
      try {
        jsonStr = extractAndRepairJson(messageContent);
        console.error("[GROQ_DEBUG] Successfully extracted JSON (length:", jsonStr.length, "characters)");
      } catch (e) {
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG_ERROR] JSON extraction failed:", e instanceof Error ? e.message : String(e));
        console.error("=".repeat(80) + "\n");
        throw new Error(`Failed to extract JSON from Groq response (finish_reason=${finishReason}): ${e instanceof Error ? e.message : String(e)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
        console.error("[GROQ_DEBUG] Successfully parsed JSON");
        console.error("[GROQ_DEBUG] Parsed keys:", Object.keys(parsed || {}).join(", "));
      } catch (e) {
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG_ERROR] JSON parsing failed:", e instanceof Error ? e.message : String(e));
        console.error("[GROQ_DEBUG_ERROR] Attempted JSON string (first 500 chars):");
        console.error(jsonStr.substring(0, 500));
        console.error("=".repeat(80) + "\n");
        throw new Error(`Failed to parse Groq JSON (finish_reason=${finishReason}, content length=${messageContent.length}): ${e instanceof Error ? e.message : String(e)}`);
      }

      if (parsed?.html == null) {
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG_ERROR] Missing 'html' field in parsed JSON");
        console.error("[GROQ_DEBUG_ERROR] Available fields:", Object.keys(parsed || {}).join(", "));
        console.error("[GROQ_DEBUG_ERROR] Parsed object (first 500 chars):");
        console.error(JSON.stringify(parsed, null, 2).substring(0, 500));
        console.error("=".repeat(80) + "\n");
        const error = new Error(`Groq response JSON missing 'html' field (finish_reason=${finishReason}, content length=${messageContent.length}). Parsed keys: ${Object.keys(parsed || {}).join(", ")}`);
        error.isRetriable = true;
        throw error;
      }

      let css = parsed.css != null ? String(parsed.css) : null;
      let js = parsed.js != null ? String(parsed.js) : null;

      // Model embedded CSS/JS inline in the HTML rather than using separate keys.
      // Extract them from <style> / <script> blocks so the benchmark can continue.
      if (css == null || js == null) {
        const htmlStr = String(parsed.html);
        const missingFields = ["css", "js"].filter(f => parsed?.[f] == null);
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG] Missing fields:", missingFields.join(", "), "— extracting from inline HTML");
        if (css == null) {
          const styleMatches = [...htmlStr.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
          css = styleMatches.map(m => m[1]).join("\n").trim();
          console.error("[GROQ_DEBUG] Extracted CSS from", styleMatches.length, "<style> block(s):", css.length, "chars");
        }
        if (js == null) {
          // Only match inline <script> blocks (skip those with a src= attribute)
          const scriptMatches = [...htmlStr.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)];
          js = scriptMatches.map(m => m[1]).join("\n").trim();
          console.error("[GROQ_DEBUG] Extracted JS from", scriptMatches.length, "inline <script> block(s):", js.length, "chars");
        }
        console.error("=".repeat(80) + "\n");
      }

      console.error("[GROQ_DEBUG] All required fields present, returning parsed content");
      return {
        html: String(parsed.html),
        css,
        js,
        usage: payload?.usage || {}
      };
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRetriable = (error instanceof Error && error.isRetriable) || errorMsg.includes("finish_reason=error") || errorMsg.includes("status 5");

      if (isRetriable) {
        console.warn(`${errorMsg} (attempt ${attempt}/${maxRetries}). Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}
