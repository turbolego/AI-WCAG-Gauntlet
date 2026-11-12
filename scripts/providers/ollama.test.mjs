import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generateWithOllama, getOllamaBaseUrl } from "./ollama.mjs";

/**
 * Ollama provider tests — spin up a local mock of Ollama's
 * OpenAI-compatible /v1/chat/completions endpoint.
 */

function startMockOllama({ behavior = "ok" } = {}) {
  let lastRequest = null;
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/chat/completions")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch {}
      lastRequest = { url: req.url, model: parsed?.model, messages: parsed?.messages, temperature: parsed?.temperature, stream: parsed?.stream, max_tokens: parsed?.max_tokens };
      res.writeHead(200, { "content-type": "application/json" });
      if (behavior === "ok") {
        res.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ html: "<div>hi</div>", css: "body {}", js: "" }) } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: "mock-model"
        }));
      } else if (behavior === "fenced") {
        res.end(JSON.stringify({
          choices: [{ message: { content: "```json\n" + JSON.stringify({ html: "<main>x</main>", css: "", js: "" }) + "\n```" } }],
          usage: null,
          model: "mock-model"
        }));
      } else if (behavior === "no-content") {
        res.end(JSON.stringify({ choices: [{ message: { content: "" } }], model: "mock-model" }));
      } else if (behavior === "bad-json") {
        res.end(JSON.stringify({ choices: [{ message: { content: "{ not valid json" } }], model: "mock-model" }));
      } else {
        res.end("{}");
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
        getLastRequest: () => lastRequest
      });
    });
  });
}

describe("ollama provider", () => {
  test("getOllamaBaseUrl defaults to 127.0.0.1:11434 and strips trailing slashes", () => {
    delete process.env.OLLAMA_BASE_URL;
    assert.equal(getOllamaBaseUrl(), "http://127.0.0.1:11434");
    process.env.OLLAMA_BASE_URL = "http://100.64.0.9:11434///";
    assert.equal(getOllamaBaseUrl(), "http://100.64.0.9:11434");
    delete process.env.OLLAMA_BASE_URL;
  });

  test("parses a plain JSON chat completion", async () => {
    const mock = await startMockOllama({ behavior: "ok" });
    try {
      process.env.OLLAMA_BASE_URL = mock.url;
      const out = await generateWithOllama({ model: "qwen3.5:0.8b", iteration: 1, feedback: null, maxTokens: 8000 });
      assert.equal(out.html, "<div>hi</div>");
      assert.equal(out.css, "body {}");
      assert.equal(out.js, "");
      assert.equal(out.rawModel, "mock-model");
      assert.equal(out.usage.total_tokens, 15);
      // request shape
      const req = mock.getLastRequest();
      assert.equal(req.model, "qwen3.5:0.8b");
      assert.equal(req.temperature, 0.2);
      assert.equal(req.stream, false);
      assert.equal(req.max_tokens, 8000);
      assert.equal(req.messages.length, 2);
      assert.match(req.messages[0].content, /valid JSON/);
    } finally {
      delete process.env.OLLAMA_BASE_URL;
      await mock.close();
    }
  });

  test("repairs fenced JSON output", async () => {
    const mock = await startMockOllama({ behavior: "fenced" });
    try {
      process.env.OLLAMA_BASE_URL = mock.url;
      const out = await generateWithOllama({ model: "turbolego/qwen3.5-0.8b-wcag-gauntlet-lora-q4_k_m", iteration: 2, feedback: "fix the contrast", maxTokens: undefined });
      assert.equal(out.html, "<main>x</main>");
      const req = mock.getLastRequest();
      assert.equal(req.max_tokens, undefined);
      assert.match(req.messages[1].content, /Previous reports:\nfix the contrast/);
    } finally {
      delete process.env.OLLAMA_BASE_URL;
      await mock.close();
    }
  });

  test("throws when the response has no content", async () => {
    const mock = await startMockOllama({ behavior: "no-content" });
    try {
      process.env.OLLAMA_BASE_URL = mock.url;
      await assert.rejects(
        () => generateWithOllama({ model: "qwen3.5:0.8b", iteration: 1, feedback: null }),
        /did not include content/
      );
    } finally {
      delete process.env.OLLAMA_BASE_URL;
      await mock.close();
    }
  });

  test("throws when the response is not valid JSON", async () => {
    const mock = await startMockOllama({ behavior: "bad-json" });
    try {
      process.env.OLLAMA_BASE_URL = mock.url;
      await assert.rejects(
        () => generateWithOllama({ model: "qwen3.5:0.8b", iteration: 1, feedback: null }),
        /not valid JSON/
      );
    } finally {
      delete process.env.OLLAMA_BASE_URL;
      await mock.close();
    }
  });

  test("throws a helpful error when Ollama is unreachable", async () => {
    // port 1 on loopback is almost certainly closed
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
    try {
      await assert.rejects(
        () => generateWithOllama({ model: "qwen3.5:0.8b", iteration: 1, feedback: null }),
        (err) => /Is `ollama serve` running/.test(err.message)
      );
    } finally {
      delete process.env.OLLAMA_BASE_URL;
    }
  });
});
