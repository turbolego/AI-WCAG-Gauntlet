import { extractAndRepairJson } from "../generate-page.mjs";

export async function generateWithMistral({ model, token, iteration, feedback }) {
  const REQUIRED_HTML5_TAGS = [
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo", "blockquote",
    "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd",
    "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure",
    "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i",
    "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu",
    "meta", "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture",
    "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "search", "section", "select", "slot",
    "small", "source", "span", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template",
    "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr"
  ];

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

  // Retry logic for transient Mistral API failures
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ model, messages, max_tokens: 24576, response_format: { type: "json_object" } })
      });

      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        const error = `Mistral request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`;
        if (attempt < maxRetries && response.status >= 500) {
          console.warn(`${error} (attempt ${attempt}/${maxRetries}). Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue;
        }
        throw new Error(error);
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      const finishReason = choice?.finish_reason ?? "unknown";
      const messageContent = choice?.message?.content;
      if (!messageContent) {
        throw new Error(`Mistral response did not include content (finish_reason=${finishReason}).`);
      }

      if (finishReason === "length") {
        console.warn(`Mistral response truncated (finish_reason=length, content length=${messageContent.length}). Attempting repair.`);
      }
      
      if (finishReason === "error") {
        console.warn(`Mistral API error (finish_reason=error). Response content length: ${messageContent.length}. This may indicate API overload or model limits. Attempting to parse partial response.`);
      }

      let jsonStr;
      try {
        jsonStr = extractAndRepairJson(messageContent);
      } catch (e) {
        throw new Error(`Failed to extract JSON from Mistral response (finish_reason=${finishReason}): ${e instanceof Error ? e.message : String(e)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Failed to parse Mistral JSON (finish_reason=${finishReason}, content length=${messageContent.length}): ${e instanceof Error ? e.message : String(e)}`);
      }

      const missingFields = ["html", "css", "js"].filter(f => parsed?.[f] == null);
      if (missingFields.length > 0) {
        const error = new Error(`Mistral response JSON missing fields: ${missingFields.join(", ")} (finish_reason=${finishReason}, content length=${messageContent.length}). This may occur when the model context is too large or API is overloaded.`);
        error.isRetriable = true; // Mark as retriable for finish_reason=stop cases
        throw error;
      }

      return {
        html: String(parsed.html),
        css: String(parsed.css),
        js: String(parsed.js)
      };
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRetriable = (error instanceof Error && error.isRetriable) || errorMsg.includes("finish_reason=error") || errorMsg.includes("status 5");
      
      if (isRetriable) {
        console.warn(`${errorMsg} (attempt ${attempt}/${maxRetries}). Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        continue;
      }
      throw error;
    }
  }
}
