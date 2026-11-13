import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REQUIRED_HTML5_TAGS, buildTaskPrompt, findHtmlTags, readFixture, validateTask } from "./benchmark-task.mjs";
import { generateWithModel } from "./providers/github.mjs";
import { generateWithMistral } from "./providers/mistral.mjs";
import { generateWithOpenRouter } from "./providers/openrouter.mjs";
import { generateWithCloudflare } from "./providers/cloudflare.mjs";
import { generateWithAlibaba } from "./providers/alibaba.mjs";
import { generateWithCohere } from "./providers/cohere.mjs";
import { generateWithGroq } from "./providers/groq.mjs";
import { generateWithHuggingFace } from "./providers/huggingface.mjs";

const taskContext = {
  task: "legacy-repair", fixture: "norwegian-news",
  fixtureHtml: "<font>Preserve this fixture</font>",
  candidateHtml: "<main>Previous candidate</main>", candidateCss: "main {color:black}"
};
const page = { html: "<main>Repaired</main>", css: "", js: "" };
function response() {
  return Response.json({
    id: "test", object: "chat.completion", created: 0, model: "test",
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(page) }, finish_reason: "stop" }]
  });
}

test("both task prompts require every authoritative HTML5 tag and preserve repair context", () => {
  for (const context of [{}, taskContext]) {
    const prompt = buildTaskPrompt({ iteration: 2, ...context });
    assert.ok(prompt.includes(REQUIRED_HTML5_TAGS.join(", ")));
    assert.match(prompt, /selectedcontent is required/);
    assert.match(prompt, /Do not use obsolete param/);
  }
  const prompt = buildTaskPrompt({ iteration: 2, ...taskContext });
  assert.ok(prompt.includes(taskContext.fixtureHtml));
  assert.ok(prompt.includes(taskContext.candidateHtml));
  assert.ok(prompt.includes(taskContext.candidateCss));
  assert.throws(() => validateTask("legacy-repair", "../escape"), /requires --fixture/);
  assert.throws(() => validateTask("showcase", "norwegian-news"), /only supported/);
});

test("coverage recognizes selectedcontent in valid context, not comments or script strings", () => {
  const tags = findHtmlTags(`<select><button><selectedcontent></selectedcontent></button>
    <option>One</option></select><!-- <font><param> --><script>"<marquee>"</script>
    &lt;center&gt;<template><article></article></template>`);
  assert.ok(tags.has("selectedcontent"));
  assert.ok(tags.has("button"));
  assert.ok(tags.has("article"));
  for (const tag of ["font", "param", "marquee", "center"]) assert.ok(!tags.has(tag));
});

test("coverage CLI fails coverage when selectedcontent is missing and accepts it when present", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-coverage-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const htmlPath = path.join(dir, "index.html");
  const reportPath = path.join(dir, "report.json");
  const html = REQUIRED_HTML5_TAGS.filter(tag => tag !== "selectedcontent")
    .map(tag => `<${tag}></${tag}>`).join("");
  for (const includeSelected of [false, true]) {
    fs.writeFileSync(htmlPath, html + (includeSelected
      ? "<select><button><selectedcontent></selectedcontent></button><option>A</option></select>" : ""));
    const run = spawnSync(process.execPath, ["scripts/check-html5-tags.mjs", htmlPath, reportPath], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    // Other malformed nesting in this synthetic coverage-only source is irrelevant here.
    assert.equal(report.missing_tags.includes("selectedcontent"), !includeSelected);
  }
});

for (const provider of [generateWithModel, generateWithMistral, generateWithOpenRouter,
  generateWithCloudflare, generateWithAlibaba, generateWithCohere, generateWithGroq, generateWithHuggingFace]) {
  test(`${provider.name} sends complete repair requirements and feedback`, async t => {
    const requests = [];
    t.mock.method(console, "error", () => {});
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return response();
    });
    const result = await provider({
      model: "test-model", normalizedModel: "test/model", token: "hf_test_token", accountId: "test-account",
      iteration: 2, feedback: "Fix remaining legacy patterns", taskContext
    });
    assert.equal(result.html, page.html);
    assert.equal(requests.length, 1);
    const prompt = requests[0].messages.map(message => message.content).join("\n");
    for (const text of [REQUIRED_HTML5_TAGS.join(", "), taskContext.fixtureHtml,
      taskContext.candidateHtml, taskContext.candidateCss, "Fix remaining legacy patterns"]) {
      assert.ok(prompt.includes(text), text);
    }
    assert.ok(!prompt.includes("You do not need to include every possible"));
  });
}

test("Groq retry trims feedback but never fixture or required-tag instructions", async t => {
  const requests = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return requests.length === 1 ? new Response("rate limit", { status: 429 }) : response();
  });
  await generateWithGroq({
    model: "test-model", token: "test-token", iteration: 2, feedback: "feedback ".repeat(200), taskContext
  });
  assert.equal(requests.length, 2);
  assert.ok(requests[1].messages[1].content.includes(REQUIRED_HTML5_TAGS.join(", ")));
  assert.ok(requests[1].messages[1].content.includes(taskContext.fixtureHtml));
  assert.ok(requests[1].messages[1].content.length < requests[0].messages[1].content.length);
});

test("missing credentials cannot overwrite or record a fallback repair candidate", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-generation-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "index.html"), "existing candidate");
  const run = spawnSync(process.execPath, [
    "scripts/generate-page.mjs", "--provider", "mistral", "--outputDir", dir,
    "--task", "legacy-repair", "--fixture", "norwegian-news"
  ], { encoding: "utf8", env: { ...process.env, MISTRAL_TOKEN: "" } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /candidate not replaced/);
  assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), "existing candidate");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "generation.json"))).generatedByModel, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "task.json"))).task, "legacy-repair");
  assert.ok(readFixture("norwegian-news").includes("<font"));
});
