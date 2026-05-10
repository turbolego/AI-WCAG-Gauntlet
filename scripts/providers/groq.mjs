import { extractAndRepairJson } from "../generate-page.mjs";

/**
 * Extract retry-after delay (in seconds) from Groq rate limit error message.
 * Example: "Please try again in 30.81s" → 30.81
 */
function extractRetryDelay(errorMessage) {
  const match = errorMessage.match(/try again in ([\d.]+)s/i);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract TPM info from rate limit error to help reduce future requests.
 * Returns { limit, used, requested } or null
 */
function extractTPMInfo(errorMessage) {
  const match = errorMessage.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
  if (match) {
    return {
      limit: parseInt(match[1], 10),
      used: parseInt(match[2], 10),
      requested: parseInt(match[3], 10)
    };
  }
  return null;
}

export async function generateWithGroq({ model, token, iteration, feedback, maxTokens = 4000 }) {
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

  const prompt = [
    "Create an accessibility-focused single-page web app output as strict JSON with keys: html, css, js.",
    "Requirements:",
    "- Use every required HTML5 tag at least once in the generated HTML.",
    "- Required tags:",
    REQUIRED_HTML5_TAGS.join(", "),
    "- Keep the page valid and as accessible as possible (labels, landmarks, alt text, headings order, contrast-safe defaults, keyboard-usable controls).",
    "- Do not include markdown fences or explanations.",
    "- Output ONLY the raw JSON object, no markdown code fences.",
    `- This is iteration ${iteration}.`,
    feedback ? "- Improve based on previous reports provided below." : ""
  ].filter(Boolean).join("\n");

  const systemMessage = "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences.";

  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];

  // Debug logging
  console.error("\n" + "=".repeat(80));
  console.error("[GROQ_DEBUG] Iteration:", iteration);
  console.error("[GROQ_DEBUG] Model:", model);
  console.error("[GROQ_DEBUG] System Message:", systemMessage);
  console.error("-".repeat(80));
  console.error("[GROQ_DEBUG] User Prompt (first 500 chars):");
  console.error(prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""));
  if (feedback) {
    console.error("-".repeat(80));
    console.error("[GROQ_DEBUG] Feedback/Reports Provided (first 2000 chars):");
    console.error(feedback.substring(0, 2000) + (feedback.length > 2000 ? "..." : ""));
  }
  console.error("=".repeat(80) + "\n");

  // Retry logic for transient Groq API failures and rate limits
  const maxRetries = 3;
  let currentMaxTokens = maxTokens;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ model, messages, max_tokens: currentMaxTokens })
      });

      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        const error = `Groq request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`;
        
        // Handle 429 rate limit errors specifically
        if (response.status === 429) {
          let retryDelay = 5; // Default 5 second backoff
          let tpmInfo = null;
          
          try {
            const errorObj = JSON.parse(errorBody);
            const errorMessage = errorObj?.error?.message || errorBody;
            
            // Try to extract suggested retry delay
            const suggestedDelay = extractRetryDelay(errorMessage);
            if (suggestedDelay) {
              retryDelay = Math.ceil(suggestedDelay + 1); // Add 1s buffer
              console.warn(`[GROQ_RATE_LIMIT] API suggests waiting ${suggestedDelay}s, using ${retryDelay}s`);
            }
            
            // Extract TPM info to reduce max_tokens on retry
            tpmInfo = extractTPMInfo(errorMessage);
            if (tpmInfo) {
              const remaining = tpmInfo.limit - tpmInfo.used;
              const reducedTokens = Math.max(1000, Math.floor(remaining * 0.8)); // Use 80% of remaining
              console.warn(`[GROQ_RATE_LIMIT] TPM: Limit=${tpmInfo.limit}, Used=${tpmInfo.used}, Requested=${tpmInfo.requested}`);
              console.warn(`[GROQ_RATE_LIMIT] Reducing max_tokens from ${currentMaxTokens} to ${reducedTokens}`);
              currentMaxTokens = reducedTokens;
            }
          } catch (e) {
            console.warn(`[GROQ_RATE_LIMIT] Could not parse error details: ${e instanceof Error ? e.message : String(e)}`);
          }
          
          if (attempt < maxRetries) {
            console.warn(`Rate limit hit (attempt ${attempt}/${maxRetries}). Waiting ${retryDelay}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
            continue;
          }
        }
        
        // For other 5xx errors, retry with backoff
        if (attempt < maxRetries && response.status >= 500) {
          const backoff = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
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
      if (!messageContent) {
        console.error("\n" + "=".repeat(80));
        console.error("[GROQ_DEBUG_ERROR] Groq API returned no content");
        console.error("[GROQ_DEBUG_ERROR] Full response object (first 1000 chars):");
        console.error(JSON.stringify(payload, null, 2).substring(0, 1000));
        console.error("=".repeat(80) + "\n");
        throw new Error(`Groq response did not include content (finish_reason=${finishReason}).`);
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
