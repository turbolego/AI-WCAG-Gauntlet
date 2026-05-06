import { normalizeModel, parseResponseJson } from "../utils.mjs";
import { SYSTEM_PROMPT, buildUserPrompt, extractFeedbackSummary } from "../common-prompt.mjs";

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

async function tryGitHubEndpoints(endpoints, messages, feedbackInfo) {
  // Debug: log what feedback we received
  if (feedbackInfo.feedback) {
    const hasHtml5 = feedbackInfo.feedback.includes('html5_tags_report');
    const hasAxe = feedbackInfo.feedback.includes('axe_report');
    const hasPa11y = feedbackInfo.feedback.includes('pa11y_report');
    const hasQualweb = feedbackInfo.feedback.includes('qualweb_report');
    console.log(`[GitHub] Feedback received: ${feedbackInfo.feedback.length} chars - html5:${hasHtml5} axe:${hasAxe} pa11y:${hasPa11y} qualweb:${hasQualweb}`);
  } else {
    console.log(`[GitHub] No feedback provided (iteration ${feedbackInfo.iteration})`);
  }

  // Debug: log total message size
  const totalChars = JSON.stringify(messages).length;
  console.log(`[GitHub] Sending message to model: ${totalChars} total chars`);

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

  const feedbackSummary = extractFeedbackSummary(feedback);
  const userPrompt = buildUserPrompt(iteration, feedbackSummary);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  const messageContent = await tryGitHubEndpoints(endpoints, messages, { feedback, iteration });
  
  // Try to parse JSON - with lenient fallback
  try {
    return parseResponseJson(messageContent);
  } catch (parseError) {
    // Try to extract JSON object from response
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return parseResponseJson(jsonMatch[0]);
      } catch (e) {
        // If still invalid, continue
      }
    }

    // Lenient regex fallback
    const htmlMatch = messageContent.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const cssMatch = messageContent.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    const jsMatch = messageContent.match(/"js"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
    
    if (htmlMatch && cssMatch && jsMatch) {
      const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return {
        html: unescape(htmlMatch[1]),
        css: unescape(cssMatch[1]),
        js: unescape(jsMatch[1])
      };
    }

    throw parseError;
  }
}
