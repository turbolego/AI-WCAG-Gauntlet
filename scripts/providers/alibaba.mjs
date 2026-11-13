import { buildTaskPrompt } from "../benchmark-task.mjs";
import { extractAndRepairJson } from "../generate-page.mjs";

export async function generateWithAlibaba({ model, token, iteration, feedback, taskContext = {} }) {

  const prompt = buildTaskPrompt({ iteration, ...taskContext });

  const messages = [
    { role: "system", content: "You produce only valid JSON with string fields html, css, js. Never wrap the output in markdown code fences." },
    { role: "user", content: `${prompt}${feedback ? `\n\nPrevious reports:\n${feedback}` : ""}` }
  ];

  const response = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ model, messages, max_tokens: 8000, response_format: { type: "json_object" } })
    }
  );

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Alibaba DashScope request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("Alibaba DashScope response did not include content.");
  }

  const repaired = extractAndRepairJson(messageContent);
  const parsed = JSON.parse(repaired);
  if (parsed?.html == null || parsed?.css == null || parsed?.js == null) {
    throw new Error("Alibaba DashScope response JSON missing html/css/js fields.");
  }

  return {
    html: String(parsed.html),
    css: String(parsed.css),
    js: String(parsed.js)
  };
}
