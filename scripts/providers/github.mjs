import { buildTaskPrompt } from "../benchmark-task.mjs";
import { extractAndRepairJson } from "../generate-page.mjs";

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

export async function generateWithModel({ model, normalizedModel, token, keyToken, iteration, feedback, taskContext = {} }) {

  const prompt = buildTaskPrompt({ iteration, ...taskContext });

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
