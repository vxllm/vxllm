#!/bin/bash
set -e

# VxLLM Installer
# Usage: curl -fsSL https://vxllm.com/install.sh | sh

REPO="datahase/vxllm"
INSTALL_DIR="${VXLLM_INSTALL_DIR:-$HOME/.vxllm}"
BIN_DIR="${VXLLM_BIN_DIR:-$HOME/.local/bin}"

echo ""
echo "  ⚡ VxLLM Installer"
echo "  ────────────────────"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
  darwin) PLATFORM="macos" ;;
  linux)  PLATFORM="linux" ;;
  *)      echo "  ✗ Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)             echo "  ✗ Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "  Platform: $PLATFORM ($ARCH)"
echo "  Install:  $INSTALL_DIR"
echo ""

# Check for bun
if ! command -v bun &> /dev/null; then
  echo "  Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Clone and install
echo "  Cloning VxLLM..."
git clone --depth 1 https://github.com/$REPO.git "$INSTALL_DIR" 2>/dev/null || {
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR" && git pull --ff-only
}

cd "$INSTALL_DIR"
echo "  Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# Create symlink
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/apps/cli/src/index.ts" "$BIN_DIR/vxllm"

# Add to PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "  Add to your shell profile:"
  echo "    export PATH=\"$BIN_DIR:\$PATH\""
fi

echo ""
echo "  ✓ VxLLM installed successfully!"
echo ""
echo "  Get started:"
echo "    vxllm pull qwen2.5:7b"
echo "    vxllm serve"
echo ""
