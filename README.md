# Route402 — Cash-Flowing `x402` Endpoints as Sharded NEAR Account-NFTs

> **Primary Track:** `nfts` (*NFTs That Do Something*) · **Secondary Relevance:** `realworld` (*Real World Payments*), `agents` (*Agent Economy*)  
> **License:** MIT · **Standards:** NEP-171, NEP-177, NEP-181, NEP-141, **NEP-591 Global Contracts**, House of Stake **`sharded-item-1.0.0`**, **`HTTP 402` (`x402`)**, **NEAR Intents 1Click API**, **MCP (`2025-03-26`)**

**Route402** turns every monetized API or Model Context Protocol (MCP) tool into a **tradeable, self-custodial NEAR sub-account NFT**.

When a developer mints an endpoint on `r402-reg-v1.testnet`, the registry atomically creates a **keyless NEAR sub-account** (`<slug>.r402-reg-v1.testnet`, `keys: []`), binds an immutable **NEP-591 Global Contract** (`0.25 NEAR` per mint instead of `~2 NEAR`), and exposes an **`HTTP 402 Payment Required` (`x402`)** reverse proxy + MCP tool. Every micropayment from AI agents—settled in NEP-141 USDC, native NEAR, or cross-chain from Base/Solana/Arbitrum/Ethereum via **NEAR Intents 1Click**—lands directly inside that NFT's sub-account treasury. Transferring or selling the NFT atomically rotates ownership of both the live revenue stream and its accrued treasury while blocking seller mid-sale front-running (`Threat T-1`..`T-6`).

---

## Quick Verification for Judges (`do X -> see Y`)

Zero API keys, wallets, or `.env` files are required to verify both the deterministic local suite and the live deployed NEAR Testnet contracts.

### 1. Install & Run Automated Unit + E2E Gateway/Agent Tests (`< 15s`)
- **Do:**
  ```bash
  npm install
  npm test
  npm run typecheck
  ```
- **See:** Vitest passes **3 test files / 15 tests** (`House of Stake sharded-item-1.0.0 T0 & T2 Verification` forgery checks, full `HTTP 402 -> X-PAYMENT -> 200 OK`, blocked seller mid-sale drain `Threat T-2`, atomic ownership handover, x402 replay rejection, agent `payTo`/T2 trust boundaries, TEE truthfulness, and static-path traversal checks), and `tsc` verifies all 4 workspaces with zero errors.

### 2. Verify Live Deployed Contracts on NEAR Testnet (`Zero Keys Required`)
- **Do:**
  ```bash
  npm run verify:testnet
  ```
- **See:** Queries finalized blocks on `https://test.rpc.fastnear.com` directly, proving:
  - `r402-reg-v1.testnet` reports vault deploy mode `nep591-global-hash:1bbce4c18cc8cb838730db0a792b0ebece17ac22f03917fa66270c959164bc03`.
  - `alpha-signal.r402-reg-v1.testnet` passes pinned-block **`T2` pair verification**, has **`keys: []` (`0` access keys)**, rotated atomically from Alice to `r402-bob-v1.testnet` (`rotation_seq=1`), and holds `$0.10 USDC` across 2 settled `x402` calls.
  - `tee-auditor.r402-reg-v1.testnet` passes **`T2` pair verification**, has **`keys: []` (`0` access keys)**, is actively listed in **`Frozen` atomic escrow** (`2 NEAR`, `state_nonce=1`), and holds `$0.16 USDC` across 2 settled `x402` calls (including a live mid-sale payment while `Frozen`).

### 3. Run the End-to-End Judge Walkthrough (`Simulated` & `Live Dry-Quote` Modes)
- **Do (Zero-Key Deterministic Sandbox Walkthrough):**
  ```bash
  npm run demo -- --once
  ```
- **See:** Boots the `x402` gateway, discovers endpoints via `GET /.well-known/x402`, executes an autonomous `Route402AgentClient` `402 -> X-PAYMENT -> 200 OK` call while `Frozen`, proves seller mid-sale withdrawal is rejected with `HTTP 409 BLOCKED [Threat T-2]`, executes atomic `buy_endpoint` handover to Bob, and previews a `1Click` cross-chain quote.
- **Do (Live NEAR Testnet RPC + Live `1click.chaindefuser.com` Cross-Chain Quote):**
  ```bash
  npm run start:dry -- --once
  ```
- **See:** Discovers the real `r402-reg-v1.testnet` Account-NFTs from NEAR Testnet RPC and fetches a live cross-chain `Base USDC -> NEAR USDC` quote from `https://1click.chaindefuser.com/v0/quote` (`liveApi=true`).

### 4. Launch Interactive Web Console + `x402` Gateway
- **Do:**
  ```bash
  npm run web:build
  npm run demo
  ```
- **See:** Opens the Route402 `x402` Gateway on `http://127.0.0.1:4402` and the Web Console on `http://127.0.0.1:4173` (toggle between **Simulated sandbox** and **Live NEAR Testnet** in the top navigation bar).

### 5. Build & Test All 3 Rust Smart Contracts in `near-sandbox` (Requires Rust `>= 1.95` + `cargo-near`)
- **Do:**
  ```bash
  npm run test:contracts
  ```
- **See:** Compiles `endpoint_vault.wasm`, `mock_ft.wasm`, and `registry.wasm`, runs 6 vault unit tests, and executes a real `near-sandbox` multi-contract E2E test (`contracts/registry/tests/test_security_and_lifecycle.rs`). The suite covers NEP-591 Global Contract deployment plus `T-1`, `T-2`, `T-3`, `T-5`, and `T-6`; `T-4` (in-flight outflow race) is covered by the vault unit tests `t4_pending_outflow_blocks_listing` and `t4_pending_outflow_blocks_rotation`.

---

## Live NEAR Testnet Deployment & Onchain Proofs

| Component | NEAR Testnet Account / Hash | Explorer Link |
| :--- | :--- | :--- |
| **Sharded Collection Registry** (`NEP-171` + Escrow) | `r402-reg-v1.testnet` | https://testnet.nearblocks.io/address/r402-reg-v1.testnet |
| **NEP-591 Global Vault SHA-256** (`175.3 KB` immutable) | `1bbce4c18cc8cb838730db0a792b0ebece17ac22f03917fa66270c959164bc03` | Verified via `get_vault_deploy_mode()` |
| **Test USDC (`NEP-141`)** | `r402-usdc-v1.testnet` | https://testnet.nearblocks.io/address/r402-usdc-v1.testnet |
| **Account-NFT #1** (Sold to Bob, `rotation_seq=1`) | `alpha-signal.r402-reg-v1.testnet` | https://testnet.nearblocks.io/address/alpha-signal.r402-reg-v1.testnet |
| **Account-NFT #2** (`Frozen` in `2 NEAR` Escrow) | `tee-auditor.r402-reg-v1.testnet` | https://testnet.nearblocks.io/address/tee-auditor.r402-reg-v1.testnet |
| **Proof Tx — Blocked Seller Mid-Sale Drain (`T-2`)** | `4y4gSjQpXx8kuj7kqcobkW6dWe16NK5eAc6jKLCdejbs` | https://testnet.nearblocks.io/txns/4y4gSjQpXx8kuj7kqcobkW6dWe16NK5eAc6jKLCdejbs |
| **Proof Tx — Mid-Sale `x402` USDC Settlement (`T-6`)** | `2sct1tUAS16xTdbxeSgUzzHHDu9D9eq4ex65kCrwQJX8` | https://testnet.nearblocks.io/txns/2sct1tUAS16xTdbxeSgUzzHHDu9D9eq4ex65kCrwQJX8 |

---

## Architecture & Repository Layout

```text
route402/
├── contracts/
│   ├── endpoint-vault/     # Keyless child contract (`sharded-item-1.0.0`, NEP-141 receiver, Frozen escrow guard)
│   ├── registry/           # Parent NEP-171/177/181 collection + NEP-591 Global Contract + Atomic Escrow Market
│   ├── mock-ft/            # NEP-141 6-decimal USDC test token with open faucet
│   └── artifacts/          # Compiled WASMs + `testnet-deployment.json`
├── packages/
│   ├── core/               # Pinned-block `T2` pair verifier, NEAR Intents 1Click client, `x402` wire codecs
│   ├── x402-gateway/       # HTTP 402 reverse proxy, `/.well-known/x402` discovery, NEAR AI Cloud adapter (attestation unverified)
│   └── agent-mcp/          # `Route402AgentClient` + JSON-RPC 2.0 stdio MCP server (`npm run mcp`)
├── apps/
│   └── web/                # React + Vite console (Simulated Sandbox + Live NEAR Testnet RPC + NearConnector)
├── scripts/
│   ├── demo.ts             # Unified judge runner (`demo`, `dry`, `live`, `--once`)
│   ├── verify-onchain.ts   # Zero-key live NEAR Testnet `T2` & `keys: []` verifier
│   ├── deploy-testnet.ts   # Repeatable `near-cli-rs` Testnet deployment & E2E seeder
│   └── test-contracts.sh   # Rust unit + WASM + `near-sandbox` E2E runner
└── THREAT_MODEL.md         # Formal 6-vector Transfer & Treasury Threat Model (`T-1`..`T-6`)
```

---

## Honest Runtime Mode Matrix

Route402 never disguises simulated responses as live mainnet settlements. Every HTTP response and CLI banner explicitly labels `mode` and `simulated: true | false`:

| Feature | `demo` (`npm run demo`) | `dry` (`npm run start:dry`) | `live` (`npm run start:live`) |
| :--- | :--- | :--- | :--- |
| **Account-NFT State & `T2` Verifier** | Deterministic in-process `SandboxChainMirror` | **Live NEAR Testnet RPC** (`final` blocks) | **Live NEAR Testnet RPC** (`final` blocks) |
| **`HTTP 402` (`x402`) Settlement** | Simulated instant ledger (`simulated: true`); duplicate `request_id` rejected | Verifies `is_request_paid()` onchain, then consumes the `request_id` in the gateway replay cache | Verifies `is_request_paid()` onchain, then consumes the `request_id` in the gateway replay cache |
| **NEAR Intents 1Click Quotes** | Offline deterministic fallback | **Live `POST https://1click.chaindefuser.com/v0/quote`** (`dry: true`) | **Live `1click.chaindefuser.com`** (`dry: false` deposit addresses) |
| **NEAR AI Cloud Inference (`tee-auditor`)** | Deterministic structured preview (unless `NEAR_AI_API_KEY` set) | Live `cloud-api.near.ai` if `NEAR_AI_API_KEY` set; response digest recorded, **TEE attestation not independently verified** | Same as `dry` |
| **Required Secrets / Keys** | **None** | **None** (read-only verification) | **None** for read-only `start:live`; wallet / `.near-credentials` only when an operator signs `ft_transfer_call`, listing, or buy transactions |

See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the complete 6-vector security specification (`T-1` through `T-6`) and House of Stake `sharded-item-1.0.0` `T2` pair verification clauses.

