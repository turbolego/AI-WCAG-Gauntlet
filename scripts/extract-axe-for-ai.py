#!/usr/bin/env python3
"""
extract-axe-for-ai.py

Reads an axe_report.json and writes a compact JSON containing only the fields
the AI model needs to fix accessibility violations:

  - violation id
  - impact level
  - help text (what to fix)
  - for each failing node (up to 3 per violation):
      - html   : the offending HTML snippet (truncated to 80 chars)
      - message: the first check message explaining why it failed

Usage:
  python3 scripts/extract-axe-for-ai.py <axe_report.json> [output.json]

If no output path is given, the result is printed to stdout.
"""

import json
import sys
from pathlib import Path


MAX_VIOLATIONS = 8
MAX_NODES_PER_VIOLATION = 3
MAX_HTML_LENGTH = 80


def extract_message(node: dict) -> str:
    """Return the first check message from any/all/none arrays."""
    for key in ("any", "all", "none"):
        checks = node.get(key, [])
        if checks and checks[0].get("message"):
            return checks[0]["message"]
    return ""


def compact_violations(report_data: list) -> list:
    """Extract the minimal violation data needed by the AI model."""
    # axe reports are wrapped in a list; violations live on the first entry
    raw_violations = []
    if isinstance(report_data, list) and report_data:
        raw_violations = report_data[0].get("violations", [])
    elif isinstance(report_data, dict):
        raw_violations = report_data.get("violations", [])

    result = []
    for v in raw_violations[:MAX_VIOLATIONS]:
        compact_nodes = []
        for node in v.get("nodes", [])[:MAX_NODES_PER_VIOLATION]:
            html_snippet = (node.get("html") or "")[:MAX_HTML_LENGTH]
            message = extract_message(node)
            compact_nodes.append({"html": html_snippet, "message": message})

        result.append({
            "id": v.get("id", ""),
            "impact": v.get("impact", ""),
            "help": v.get("help", ""),
            "nodes": compact_nodes,
        })

    return result


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    report_data = json.loads(input_path.read_text(encoding="utf-8"))
    compact = compact_violations(report_data)

    output = json.dumps(compact, indent=2, ensure_ascii=False)

    if len(sys.argv) >= 3:
        out_path = Path(sys.argv[2])
        out_path.write_text(output, encoding="utf-8")
        original_size = input_path.stat().st_size
        compact_size = out_path.stat().st_size
        reduction = 100 * (1 - compact_size / original_size) if original_size else 0
        print(f"Written to {out_path}")
        print(f"Original : {original_size:,} bytes")
        print(f"Compact  : {compact_size:,} bytes  ({reduction:.1f}% reduction)")
        print(f"Violations: {len(compact)}")
        for v in compact:
            print(f"  [{v['impact']}] {v['id']}: {len(v['nodes'])} node(s)")
    else:
        print(output)


if __name__ == "__main__":
    main()
