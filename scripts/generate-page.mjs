// Support .env for local testing (dotenv is a dev dependency)
try {
  if (process.env.NODE_ENV !== "production") {
    await import("dotenv").then(dotenv => dotenv.config());
  }
} catch (e) {
  // Ignore if dotenv is not installed
}
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import utilities
import {
  parseResponseJson,
  REQUIRED_HTML5_TAGS,
  readFeedback,
  parseArgs,
  normalizeModel,
  defaultPage
} from "./utils.mjs";

// Import provider implementations
import generateWithOpenRouter from "./providers/openrouter.mjs";
import generateWithMistral from "./providers/mistral.mjs";
import generateWithOpenCode from "./providers/opencode.mjs";
import generateWithLLM7 from "./providers/llm7.mjs";
import generateWithHuggingFace from "./providers/huggingface.mjs";
import generateWithCohere from "./providers/cohere.mjs";
import generateWithCloudflare from "./providers/cloudflare.mjs";
import generateWithGitHub from "./providers/default.mjs";

/**
 * Write index.html, style.css, and script.js to the output directory.
 */
async function writePage(outputDir, html, css, js) {
  await fs.writeFile(path.join(outputDir, "index.html"), html, "utf8");
  await fs.writeFile(path.join(outputDir, "style.css"), css, "utf8");
  await fs.writeFile(path.join(outputDir, "script.js"), js, "utf8");
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(process.argv);
  const modelArg = args.model || "gpt-4o";
  const provider = args.provider || "github";
  const outputDir = args.outputDir;
  const iteration = args.iteration || "1";
  const previousDir = args.previousDir;

  if (!outputDir) {
    throw new Error("--outputDir argument is required");
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Read feedback from previous iteration if available
  const feedback = await readFeedback(previousDir);

  let generated = null;
  let generatedByModel = false;
  let modelError = null;
  let resolvedModel = modelArg;

  try {
    switch (provider) {
      case "openrouter": {
        const token = process.env.OPENROUTER_TOKEN;
        if (!token) {
          modelError = "No OPENROUTER_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithOpenRouter({ model: modelArg, token, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "mistral": {
        const token = process.env.MISTRAL_TOKEN;
        if (!token) {
          modelError = "No MISTRAL_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithMistral({ model: modelArg, token, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "opencode": {
        const token = process.env.OPENCODE_TOKEN;
        if (!token) {
          modelError = "No OPENCODE_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithOpenCode({ model: modelArg, token, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "llm7": {
        const token = process.env.LLM7_TOKEN;
        if (!token) {
          modelError = "No LLM7_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithLLM7({ model: modelArg, token, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "huggingface":
      case "groq": {
        const token = provider === "groq"
          ? (process.env.GROQ_TOKEN || process.env.HUGGINGFACE_TOKEN)
          : process.env.HUGGINGFACE_TOKEN;
        if (!token) {
          modelError = provider === "groq"
            ? "No GROQ_TOKEN or HUGGINGFACE_TOKEN available."
            : "No HUGGINGFACE_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithHuggingFace({
            model: modelArg,
            token,
            iteration,
            feedback,
            isGroq: provider === "groq"
          });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "cohere": {
        const token = process.env.COHERE_TOKEN;
        if (!token) {
          modelError = "No COHERE_TOKEN available.";
          break;
        }
        try {
          generated = await generateWithCohere({ model: modelArg, token, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "cloudflare": {
        const token = process.env.CLOUDFLARE_TOKEN;
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        if (!token || !accountId) {
          modelError = "No CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID available.";
          break;
        }
        try {
          generated = await generateWithCloudflare({ model: modelArg, token, accountId, iteration, feedback });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      case "github":
      default: {
        const primaryToken = process.env.GITHUB_TOKEN;
        const fallbackToken = process.env.MODELS_TOKEN || process.env.KEY_GITHUB_TOKEN;
        if (!primaryToken && !fallbackToken) {
          modelError = "No GITHUB_TOKEN available.";
          break;
        }
        try {
          resolvedModel = normalizeModel(modelArg);
          generated = await generateWithGitHub({
            model: modelArg,
            token: primaryToken,
            fallbackToken,
            iteration,
            feedback
          });
          generatedByModel = true;
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
        }
        break;
      }
    }
  } catch (error) {
    modelError = error instanceof Error ? error.message : String(error);
  }

  // Use fallback page if generation failed
  if (!generated) {
    console.warn(`Model generation fallback used: ${modelError}`);
    generated = defaultPage();
  }

  // Write page files
  await writePage(outputDir, generated.html, generated.css, generated.js);

  // Write generation.json with metadata
  const metadata = {
    requestedModel: modelArg,
    resolvedModel,
    provider,
    generatedByModel,
    ...(modelError && { generationError: modelError })
  };
  await fs.writeFile(
    path.join(outputDir, "generation.json"),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  console.log(`✓ Generated page for ${provider}/${modelArg} in ${outputDir}`);
}

// Entry point guard (outside main function)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
