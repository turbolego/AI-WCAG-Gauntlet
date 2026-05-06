import { InferenceClient } from "@huggingface/inference";
import { parseResponseJson } from "../utils.mjs";
import { SYSTEM_PROMPT, buildUserPrompt, extractFeedbackSummary } from "../common-prompt.mjs";

export default async function generateWithHuggingFace({ model, token, iteration, feedback, isGroq }) {
  // Debug: log what feedback we received
  if (feedback) {
    const hasHtml5 = feedback.includes('html5_tags_report');
    const hasAxe = feedback.includes('axe_report');
    const hasPa11y = feedback.includes('pa11y_report');
    const hasQualweb = feedback.includes('qualweb_report');
    console.log(`[HuggingFace] Feedback received: ${feedback.length} chars - html5:${hasHtml5} axe:${hasAxe} pa11y:${hasPa11y} qualweb:${hasQualweb}`);
  } else {
    console.log(`[HuggingFace] No feedback provided (iteration ${iteration})`);
  }

  const feedbackSummary = extractFeedbackSummary(feedback);
  const userPrompt = buildUserPrompt(iteration, feedbackSummary);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  // Debug: log total message size
  const totalChars = JSON.stringify(messages).length;
  console.log(`[HuggingFace] Sending message to model: ${totalChars} total chars`);

  const client = new InferenceClient(token);
  const chatOptions = {
    model,
    messages,
    max_tokens: 8000
  };
  if (isGroq) {
    chatOptions.provider = "groq";
  }

  const response = await client.chatCompletion(chatOptions);
  const messageContent = response?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("HuggingFace response did not include content.");
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
