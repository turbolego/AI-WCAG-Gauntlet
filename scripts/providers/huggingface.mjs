import { extractAndRepairJson } from "../generate-page.mjs";
import { InferenceClient } from "@huggingface/inference";

export async function generateWithHuggingFace({ model, token, iteration, feedback, inferenceProvider }) {
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

  const client = new InferenceClient(token);

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

  const chatOptions = {
    model,
    messages,
    max_tokens: 8000
  };
  if (inferenceProvider) {
    chatOptions.provider = inferenceProvider;
  }
  
  let response;
  try {
    response = await client.chatCompletion(chatOptions);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? (error.cause || error.stack || '') : '';
    throw new Error(
      `Hugging Face API error for model "${model}"${inferenceProvider ? ` (provider: ${inferenceProvider})` : ''}: ${errorMsg}${errorDetails ? ` — ${errorDetails.split('\n')[0]}` : ''}`
    );
  }

  const messageContent = response?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("Hugging Face response did not include content.");
  }

  // Extract the JSON object from the response.  Models may prefix/suffix the
  // JSON with markdown fences, explanatory text, or other noise.  We locate
  // the outermost { … } and repair escape issues inside string values.
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

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
