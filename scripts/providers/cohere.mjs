import { parseResponseJson } from "../utils.mjs";
import { SYSTEM_PROMPT, buildUserPrompt, extractFeedbackSummary } from "../common-prompt.mjs";

export default async function generateWithCohere({ model, token, iteration, feedback }) {
  // Debug: log what feedback we received
  if (feedback) {
    const hasHtml5 = feedback.includes('html5_tags_report');
    const hasAxe = feedback.includes('axe_report');
    const hasPa11y = feedback.includes('pa11y_report');
    const hasQualweb = feedback.includes('qualweb_report');
    console.log(`[Cohere] Feedback received: ${feedback.length} chars - html5:${hasHtml5} axe:${hasAxe} pa11y:${hasPa11y} qualweb:${hasQualweb}`);
  } else {
    console.log(`[Cohere] No feedback provided (iteration ${iteration})`);
  }

  const feedbackSummary = extractFeedbackSummary(feedback);
  const userPrompt = buildUserPrompt(iteration, feedbackSummary);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  // Debug: log total message size (Cohere uses 'message' field instead of messages array)
  const fullMessage = `${messages[0].content}\n\n${messages[1].content}`;
  console.log(`[Cohere] Sending message to model: ${fullMessage.length} total chars`);

  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      message: fullMessage,
      max_tokens: 16384
    })
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(`Cohere request failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`);
  }

  const payload = await response.json();
  const messageContent = payload?.text;
  if (!messageContent) {
    throw new Error("Cohere response did not include text.");
  }

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
