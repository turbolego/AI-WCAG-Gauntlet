/**
 * Model configuration with token limits, TPM constraints, and capabilities.
 * Used to optimize prompts and handle rate limiting intelligently.
 * 
 * Data sources:
 * - Cohere models: https://docs.cohere.com (official model docs)
 * - Groq models: https://console.groq.com/docs/models (max output) & 
 *   https://console.groq.com/docs/rate-limits (TPM base limits for Developer plan)
 */

export const MODEL_CONFIG = {
  // Cohere models — specs from https://docs.cohere.com
  "command-r7b-12-2024": {
    maxOutputTokens: 4000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: true
  },
  "command-r-08-2024": {
    maxOutputTokens: 4000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: true
  },
  "command-r-plus-08-2024": {
    maxOutputTokens: 4000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: true
  },
  "command-a-03-2025": {
    maxOutputTokens: 8000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "command-a-reasoning-08-2025": {
    maxOutputTokens: 32000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: true,
    lowTokenLimit: false
  },
  "command-a-translate-08-2025": {
    maxOutputTokens: 8000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "command-a-vision-07-2025": {
    maxOutputTokens: 8000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "c4ai-aya-expanse-32b": {
    maxOutputTokens: 4000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: true
  },
  "c4ai-aya-vision-32b": {
    maxOutputTokens: 4000,
    provider: "cohere",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: true
  },

  // Groq models — specs from https://console.groq.com/docs/models
  "meta-llama/llama-4-scout-17b-16e-instruct": {
    maxOutputTokens: 8192,
    provider: "groq",
    tpmLimit: 500000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "llama-3.3-70b-versatile": {
    maxOutputTokens: 32768,
    provider: "groq",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "llama-3.1-8b-instant": {
    maxOutputTokens: 131072,
    provider: "groq",
    tpmLimit: 500000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "qwen/qwen3-32b": {
    maxOutputTokens: 40960,
    provider: "groq",
    tpmLimit: 500000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
  "openai/gpt-oss-120b": {
    maxOutputTokens: 65536,
    provider: "groq",
    tpmLimit: 200000,
    hasReasoningMode: false,
    lowTokenLimit: false
  },
};

/**
 * Get model configuration with defaults for unknown models.
 */
export function getModelConfig(modelName) {
  return MODEL_CONFIG[modelName] ?? {
    maxOutputTokens: 4096,
    provider: "unknown",
    tpmLimit: 100000,
    hasReasoningMode: false,
    lowTokenLimit: false
  };
}

/**
 * Check if a model has a low token limit (4096 or less).
 */
export function isLowTokenModel(modelName) {
  const config = getModelConfig(modelName);
  return config.lowTokenLimit || config.maxOutputTokens <= 4096;
}

/**
 * Get the safe max_tokens for a model.
 * Accounts for buffer and uses a conservative value for low-token models.
 */
export function getSafeMaxTokens(modelName, overrideDefault = null) {
  const config = getModelConfig(modelName);
  
  if (overrideDefault !== null) {
    return Math.min(overrideDefault, config.maxOutputTokens);
  }

  // For low-token models, use a conservative default
  if (config.lowTokenLimit) {
    return Math.max(2000, Math.floor(config.maxOutputTokens * 0.9));
  }

  // For regular models, use higher default
  return Math.max(4000, Math.floor(config.maxOutputTokens * 0.85));
}
