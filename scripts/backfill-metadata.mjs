#!/usr/bin/env node
/**
 * backfill-metadata.mjs
 *
 * Backfills provider, providerLabel, and tool fields into every benchmark
 * folder's metadata.json. Creates metadata.json if it does not exist.
 *
 * Mapping rules (derived from how each model was originally run):
 *   - qwen3.5-32k  → Ollama (local, vscode)
 *   - Folders with a generation.json → derive providerKey from resolvedModel prefix
 *   - All others (no generation.json, not qwen3.5-32k) → GitHub Copilot (vscode)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_DIR = join(__dirname, '..', 'benchmarks');

// Maps generation.json resolvedModel prefix → { providerKey, providerLabel }
const RESOLVED_MODEL_PROVIDER_MAP = [
  { prefix: 'openai/',           providerKey: 'openai',         providerLabel: 'OpenAI'       },
  { prefix: 'meta-llama/',       providerKey: 'huggingface',    providerLabel: 'HuggingFace'  },
  { prefix: 'Qwen/',             providerKey: 'huggingface',    providerLabel: 'HuggingFace'  },
  { prefix: 'google/',           providerKey: 'openrouter',     providerLabel: 'OpenRouter'   },
  { prefix: 'mistral',           providerKey: 'mistral',        providerLabel: 'Mistral AI'   },
  { prefix: 'ministral',         providerKey: 'mistral',        providerLabel: 'Mistral AI'   },
];

// Maps generation.json provider field → { providerKey, providerLabel }
// (overrides resolvedModel-based detection when present)
const GENERATION_PROVIDER_MAP = {
  huggingface:  { providerKey: 'huggingface', providerLabel: 'HuggingFace' },
  mistral:      { providerKey: 'mistral',      providerLabel: 'Mistral AI'  },
  openrouter:   { providerKey: 'openrouter',   providerLabel: 'OpenRouter'  },
  openai:       { providerKey: 'openai',       providerLabel: 'OpenAI'      },
  github:       { providerKey: 'openai',       providerLabel: 'OpenAI'      }, // github actions using openai-compatible api
};

function getProviderFromGeneration(genPath) {
  try {
    const gen = JSON.parse(readFileSync(genPath, 'utf-8'));

    // 1. Use explicit provider field if present
    if (gen.provider && GENERATION_PROVIDER_MAP[gen.provider]) {
      return { ...GENERATION_PROVIDER_MAP[gen.provider], tool: 'github-actions' };
    }

    // 2. Derive from resolvedModel prefix
    const resolved = gen.resolvedModel || '';
    for (const { prefix, providerKey, providerLabel } of RESOLVED_MODEL_PROVIDER_MAP) {
      if (resolved.startsWith(prefix)) {
        return { providerKey, providerLabel, tool: 'github-actions' };
      }
    }

    // 3. Fallback — we know it was an API run
    return { providerKey: 'api', providerLabel: 'API', tool: 'github-actions' };
  } catch {
    return null;
  }
}

let updated = 0;
let created = 0;
let skipped = 0;

for (const modelName of readdirSync(BENCHMARKS_DIR)) {
  const modelDir = join(BENCHMARKS_DIR, modelName);
  if (!statSync(modelDir).isDirectory()) continue;

  // Special case: qwen3.5-32k was always Ollama + vscode
  const isOllama = modelName === 'qwen3.5-32k';

  for (const runName of readdirSync(modelDir)) {
    const runDir = join(modelDir, runName);
    if (!statSync(runDir).isDirectory()) continue;

    const metaPath = join(runDir, 'metadata.json');
    const genPath  = join(runDir, 'generation.json');

    // Determine provider info
    let providerKey, providerLabel, tool;

    if (isOllama) {
      providerKey   = 'ollama';
      providerLabel = 'Ollama';
      tool          = 'vscode';
    } else if (existsSync(genPath)) {
      const result = getProviderFromGeneration(genPath);
      if (!result) {
        console.warn(`  WARN: could not parse generation.json in ${runDir}`);
        skipped++;
        continue;
      }
      ({ providerKey, providerLabel, tool } = result);
    } else {
      // No generation.json → ran locally via GitHub Copilot + vscode
      providerKey   = 'github-copilot';
      providerLabel = 'GitHub Copilot';
      tool          = 'vscode';
    }

    if (existsSync(metaPath)) {
      // Update existing metadata.json
      let meta;
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      } catch {
        console.warn(`  WARN: could not parse ${metaPath}`);
        skipped++;
        continue;
      }

      // Only write if fields are missing or need updating
      if (meta.provider === providerKey && meta.providerLabel === providerLabel && meta.tool === tool) {
        skipped++;
        continue;
      }

      meta.provider      = providerKey;
      meta.providerLabel = providerLabel;
      meta.tool          = tool;
      writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      updated++;
      console.log(`  UPDATED ${metaPath}`);
    } else {
      // Create minimal metadata.json for local-format runs (no existing metadata)
      const meta = {
        model:         modelName,
        folder:        runName,
        provider:      providerKey,
        providerLabel: providerLabel,
        tool:          tool,
      };
      writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      created++;
      console.log(`  CREATED ${metaPath}`);
    }
  }
}

console.log(`\nDone. Created: ${created}, Updated: ${updated}, Skipped (already correct): ${skipped}`);
