import { buildTaskPrompt } from "../benchmark-task.mjs";
import { extractAndRepairJson } from "../generate-page.mjs";

export async function generateWithCloudflare({ model, token, accountId, iteration, feedback, taskContext = {} }) {

  const prompt = buildTaskPrompt({ iteration, ...taskContext });

  const messages = [
    { role: "system", content: "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences." },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ model, messages, max_tokens: 8000 })
    }
  );

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Cloudflare request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.result?.response || payload?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("Cloudflare response did not include content.");
  }

  const repaired = extractAndRepairJson(messageContent);
  const parsed = JSON.parse(repaired);
  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    throw new Error("Cloudflare response JSON missing html/css/js fields.");
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
