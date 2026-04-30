import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeModel, buildEndpoints } from "./generate-page.mjs";

const COPILOT_URL = "https://api.githubcopilot.com/chat/completions";
const MODELS_URL = "https://models.github.ai/inference/chat/completions";
const AZURE_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";

describe("normalizeModel", () => {
  test("gpt-4.1 is normalized to openai/gpt-4.1", () => {
    assert.equal(normalizeModel("gpt-4.1"), "openai/gpt-4.1");
  });

  test("gpt-5-mini is normalized to openai/gpt-5-mini", () => {
    assert.equal(normalizeModel("gpt-5-mini"), "openai/gpt-5-mini");
  });

  test("o4-mini is normalized to openai/o4-mini", () => {
    assert.equal(normalizeModel("o4-mini"), "openai/o4-mini");
  });

  test("unknown model is returned as-is", () => {
    assert.equal(normalizeModel("some-unknown-model"), "some-unknown-model");
  });
});

describe("buildEndpoints - copilot-api routing", () => {
  const TOKEN = "test-token";

  test("gpt-4.1 uses only models-inference endpoint (not copilot-api)", () => {
    const endpoints = buildEndpoints("gpt-4.1", "openai/gpt-4.1", TOKEN);

    assert.equal(endpoints.length, 1, "should have exactly one endpoint");
    assert.equal(endpoints[0].name, "models-inference");
    assert.equal(endpoints[0].url, MODELS_URL);
    assert.equal(endpoints[0].model, "openai/gpt-4.1");
    assert.equal(endpoints[0].headers.authorization, `Bearer ${TOKEN}`);
  });

  test("gpt-5-mini skips copilot-api", () => {
    const endpoints = buildEndpoints("gpt-5-mini", "openai/gpt-5-mini", TOKEN);
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].name, "models-inference");
  });

  test("o3-mini skips copilot-api", () => {
    const endpoints = buildEndpoints("o3-mini", "openai/o3-mini", TOKEN);
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].name, "models-inference");
  });

  test("o4-mini skips copilot-api", () => {
    const endpoints = buildEndpoints("o4-mini", "openai/o4-mini", TOKEN);
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].name, "models-inference");
  });

  test("gpt-4.1 endpoint does not include x-github-api-version header", () => {
    const endpoints = buildEndpoints("gpt-4.1", "openai/gpt-4.1", TOKEN);

    assert.equal(endpoints.length, 1);
    assert.equal(
      "x-github-api-version" in endpoints[0].headers,
      false,
      "models-inference endpoint must not send x-github-api-version"
    );
  });

  test("gpt-4o uses copilot-api first, then models-inference as fallback", () => {
    const endpoints = buildEndpoints("gpt-4o", "openai/gpt-4o", TOKEN);

    assert.equal(endpoints.length, 2);
    assert.equal(endpoints[0].name, "copilot-api");
    assert.equal(endpoints[0].url, COPILOT_URL);
    assert.equal(endpoints[0].model, "gpt-4o");
    assert.equal(endpoints[1].name, "models-inference");
    assert.equal(endpoints[1].url, MODELS_URL);
    assert.equal(endpoints[1].model, "openai/gpt-4o");
  });

  test("gpt-4o-mini uses copilot-api first, then models-inference as fallback", () => {
    const endpoints = buildEndpoints("gpt-4o-mini", "openai/gpt-4o-mini", TOKEN);

    assert.equal(endpoints.length, 2);
    assert.equal(endpoints[0].name, "copilot-api");
    assert.equal(endpoints[1].name, "models-inference");
  });

  test("copilot-api endpoint carries x-github-api-version header", () => {
    const endpoints = buildEndpoints("gpt-4o", "openai/gpt-4o", TOKEN);
    const copilot = endpoints[0];

    assert.equal(copilot.headers["x-github-api-version"], "2023-11-08");
  });

  test("bearer token is set correctly on both endpoint types", () => {
    const token = "my-secret-token";

    const gpt41 = buildEndpoints("gpt-4.1", "openai/gpt-4.1", token);
    assert.equal(gpt41[0].headers.authorization, `Bearer ${token}`);

    const gpt4o = buildEndpoints("gpt-4o", "openai/gpt-4o", token);
    assert.equal(gpt4o[0].headers.authorization, `Bearer ${token}`);
    assert.equal(gpt4o[1].headers.authorization, `Bearer ${token}`);
  });
});

describe("buildEndpoints - KEY_GITHUB_TOKEN fallback", () => {
  const TOKEN = "test-token";
  const KEY_TOKEN = "key-github-token";

  test("keyToken adds azure-models-inference endpoint as fallback", () => {
    const endpoints = buildEndpoints("gpt-4.1", "openai/gpt-4.1", TOKEN, KEY_TOKEN);

    assert.equal(endpoints.length, 2);
    assert.equal(endpoints[0].name, "models-inference");
    assert.equal(endpoints[1].name, "azure-models-inference");
    assert.equal(endpoints[1].url, AZURE_MODELS_URL);
    assert.equal(endpoints[1].headers.authorization, `Bearer ${KEY_TOKEN}`);
  });

  test("keyToken alone produces only azure-models-inference endpoint", () => {
    const endpoints = buildEndpoints("gpt-4.1", "openai/gpt-4.1", undefined, KEY_TOKEN);

    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].name, "azure-models-inference");
    assert.equal(endpoints[0].url, AZURE_MODELS_URL);
    assert.equal(endpoints[0].model, "gpt-4.1");
  });

  test("no tokens produces empty endpoints", () => {
    const endpoints = buildEndpoints("gpt-4.1", "openai/gpt-4.1", undefined, undefined);
    assert.equal(endpoints.length, 0);
  });
});
