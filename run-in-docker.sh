#!/bin/bash
# Run the benchmark test suite inside a Linux Docker container.
# Provides identical results on Windows (Docker Desktop), macOS, and Linux.
#
# Usage:
#   ./run-in-docker.sh <benchmark-folder>
#
# Example:
#   ./setup.sh
#   ./run-in-docker.sh benchmarks/GPT-4o/GPT-4o-20260503-143757
#
# On first run the image is built and Node dependencies are installed inside
# a named Docker volume so Linux binaries never conflict with host binaries.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="wcag-bench"
# Separate volume keeps Linux node_modules isolated from the host tree,
# preventing binary incompatibilities on macOS/Windows.
VOLUME_NAME="wcag-bench-node-modules"

TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: ./run-in-docker.sh <benchmark-folder>"
    echo "Example: ./run-in-docker.sh benchmarks/GPT-4o/GPT-4o-20260503-143757"
    exit 1
fi

# Resolve to an absolute path
if [[ "$TARGET_DIR" != /* ]]; then
    TARGET_DIR="$SCRIPT_DIR/$TARGET_DIR"
fi
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Path relative to the repo root (used inside the container where CWD=/workspace)
REL_TARGET="${TARGET_DIR#${SCRIPT_DIR}/}"

echo "==> Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

# Install Node.js dependencies inside Docker (Linux binaries, isolated from host).
# The named volume persists between runs so this is fast after the first time.
echo "==> Installing Node.js dependencies in Docker..."
docker run --rm \
    --shm-size=2g \
    -v "$SCRIPT_DIR:/workspace" \
    -v "$VOLUME_NAME:/workspace/node_modules" \
    -w /workspace \
    -e PUPPETEER_SKIP_DOWNLOAD=1 \
    "$IMAGE_NAME" \
    npm ci

echo "==> Running tests for: $REL_TARGET"
docker run --rm \
    --shm-size=2g \
    -v "$SCRIPT_DIR:/workspace" \
    -v "$VOLUME_NAME:/workspace/node_modules" \
    -w /workspace \
    "$IMAGE_NAME" \
    bash test-suite.sh "$REL_TARGET"
