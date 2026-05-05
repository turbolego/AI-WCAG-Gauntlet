import { extractAndRepairJson, REQUIRED_HTML5_TAGS, readFeedback } from "../generate-page.mjs";

export default async function handleLLM7({ modelArg, iteration, previousDir }) {
  const llm7Token = process.env.LLM7_TOKEN;
  let generatedByModel = false;
  let modelError = null;
  let generated = null;
  if (llm7Token) {
    const feedback = await readFeedback(previousDir);
    try {
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

      const response = await fetch("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${llm7Token}`
        },
        body: JSON.stringify({ model: modelArg, messages, max_tokens: 8000, response_format: { type: "json_object" } })
      });

      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        throw new Error(`LLM7 request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
      }

      const payload = await response.json();
      const messageContent = payload?.choices?.[0]?.message?.content;
      if (!messageContent) {
        throw new Error("LLM7 response did not include content.");
      }

      const jsonStr = extractAndRepairJson(messageContent);
      const parsed = JSON.parse(jsonStr);
      if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
        throw new Error("LLM7 response JSON missing html/css/js fields.");
      }

      generated = {
        html: String(parsed.html),
        css: String(parsed.css),
        js: String(parsed.js)
      };
      generatedByModel = true;
    } catch (error) {
      modelError = error instanceof Error ? error.message : String(error);
    }
  } else {
    modelError = "No LLM7_TOKEN available for LLM7 request.";
  }
  return { generated, generatedByModel, modelError };
}
