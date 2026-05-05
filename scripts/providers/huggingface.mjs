import { InferenceClient } from "@huggingface/inference";
import { parseResponseJson, REQUIRED_HTML5_TAGS } from "../utils.mjs";

export default async function generateWithHuggingFace({ model, token, iteration, feedback, isGroq }) {
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

  const client = new InferenceClient(token);
  const chatOptions = {
    model,
    messages,
    max_tokens: 8000
  };
  if (isGroq) {
    chatOptions.provider = "groq";
  }

  const response = await client.chatCompletion(chatOptions);
  const messageContent = response?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("HuggingFace response did not include content.");
  }

  return parseResponseJson(messageContent);
}
