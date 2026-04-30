import json
import os
import re

# Update the path to the resources directory
RESOURCES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../resources"))
try:
    with open(f"{RESOURCES_DIR}/html_tags.json", 'r') as f:
        html_tags = json.load(f)
        if not isinstance(html_tags, dict) or 'tags' not in html_tags:
            raise ValueError("Invalid structure in html_tags.json. Expected a dictionary with a 'tags' key.")
        all_tags = set(html_tags['tags'])
except Exception as e:
    print(f"Error loading html_tags.json: {e}")
    exit(1)

# Read the content of the index.html file
try:
    import sys
    if len(sys.argv) > 1:
        html_path = sys.argv[1]
    else:
        html_path = 'index.html'
    with open(html_path, 'r', encoding='utf-8-sig') as f:
        html_content = f.read()
        print(f"Successfully read {html_path}")
except UnicodeDecodeError:
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            print(f"Successfully read {html_path} with utf-8")
    except Exception as e:
        print(f"Error reading {html_path}: {e}")
        exit(1)
except Exception as e:
    print(f"Error reading {html_path}: {e}")
    exit(1)

# Debugging: Log the full content of the HTML file to ensure it is being read correctly
print("Full HTML content:", html_content)

# Refine regex to ensure it captures all valid tags, including custom and less common tags
# Normalize to lowercase to match with json list
used_tags = sorted(set(tag.lower() for tag in re.findall(r'<\s*([a-zA-Z][a-zA-Z0-9\-]*)\b', html_content)))

# Debugging: Log detected tags and raw HTML content
print("Detected tags:", used_tags)
print("Raw HTML content:", html_content[:500])  # Print first 500 characters for context

# Check for missing tags
missing_tags = sorted(all_tags - set(used_tags))
print("Missing tags:", missing_tags)

# Generate the JSON report
report_path = os.path.join(os.path.dirname(html_path), 'html5_tags_report.json')
try:
    with open(report_path, 'w') as report_file:
        json.dump({"used_tags": used_tags, "missing_tags": missing_tags}, report_file, indent=4)
    print(f"JSON report successfully written to {report_path}")
except Exception as e:
    print(f"Error writing JSON report: {e}")

# Output the results
if missing_tags:
    print("The following HTML5 tags are missing:")
    for tag in missing_tags:
        print(f"- {tag}")
else:
    print("All HTML5 tags are used at least once.")