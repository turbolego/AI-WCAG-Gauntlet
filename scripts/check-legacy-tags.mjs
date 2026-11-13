import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";
import { SAXParser } from "parse5-sax-parser";

const resource = JSON.parse(readFileSync(new URL("../resources/legacy_tags.json", import.meta.url), "utf8"));
const obsoleteTags = new Set(resource.tags);
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
// Distinct document URLs keep an absolute base from impersonating a portable relative destination.
const comparisonDocumentUrls = [
  "https://fixture.invalid/legacy/index.html",
  "http://repair.invalid:8080/nested/legacy/page.html?view=1"
];
const nonVisibleTags = new Set(["head", "script", "style", "template", "noscript", "title"]);
const blockTags = new Set([
  "address", "article", "aside", "blockquote", "br", "caption", "center", "dd", "div",
  "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
  "h4", "h5", "h6", "header", "hr", "li", "main", "marquee", "nav", "ol", "p",
  "pre", "section", "table", "td", "th", "tr", "ul"
]);
const textTags = new Set([
  "b", "basefont", "big", "blink", "center", "div", "em", "font", "i", "p",
  "s", "small", "span", "strike", "strong", "tt", "u"
]);
const presentationAttributes = {
  body: ["alink", "background", "bgcolor", "link", "text", "vlink"],
  table: ["align", "background", "bgcolor", "border", "cellpadding", "cellspacing", "width"],
  tr: ["align", "bgcolor", "valign"],
  td: ["align", "background", "bgcolor", "height", "nowrap", "valign", "width"],
  th: ["align", "background", "bgcolor", "height", "nowrap", "valign", "width"],
  col: ["align", "char", "charoff", "valign", "width"],
  colgroup: ["align", "char", "charoff", "valign", "width"],
  hr: ["align", "color", "noshade", "size", "width"],
  img: ["align", "border", "hspace", "vspace"],
  br: ["clear"],
  ol: ["compact"], ul: ["compact", "type"], li: ["type"],
  p: ["align"], div: ["align"], h1: ["align"], h2: ["align"], h3: ["align"],
  h4: ["align"], h5: ["align"], h6: ["align"], caption: ["align"]
};

function attribute(node, name) {
  return node.attrs?.find((attr) => attr.name === name && !attr.namespace)?.value;
}

function styleValue(node, property) {
  const declarations = (attribute(node, "style") || "").replace(/\/\*[\s\S]*?\*\//g, "").split(";");
  let value = "";
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (declaration.slice(0, colon).trim().toLowerCase() === property) {
      value = declaration.slice(colon + 1).replace(/\s*!important\s*$/i, "").trim().toLowerCase();
    }
  }
  return value;
}

function hidden(node) {
  return nonVisibleTags.has(node.tagName) || attribute(node, "hidden") !== undefined
    || (node.tagName === "dialog" && attribute(node, "open") === undefined
      && !styleValue(node, "display"))
    || styleValue(node, "display") === "none"
    || ["hidden", "collapse"].includes(styleValue(node, "visibility"));
}

function textContent(node, { includeHidden = false, accessible = false } = {}) {
  if (!includeHidden && hidden(node)) return "";
  if (accessible && attribute(node, "aria-hidden")?.toLowerCase() === "true") return "";
  if (node.nodeName === "#text") return node.value;
  const text = (node.childNodes || []).map((child) => textContent(child, { includeHidden, accessible })).join("");
  return blockTags.has(node.tagName) ? ` ${text} ` : text;
}

function normalized(text) {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function inventory(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const elements = [];
  const visibleElements = [];
  const ids = new Map();
  let baseHref;
  function visit(node, ancestorHidden = false, inTemplate = false) {
    const isHidden = ancestorHidden || hidden(node);
    if (node.tagName) {
      elements.push(node);
      if (!isHidden) visibleElements.push(node);
      const id = attribute(node, "id");
      if (id && !ids.has(id)) ids.set(id, node);
      if (!inTemplate && node.namespaceURI === HTML_NAMESPACE && node.tagName === "base" && baseHref === undefined) {
        baseHref = attribute(node, "href");
      }
    }
    for (const child of node.childNodes || []) visit(child, isHidden, inTemplate);
    // Template contents are real markup, but do not contribute visible content.
    if (node.content) visit(node.content, true, true);
  }
  visit(document);
  const baseUrls = comparisonDocumentUrls.map((documentUrl) => {
    if (baseHref !== undefined && !URL.canParse(baseHref, documentUrl)) return null;
    const base = new URL(baseHref ?? documentUrl, documentUrl);
    return ["data:", "javascript:"].includes(base.protocol) ? documentUrl : base.href;
  });
  return { document, elements, visibleElements, ids, baseUrls };
}

function accessibleName(node, ids, visited = new Set()) {
  if (visited.has(node)) return "";
  visited = new Set([...visited, node]);
  const labelledBy = attribute(node, "aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy.trim().split(/\s+/).map((id) => ids.get(id)).filter(Boolean);
    if (labels.length) {
      const name = normalized(labels.map((label) =>
        textContent(label, { includeHidden: true })).join(" "));
      if (name) return name;
    }
  }
  if (normalized(attribute(node, "aria-label") || "")) return attribute(node, "aria-label");
  if (node.tagName === "img") {
    const alt = attribute(node, "alt");
    return alt !== undefined ? normalized(alt) : normalized(attribute(node, "title") || "");
  }
  const parts = [];
  function collect(child) {
    if (hidden(child) || attribute(child, "aria-hidden")?.toLowerCase() === "true") return;
    if (child.nodeName === "#text") parts.push(child.value);
    else if (child.tagName === "img") parts.push(accessibleName(child, ids, visited));
    else for (const descendant of child.childNodes || []) collect(descendant);
  }
  for (const child of node.childNodes || []) collect(child);
  return normalized(parts.join(" ")) || normalized(attribute(node, "title") || "");
}

function hasImage(node) {
  return (node.childNodes || []).some((child) => child.tagName === "img" || hasImage(child));
}

function counts(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) || 0) + 1);
  return result;
}

/**
 * Detect obsolete markup independently of HTML5 tag coverage.
 * Preservation is a DOM-based, inline-visibility check, not a browser/CSS audit.
 * Text and resolved link multiplicities may increase or be reordered, but must not decrease.
 */
export function checkLegacy(html, { fixtureHtml } = {}) {
  if (typeof html !== "string") throw new TypeError("html must be a string");
  if (fixtureHtml !== undefined && typeof fixtureHtml !== "string") {
    throw new TypeError("fixtureHtml must be a string");
  }
  const page = inventory(html);
  const tagFindings = new Map();
  const patternFindings = new Map();
  function record(findings, key, node) {
    if (!findings.has(key)) findings.set(key, { count: 0, examples: [] });
    const finding = findings.get(key);
    finding.count++;
    const location = node.sourceCodeLocation?.startTag || node.sourceCodeLocation;
    const example = location
      ? html.slice(location.startOffset, location.endOffset).replace(/\s+/g, " ").slice(0, 180)
      : `<${node.tagName}>`;
    if (finding.examples.length < 3) finding.examples.push(example);
  }
  // Source tokens survive tree-builder repair, which can discard or clone elements.
  const sourceParser = new SAXParser({ sourceCodeLocationInfo: true });
  sourceParser.on("startTag", (token) => {
    if (obsoleteTags.has(token.tagName)) record(tagFindings, token.tagName, token);
  });
  sourceParser.end(html);
  const absoluteGroups = new Map();
  for (const node of page.elements) {
    if (node.namespaceURI !== HTML_NAMESPACE) continue;
    const tag = node.tagName;
    const attrs = presentationAttributes[tag] || [];
    if (attrs.some((name) => attribute(node, name) !== undefined)
      || (textTags.has(tag) && ["color", "size", "face"].some((name) => attribute(node, name) !== undefined))) {
      record(patternFindings, "presentational-attributes", node);
    }
    if (tag === "table" && ["presentation", "none"].includes(
      (attribute(node, "role") || "").trim().toLowerCase().split(/\s+/)[0]
    )) record(patternFindings, "layout-table", node);
    if (tag === "div" && styleValue(node, "position") === "absolute") {
      if (!absoluteGroups.has(node.parentNode)) absoluteGroups.set(node.parentNode, []);
      absoluteGroups.get(node.parentNode).push(node);
    }
    if (tag === "a" && attribute(node, "href") !== undefined && hasImage(node)
      && !accessibleName(node, page.ids)) record(patternFindings, "unnamed-image-link", node);
  }
  for (const group of absoluteGroups.values()) {
    if (group.length >= 3) {
      for (const node of group) record(patternFindings, "absolute-div-cluster", node);
    }
  }
  const preservationErrors = [];
  if (fixtureHtml !== undefined) {
    const fixture = inventory(fixtureHtml);
    const expectedText = counts(normalized(textContent(fixture.document)).split(" ").filter(Boolean));
    const actualText = counts(normalized(textContent(page.document)).split(" ").filter(Boolean));
    for (const [word, count] of expectedText) {
      const missing = count - (actualText.get(word) || 0);
      if (missing > 0) preservationErrors.push(`Visible text missing: ${JSON.stringify(word)} (${missing} occurrence(s))`);
    }
    const linkCounts = (entry) => {
      const links = new Map();
      for (const node of entry.visibleElements) {
        const href = attribute(node, "href");
        if (!["a", "area"].includes(node.tagName) || href === undefined) continue;
        if (entry.baseUrls.some((base) => !URL.canParse(href, base ?? undefined))) {
          preservationErrors.push(`Link destination invalid: ${JSON.stringify(href)}`);
          continue;
        }
        const destination = JSON.stringify(entry.baseUrls.map((base) => new URL(href, base ?? undefined).href));
        const link = links.get(destination) || { href, count: 0 };
        link.count++;
        links.set(destination, link);
      }
      return links;
    };
    const expectedLinks = linkCounts(fixture);
    const actualLinks = linkCounts(page);
    for (const [destination, { href, count }] of expectedLinks) {
      const missing = count - (actualLinks.get(destination)?.count || 0);
      if (missing > 0) preservationErrors.push(`Link href missing: ${JSON.stringify(href)} (${missing} occurrence(s))`);
    }
  }
  const legacyPresent = resource.tags.filter((tag) => tagFindings.has(tag))
    .map((tag) => ({ tag, ...tagFindings.get(tag) }));
  const legacyPatterns = resource.patterns.filter(({ id }) => patternFindings.has(id))
    .map(({ id }) => ({ id, ...patternFindings.get(id) }));
  return {
    version: 1,
    legacy_present: legacyPresent,
    legacy_patterns_matched: legacyPatterns,
    legacy_error_count: [...legacyPresent, ...legacyPatterns].reduce((sum, finding) => sum + finding.count, 0)
      + preservationErrors.length,
    preservation_errors: preservationErrors
  };
}

async function main(args) {
  if (args.length < 2 || args.length > 3) {
    throw new Error("Usage: node scripts/check-legacy-tags.mjs <html> <report> [fixture html]");
  }
  const [htmlPath, reportPath, fixturePath] = args;
  const html = await readFile(htmlPath, "utf8");
  const fixtureHtml = fixturePath === undefined ? undefined : await readFile(fixturePath, "utf8");
  await writeFile(reportPath, `${JSON.stringify(checkLegacy(html, { fixtureHtml }), null, 2)}\n`, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Legacy checker failed: ${error.message}`);
    process.exitCode = 1;
  });
}
