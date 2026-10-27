import fs from "fs";

const content = fs.readFileSync("test-suite.ps1", "utf8");
const lines = content.split("\n");

let depth = 0;
let inLineComment = false;
let inSingleQuote = false;
let inDoubleQuote = false;
let prevChar = "";

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  inLineComment = false;
  inSingleQuote = false;
  inDoubleQuote = false;

  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const nextCh = line[j + 1] || "";

    // Handle line comments
    if (ch === "#" && !inSingleQuote && !inDoubleQuote) {
      inLineComment = true;
    }

    if (inLineComment) {
      continue;
    }

    // Handle single quotes (but not inside double-quoted strings in PS)
    if (ch === "'" && prevChar !== "\\") {
      inSingleQuote = !inSingleQuote;
    }

    // Handle double quotes (simple check)
    if (ch === '"' && prevChar !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }

    // Count braces only outside strings and comments
    if (!inLineComment && !inSingleQuote && !inDoubleQuote) {
      if (ch === "{") {
        depth++;
        console.log(`Line ${i + 1}: + -> depth=${depth}`);
      }
      if (ch === "}") {
        depth--;
        console.log(`Line ${i + 1}: - -> depth=${depth}`);
      }
    }

    prevChar = ch;
  }
}

console.log("\nFinal depth:", depth);
if (depth > 0) {
  console.log(`Missing ${depth} closing brace(s)}`);
} else if (depth < 0) {
  console.log(`Extra ${Math.abs(depth)} closing brace(s)}`);
}