import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse, serialize } from "parse5";
import { checkLegacy } from "./check-legacy-tags.mjs";

const fixtureRoot = new URL("../resources/fixtures/legacy/", import.meta.url);
const checkerPath = fileURLToPath(new URL("./check-legacy-tags.mjs", import.meta.url));
const resource = JSON.parse(await readFile(new URL("../resources/legacy_tags.json", import.meta.url), "utf8"));
const patternCount = (report, id) => report.legacy_patterns_matched.find((entry) => entry.id === id)?.count || 0;

for (const id of ["norwegian-news", "community-portal", "local-directory"]) {
  test(`${id}: unchanged synthetic fixture retains content and has legacy findings`, async () => {
    const html = await readFile(new URL(`${id}.html`, fixtureRoot), "utf8");
    const report = checkLegacy(html, { fixtureHtml: html });
    assert.equal(report.version, 1);
    assert.deepEqual(report.preservation_errors, []);
    assert.ok(report.legacy_present.some((entry) => entry.tag === "font"));
    assert.equal(patternCount(report, "unnamed-image-link"), 1);
    assert.ok(report.legacy_error_count > 0);
    assert.equal(report.legacy_error_count,
      [...report.legacy_present, ...report.legacy_patterns_matched].reduce((sum, entry) => sum + entry.count, 0));
    if (id === "community-portal") assert.equal(patternCount(report, "absolute-div-cluster"), 3);
    else assert.equal(patternCount(report, "layout-table"), 1);
  });

  test(`${id}: semantic cleanup can remove findings without removing content`, async () => {
    const fixtureHtml = await readFile(new URL(`${id}.html`, fixtureRoot), "utf8");
    const document = parse(fixtureHtml);
    const replacements = {
      font: "span", center: "div", marquee: "div", blink: "span", big: "span",
      strike: "s", tt: "code", acronym: "abbr", dir: "ul", basefont: "span", param: "span"
    };
    function repair(node) {
      if (replacements[node.tagName]) node.tagName = node.nodeName = replacements[node.tagName];
      if (node.attrs) {
        node.attrs = node.attrs.filter(({ name }) => [
          "id", "href", "src", "lang", "charset", "title", "type", "data", "scope", "alt", "class"
        ].includes(name));
        if (node.tagName === "img") node.attrs.push({ name: "alt", value: "Symbol" });
      }
      for (const child of node.childNodes || []) repair(child);
    }
    repair(document);
    assert.deepEqual(checkLegacy(serialize(document), { fixtureHtml }), {
      version: 1, legacy_present: [], legacy_patterns_matched: [], legacy_error_count: 0, preservation_errors: []
    });
  });
}

test("DOM parsing ignores tag-like strings in comments, scripts, styles and escaped text", () => {
  const html = `<!doctype html><html><head><style>.x::after { content: "<font>"; }</style></head>
    <body><!-- <center><font> --><script>const text = "<marquee><font>";</script>
    <p>&lt;blink&gt; &lt;font color="red"&gt;</p><selectedcontent></selectedcontent></body></html>`;
  assert.equal(checkLegacy(html).legacy_error_count, 0);
});

test("obsolete tags, including param, are counted case-insensitively with bounded examples", () => {
  const report = checkLegacy(`<FONT>x</FONT><font>y</font><font>z</font><font>æ</font>
    <object><param name="a"><param name="b"></object><template><center>inert</center></template>`);
  assert.deepEqual(report.legacy_present.map(({ tag, count }) => ({ tag, count })), [
    { tag: "center", count: 1 }, { tag: "font", count: 4 }, { tag: "param", count: 2 }
  ]);
  assert.equal(report.legacy_present.find(({ tag }) => tag === "font").examples.length, 3);
  assert.ok(report.legacy_present.every(({ examples }) => examples.every((value) => value.startsWith("<"))));
  assert.equal(report.legacy_error_count, 7);
  assert.ok(resource.tags.includes("param"));
  assert.ok(!resource.tags.includes("selectedcontent"));
});

test("presentation attributes are tag-specific; contrast and valid attributes are not guessed", () => {
  const clean = `<input size="30"><select size="2"><option>Velg</option></select>
    <svg color="red"><text>Logo</text></svg><span style="color:#aaa">Svak kontrast</span>
    <img width="32" height="32" alt="Logo"><ol type="a"><li>Første</li></ol>`;
  assert.equal(checkLegacy(clean).legacy_error_count, 0);
  const report = checkLegacy(`<font color="red" size="2">Nyhet</font>
    <span color="red">Tekst</span><table bgcolor="white" cellpadding="3"><tr><td align="left">A</td></tr></table>`);
  assert.equal(patternCount(report, "presentational-attributes"), 4);
});

test("source counting retains obsolete start tags discarded by DOM tree repair", () => {
  const report = checkLegacy(`<body><frameset><frame></frameset><param name=x>
    <select><font color=red>x</font></select></body>`);
  assert.deepEqual(report.legacy_present, [
    { tag: "font", count: 1, examples: ["<font color=red>"] },
    { tag: "frame", count: 1, examples: ["<frame>"] },
    { tag: "frameset", count: 1, examples: ["<frameset>"] },
    { tag: "param", count: 1, examples: ["<param name=x>"] }
  ]);
  assert.equal(report.legacy_error_count, 4);
});

test("source counting ignores comments, raw text and escaped markup without counting DOM clones", () => {
  const report = checkLegacy(`<body><!-- <frameset><frame><param><font> -->
    <script>const markup = "<frameset><frame><param><font>";</script>
    <style>.x::after { content: "<font>"; }</style>
    <textarea><font>not markup</font></textarea><p>&lt;param&gt;</p>
    <b><font>one</b>two</font></body>`);
  assert.deepEqual(report.legacy_present, [{ tag: "font", count: 1, examples: ["<font>"] }]);
  assert.equal(report.legacy_error_count, 1);
});

test("only explicit layout tables and clusters of at least three sibling absolute divs match", () => {
  const report = checkLegacy(`<table><caption>Priser</caption><tr><th>Vare</th><th>Pris</th></tr>
    <tr><td>Brød</td><td>30</td></tr></table><table role="presentation"></table><table role=" NONE "></table>
    <section><div style="position:absolute"></div><div style="position:relative"></div></section>
    <section><div style="position:absolute"></div><div style="position:absolute"></div></section>
    <section><div style="position:absolute"></div><div style="POSITION: /*legacy*/ absolute !important"></div>
    <div style="position:absolute"></div><div style="position:fixed"></div></section>`);
  assert.equal(patternCount(report, "layout-table"), 2);
  assert.equal(patternCount(report, "absolute-div-cluster"), 3);
  assert.equal(report.legacy_error_count, 5);
});

test("named image links honor text, alt, aria-label, aria-labelledby and title", () => {
  const report = checkLegacy(`<p id="label" hidden>Åpne arkivet</p>
    <a href="#a"><img alt="Arkivet"></a>
    <a href="#b" aria-label="Arkivet"><img></a>
    <a href="#c" aria-labelledby="label"><img></a>
    <a href="#d" title="Arkivet"><img alt=""></a>
    <a href="#e"><img>Åpne arkivet</a>
    <a href="#f"><img title="Arkivet"></a>
    <a href="#g"><img aria-label="Arkivet"></a>
    <a href="#h"><img aria-labelledby="label"></a>
    <a href="#bad"><img></a>
    <a href="#bad2"><img alt=" "><span hidden>Ikke et navn</span></a>
    <a href="#bad3" aria-labelledby="missing"><img alt=""></a>
    <a href="#bad4"><img aria-hidden="true" alt="Skjult"></a>
    <a><img></a>`);
  assert.equal(patternCount(report, "unnamed-image-link"), 4);
});

test("preservation accepts semantic restructuring, whitespace changes and additional content", () => {
  const fixtureHtml = `<center><font>Hei, <b>Norge!</b></font></center><a href="/nytt?a=1&amp;b=2">Les mer</a>`;
  const repaired = `<main><h1>Hei, Norge!</h1><p><a href="/nytt?a=1&amp;b=2">Les <em>mer</em></a></p>
    <p>Nytt innhold.</p></main>`;
  assert.equal(checkLegacy(repaired, { fixtureHtml }).legacy_error_count, 0);
});

test("deletion, hiding and duplicate removal are penalized even when remaining HTML is clean", () => {
  const fixtureHtml = `<p>Viktig nyhet</p><p>Viktig nyhet</p><a href="/a">Les</a><a href="/a">Les</a>`;
  for (const html of [
    "",
    `<main hidden>${fixtureHtml}</main>`,
    `<main style="display: none !important">${fixtureHtml}</main>`,
    `<main style="visibility:hidden">${fixtureHtml}</main>`,
    `<script>${fixtureHtml}</script><style>${fixtureHtml}</style><template>${fixtureHtml}</template>`
  ]) {
    const report = checkLegacy(html, { fixtureHtml });
    assert.ok(report.preservation_errors.some((message) => message.includes("Visible text missing")));
    assert.ok(report.preservation_errors.some((message) => message.includes("Link href missing")));
    assert.equal(report.legacy_error_count, report.preservation_errors.length);
  }
  const report = checkLegacy(`<p>Viktig nyhet</p><a href="/a">Les</a>`, { fixtureHtml });
  assert.equal(report.preservation_errors.length, 4);
  assert.ok(report.preservation_errors.every((message) => message.includes("(1 occurrence(s))")));
});

test("preservation ignores non-rendered baseline text and links but retains aria-hidden visible text", () => {
  const fixtureHtml = `<head><title>Metatittel</title><style>body{color:black}</style></head><body>
    <script>const a = "internt";</script><template><a href="/inert">Mal</a></template>
    <noscript>Uten skript</noscript><p hidden>Skjult</p><p style="display:none">Også skjult</p>
    <p aria-hidden="true">Synlig tekst</p><a href="/a">Åpne</a></body>`;
  assert.equal(checkLegacy(`<p>Synlig tekst</p><a href="/a">Åpne</a>`, { fixtureHtml }).legacy_error_count, 0);
  assert.ok(checkLegacy(`<a href="/a">Åpne</a>`, { fixtureHtml }).preservation_errors.length > 0);
});

test("changing link targets is penalized even when link text is preserved", () => {
  const report = checkLegacy(`<p>Kontakt</p><a href="/different">Les</a>`, {
    fixtureHtml: `<p>Kontakt</p><a href="/original">Les</a>`
  });
  assert.deepEqual(report.preservation_errors, ['Link href missing: "/original" (1 occurrence(s))']);
  assert.equal(report.legacy_error_count, 1);
});

test("the pure synchronous API is deterministic and rejects non-string inputs", () => {
  const first = checkLegacy("<font>Hei</font>");
  first.legacy_present[0].count = 500;
  assert.equal(checkLegacy("<font>Hei</font>").legacy_present[0].count, 1);
  assert.throws(() => checkLegacy(null), /html must be a string/);
  assert.throws(() => checkLegacy("", { fixtureHtml: null }), /fixtureHtml must be a string/);
});

test("CLI writes findings with exit zero and explicitly fails usage, reads and writes", async () => {
  const work = new URL(`.checker-test-${randomUUID()}/`, fixtureRoot);
  await mkdir(work);
  const reportPath = fileURLToPath(new URL("report.json", work));
  const htmlPath = fileURLToPath(new URL("norwegian-news.html", fixtureRoot));
  function run(args) {
    return spawnSync(process.execPath, [checkerPath, ...args], { encoding: "utf8" });
  }
  try {
    const result = run([htmlPath, reportPath, htmlPath]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.ok(report.legacy_error_count > 0);
    assert.deepEqual(report.preservation_errors, []);
    for (const args of [
      [], [htmlPath], [htmlPath, reportPath, htmlPath, "extra"],
      [`${htmlPath}.missing`, reportPath],
      [htmlPath, reportPath, `${htmlPath}.missing`],
      [htmlPath, fileURLToPath(new URL("absent/report.json", work))]
    ]) {
      const failure = run(args);
      assert.notEqual(failure.status, 0);
      assert.match(failure.stderr, /Legacy checker failed:/);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
