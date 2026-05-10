import { extractAndRepairJson } from "../generate-page.mjs";
import { InferenceClient } from "@huggingface/inference";

export async function generateWithHuggingFace({ model, token, iteration, feedback, inferenceProvider }) {
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

  const client = new InferenceClient(token);

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
  const userMessage = `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}`;
  
  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ];

  // Debug logging
  console.error("\n" + "=".repeat(80));
  console.error("[HF_DEBUG] Iteration:", iteration);
  console.error("[HF_DEBUG] Model:", model);
  console.error("[HF_DEBUG] Inference Provider:", inferenceProvider || "default");
  console.error("[HF_DEBUG] System Message:", systemMessage);
  console.error("-".repeat(80));
  console.error("[HF_DEBUG] User Prompt (first 500 chars):");
  console.error(prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""));
  if (feedback) {
    console.error("-".repeat(80));
    console.error("[HF_DEBUG] Feedback/Reports Provided (first 2000 chars):");
    console.error(feedback.substring(0, 2000) + (feedback.length > 2000 ? "..." : ""));
  }
  console.error("=".repeat(80) + "\n");

  const chatOptions = {
    model,
    messages,
    max_tokens: 8000
  };
  if (inferenceProvider) {
    chatOptions.provider = inferenceProvider;
  }
  
  let response;
  try {
    response = await client.chatCompletion(chatOptions);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? (error.cause || error.stack || '') : '';
    throw new Error(
      `Hugging Face API error for model "${model}"${inferenceProvider ? ` (provider: ${inferenceProvider})` : ''}: ${errorMsg}${errorDetails ? ` — ${errorDetails.split('\n')[0]}` : ''}`
    );
  }

  const messageContent = response?.choices?.[0]?.message?.content;
  if (!messageContent) {
    console.error("\n" + "=".repeat(80));
    console.error("[HF_DEBUG_ERROR] Hugging Face API returned no content");
    console.error("[HF_DEBUG_ERROR] Full response object (first 1000 chars):");
    console.error(JSON.stringify(response, null, 2).substring(0, 1000));
    console.error("=".repeat(80) + "\n");
    throw new Error("Hugging Face response did not include content.");
  }

  // Debug: Log raw API response
  console.error("\n" + "=".repeat(80));
  console.error("[HF_DEBUG_RESPONSE] Raw Model Output (first 1500 chars):");
  console.error(messageContent.substring(0, 1500) + (messageContent.length > 1500 ? "\n... [truncated]" : ""));
  console.error("[HF_DEBUG_RESPONSE] Total response length:", messageContent.length, "characters");
  console.error("=".repeat(80) + "\n");

  // Extract the JSON object from the response.  Models may prefix/suffix the
  // JSON with markdown fences, explanatory text, or other noise.  We locate
  // the outermost { … } and repair escape issues inside string values.
  let jsonStr;
  try {
    jsonStr = extractAndRepairJson(messageContent);
    console.error("[HF_DEBUG] Successfully extracted JSON (length:", jsonStr.length, "characters)");
  } catch (error) {
    // fallback to regex extraction if needed
    const extractError = error instanceof Error ? error.message : String(error);
    console.error("\n" + "=".repeat(80));
    console.error("[HF_DEBUG_ERROR] JSON extraction failed:", extractError);
    console.error("[HF_DEBUG_ERROR] Attempting regex fallback...");
    
    // Try to find valid JSON structures in the response
    const htmlMatch = messageContent.match(/"html"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"html"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    const cssMatch = messageContent.match(/"css"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"css"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    const jsMatch = messageContent.match(/"js"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"js"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    
    console.error("[HF_DEBUG_ERROR] Regex matches - html:", htmlMatch.length > 0 ? "found" : "not found", 
                  ", css:", cssMatch.length > 0 ? "found" : "not found",
                  ", js:", jsMatch.length > 0 ? "found" : "not found");
    
    if (htmlMatch && cssMatch && jsMatch) {
      console.error("[HF_DEBUG_ERROR] Regex fallback successful, using extracted fields");
      console.error("=".repeat(80) + "\n");
      return {
        html: htmlMatch[1] || htmlMatch[0] || "<h1>Error</h1>",
        css: cssMatch[1] || cssMatch[0] || "body{font-family:sans-serif}",
        js: jsMatch[1] || jsMatch[0] || ""
      };
    }
    console.error("[HF_DEBUG_ERROR] Regex fallback also failed");
    console.error("=".repeat(80) + "\n");
    throw new Error(`Failed to extract JSON from Hugging Face response: ${extractError}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
    console.error("[HF_DEBUG] Successfully parsed JSON");
    console.error("[HF_DEBUG] Parsed keys:", Object.keys(parsed || {}).join(", "));
  } catch (error) {
    // fallback to regex extraction if needed
    const parseError = error instanceof Error ? error.message : String(error);
    console.error("\n" + "=".repeat(80));
    console.error("[HF_DEBUG_ERROR] JSON parsing failed:", parseError);
    console.error("[HF_DEBUG_ERROR] Attempted JSON string (first 500 chars):");
    console.error(jsonStr.substring(0, 500));
    console.error("[HF_DEBUG_ERROR] Attempting regex fallback...");
    
    const htmlMatch = messageContent.match(/"html"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"html"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    const cssMatch = messageContent.match(/"css"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"css"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    const jsMatch = messageContent.match(/"js"\s*:\s*"([^\"]*(?:\\.[^\"]*)*)"/) || messageContent.match(/"js"\s*:\s*"([^\"]*(?:\\"[^"]*)*)"/) || [];
    
    console.error("[HF_DEBUG_ERROR] Regex matches - html:", htmlMatch.length > 0 ? "found" : "not found",
                  ", css:", cssMatch.length > 0 ? "found" : "not found",
                  ", js:", jsMatch.length > 0 ? "found" : "not found");
    
    if (htmlMatch && cssMatch && jsMatch) {
      console.error("[HF_DEBUG_ERROR] Regex fallback successful, using extracted fields");
      console.error("=".repeat(80) + "\n");
      return {
        html: htmlMatch[1] || htmlMatch[0] || "<h1>Error</h1>",
        css: cssMatch[1] || cssMatch[0] || "body{font-family:sans-serif}",
        js: jsMatch[1] || jsMatch[0] || ""
      };
    }
    console.error("[HF_DEBUG_ERROR] Regex fallback also failed");
    console.error("=".repeat(80) + "\n");
    throw new Error(`Failed to parse Hugging Face JSON: ${parseError}. Attempted to parse: ${jsonStr.slice(0, 200)}`);
  }

  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    const missingFields = ["html", "css", "js"].filter(f => parsed?.[f] == null);
    console.error("\n" + "=".repeat(80));
    console.error("[HF_DEBUG_ERROR] Missing required fields in parsed JSON");
    console.error("[HF_DEBUG_ERROR] Missing fields:", missingFields.join(", "));
    console.error("[HF_DEBUG_ERROR] Available fields:", Object.keys(parsed || {}).join(", "));
    console.error("[HF_DEBUG_ERROR] Parsed object (first 500 chars):");
    console.error(JSON.stringify(parsed, null, 2).substring(0, 500));
    console.error("=".repeat(80) + "\n");
    throw new Error(`Hugging Face response JSON missing fields: ${missingFields.join(", ")}. Parsed keys: ${Object.keys(parsed || {}).join(", ")}`);
  }

  console.error("[HF_DEBUG] All required fields present, returning parsed content");
  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
