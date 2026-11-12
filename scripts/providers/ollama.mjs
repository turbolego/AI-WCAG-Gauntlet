import { extractAndRepairJson } from "../generate-page.mjs";

/**
 * Ollama provider — runs the gauntlet against a local (or remote) Ollama
 * server through its OpenAI-compatible API.
 *
 *   OLLAMA_BASE_URL   default http://127.0.0.1:11434
 *                     (use e.g. http://100.x.y.z:11434 for Tailscale)
 *   OLLAMA_TIMEOUT_MS default 600000 (10 min — small models on CPU are slow)
 *
 * Model names are Ollama tags, e.g.:
 *   qwen3.5:0.8b                                              (base)
 *   turbolego/qwen3.5-0.8b-wcag-gauntlet-lora-q4_k_m         (fused LoRA)
 *
 * No authentication — this is a local inference endpoint.
 */

// NOTE: tag list duplicated from the other providers; dedupe to
// resources/html_tags.json when AI-WCAG-Gauntlet#77 G4 lands.
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

export function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

/**
 * Generate the page JSON via Ollama's OpenAI-compatible chat endpoint.
 * Same contract as the other providers: returns { html, css, js, usage }.
 */
export async function generateWithOllama({ model, iteration, feedback, maxTokens }) {
  const baseUrl = getOllamaBaseUrl();
  const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || "600000", 10);

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        stream: false,
        ...(maxTokens ? { max_tokens: maxTokens } : {})
      }),
      signal: controller.signal
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Ollama request to ${baseUrl}/v1/chat/completions failed: ${msg}. ` +
      `Is \`ollama serve\` running and is the model pulled (\`ollama pull ${model}\`)?`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Ollama request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("Ollama response did not include content.");
  }

  const jsonStr = extractAndRepairJson(messageContent);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`Ollama response was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  if (typeof parsed?.html !== "string") {
    throw new Error("Ollama JSON response is missing the html string field.");
  }

  return {
    html: parsed.html,
    css: typeof parsed.css === "string" ? parsed.css : "",
    js: typeof parsed.js === "string" ? parsed.js : "",
    usage: payload?.usage ?? null,
    rawModel: payload?.model ?? model
  };
}
