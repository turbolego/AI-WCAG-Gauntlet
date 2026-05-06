import { parseResponseJson, extractAndRepairJson } from "../utils.mjs";
import { readFeedback } from "../utils.mjs";
import { SYSTEM_PROMPT, buildUserPrompt, extractFeedbackSummary } from "../common-prompt.mjs";

export default async function generateWithCloudflare({ model, token, accountId, iteration, feedback }) {
  if (!token || !accountId) {
    throw new Error("Missing CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID.");
  }

  // Debug: log what feedback we received
  if (feedback) {
    const hasHtml5 = feedback.includes('html5_tags_report');
    const hasAxe = feedback.includes('axe_report');
    const hasPa11y = feedback.includes('pa11y_report');
    const hasQualweb = feedback.includes('qualweb_report');
    console.log(`[Cloudflare] Feedback received: ${feedback.length} chars - html5:${hasHtml5} axe:${hasAxe} pa11y:${hasPa11y} qualweb:${hasQualweb}`);
  } else {
    console.log(`[Cloudflare] No feedback provided (iteration ${iteration})`);
  }

  // Cloudflare: provide complete valid JSON example, ask to output it
  const feedbackSummary = extractFeedbackSummary(feedback);
  const userPrompt = feedbackSummary
    ? `Return JSON with improved html/css/js: ${feedbackSummary}`
    : `Return this JSON:{"html":"<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Page</title></head><body><header><h1>Header</h1></header><main><p>Main</p><button>Button</button><form><label for=\"i\">Label</label><input id=\"i\" type=\"text\"></form></main><footer>Footer</footer></body></html>","css":"body{font-family:Arial,sans-serif;margin:0;padding:20px}header,footer{background:#f0f0f0;padding:10px}button{padding:10px 20px;cursor:pointer}input{padding:8px}","js":"document.querySelector('button').addEventListener('click',function(){alert('clicked');});"}`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  console.log(`[Cloudflare] Sending message to model (system + user combined): ${SYSTEM_PROMPT.length + userPrompt.length} total chars`);

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ messages, max_tokens: 4000 })
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
  // Try reasoning_content field first (some models output here)
  if (!messageContent && payload?.result?.choices?.[0]?.message?.reasoning_content) {
    messageContent = payload.result.choices[0].message.reasoning_content;
  }
  // Try OpenAI-style format (choices array)
  if (!messageContent && payload?.result?.choices?.[0]?.message?.content) {
    messageContent = payload.result.choices[0].message?.content;
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
    // Try to find and extract JSON object from response
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return parseResponseJson(jsonMatch[0]);
      } catch (e) {
        // If still invalid, continue to regex fallback
      }
    }

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
