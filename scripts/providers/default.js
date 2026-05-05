import { extractAndRepairJson, REQUIRED_HTML5_TAGS, readFeedback, normalizeModel } from "../generate-page.mjs";

export default async function handleDefault({ modelArg, iteration, previousDir }) {
  const normalizedModel = normalizeModel(modelArg);
  let resolvedModel = normalizedModel;
  const token = process.env.GITHUB_TOKEN || process.env.MODELS_TOKEN;
  const keyToken = process.env.KEY_GITHUB_TOKEN;
  let generatedByModel = false;
  let modelError = null;
  let generated = null;
  if (token || keyToken) {
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
        `- This is iteration ${iteration}.`,
        feedback ? "- Improve based on previous reports provided below." : ""
      ].filter(Boolean).join("\n");

      const messages = [
        {
          role: "system",
          content: "You produce only valid JSON with string fields html, css, js."
        },
        {
          role: "user",
          content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}`
        }
      ];

      // The Copilot API uses the short model name (e.g. "gpt-4o"), while the
      // GitHub Models inference API requires the provider-prefixed name (e.g. "openai/gpt-4o").
      const endpoints = (await import("../generate-page.mjs")).buildEndpoints(modelArg, normalizedModel, token, keyToken);
      const noTemperatureModels = /^(o[134]-|gpt-5)/;
      const supportsTemperature = !noTemperatureModels.test(modelArg);
      const endpointErrors = [];
      let payload = null;
      for (const endpoint of endpoints) {
        const requestBody = {
          model: endpoint.model,
          response_format: { type: "json_object" },
          messages
        };
        if (supportsTemperature) {
          requestBody.temperature = 0.2;
        }
        const body = JSON.stringify(requestBody);
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: endpoint.headers,
          body
        });
        if (response.ok) {
          payload = await response.json();
          break;
        }
        const errorBody = (await response.text()).trim();
        endpointErrors.push(`${endpoint.name} (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
      }
      if (!payload) {
        throw new Error(`Model request failed: ${endpointErrors.join(" | ")}`);
      }
      const messageContent = payload?.choices?.[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Model response did not include content.");
      }
      const repaired = extractAndRepairJson(messageContent);
      const parsed = JSON.parse(repaired);
      if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
        throw new Error("Model response JSON missing html/css/js fields.");
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
    modelError = "No GITHUB_TOKEN, MODELS_TOKEN, or KEY_GITHUB_TOKEN available for model request.";
  }
  return { generated, generatedByModel, modelError, resolvedModel };
}
