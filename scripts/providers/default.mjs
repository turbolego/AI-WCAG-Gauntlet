import { normalizeModel, parseResponseJson, REQUIRED_HTML5_TAGS } from "../utils.mjs";

function normalizeGitHubModel(modelName) {
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

function buildGitHubEndpoints(normalizedModel, primaryToken, fallbackToken) {
  const endpoints = [];
  if (primaryToken) {
    endpoints.push({
      url: "https://models.inference.ai.azure.com/chat/completions",
      headers: { authorization: `Bearer ${primaryToken}` },
      model: normalizedModel,
      label: "GitHub Models API (primary)"
    });
  }
  if (fallbackToken && fallbackToken !== primaryToken) {
    endpoints.push({
      url: "https://models.inference.ai.azure.com/chat/completions",
      headers: { authorization: `Bearer ${fallbackToken}` },
      model: normalizedModel,
      label: "GitHub Models API (fallback)"
    });
  }
  if (primaryToken) {
    endpoints.push({
      url: "https://api.github.com/models/chat/completions",
      headers: {
        authorization: `Bearer ${primaryToken}`,
        "github-api-version": "2024-10-01"
      },
      model: normalizedModel,
      label: "Copilot API"
    });
  }
  return endpoints;
}

async function tryGitHubEndpoints(endpoints, messages) {
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...endpoint.headers
        },
        body: JSON.stringify({
          model: endpoint.model,
          messages,
          max_tokens: 8000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        lastError = new Error(
          `${endpoint.label} request failed (${response.status})`
        );
        continue;
      }

      const payload = await response.json();
      const messageContent = payload?.choices?.[0]?.message?.content;
      if (!messageContent) {
        lastError = new Error(
          `${endpoint.label} response did not include content.`
        );
        continue;
      }

      return messageContent;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("All GitHub endpoints failed.");
}

export default async function generateWithGitHub({ model, token, fallbackToken, iteration, feedback }) {
  const normalizedModel = normalizeGitHubModel(model);
  const endpoints = buildGitHubEndpoints(normalizedModel, token, fallbackToken);

  if (endpoints.length === 0) {
    throw new Error("No GitHub API tokens available.");
  }

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

  const messageContent = await tryGitHubEndpoints(endpoints, messages);
  return parseResponseJson(messageContent);
}
