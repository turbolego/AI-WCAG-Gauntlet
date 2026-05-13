#!/usr/bin/env node

/**
 * Debug script to test Cohere API directly
 * Tests different message formats to identify what works with command-a-reasoning-08-2025
 */

const token = process.env.COHERE_TOKEN;
if (!token) {
  console.error("Error: COHERE_TOKEN environment variable not set");
  process.exit(1);
}

const tests = [
  {
    name: "Test 1: System + User (current approach)",
    messages: [
      { role: "system", content: "You output only valid JSON with keys: html, css, js (all strings)." },
      { role: "user", content: "Generate valid HTML5 with semantic structure, CSS, and JavaScript. Output only JSON." }
    ]
  },
  {
    name: "Test 2: User only (no system message)",
    messages: [
      { role: "user", content: "You are a JSON generator. Generate valid JSON with keys: html, css, js (all strings). Output only valid JSON:\n\n{\n  \"html\": \"<html>...</html>\",\n  \"css\": \"...\",\n  \"js\": \"...\"\n}" }
    ]
  },
  {
    name: "Test 3: Simple user message",
    messages: [
      { role: "user", content: "Output valid JSON: {\"html\": \"<html><body>Hello</body></html>\", \"css\": \"body { color: black; }\", \"js\": \"console.log('test');\"}" }
    ]
  },
  {
    name: "Test 4: User + Assistant format",
    messages: [
      { role: "user", content: "Generate HTML5 web page JSON" },
      { role: "assistant", content: "I'll generate a JSON object with html, css, and js keys." },
      { role: "user", content: "Now output the actual JSON." }
    ]
  }
];

async function runTest(test, model) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Model: ${model}`);
  console.log(`${test.name}`);
  console.log(`Messages: ${JSON.stringify(test.messages, null, 2).substring(0, 200)}...`);
  console.log(`${"=".repeat(80)}`);

  try {
    const response = await fetch("https://api.cohere.ai/compatibility/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        messages: test.messages,
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ FAILED (${response.status})`);
      console.log(`Error: ${data.error_type || "Unknown"}`);
      console.log(`Message: ${data.message || JSON.stringify(data).substring(0, 200)}`);
      return false;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      console.log(`✅ SUCCESS`);
      console.log(`Response (first 300 chars): ${content.substring(0, 300)}...`);
      return true;
    } else {
      console.log(`❌ FAILED - No content in response`);
      console.log(`Full response: ${JSON.stringify(data).substring(0, 300)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  const model = process.argv[2] || "command-a-reasoning-08-2025";
  
  console.log(`Testing Cohere API with model: ${model}`);
  console.log(`Using endpoint: https://api.cohere.ai/compatibility/v1/chat/completions`);

  let successCount = 0;
  for (const test of tests) {
    const success = await runTest(test, model);
    if (success) successCount++;
    
    // Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Summary: ${successCount}/${tests.length} tests passed`);
  console.log(`${"=".repeat(80)}`);

  if (successCount === 0) {
    console.log("\n⚠️  All tests failed. Possible issues:");
    console.log("  1. Model may not support the compatibility endpoint");
    console.log("  2. Model may have specific message format requirements");
    console.log("  3. Token or API key may be invalid");
    console.log("  4. Rate limit may have been exceeded");
  }
}

main().catch(console.error);
