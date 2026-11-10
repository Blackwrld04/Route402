#!/usr/bin/env bash
set -euo pipefail

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/contracts/artifacts"
mkdir -p "$ARTIFACTS_DIR"

echo "==> [1/4] Building & testing endpoint-vault (sharded-item-1.0.0)..."
cd "$ROOT_DIR/contracts/endpoint-vault"
cargo test --lib
cargo near build non-reproducible-wasm --no-abi
cp target/near/endpoint_vault.wasm "$ARTIFACTS_DIR/endpoint_vault.wasm"

echo "==> [2/4] Building mock-ft (NEP-141 USDC)..."
cd "$ROOT_DIR/contracts/mock-ft"
cargo near build non-reproducible-wasm --no-abi
cp target/near/mock_ft.wasm "$ARTIFACTS_DIR/mock_ft.wasm"

echo "==> [3/4] Building registry (NEP-171 + NEP-591 Global Contract + Atomic Escrow)..."
cd "$ROOT_DIR/contracts/registry"
cargo near build non-reproducible-wasm --no-abi
cp target/near/registry.wasm "$ARTIFACTS_DIR/registry.wasm"

echo "==> [4/4] Running near-sandbox multi-contract E2E + 6-vector security tests..."
cargo test --test test_security_and_lifecycle -- --nocapture

echo ""
echo "✓ All Route402 Rust contracts built and sandbox security tests passed!"
ls -lh "$ARTIFACTS_DIR"/*.wasm
