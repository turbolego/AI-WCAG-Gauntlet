import { parseResponseJson, REQUIRED_HTML5_TAGS } from "../utils.mjs";

export default async function generateWithCohere({ model, token, iteration, feedback }) {
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

  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      message: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}`,
      max_tokens: 8000
    })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Cohere request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.text;
  if (!messageContent) {
    throw new Error("Cohere response did not include text.");
  }

  return parseResponseJson(messageContent);
}
