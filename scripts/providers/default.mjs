export default async function handleDefault({ modelArg, iteration, previousDir }) {
  // This is a fallback provider for unknown or unsupported providers
  return {
    generated: null,
    generatedByModel: false,
    modelError: `No provider logic implemented for: ${modelArg}`
  };
}
