import { extractAndRepairJson, REQUIRED_HTML5_TAGS, readFeedback } from "../generate-page.mjs";

export default async function handleOpencode({ modelArg, iteration, previousDir }) {
  // Placeholder: implement actual Opencode provider logic if available
  // For now, fallback to a default error
  return {
    generated: null,
    generatedByModel: false,
    modelError: "Opencode provider not implemented."
  };
}
