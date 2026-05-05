
// Support .env for local testing (dotenv is a dev dependency)
try {
  if (process.env.NODE_ENV !== "production") {
    await import("dotenv").then(dotenv => dotenv.config());
  }
} catch (e) {
  // Ignore if dotenv is not installed
}
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InferenceClient } from "@huggingface/inference";

export const REQUIRED_HTML5_TAGS = [
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
// Keeps prompt size bounded while preserving enough context from prior reports.
const MAX_FEEDBACK_CHARS = 2500;

/**
 * Extract the outermost JSON object from a string that may contain leading/
 * trailing non-JSON text, and simultaneously repair common LLM JSON issues
 * *only inside string literals* (not in structural JSON whitespace):
 *   1. Invalid escape sequences (e.g. \' \: \a) — double-escape the backslash.
 *   2. Raw control characters (U+0000–U+001F) — replace with proper escapes.
 *   3. Backticks used as string delimiters (template literals) — convert to quotes.
 */
export function extractAndRepairJson(raw) {
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }

  let result = "";
  let depth = 0;
  let inString = false;
  let stringDelimiter = '"'; // Track whether current string uses " or backtick

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      // Check for end of string (matching delimiter)
      if (ch === stringDelimiter || (stringDelimiter === "`" && ch === "`")) {
        // For backticks: determine if this backtick truly closes the string
        if (ch === "`") {
          let j = i + 1;
          while (j < raw.length && " \t\n\r".includes(raw[j])) j++;
          const after = raw[j];
          if (!(after === undefined || after === "," || after === "}" || after === "]" || after === ":")) {
            // Not a closing backtick, treat as content
            result += "\\`";
            continue;
          }
        }
        // This is the closing delimiter
        inString = false;
        result += '"'; // Always output a quote for JSON
        continue;
      }

      if (ch === "\\") {
        const next = raw[i + 1];
        if (next != null && !'"\\\/bfnrtu'.includes(next)) {
          // Invalid escape sequence — double the backslash so JSON.parse
          // sees a literal backslash followed by the next character.
          result += "\\\\";
          continue;
        }
        // Valid escape — pass through both characters
        result += ch + (next ?? "");
        i++;
        continue;
      }

      // If we're in a backtick string, an embedded quote should be kept as-is
      // (it's literal content in the template literal)
      if (stringDelimiter === "`" && ch === '"') {
        result += '\\"';
        continue;
      }

      // For regular quoted strings, handle embedded quotes
      if (stringDelimiter === '"' && ch === '"') {
        // Determine whether this quote truly ends the string or is an
        // unescaped embedded quote (e.g. HTML attributes like class="foo").
        // A real closing quote is followed (after optional whitespace) by
        // a JSON structural character: , } ] :  or end-of-input.
        let j = i + 1;
        while (j < raw.length && " \t\n\r".includes(raw[j])) j++;
        const after = raw[j];
        if (after === undefined || after === "," || after === "}" || after === "]" || after === ":") {
          inString = false;
          result += ch;
          continue;
        }
        // Otherwise it's an unescaped quote inside the string — escape it
        result += '\\"';
        continue;
      }

      // Raw control character inside a string value
      const code = ch.charCodeAt(0);
      if (code <= 0x1f) {
        if (ch === "\n") { result += "\\n"; continue; }
        if (ch === "\r") { result += "\\r"; continue; }
        if (ch === "\t") { result += "\\t"; continue; }
        result += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
      result += ch;
    } else {
      // Outside a string — structural JSON
      if (ch === '"') {
        inString = true;
        stringDelimiter = '"';
        result += ch;
        continue;
      }
      if (ch === "`") {
        // Backtick used as string delimiter — convert to quote
        inString = true;
        stringDelimiter = "`";
        result += '"';
        continue;
      }
      if (ch === "{") { depth++; result += ch; continue; }
      if (ch === "}") {
        depth--;
        result += ch;
        if (depth === 0) return result;
        continue;
      }
      // Detect unquoted property names (e.g.  html: or css: instead of "html": )
      // and wrap them in double quotes so JSON.parse can handle them.
      if (/[a-zA-Z_$]/.test(ch)) {
        let keyEnd = i + 1;
        while (keyEnd < raw.length && /[\w$]/.test(raw[keyEnd])) keyEnd++;
        let colonPos = keyEnd;
        while (colonPos < raw.length && " \t\n\r".includes(raw[colonPos])) colonPos++;
        if (raw[colonPos] === ":") {
          const key = raw.slice(i, keyEnd);
          result += `"${key}"`;
          i = keyEnd - 1; // for-loop will increment
          continue;
        }
      }
      result += ch;
    }
  }

  // Input ended before braces balanced (truncated response).
  // Close any open string and remaining braces so JSON.parse can succeed.
  if (inString) {
    result += '"';
  }
  while (depth > 0) {
    result += "}";
    depth--;
  }
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value == null) {
      continue;
    }
    args[key.slice(2)] = value;
  }
  return args;
}

export function normalizeModel(modelName) {
  const mapping = {
    "gpt-4.1": "openai/gpt-4.1",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-5": "openai/gpt-5",
    "gpt-5-mini": "openai/gpt-5-mini",
    "gpt-5-nano": "openai/gpt-5-nano",
    "gpt-5-chat": "openai/gpt-5-chat",
    "o3": "openai/o3",
    "o3-mini": "openai/o3-mini",
    "o4-mini": "openai/o4-mini"
  };
  return mapping[modelName] ?? modelName;
}

function defaultPage() {
  return {
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI WCAG Gauntlet</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <header><h1>AI WCAG Gauntlet</h1></header>
  <main id="main-content" tabindex="-1">
    <p id="status" aria-live="polite">Page loaded.</p>
    <button id="action-button" type="button">Run example action</button>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    css: `:root { color-scheme: light dark; }\nbody { font-family: Arial, sans-serif; line-height: 1.5; margin: 0; }\nheader, main { max-width: 60rem; margin: 0 auto; padding: 1rem; }\nbutton { padding: 0.75rem 1rem; }`,
    js: `(() => { const button = document.getElementById("action-button"); const status = document.getElementById("status"); if (!button || !status) return; button.addEventListener("click", () => { status.textContent = "Example action completed."; }); })();`
  };
}

export async function readFeedback(previousDir) {
  if (!previousDir) {
    return "";
  }

  const feedbackParts = [];
  const files = [
    "test_results.json",
    "html5_tags_report.json",
    "w3c_report.json",
    "axe_report.json",
    "pa11y_report.json",
    "qualweb_report.json",
  ];
  for (const filename of files) {
    const fullPath = path.join(previousDir, filename);
    try {
      const content = await fs.readFile(fullPath, "utf8");
      feedbackParts.push(`## ${filename}\n${content.slice(0, MAX_FEEDBACK_CHARS)}`);
    } catch {
      // ignore
    }
  }

  return feedbackParts.join("\n\n");
}

export function buildEndpoints(model, normalizedModel, token, keyToken) {
  const endpoints = [];

  if (token) {
    const copilotEndpoint = {
      name: "copilot-api",
      url: "https://api.githubcopilot.com/chat/completions",
      model,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2023-11-08"
      }
    };

    const modelsEndpoint = {
      name: "models-inference",
      url: "https://models.github.ai/inference/chat/completions",
      model: normalizedModel,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`
      }
    };

    // gpt-4.1, gpt-5 family, and reasoning models are not supported by the Copilot chat API
    // (returns "invalid apiVersion"). Route them directly to the GitHub Models inference API.
    const skipCopilot = /^openai\/(gpt-4\.1|gpt-5|o[134])/.test(normalizedModel);
    if (skipCopilot) {
      endpoints.push(modelsEndpoint);
    } else {
      endpoints.push(copilotEndpoint, modelsEndpoint);
    }
  }

  if (keyToken) {
    endpoints.push({
      name: "azure-models-inference",
      url: "https://models.inference.ai.azure.com/chat/completions",
      model,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${keyToken}`
      }
    });
  }

  return endpoints;
}

async function generateWithHuggingFace({ model, token, iteration, feedback, inferenceProvider }) {
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

async function generateWithModel({ model, normalizedModel, token, keyToken, iteration, feedback }) {
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
  const endpoints = buildEndpoints(model, normalizedModel, token, keyToken);

  // Models that don't support custom temperature (reasoning models and gpt-5 family)
  const noTemperatureModels = /^(o[134]-|gpt-5)/;
  const supportsTemperature = !noTemperatureModels.test(model);

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

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}

async function generateWithOpenRouter({ model, token, iteration, feedback }) {
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

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ model, messages, max_tokens: 8000 })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`OpenRouter request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("OpenRouter response did not include content.");
  }

  const jsonStr = extractAndRepairJson(messageContent);
  const parsed = JSON.parse(jsonStr);
  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    throw new Error("OpenRouter response JSON missing html/css/js fields.");
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}

async function generateWithMistral({ model, token, iteration, feedback }) {
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

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ model, messages, max_tokens: 16384, response_format: { type: "json_object" } })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Mistral request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
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

  const jsonStr = extractAndRepairJson(messageContent);
  const parsed = JSON.parse(jsonStr);
  const missingFields = ["html", "css", "js"].filter(f => parsed?.[f] == null);
  if (missingFields.length > 0) {
    throw new Error(`Mistral response JSON missing fields: ${missingFields.join(", ")} (finish_reason=${finishReason}, content length=${messageContent.length}).`);
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}

async function writePage(outputDir, page) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "index.html"), page.html, "utf8");
  await fs.writeFile(path.join(outputDir, "style.css"), page.css, "utf8");
  await fs.writeFile(path.join(outputDir, "script.js"), page.js, "utf8");
}

async function main() {
  const args = parseArgs(process.argv);
  const modelArg = args.model ?? "gpt-4o";
  const outputDir = args.outputDir;
  const iteration = Number.parseInt(args.iteration ?? "1", 10);
  const previousDir = args.previousDir;
  const provider = args.provider ?? "github";

  if (!outputDir) {
    throw new Error("Missing required argument: --outputDir");
  }

  let generated = defaultPage();
  let generatedByModel = false;
  let modelError = null;
  let resolvedModel = modelArg;

  if (provider === "openrouter") {
    const orToken = process.env.OPENROUTER_TOKEN;
    if (orToken) {
      const feedback = await readFeedback(previousDir);
      try {
        generated = await generateWithOpenRouter({
          model: modelArg,
          token: orToken,
          iteration,
          feedback
        });
        generatedByModel = true;
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
      }
    } else {
      modelError = "No OPENROUTER_TOKEN available for OpenRouter request.";
    }
  } else if (provider === "mistral") {
    const mistralToken = process.env.MISTRAL_TOKEN;
    if (mistralToken) {
      const feedback = await readFeedback(previousDir);
      try {
        generated = await generateWithMistral({
          model: modelArg,
          token: mistralToken,
          iteration,
          feedback
        });
        generatedByModel = true;
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
      }
    } else {
      modelError = "No MISTRAL_TOKEN available for Mistral request.";
    }
  } else if (provider === "llm7") {
    // LLM7 provider: OpenAI-compatible API at https://api.llm7.io/v1
    // Uses process.env.LLM7_TOKEN for authentication
    const llm7Token = process.env.LLM7_TOKEN;
    if (llm7Token) {
      const feedback = await readFeedback(previousDir);
      try {
        // Use OpenAI-compatible API (like generateWithOpenRouter, but with different base_url and token)
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
  } else if (provider === "huggingface" || provider === "groq") {
    const hfToken = provider === "groq"
      ? (process.env.GROQ_TOKEN || process.env.HUGGINGFACE_TOKEN)
      : process.env.HUGGINGFACE_TOKEN;
    if (hfToken) {
      const feedback = await readFeedback(previousDir);
      try {
        generated = await generateWithHuggingFace({
          model: modelArg,
          token: hfToken,
          iteration,
          feedback,
          inferenceProvider: provider === "groq" ? "groq" : undefined
        });
        generatedByModel = true;
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
      }
    } else {
      modelError = provider === "groq"
        ? "No GROQ_TOKEN or HUGGINGFACE_TOKEN available for Groq request."
        : "No HUGGINGFACE_TOKEN available for Hugging Face request.";
    }
  } else if (provider === "opencode") {
    // OpenCode Zen provider: OpenAI-compatible API at https://opencode.ai/zen/v1/chat/completions
    // Uses process.env.OPENCODE_TOKEN for authentication
    // Model list: https://opencode.ai/zen/v1/models (see docs)
    const opencodeToken = process.env.OPENCODE_TOKEN;
    if (opencodeToken) {
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

        const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${opencodeToken}`
          },
          body: JSON.stringify({ model: modelArg, messages, max_tokens: 8000, response_format: { type: "json_object" } })
        });

        if (!response.ok) {
          const errorBody = (await response.text()).trim();
          throw new Error(`OpenCode request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
        }

        const payload = await response.json();
        const messageContent = payload?.choices?.[0]?.message?.content;
        if (!messageContent) {
          throw new Error("OpenCode response did not include content.");
        }

        const jsonStr = extractAndRepairJson(messageContent);
        const parsed = JSON.parse(jsonStr);
        if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
          throw new Error("OpenCode response JSON missing html/css/js fields.");
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
      modelError = "No OPENCODE_TOKEN available for OpenCode request.";
    }
  } else if (provider === "cohere") {
    const cohereToken = process.env.COHERE_TOKEN;
    if (cohereToken) {
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

        const message = `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}`;

        const response = await fetch("https://api.cohere.ai/v1/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${cohereToken}`
          },
          body: JSON.stringify({
            model: modelArg,
            message,
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
          throw new Error("Cohere response did not include text field.");
        }

        let jsonStr;
        try {
          jsonStr = extractAndRepairJson(messageContent);
        } catch (extractError) {
          throw new Error(`Failed to extract JSON from Cohere response: ${extractError instanceof Error ? extractError.message : String(extractError)}. Response preview: ${messageContent.slice(0, 300)}`);
        }

        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (parseError) {
          // If JSON parsing fails, try regex-based extraction as a fallback
          const htmlMatch = messageContent.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const cssMatch = messageContent.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const jsMatch = messageContent.match(/"js"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          
          if (htmlMatch && cssMatch && jsMatch) {
            // Unescape the extracted values
            const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
            parsed = {
              html: unescape(htmlMatch[1]),
              css: unescape(cssMatch[1]),
              js: unescape(jsMatch[1])
            };
          } else {
            throw new Error(`Failed to parse Cohere JSON and regex extraction failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. Attempted to parse: ${jsonStr.slice(0, 300)}`);
          }
        }

        if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
          throw new Error("Cohere response JSON missing html/css/js fields.");
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
      modelError = "No COHERE_TOKEN available for Cohere request.";
    }
  } else {
    const normalizedModel = normalizeModel(modelArg);
    resolvedModel = normalizedModel;
    const token = process.env.GITHUB_TOKEN || process.env.MODELS_TOKEN;
    const keyToken = process.env.KEY_GITHUB_TOKEN;

    if (token || keyToken) {
      const feedback = await readFeedback(previousDir);
      try {
        generated = await generateWithModel({
          model: modelArg,
          normalizedModel,
          token,
          keyToken,
          iteration,
          feedback
        });
        generatedByModel = true;
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
      }
    } else {
      modelError = "No GITHUB_TOKEN, MODELS_TOKEN, or KEY_GITHUB_TOKEN available for model request.";
    }
  }

  await writePage(outputDir, generated);
  await fs.writeFile(
    path.join(outputDir, "generation.json"),
    JSON.stringify(
      {
        requestedModel: modelArg,
        resolvedModel,
        provider,
        generatedByModel,
        generationError: modelError
      },
      null,
      2
    ),
    "utf8"
  );

  if (!generatedByModel) {
    console.warn(`Model generation fallback used: ${modelError}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}