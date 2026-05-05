import fs from "node:fs/promises";
import path from "node:path";

const MAX_FEEDBACK_CHARS = 2500;

/**
 * Extract the outermost JSON object from a string that may contain leading/
 * trailing non-JSON text, and simultaneously repair common LLM JSON issues.
 */
export function extractAndRepairJson(raw) {
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }

  let result = "";
  let depth = 0;
  let inString = false;
  let stringDelimiter = '"';

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (ch === stringDelimiter || (stringDelimiter === "`" && ch === "`")) {
        if (ch === "`") {
          let j = i + 1;
          while (j < raw.length && " \t\n\r".includes(raw[j])) j++;
          const after = raw[j];
          if (!(after === undefined || after === "," || after === "}" || after === "]" || after === ":")) {
            result += "\\`";
            continue;
          }
        }
        inString = false;
        result += '"';
        continue;
      }

      if (ch === "\\") {
        const next = raw[i + 1];
        if (next != null && !'"\\\/bfnrtu'.includes(next)) {
          result += "\\\\";
          continue;
        }
        result += ch + (next ?? "");
        i++;
        continue;
      }

      if (stringDelimiter === "`" && ch === '"') {
        result += '\\"';
        continue;
      }

      if (stringDelimiter === '"' && ch === '"') {
        let j = i + 1;
        while (j < raw.length && " \t\n\r".includes(raw[j])) j++;
        const after = raw[j];
        if (after === undefined || after === "," || after === "}" || after === "]" || after === ":") {
          inString = false;
          result += ch;
          continue;
        }
        result += '\\"';
        continue;
      }

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
      if (ch === '"') {
        inString = true;
        stringDelimiter = '"';
        result += ch;
        continue;
      }
      if (ch === "`") {
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
      if (/[a-zA-Z_$]/.test(ch)) {
        let keyEnd = i + 1;
        while (keyEnd < raw.length && /[\w$]/.test(raw[keyEnd])) keyEnd++;
        let colonPos = keyEnd;
        while (colonPos < raw.length && " \t\n\r".includes(raw[colonPos])) colonPos++;
        if (raw[colonPos] === ":") {
          const key = raw.slice(i, keyEnd);
          result += `"${key}"`;
          i = keyEnd - 1;
          continue;
        }
      }
      result += ch;
    }
  }

  if (inString) {
    result += '"';
  }
  while (depth > 0) {
    result += "}";
    depth--;
  }
  return result;
}

/**
 * Read feedback from previous test results
 */
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

/**
 * Parse CLI arguments
 */
export function parseArgs(argv) {
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

/**
 * Normalize model name for GitHub APIs
 */
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
 * Get default accessible page
 */
export function defaultPage() {
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

/**
 * Helper to extract and parse JSON with regex fallback
 */
export function parseResponseJson(messageContent) {
  let jsonStr;
  try {
    jsonStr = extractAndRepairJson(messageContent);
  } catch (extractError) {
    throw new Error(`Failed to extract JSON: ${extractError instanceof Error ? extractError.message : String(extractError)}. Response preview: ${messageContent.slice(0, 300)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    // Fallback: try regex extraction
    const htmlMatch = messageContent.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const cssMatch = messageContent.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const jsMatch = messageContent.match(/"js"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    
    if (htmlMatch && cssMatch && jsMatch) {
      const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      parsed = {
        html: unescape(htmlMatch[1]),
        css: unescape(cssMatch[1]),
        js: unescape(jsMatch[1])
      };
    } else {
      throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Attempted: ${jsonStr.slice(0, 300)}`);
    }
  }

  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    throw new Error("Response JSON missing html/css/js fields.");
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
