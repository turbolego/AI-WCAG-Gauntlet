import { parseResponseJson, extractAndRepairJson } from "../utils.mjs";

export default async function generateWithCloudflare({ model, token, accountId, iteration, feedback }) {
  if (!token || !accountId) {
    throw new Error("Missing CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID.");
  }

  // Ultra-minimal prompt for Cloudflare small models
  const prompt = `Output ONLY a JSON object with three string fields: html, css, js. 
html: a complete accessible HTML page with header, main, footer, button, form, and input.
css: basic styles for the page.
js: event handler for button clicks.
Must use valid HTML5 tags and be accessible (labels, semantic HTML, keyboard support).
Iteration ${iteration}. NO MARKDOWN, NO EXPLANATIONS, ONLY JSON.`;

  const messages = [
    { role: "system", content: "Output only valid JSON." },
    { role: "user", content: prompt }
  ];

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ messages, max_tokens: 2000 })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Cloudflare request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  let messageContent = payload?.result?.response;
  if (!messageContent && typeof payload?.result === "string") {
    messageContent = payload.result;
  }
  // Try reasoning field if content is null (some models use this)
  if (!messageContent && payload?.result?.choices?.[0]?.message?.reasoning) {
    messageContent = payload.result.choices[0].message.reasoning;
  }
  if (!messageContent) {
    throw new Error(`Cloudflare response did not include content. Payload: ${JSON.stringify(payload).slice(0, 500)}`);
  }

  // Extract and repair JSON with lenient fallback
  try {
    // First try standard repair/parse
    return parseResponseJson(messageContent);
  } catch (parseError) {
    // Lenient regex fallback for malformed JSON
    const htmlMatch = messageContent.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const cssMatch = messageContent.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const jsMatch = messageContent.match(/"js"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    
    if (htmlMatch && cssMatch && jsMatch) {
      const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      return {
        html: unescape(htmlMatch[1]),
        css: unescape(cssMatch[1]),
        js: unescape(jsMatch[1])
      };
    }

    // Throw detailed error
    throw new Error(
      `Cloudflare response parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
      `Response: ${messageContent.slice(0, 300)}`
    );
  }
}
