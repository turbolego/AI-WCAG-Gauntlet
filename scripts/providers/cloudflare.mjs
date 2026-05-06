import { parseResponseJson, extractAndRepairJson } from "../utils.mjs";
import { readFeedback } from "../utils.mjs";

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

  // Ultra-minimal prompt for Cloudflare small models
  const systemPrompt = `You are a JSON generator. ALWAYS output ONLY valid JSON with no text before or after. Never explain, never comment, never output markdown. Just JSON.`;
  
  const userPrompt = feedback
    ? `Generate a JSON object with fields: html, css, js. The html must be a complete, accessible HTML5 page with header, main, footer, button, form, input using semantic tags and labels. Iteration ${iteration}.\n\nPrior test failures:\n${feedback}\n\nOutput ONLY valid JSON, nothing else:`
    : `Generate a JSON object with fields: html, css, js. The html must be a complete, accessible HTML5 page with header, main, footer, button, form, input using semantic tags and labels. Iteration ${iteration}. Output ONLY valid JSON:`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  // Debug: log what the model will receive
  console.log(`[Cloudflare] Sending message to model (system + user combined): ${prompt.length + (feedback ? feedback.length : 0)} total chars`);

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
