import { parseResponseJson, REQUIRED_HTML5_TAGS } from "../utils.mjs";

export default async function generateWithCloudflare({ model, token, accountId, iteration, feedback }) {
  if (!token || !accountId) {
    throw new Error("Missing CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID.");
  }

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

  const messages = [
    { role: "system", content: "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences." },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ messages, max_tokens: 8000 })
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
  if (!messageContent) {
    throw new Error("Cloudflare response did not include content.");
  }

  return parseResponseJson(messageContent);
}
