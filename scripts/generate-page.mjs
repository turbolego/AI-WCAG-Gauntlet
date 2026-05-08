import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InferenceClient } from "@huggingface/inference";
import { generateWithMistral } from "./providers/mistral.mjs";
import { generateWithOpenRouter } from "./providers/openrouter.mjs";
import { generateWithCohere } from "./providers/cohere.mjs";
import { generateWithCloudflare } from "./providers/cloudflare.mjs";
import { generateWithAlibaba } from "./providers/alibaba.mjs";
import { generateWithHuggingFace } from "./providers/huggingface.mjs";
import { generateWithModel, buildEndpoints } from "./providers/github.mjs";

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
// Keeps prompt size bounded while preserving enough context from prior reports.
// Reduced to allow more room for model output (especially for Mistral which has strict token limits).
const MAX_FEEDBACK_CHARS = 1500;

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

/**
 * Write AI input/output logs to the logs directory for debugging and token usage analysis.
 */
async function logProviderInteraction(outputDir, iteration, messageType, data) {
  try {
    const logDir = path.join(outputDir, "logs");
    await fs.mkdir(logDir, { recursive: true });
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = `${messageType}_${timestamp}_iteration_${iteration}.json`;
    const logPath = path.join(logDir, filename);
    await fs.writeFile(logPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    // Non-fatal: log errors don't abort the benchmark
    console.warn(`Failed to write ${messageType} log: ${error instanceof Error ? error.message : String(error)}`);
  }
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

async function readFeedback(previousDir) {
  if (!previousDir) {
    return "";
  }

  try {
    // Read test results to get latest iteration's metrics
    const testResultsPath = path.join(previousDir, "test_results.json");
    const testResults = await fs.readFile(testResultsPath, "utf8");
    const results = JSON.parse(testResults);
    
    if (!Array.isArray(results) || results.length === 0) {
      return "";
    }

    // Only use latest iteration to prevent context bloat
    const latest = results[results.length - 1];
    
    // Extract key metrics for the model to learn from
    const feedbackParts = [];
    
    // Show score progression (help model see if it's improving)
    if (results.length > 1) {
      const scores = results.map(r => `${r.iteration}:${r.score}`).join(", ");
      feedbackParts.push(`Score progression: ${scores}`);
    }
    
    // Current iteration metrics
    feedbackParts.push(`Current iteration ${latest.iteration}:`);
    feedbackParts.push(`  Score: ${latest.score}/100`);
    
    if (latest.html_tag_errors > 0) {
      feedbackParts.push(`  Missing HTML5 tags: ${latest.html_tag_errors}`);
      if (latest.missing_tags && Array.isArray(latest.missing_tags)) {
        const tags = latest.missing_tags.slice(0, 15).join(", ");
        feedbackParts.push(`  Add these tags: ${tags}`);
      }
    }
    
    if (latest.w3c_errors > 0) {
      feedbackParts.push(`  W3C HTML validation errors: ${latest.w3c_errors}`);
    }
    
    if (latest.axe_violations > 0) {
      feedbackParts.push(`  Accessibility violations (axe): ${latest.axe_violations}`);
    }
    
    if (latest.pa11y_issues > 0) {
      feedbackParts.push(`  Accessibility issues (pa11y): ${latest.pa11y_issues}`);
    }
    
    return feedbackParts.join("\n");
  } catch {
    // Fallback to raw file reading if parsing fails
    const feedbackParts = [];
    const files = [
      "test_results.json",
      "html5_tags_report.json",
      "w3c_report.json",
      "axe_report.json",
      "pa11y_report.json",
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
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "openrouter",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithOpenRouter({
          model: modelArg,
          token: orToken,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "openrouter",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "openrouter",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = "No OPENROUTER_TOKEN available for OpenRouter request.";
    }
  } else if (provider === "mistral") {
    const mistralToken = process.env.MISTRAL_TOKEN;
    if (mistralToken) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "mistral",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithMistral({
          model: modelArg,
          token: mistralToken,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "mistral",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "mistral",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = "No MISTRAL_TOKEN available for Mistral request.";
    }
  } else if (provider === "cohere") {
    const cohereToken = process.env.COHERE_TOKEN;
    if (cohereToken) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "cohere",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithCohere({
          model: modelArg,
          token: cohereToken,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "cohere",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "cohere",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = "No COHERE_TOKEN available for Cohere request.";
    }
  } else if (provider === "cloudflare") {
    const cloudflareToken = process.env.CLOUDFLARE_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (cloudflareToken && accountId) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "cloudflare",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithCloudflare({
          model: modelArg,
          token: cloudflareToken,
          accountId,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "cloudflare",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "cloudflare",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = cloudflareToken ? "No CLOUDFLARE_ACCOUNT_ID available for Cloudflare request." : "No CLOUDFLARE_TOKEN available for Cloudflare request.";
    }
  } else if (provider === "alibaba") {
    const alibabaToken = process.env.ALIBABA_TOKEN;
    if (alibabaToken) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "alibaba",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithAlibaba({
          model: modelArg,
          token: alibabaToken,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "alibaba",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "alibaba",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = "No ALIBABA_TOKEN available for Alibaba DashScope request.";
    }
  } else if (provider === "huggingface" || provider === "groq") {
    const hfToken = provider === "groq"
      ? (process.env.GROQ_TOKEN || process.env.HUGGINGFACE_TOKEN)
      : process.env.HUGGINGFACE_TOKEN;
    if (hfToken) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: provider === "groq" ? "groq" : "huggingface",
          model: modelArg,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithHuggingFace({
          model: modelArg,
          token: hfToken,
          iteration,
          feedback,
          inferenceProvider: provider === "groq" ? "groq" : undefined
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: provider === "groq" ? "groq" : "huggingface",
          model: modelArg,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: provider === "groq" ? "groq" : "huggingface",
          model: modelArg,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      modelError = provider === "groq"
        ? "No GROQ_TOKEN or HUGGINGFACE_TOKEN available for Groq request."
        : "No HUGGINGFACE_TOKEN available for Hugging Face request.";
    }
  } else {
    const normalizedModel = normalizeModel(modelArg);
    resolvedModel = normalizedModel;
    const token = process.env.GITHUB_TOKEN || process.env.MODELS_TOKEN;
    const keyToken = process.env.KEY_GITHUB_TOKEN;

    if (token || keyToken) {
      const feedback = await readFeedback(previousDir);
      try {
        await logProviderInteraction(outputDir, iteration, "input", {
          provider: "github",
          model: modelArg,
          normalizedModel,
          iteration,
          hasFeedback: Boolean(feedback),
          timestamp: new Date().toISOString()
        });
        generated = await generateWithModel({
          model: modelArg,
          normalizedModel,
          token,
          keyToken,
          iteration,
          feedback
        });
        generatedByModel = true;
        await logProviderInteraction(outputDir, iteration, "output", {
          provider: "github",
          model: modelArg,
          normalizedModel,
          iteration,
          success: true,
          generatedKeys: Object.keys(generated).sort(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
        await logProviderInteraction(outputDir, iteration, "error", {
          provider: "github",
          model: modelArg,
          normalizedModel,
          iteration,
          error: modelError,
          timestamp: new Date().toISOString()
        });
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
