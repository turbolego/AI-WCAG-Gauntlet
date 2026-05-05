import { extractAndRepairJson, REQUIRED_HTML5_TAGS, readFeedback } from "../generate-page.mjs";

export default async function handleHuggingFace({ modelArg, iteration, previousDir, provider }) {
  const hfToken = provider === "groq"
    ? (process.env.GROQ_TOKEN || process.env.HUGGINGFACE_TOKEN)
    : process.env.HUGGINGFACE_TOKEN;
  let generatedByModel = false;
  let modelError = null;
  let generated = null;
  if (hfToken) {
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
        `- This is iteration ${iteration}.",
        feedback ? "- Improve based on previous reports provided below." : ""
      ].filter(Boolean).join("\n");

      const messages = [
        { role: "system", content: "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences." },
        { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
      ];

      const InferenceClient = (await import("@huggingface/inference")).InferenceClient;
      const client = new InferenceClient(hfToken);
      const chatOptions = {
        model: modelArg,
        messages,
        max_tokens: 8000
      };
      if (provider === "groq") {
        chatOptions.provider = "groq";
      }
      let response;
      try {
        response = await client.chatCompletion(chatOptions);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error ? (error.cause || error.stack || '') : '';
        throw new Error(
          `Hugging Face API error for model "${modelArg}"${provider === "groq" ? ` (provider: groq)` : ''}: ${errorMsg}${errorDetails ? ` — ${errorDetails.split('\n')[0]}` : ''}`
        );
      }
      const messageContent = response?.choices?.[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Hugging Face response did not include content.");
      }
      let jsonStr;
      try {
        jsonStr = extractAndRepairJson(messageContent);
      } catch (error) {
        throw new Error(`Failed to extract JSON from Hugging Face response: ${error instanceof Error ? error.message : String(error)}`);
      }
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (error) {
        throw new Error(`Failed to parse Hugging Face JSON: ${error instanceof Error ? error.message : String(error)}. Attempted to parse: ${jsonStr.slice(0, 200)}`);
      }
      if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
        const missingFields = ["html", "css", "js"].filter(f => parsed?.[f] == null);
        throw new Error(`Hugging Face response JSON missing fields: ${missingFields.join(", ")}. Parsed keys: ${Object.keys(parsed || {}).join(", ")}`);
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
    modelError = provider === "groq"
      ? "No GROQ_TOKEN or HUGGINGFACE_TOKEN available for Groq request."
      : "No HUGGINGFACE_TOKEN available for Hugging Face request.";
  }
  return { generated, generatedByModel, modelError };
}
