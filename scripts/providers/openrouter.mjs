import { buildTaskPrompt } from "../benchmark-task.mjs";
import { extractAndRepairJson } from "../generate-page.mjs";

export async function generateWithOpenRouter({ model, token, iteration, feedback, taskContext = {} }) {

  const prompt = buildTaskPrompt({ iteration, ...taskContext });

  const messages = [
    { role: "system", content: "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences." },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ model, messages, max_tokens: 8000 })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`OpenRouter request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("OpenRouter response did not include content.");
  }

  // Debug: Log first 500 chars of response for inspection
  const responsePreview = messageContent.substring(0, 500);
  console.error(`[DEBUG] OpenRouter raw response (first 500 chars): ${responsePreview}`);

  let jsonStr;
  try {
    jsonStr = extractAndRepairJson(messageContent);
  } catch (extractError) {
    console.error(`[DEBUG] JSON extraction failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
    throw new Error(`JSON extraction failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error(`[DEBUG] JSON parse failed. Attempting to extract manually...`);
    console.error(`[DEBUG] Extracted JSON (first 1000 chars): ${jsonStr.substring(0, 1000)}`);
    
    // Try to find valid JSON structures in the response
    const htmlMatch = messageContent.match(/"html"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/) || messageContent.match(/"html"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/) || [];
    const cssMatch = messageContent.match(/"css"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/) || messageContent.match(/"css"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/) || [];
    const jsMatch = messageContent.match(/"js"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/) || messageContent.match(/"js"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/) || [];
    
    if (htmlMatch && cssMatch && jsMatch) {
      console.error(`[DEBUG] Successfully extracted fallback fields via regex`);
      return {
        html: htmlMatch[1] || htmlMatch[0] || "<h1>Error</h1>",
        css: cssMatch[1] || cssMatch[0] || "body{font-family:sans-serif}",
        js: jsMatch[1] || jsMatch[0] || ""
      };
    }
    
    throw new Error(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    throw new Error("OpenRouter response JSON missing html/css/js fields.");
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
