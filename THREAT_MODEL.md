# Route402 Transfer & Treasury Threat Model

When an NFT owns a live NEAR sub-account (`<slug>.<registry>.testnet`) that actively receives `HTTP 402` (`x402`) payments and holds NEP-141 USDC + native NEAR, transferring that NFT across asynchronous cross-contract receipts introduces **six concrete attack vectors**.

Route402 enforces deterministic protocol-level invariants across `contracts/endpoint-vault/src/lib.rs`, `contracts/registry/src/lib.rs`, and `packages/core/src/t2-verifier.ts` to mitigate all six vectors. Coverage is split: `contracts/registry/tests/test_security_and_lifecycle.rs` exercises `T-1`, `T-2`, `T-3`, `T-5`, and `T-6` against `near-sandbox`; `T-4` is covered by the vault unit tests `t4_pending_outflow_blocks_listing` and `t4_pending_outflow_blocks_rotation`. `scripts/verify-onchain.ts` independently checks live Testnet `T2`, `keys: []`, listings, and receipts; it does not re-run every invariant against the deployed contracts.

---

## Threat Matrix (`T-1` through `T-6`)

| ID | Attack Vector | Failure Mode Without Mitigation | Route402 Mitigation | Automated Proof |
| :--- | :--- | :--- | :--- | :--- |
| **`T-1`** | **Residual Access Key Backdoor** | Minter retains a `FullAccess` or `FunctionCall` key on `<slug>.<registry>`, sells the NFT, and later redeploys code or drains funds directly. | `registry::mint_endpoint` creates `<slug>.<registry>` with **zero access keys (`keys: []`)** and binds an immutable **NEP-591 Global Contract** by SHA-256 hash (`use_global_contract`). Every state change must check `predecessor_account_id()`. | `test_security_and_lifecycle.rs` (`vault_account.list_keys().is_empty()`) + `npm run verify:testnet` (`view_access_key_list` == `0`). |
| **`T-2`** | **Seller Mid-Sale Front-Run Drain** | Seller lists the Account-NFT for `1.5 NEAR` showing `\$100 USDC` in the vault, sees buyer's `buy_endpoint` transaction, and front-runs a `withdraw_usdc` call in the prior block. | `registry::list_endpoint` invokes `vault.prepare_listing()`, transitioning the vault into `ItemStatus::Frozen`. Both `nft_item_info().status` and `assert_owner_active_and_settled()` share the **exact same `blocking_condition()` predicate** (`sharded-item-1.0.0` Requirement #9), panicking any withdrawal or config edit while `Frozen`. | `test_security_and_lifecycle.rs` + live NEAR Testnet rejected tx recorded in `testnet-deployment.json`. |
| **`T-3`** | **Stale Inspection / State Swap** | Seller unlists, alters pricing or withdraws funds, and re-lists at the same price before buyer's transaction lands. | Every owner-initiated outflow, config mutation, or listing state change increments a monotonic `state_nonce: u64`. `buy_endpoint(token_id, expected_state_nonce, expected_rotation_seq)` aborts if either counter differs from what the buyer inspected. | `test_security_and_lifecycle.rs` (`expected_state_nonce: "999"` -> `assert_failure()`). |
| **`T-4`** | **In-Flight Async Outflow Race** | Seller initiates `withdraw_usdc` (`Promise` to NEP-141 `ft_transfer`) and immediately lists or transfers the NFT before the callback settles. | Vault tracks `pending_outflows: u32`. Both `prepare_listing()` and `on_registry_rotate()` require `pending_outflows == 0`, while the registry locks `in_flight_tokens` across cross-contract lifecycle callbacks. | Vault unit tests `t4_pending_outflow_blocks_listing` and `t4_pending_outflow_blocks_rotation`; registry `in_flight_tokens` is exercised by the `near-sandbox` E2E. |
| **`T-5`** | **Stale Operator / Session Persistence** | Former owner delegates operational rights to `op.near` before selling, then uses `op.near` after ownership transfers to Bob. | Operators bind to `operator_bound_seq = Some(self.rotation_seq)`. `on_registry_rotate()` increments `rotation_seq` and zeroes `operator_id = None` and `operator_bound_seq = None` atomically. | `test_security_and_lifecycle.rs` (`post_summary["operator_id"].is_null()`). |
| **`T-6`** | **Mid-Sale Inbound `x402` Revenue DoS or Theft** | If freezing a vault blocked all calls, listing an API NFT would cause `HTTP 503` downtime; if inbound calls bumped `state_nonce`, a competitor could pay `\$0.05` to DoS every buyer's `expected_state_nonce`! | `ft_on_transfer` and `pay_native_x402` remain open during `ItemStatus::Frozen` and **never bump `state_nonce`**. Revenue earned while listed stays locked inside the frozen vault and transfers 100% to the buyer upon `on_registry_rotate`. | `test_security_and_lifecycle.rs` + `packages/core/src/__tests__/t2-and-x402.test.ts` + live NEAR Testnet `req-testnet-midsale-2`. |

---

## House of Stake `sharded-item-1.0.0` Tier-2 (`T2`) Forgery Defenses

Any arbitrary NEAR contract can implement a method named `nft_item_info()` and claim to belong to a reputable collection. Before routing or settling `HTTP 402` traffic, `verifyT2ShardedItem()` (`packages/core/src/t2-verifier.ts`) pins a single finalized block height `H` (`finality: "final"`) and executes both RPC views at `block_id = H`:

1. `item = view(accountId, "nft_item_info", {}, H)`
2. `token = view(pinnedCollectionId, "nft_token", { token_id: accountId }, H)`
3. `collSeq = view(pinnedCollectionId, "get_token_rotation_seq", { token_id: accountId }, H)`

It refuses the endpoint if:
- `item.spec !== "sharded-item-1.0.0"` (`REFUSED_UNSUPPORTED_SPEC`)
- `item.collection_id !== pinnedCollectionId` (`REFUSED_UNPINNED_COLLECTION`)
- `item.token_id !== accountId` (`REFUSED_IDENTITY_MISMATCH` — prevents forwarding/aliasing attacks; `endpoint-vault` derives `token_id` directly from `env::current_account_id()`)
- `!item.init` (`REFUSED_UNINITIALIZED`)
- `!token || token.token_id !== item.token_id` (`REFUSED_NOT_IN_COLLECTION`)
- `token.owner_id !== item.owner_id`: compares `item.rotation_seq` vs `collSeq` to separate transient cross-receipt lag (`RETRYABLE_INDEX_LAGGING`) from `REFUSED_INVENTED_ROTATION` (`item < index`) and `REFUSED_OWNER_CORRUPTION` (`item == index`).
