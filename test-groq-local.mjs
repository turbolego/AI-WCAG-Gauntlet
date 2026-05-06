#!/usr/bin/env node

/**
 * Local test script to verify Groq model works with reverted code
 * Usage: node test-groq-local.mjs [--iteration N] [--model MODEL] [--output-dir DIR] [--previous-dir DIR]
 * 
 * Examples:
 *   node test-groq-local.mjs --iteration 1 --output-dir /tmp/test-groq
 *   node test-groq-local.mjs --iteration 2 --previous-dir ./benchmarks/meta-llama-*/meta-llama-*-20260504-010641 --output-dir /tmp/test-groq
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

// Support .env for local testing
try {
  if (process.env.NODE_ENV !== "production") {
    await import("dotenv").then(dotenv => dotenv.config());
  }
} catch (e) {
  // Ignore if dotenv is not installed
}

// Parse command line arguments
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1]?.startsWith("--") ? true : argv[i + 1];
      if (value !== true && value !== undefined) i++;
      args[key] = value || true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const iteration = args.iteration || "1";
  const model = args.model || "meta-llama/Llama-4-Scout-17B-16E-Instruct";
  const outputDir = args["output-dir"] || `/tmp/test-groq-${Date.now()}`;
  const previousDir = args["previous-dir"];
  const hfToken = process.env.HF_TOKEN;

  if (!hfToken) {
    console.error("❌ Error: HF_TOKEN environment variable not set");
    console.error("   Set it with: export HF_TOKEN=your_token");
    process.exit(1);
  }

  console.log("=== Local Groq Test (Reverted Code) ===");
  console.log(`Model: ${model}`);
  console.log(`Iteration: ${iteration}`);
  console.log(`Output Dir: ${outputDir}`);
  console.log(`HF Token: ${hfToken.slice(0, 10)}...`);
  if (previousDir) {
    console.log(`Previous Dir: ${previousDir}`);
  }
  console.log("");

  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Build command
    let cmd = `node scripts/generate-page.mjs --provider huggingface --model "${model}" --iteration ${iteration} --outputDir "${outputDir}"`;
    
    if (previousDir) {
      cmd += ` --previousDir "${previousDir}"`;
    }

    console.log("🚀 Running command:");
    console.log(`   ${cmd}`);
    console.log("");

    // Run generate-page with environment
    const env = { ...process.env, HF_TOKEN: hfToken };
    execSync(cmd, { 
      stdio: "inherit",
      env,
      cwd: process.cwd()
    });

    console.log("");
    console.log("✅ Success! Generated files:");
    console.log(`  - ${path.join(outputDir, "index.html")}`);
    console.log(`  - ${path.join(outputDir, "style.css")}`);
    console.log(`  - ${path.join(outputDir, "script.js")}`);
    
    // Show HTML size
    const htmlPath = path.join(outputDir, "index.html");
    const htmlContent = await fs.readFile(htmlPath, "utf8");
    console.log(`  HTML size: ${htmlContent.length} bytes`);
    
    // Check for semantic tags
    const tags = ["<article", "<section", "<nav", "<aside", "<header", "<footer"];
    const found = tags.filter(tag => htmlContent.includes(tag));
    console.log(`  Semantic tags found: ${found.length}/${tags.length} (${found.join(", ")})`);
    
    console.log("");
    console.log("📝 View results:");
    console.log(`  open ${outputDir}/index.html`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
