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
 * Safely truncate JSON to a max length while preserving structure
 */
function safeJsonTruncate(jsonStr, maxLength) {
  if (jsonStr.length <= maxLength) return jsonStr;
  
  try {
    const truncated = jsonStr.slice(0, maxLength);
    
    // For arrays: find the last complete object
    if (truncated.trim().startsWith("[")) {
      // Find the last closing brace before maxLength
      const lastBrace = truncated.lastIndexOf("}");
      const lastBracket = truncated.lastIndexOf("]");
      
      if (lastBrace > 10) {
        // Check if we need to close the array
        const afterBrace = truncated.slice(lastBrace + 1).trim();
        if (afterBrace.endsWith(",") || afterBrace === "") {
          return truncated.slice(0, lastBrace + 1) + "]";
        }
      }
    }
    
    // For objects: similar approach
    if (truncated.trim().startsWith("{")) {
      const lastBrace = truncated.lastIndexOf("}");
      if (lastBrace > 10) {
        return truncated.slice(0, lastBrace + 1);
      }
    }
    
    return jsonStr.slice(0, maxLength);
  } catch {
    return jsonStr.slice(0, maxLength);
  }
}

/**
 * Filter axe report to keep only violations, removing metadata noise
 */
function filterAxeReport(content) {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data) || data.length === 0) return "";
    
    const report = data[0];
    const violations = report.violations || [];
    const incomplete = report.incomplete || [];
    
    // Compact format: just id, impact, and node count
    const result = {
      violations: violations.map(v => ({
        id: v.id,
        impact: v.impact,
        nodes: (v.nodes || []).length,
      })),
      incomplete: incomplete.slice(0, 5), // Keep first 5 incomplete
    };
    
    return JSON.stringify(result);
  } catch {
    return content;
  }
}

/**
 * Filter W3C report to keep only errors (more aggressive filtering)
 */
function filterW3CReport(content) {
  try {
    const data = JSON.parse(content);
    
    // W3C report format: { errorCount, messages: [...] }
    if (data.messages && Array.isArray(data.messages)) {
      const errors = data.messages.filter(item => item.type === "error");
      
      // Create compact format with only essential fields
      const reduced = errors.slice(0, 8).map(e => ({
        line: e.line,
        column: e.column,
        message: e.message?.slice(0, 120), // Shorter message
      }));
      
      return JSON.stringify({
        errorCount: errors.length,
        errors: reduced,
      });
    }
    
    return content;
  } catch {
    return content;
  }
}

/**
 * Filter test results to keep only latest iteration metrics
 */
function filterTestResults(content) {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data) || data.length === 0) return "";
    
    // Keep only the latest iteration
    const latest = data[data.length - 1];
    return JSON.stringify({
      iteration: latest.iteration,
      status: latest.status,
      score: latest.score,
      html_tag_errors: latest.html_tag_errors,
      w3c_errors: latest.w3c_errors,
      axe_violations: latest.axe_violations,
      pa11y_issues: latest.pa11y_issues,
      qualweb_issues: latest.qualweb_issues,
      missing_tags: latest.missing_tags?.slice(0, 20), // Limit tags
    });
  } catch {
    return content;
  }
}

/**
 * Read feedback from previous test results, optimized to remove noise
 */
export async function readFeedback(previousDir) {
  if (!previousDir) {
    return "";
  }

  const feedbackParts = [];
  
  // Define file processors: filename -> { processor, description }
  const fileProcessors = {
    "test_results.json": { processor: filterTestResults, priority: 1 },
    "axe_report.json": { processor: filterAxeReport, priority: 2 },
    "pa11y_report.json": { processor: (c) => c, priority: 3 },
    "w3c_report.json": { processor: filterW3CReport, priority: 4 },
    "html5_tags_report.json": { processor: (c) => c, priority: 5 },
    "qualweb_report.json": { processor: (c) => c, priority: 6 },
  };

  for (const [filename, { processor }] of Object.entries(fileProcessors)) {
    const fullPath = path.join(previousDir, filename);
    try {
      let content = await fs.readFile(fullPath, "utf8");
      
      // Apply file-specific filter to remove noise
      content = processor(content);
      
      // Safely truncate if needed
      if (content.length > MAX_FEEDBACK_CHARS) {
        content = safeJsonTruncate(content, MAX_FEEDBACK_CHARS);
      }
      
      if (content.trim()) {
        feedbackParts.push(`## ${filename}\n${content}`);
      }
    } catch {
      // File doesn't exist or can't be processed, skip it
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
