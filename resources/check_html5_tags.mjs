import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = __dirname;

// Load HTML tags
let allTags;
try {
  const htmlTagsData = JSON.parse(fs.readFileSync(path.join(RESOURCES_DIR, 'html_tags.json'), 'utf-8'));
  if (!htmlTagsData || !htmlTagsData.tags || !Array.isArray(htmlTagsData.tags)) {
    console.error('Invalid structure in html_tags.json. Expected a dictionary with a "tags" key.');
    process.exit(1);
  }
  allTags = new Set(htmlTagsData.tags);
} catch (e) {
  console.error(`Error loading html_tags.json: ${e.message}`);
  process.exit(1);
}

// Read index.html
const htmlPath = process.argv[2] || 'index.html';
let htmlContent;
try {
  const contentBuffer = fs.readFileSync(path.resolve(htmlPath));
  let contentStr = contentBuffer.toString('utf8');
  // Strip BOM if present
  if (contentStr.charCodeAt(0) === 0xFEFF) {
    htmlContent = contentStr.slice(1);
  } else {
    htmlContent = contentStr;
  }
  console.log(`Successfully read ${htmlPath}`);
} catch (e) {
  console.error(`Error reading ${htmlPath}: ${e.message}`);
  process.exit(1);
}

// Extract used tags
const usedTags = [...new Set(htmlContent.match(/<\s*([a-zA-Z][a-zA-Z0-9\-]*)\b/g)?.map(t => t.replace(/<\s*([a-zA-Z][a-zA-Z0-9\-]*)\b/, '$1').toLowerCase()) || [])].sort();

// Check for missing tags
const missingTags = [...(allTags.difference(new Set(usedTags)))].sort();

// Generate JSON report
const reportPath = path.join(path.dirname(htmlPath), 'html5_tags_report.json');
fs.writeFileSync(reportPath, JSON.stringify({ used_tags: usedTags, missing_tags: missingTags }, null, 4));
console.log(`JSON report successfully written to ${reportPath}`);

// Output results
if (missingTags.length > 0) {
  console.log('The following HTML5 tags are missing:');
  missingTags.forEach(tag => console.log(`- ${tag}`));
} else {
  console.log('All HTML5 tags are used at least once.');
}