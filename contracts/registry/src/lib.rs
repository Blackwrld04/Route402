use near_sdk::json_types::{Base64VecU8, U64, U128};
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, Gas, NearToken, PanicOnDefault, Promise, env, ext_contract, near, require,
};

const GAS_FOR_VAULT_INIT: Gas = Gas::from_tgas(35);
const GAS_FOR_MINT_CALLBACK: Gas = Gas::from_tgas(25);
const GAS_FOR_VAULT_HOOK: Gas = Gas::from_tgas(25);
const GAS_FOR_HOOK_CALLBACK: Gas = Gas::from_tgas(25);

const MIN_GLOBAL_VAULT_SEED_YOCTO: u128 = 220_000_000_000_000_000_000_000; // 0.22 NEAR seed when using NEP-591 Global Contract
const REGISTRY_INDEX_RESERVE_YOCTO: u128 = 30_000_000_000_000_000_000_000; // 0.03 NEAR registry storage reserve
const LOCAL_WASM_BUFFER_YOCTO: u128 = 250_000_000_000_000_000_000_000; // 0.25 NEAR state buffer on top of WASM byte stake

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ItemStatus {
    Parked,
    Suspended,
    Expired,
    Frozen,
    Active,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct NftItemInfo {
    pub spec: String,
    pub init: bool,
    pub status: ItemStatus,
    pub collection_id: AccountId,
    pub token_id: String,
    pub owner_id: AccountId,
    pub rotation_seq: U64,
    pub rotation_epoch: u32,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct VaultListingSnapshot {
    pub state_nonce: U64,
    pub rotation_seq: U64,
    pub vault_usdc_balance: U128,
}

#[ext_contract(ext_endpoint_vault)]
pub trait ExtEndpointVault {
    fn prepare_listing(&mut self) -> VaultListingSnapshot;
    fn cancel_listing(&mut self);
    fn on_registry_rotate(
        &mut self,
        new_owner_id: AccountId,
        sale_price_yocto: Option<U128>,
    ) -> NftItemInfo;
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<Base64VecU8>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct StoredToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub rotation_seq: u64,
    pub metadata: TokenMetadata,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct MarketListing {
    pub token_id: String,
    pub seller_id: AccountId,
    pub sale_price_yocto: U128,
    pub listed_state_nonce: U64,
    pub listed_rotation_seq: U64,
    pub listed_at_ms: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EndpointRegistryContract {
    admin_id: AccountId,
    usdc_contract_id: AccountId,
    config_epoch: u32,
    contract_metadata: NFTContractMetadata,
    vault_global_hash: Option<[u8; 32]>,
    vault_wasm: Option<Vec<u8>>,
    tokens_by_id: LookupMap<String, StoredToken>,
    token_ids: Vec<String>,
    listings: LookupMap<String, MarketListing>,
    listed_ids: Vec<String>,
    in_flight_tokens: LookupMap<String, bool>,
}

#[near]
impl EndpointRegistryContract {
    #[init]
    pub fn new(admin_id: AccountId, usdc_contract_id: AccountId) -> Self {
        Self {
            admin_id,
            usdc_contract_id,
            config_epoch: 1,
            contract_metadata: NFTContractMetadata {
                spec: "nft-1.0.0".to_string(),
                name: "Route402 Cash-Flowing x402 Endpoints".to_string(),
                symbol: "R402".to_string(),
                icon: None,
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
            vault_global_hash: None,
            vault_wasm: None,
            tokens_by_id: LookupMap::new(b"t"),
            token_ids: Vec::new(),
            listings: LookupMap::new(b"l"),
            listed_ids: Vec::new(),
            in_flight_tokens: LookupMap::new(b"f"),
        }
    }

    // =========================================================================
    // Vault Bytecode Provisioning (NEP-591 Global Contract + Local WASM Fallback)
    // =========================================================================

    /// Publishes raw `endpoint_vault.wasm` passed via transaction input as an immutable
    /// NEP-591 Global Contract pinned by SHA-256 code hash (`use_global_contract`).
    #[payable]
    pub fn publish_global_vault_wasm(&mut self) -> Promise {
        self.assert_admin();
        let code = env::input().expect("Expected raw WASM bytes in transaction input");
        require!(!code.is_empty(), "Empty WASM payload");
        let hash = env::sha256_array(&code);
        self.vault_global_hash = Some(hash);
        self.config_epoch = self.config_epoch.saturating_add(1);
        Promise::new(env::current_account_id()).deploy_global_contract(code)
    }

    /// Points the registry at an already-published NEP-591 Global Contract SHA-256 hash.
    pub fn set_vault_global_hash(&mut self, code_hash_hex: String) {
        self.assert_admin();
        let parsed = decode_hex_32(&code_hash_hex);
        self.vault_global_hash = Some(parsed);
        self.config_epoch = self.config_epoch.saturating_add(1);
    }

    /// Uploads raw `endpoint_vault.wasm` bytes via `env::input()` for direct sub-account deployment
    /// when NEP-591 Global Contract mode is not enabled.
    pub fn upload_vault_wasm(&mut self) -> U64 {
        self.assert_admin();
        let code = env::input().expect("Expected raw WASM bytes in transaction input");
        require!(!code.is_empty(), "Empty WASM payload");
        let len = code.len() as u64;
        self.vault_wasm = Some(code);
        self.config_epoch = self.config_epoch.saturating_add(1);
        U64(len)
    }

    pub fn get_vault_deploy_mode(&self) -> String {
        if let Some(h) = &self.vault_global_hash {
            format!("nep591-global-hash:{}", encode_hex(h))
        } else if let Some(w) = &self.vault_wasm {
            format!("embedded-wasm:{}bytes", w.len())
        } else {
            "unconfigured".to_string()
        }
    }

    pub fn required_mint_deposit(&self) -> U128 {
        U128(self.compute_required_mint_deposit().0 + REGISTRY_INDEX_RESERVE_YOCTO)
    }

    // =========================================================================
    // House of Stake `sharded-item-1.0.0` Collection-Side Anchors
    // =========================================================================

    pub fn config_epoch(&self) -> u32 {
        self.config_epoch
    }

    pub fn get_token_rotation_seq(&self, token_id: String) -> Option<U64> {
        self.tokens_by_id.get(&token_id).map(|t| U64(t.rotation_seq))
    }

    pub fn get_usdc_contract_id(&self) -> AccountId {
        self.usdc_contract_id.clone()
    }

    // =========================================================================
    // Keyless Sharded Sub-Account Minting (`<slug>.<registry>`)
    // =========================================================================

    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn mint_endpoint(
        &mut self,
        slug: String,
        owner_id: Option<AccountId>,
        title: String,
        description: String,
        category: String,
        upstream_slug: String,
        mcp_tool_name: Option<String>,
        price_per_call_usdc: U128,
        price_per_call_yocto: U128,
    ) -> Promise {
        validate_slug(&slug);
        let subaccount_str = format!("{}.{}", slug, env::current_account_id());
        let subaccount_id: AccountId = subaccount_str
            .parse()
            .expect("Invalid sub-account identifier");

        require!(
            !self.tokens_by_id.contains_key(&subaccount_str),
            "Endpoint sub-account NFT already exists"
        );
        require!(
            !self.is_in_flight(&subaccount_str),
            "Endpoint mint or rotation already in flight"
        );

        let (seed_yocto, use_global) = self.compute_required_mint_deposit();
        let min_total = seed_yocto.saturating_add(REGISTRY_INDEX_RESERVE_YOCTO);
        let attached = env::attached_deposit().as_yoctonear();
        require!(
            attached >= min_total,
            format!(
                "Insufficient deposit: attach at least {} yoctoNEAR to seed sharded sub-account",
                min_total
            )
        );

        let payer_id = env::predecessor_account_id();
        let target_owner = owner_id.unwrap_or_else(|| payer_id.clone());
        let tool_name = mcp_tool_name
            .unwrap_or_else(|| format!("call_{}", slug.replace('-', "_")));

        let init_args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "collection_id": env::current_account_id(),
            "owner_id": target_owner,
            "usdc_contract_id": self.usdc_contract_id,
            "title": title,
            "description": description,
            "category": category,
            "upstream_slug": upstream_slug,
            "mcp_tool_name": tool_name,
            "price_per_call_usdc": price_per_call_usdc,
            "price_per_call_yocto": price_per_call_yocto,
        }))
        .expect("Failed to serialize vault init args");

        let extra_json = near_sdk::serde_json::json!({
            "spec": "sharded-item-1.0.0",
            "category": category,
            "upstream_slug": upstream_slug,
            "mcp_tool_name": tool_name,
            "price_per_call_usdc": price_per_call_usdc.0.to_string(),
            "price_per_call_yocto": price_per_call_yocto.0.to_string(),
            "keyless_vault": true,
        })
        .to_string();

        let metadata = TokenMetadata {
            title: Some(title),
            description: Some(description),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp_ms().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: Some(env::block_timestamp_ms().to_string()),
            extra: Some(extra_json),
            reference: None,
            reference_hash: None,
        };

        self.in_flight_tokens.insert(subaccount_str.clone(), true);

        // Threat T-1 Mitigation: Create sub-account with ZERO access keys (`add_full_access_key` is NEVER called).
        let mut batch = Promise::new(subaccount_id)
            .create_account()
            .transfer(NearToken::from_yoctonear(seed_yocto));

        batch = if use_global {
            let hash = self.vault_global_hash.expect("Missing global vault hash");
            batch.use_global_contract(hash)
        } else {
            let code = self.vault_wasm.clone().expect("Missing vault WASM");
            batch.deploy_contract(code)
        };

        batch
            .function_call(
                "new".to_string(),
                init_args,
                NearToken::from_yoctonear(0),
                GAS_FOR_VAULT_INIT,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_MINT_CALLBACK)
                    .on_mint_complete(
                        subaccount_str,
                        target_owner,
                        payer_id,
                        U128(attached),
                        U128(min_total),
                        metadata,
                    ),
            )
    }

    #[private]
    pub fn on_mint_complete(
        &mut self,
        token_id: String,
        owner_id: AccountId,
        payer_id: AccountId,
        attached_deposit: U128,
        min_required: U128,
        metadata: TokenMetadata,
    ) -> Option<JsonToken> {
        self.in_flight_tokens.remove(&token_id);

        if env::promise_result_checked(0, 1024).is_err() {
            if attached_deposit.0 > 0 {
                let _ = Promise::new(payer_id.clone())
                    .transfer(NearToken::from_yoctonear(attached_deposit.0));
            }
            env::log_str(&format!(
                r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_mint_failed","data":[{{"token_id":"{}","payer_id":"{}","refunded_yocto":"{}"}}]}}"#,
                token_id, payer_id, attached_deposit.0
            ));
            return None;
        }

        let stored = StoredToken {
            token_id: token_id.clone(),
            owner_id: owner_id.clone(),
            rotation_seq: 0,
            metadata: metadata.clone(),
        };
        self.tokens_by_id.insert(token_id.clone(), stored);
        self.token_ids.push(token_id.clone());

        let refund = attached_deposit.0.saturating_sub(min_required.0);
        if refund > 0 {
            let _ = Promise::new(payer_id).transfer(NearToken::from_yoctonear(refund));
        }

        emit_nep171_mint(&owner_id, &token_id);

        Some(JsonToken {
            token_id,
            owner_id,
            metadata: Some(metadata),
        })
    }

    // =========================================================================
    // Atomic Anti-Front-Running Escrow Marketplace
    // =========================================================================

    pub fn list_endpoint(&mut self, token_id: String, sale_price_yocto: U128) -> Promise {
        require!(sale_price_yocto.0 > 0, "Sale price must be positive");
        require!(
            !self.listings.contains_key(&token_id),
            "Endpoint is already listed"
        );
        require!(
            !self.is_in_flight(&token_id),
            "Endpoint already has a lifecycle transition in flight"
        );

        let tok = self
            .tokens_by_id
            .get(&token_id)
            .expect("Endpoint token_id does not exist");
        let caller = env::predecessor_account_id();
        require!(
            tok.owner_id == caller,
            "Unauthorized: only current NFT owner can list endpoint"
        );

        let vault_id: AccountId = token_id.parse().expect("Invalid vault AccountId");
        self.in_flight_tokens.insert(token_id.clone(), true);

        ext_endpoint_vault::ext(vault_id)
            .with_static_gas(GAS_FOR_VAULT_HOOK)
            .prepare_listing()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_HOOK_CALLBACK)
                    .on_list_prepared(token_id, caller, sale_price_yocto),
            )
    }

    #[private]
    pub fn on_list_prepared(
        &mut self,
        token_id: String,
        seller_id: AccountId,
        sale_price_yocto: U128,
    ) -> Option<MarketListing> {
        self.in_flight_tokens.remove(&token_id);
        let Ok(bytes) = env::promise_result_checked(0, 2048) else {
            env::log_str(&format!(
                r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_list_failed","data":[{{"token_id":"{}","seller_id":"{}","reason":"vault_prepare_listing_failed"}}]}}"#,
                token_id, seller_id
            ));
            return None;
        };
        let Ok(snap) = near_sdk::serde_json::from_slice::<VaultListingSnapshot>(&bytes) else {
            // The vault already entered escrow but returned an unreadable
            // snapshot. Unfreeze it so it cannot be stranded in Frozen state.
            if let Ok(vault_id) = token_id.parse::<AccountId>() {
                let _ = ext_endpoint_vault::ext(vault_id)
                    .with_static_gas(GAS_FOR_VAULT_HOOK)
                    .cancel_listing();
            }
            env::log_str(&format!(
                r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_list_failed","data":[{{"token_id":"{}","seller_id":"{}","reason":"invalid_vault_snapshot"}}]}}"#,
                token_id, seller_id
            ));
            return None;
        };

        let listing = MarketListing {
            token_id: token_id.clone(),
            seller_id: seller_id.clone(),
            sale_price_yocto,
            listed_state_nonce: snap.state_nonce,
            listed_rotation_seq: snap.rotation_seq,
            listed_at_ms: env::block_timestamp_ms(),
        };

        self.listings.insert(token_id.clone(), listing.clone());
        if !self.listed_ids.iter().any(|id| id == &token_id) {
            self.listed_ids.push(token_id.clone());
        }

        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_listed","data":[{{"token_id":"{}","seller_id":"{}","sale_price_yocto":"{}","listed_state_nonce":"{}","listed_rotation_seq":"{}","vault_usdc_balance":"{}"}}]}}"#,
            token_id,
            seller_id,
            sale_price_yocto.0,
            snap.state_nonce.0,
            snap.rotation_seq.0,
            snap.vault_usdc_balance.0
        ));

        Some(listing)
    }

    pub fn unlist_endpoint(&mut self, token_id: String) -> Promise {
        require!(
            !self.is_in_flight(&token_id),
            "Endpoint already has a lifecycle transition in flight"
        );
        let listing = self
            .listings
            .get(&token_id)
            .expect("Endpoint is not currently listed")
            .clone();
        require!(
            env::predecessor_account_id() == listing.seller_id,
            "Unauthorized: only seller can unlist endpoint"
        );

        let vault_id: AccountId = token_id.parse().expect("Invalid vault AccountId");
        self.in_flight_tokens.insert(token_id.clone(), true);

        ext_endpoint_vault::ext(vault_id)
            .with_static_gas(GAS_FOR_VAULT_HOOK)
            .cancel_listing()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_HOOK_CALLBACK)
                    .on_unlist_complete(token_id),
            )
    }

    #[private]
    pub fn on_unlist_complete(&mut self, token_id: String) -> bool {
        self.in_flight_tokens.remove(&token_id);
        if env::promise_result_checked(0, 512).is_ok() {
            self.listings.remove(&token_id);
            self.listed_ids.retain(|id| id != &token_id);
            return true;
        }
        false
    }

    #[payable]
    pub fn buy_endpoint(
        &mut self,
        token_id: String,
        expected_state_nonce: U64,
        expected_rotation_seq: U64,
    ) -> Promise {
        require!(
            !self.is_in_flight(&token_id),
            "Endpoint already has a lifecycle transition in flight"
        );
        let listing = self
            .listings
            .get(&token_id)
            .expect("Endpoint is not listed for sale")
            .clone();

        let attached = env::attached_deposit().as_yoctonear();
        require!(
            attached >= listing.sale_price_yocto.0,
            "Attached NEAR deposit is below listing sale_price_yocto"
        );

        // Threat T-3 Mitigation: Pin buyer's observed state_nonce & rotation_seq
        require!(
            expected_state_nonce == listing.listed_state_nonce,
            format!(
                "BLOCKED [Threat T-3]: expected_state_nonce ({}) does not match frozen listing state_nonce ({})",
                expected_state_nonce.0, listing.listed_state_nonce.0
            )
        );
        require!(
            expected_rotation_seq == listing.listed_rotation_seq,
            format!(
                "BLOCKED: expected_rotation_seq ({}) does not match listing rotation_seq ({})",
                expected_rotation_seq.0, listing.listed_rotation_seq.0
            )
        );

        let buyer_id = env::predecessor_account_id();
        require!(buyer_id != listing.seller_id, "Seller already owns this endpoint");

        // Optimistically lock listing while rotating vault
        self.listings.remove(&token_id);
        self.listed_ids.retain(|id| id != &token_id);
        self.in_flight_tokens.insert(token_id.clone(), true);

        let vault_id: AccountId = token_id.parse().expect("Invalid vault AccountId");

        ext_endpoint_vault::ext(vault_id)
            .with_static_gas(GAS_FOR_VAULT_HOOK)
            .on_registry_rotate(buyer_id.clone(), Some(listing.sale_price_yocto))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_HOOK_CALLBACK)
                    .on_buy_rotated(listing, buyer_id, U128(attached)),
            )
    }

    #[private]
    pub fn on_buy_rotated(
        &mut self,
        listing: MarketListing,
        buyer_id: AccountId,
        attached_deposit: U128,
    ) -> Option<NftItemInfo> {
        self.in_flight_tokens.remove(&listing.token_id);

        let Ok(bytes) = env::promise_result_checked(0, 4096) else {
            // Rollback listing & refund buyer 100% if vault rotation failed.
            // No panic here: panicking would revert the refund and leave the
            // in_flight_tokens lock set, permanently bricking the token.
            self.restore_listing(&listing);
            if attached_deposit.0 > 0 {
                let _ = Promise::new(buyer_id.clone())
                    .transfer(NearToken::from_yoctonear(attached_deposit.0));
            }
            env::log_str(&format!(
                r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_buy_failed","data":[{{"token_id":"{}","buyer_id":"{}","refunded_yocto":"{}","reason":"vault_rotation_failed"}}]}}"#,
                listing.token_id, buyer_id, attached_deposit.0
            ));
            return None;
        };

        let rotated_info: NftItemInfo = near_sdk::serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            // The vault call succeeded; fall back to the deterministic expected
            // rotation instead of panicking and stranding the buyer's deposit.
            NftItemInfo {
                spec: "sharded-item-1.0.0".to_string(),
                init: true,
                status: ItemStatus::Active,
                collection_id: env::current_account_id(),
                token_id: listing.token_id.clone(),
                owner_id: buyer_id.clone(),
                rotation_seq: U64(listing.listed_rotation_seq.0.saturating_add(1)),
                rotation_epoch: 1,
            }
        });

        if let Some(tok) = self.tokens_by_id.get_mut(&listing.token_id) {
            tok.owner_id = buyer_id.clone();
            tok.rotation_seq = rotated_info.rotation_seq.0;
            tok.metadata.updated_at = Some(env::block_timestamp_ms().to_string());
        }

        // Pay seller & refund any overpayment to buyer
        let _ = Promise::new(listing.seller_id.clone())
            .transfer(NearToken::from_yoctonear(listing.sale_price_yocto.0));
        let excess = attached_deposit
            .0
            .saturating_sub(listing.sale_price_yocto.0);
        if excess > 0 {
            let _ = Promise::new(buyer_id.clone()).transfer(NearToken::from_yoctonear(excess));
        }

        emit_nep171_transfer(
            &listing.seller_id,
            &buyer_id,
            &listing.token_id,
            Some("Route402 atomic escrow purchase"),
        );

        Some(rotated_info)
    }

    pub fn get_listing(&self, token_id: String) -> Option<MarketListing> {
        self.listings.get(&token_id).cloned()
    }

    pub fn get_listings(&self) -> Vec<MarketListing> {
        self.listed_ids
            .iter()
            .filter_map(|id| self.listings.get(id).cloned())
            .collect()
    }

    // =========================================================================
    // Standard NEP-171 / NEP-177 / NEP-181 Interfaces
    // =========================================================================

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        self.contract_metadata.clone()
    }

    pub fn nft_token(&self, token_id: String) -> Option<JsonToken> {
        self.tokens_by_id.get(&token_id).map(|t| JsonToken {
            token_id: t.token_id.clone(),
            owner_id: t.owner_id.clone(),
            metadata: Some(t.metadata.clone()),
        })
    }

    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        #[allow(unused_variables)] approval_id: Option<u64>,
        memo: Option<String>,
    ) -> Promise {
        require!(
            env::attached_deposit() == NearToken::from_yoctonear(1),
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );
        require!(
            !self.listings.contains_key(&token_id),
            "Unlist endpoint from escrow market before calling raw nft_transfer"
        );
        require!(
            !self.is_in_flight(&token_id),
            "Endpoint already has a lifecycle transition in flight"
        );

        let tok = self
            .tokens_by_id
            .get(&token_id)
            .expect("Token does not exist")
            .clone();
        let caller = env::predecessor_account_id();
        require!(tok.owner_id == caller, "Unauthorized: caller is not NFT owner");
        require!(receiver_id != caller, "Receiver must differ from current owner");

        let vault_id: AccountId = token_id.parse().expect("Invalid vault AccountId");
        self.in_flight_tokens.insert(token_id.clone(), true);

        ext_endpoint_vault::ext(vault_id)
            .with_static_gas(GAS_FOR_VAULT_HOOK)
            .on_registry_rotate(receiver_id.clone(), None)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_HOOK_CALLBACK)
                    .on_transfer_rotated(token_id, caller, receiver_id, memo),
            )
    }

    #[private]
    pub fn on_transfer_rotated(
        &mut self,
        token_id: String,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        memo: Option<String>,
    ) -> bool {
        self.in_flight_tokens.remove(&token_id);
        let Ok(bytes) = env::promise_result_checked(0, 4096) else {
            // Keep the NFT with the previous owner and clear the lock. Panicking
            // here would revert the lock removal and permanently freeze transfers.
            env::log_str(&format!(
                r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"endpoint_transfer_failed","data":[{{"token_id":"{}","from_owner":"{}","to_owner":"{}","reason":"vault_rotation_failed"}}]}}"#,
                token_id, previous_owner_id, receiver_id
            ));
            return false;
        };
        let rotated_info: NftItemInfo = near_sdk::serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            // Vault rotation succeeded; fall back to the deterministic expected
            // rotation rather than panicking and freezing the token.
            NftItemInfo {
                spec: "sharded-item-1.0.0".to_string(),
                init: true,
                status: ItemStatus::Active,
                collection_id: env::current_account_id(),
                token_id: token_id.clone(),
                owner_id: receiver_id.clone(),
                rotation_seq: U64(
                    self.tokens_by_id
                        .get(&token_id)
                        .map(|t| t.rotation_seq.saturating_add(1))
                        .unwrap_or(1),
                ),
                rotation_epoch: 1,
            }
        });

        if let Some(tok) = self.tokens_by_id.get_mut(&token_id) {
            tok.owner_id = receiver_id.clone();
            tok.rotation_seq = rotated_info.rotation_seq.0;
            tok.metadata.updated_at = Some(env::block_timestamp_ms().to_string());
        }

        emit_nep171_transfer(&previous_owner_id, &receiver_id, &token_id, memo.as_deref());
        true
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.token_ids.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.token_ids
            .iter()
            .skip(start)
            .take(lim)
            .filter_map(|id| self.nft_token(id.clone()))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        let count = self
            .token_ids
            .iter()
            .filter_map(|id| self.tokens_by_id.get(id))
            .filter(|t| t.owner_id == account_id)
            .count();
        U128(count as u128)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.token_ids
            .iter()
            .filter_map(|id| self.tokens_by_id.get(id))
            .filter(|t| t.owner_id == account_id)
            .skip(start)
            .take(lim)
            .map(|t| JsonToken {
                token_id: t.token_id.clone(),
                owner_id: t.owner_id.clone(),
                metadata: Some(t.metadata.clone()),
            })
            .collect()
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    fn assert_admin(&self) {
        require!(
            env::predecessor_account_id() == self.admin_id,
            "Unauthorized: caller is not registry admin"
        );
    }

    fn restore_listing(&mut self, listing: &MarketListing) {
        self.listings
            .insert(listing.token_id.clone(), listing.clone());
        if !self.listed_ids.iter().any(|id| id == &listing.token_id) {
            self.listed_ids.push(listing.token_id.clone());
        }
    }

    fn is_in_flight(&self, token_id: &str) -> bool {
        self.in_flight_tokens.get(token_id).copied().unwrap_or(false)
    }

    fn compute_required_mint_deposit(&self) -> (u128, bool) {
        if self.vault_global_hash.is_some() {
            (MIN_GLOBAL_VAULT_SEED_YOCTO, true)
        } else if let Some(code) = &self.vault_wasm {
            let wasm_stake = (code.len() as u128)
                .saturating_mul(env::storage_byte_cost().as_yoctonear());
            (wasm_stake.saturating_add(LOCAL_WASM_BUFFER_YOCTO), false)
        } else {
            env::panic_str("Registry vault bytecode not yet configured by admin");
        }
    }
}

fn validate_slug(slug: &str) {
    require!(
        (2..=32).contains(&slug.len()),
        "Slug must be between 2 and 32 characters"
    );
    require!(
        !slug.starts_with('-') && !slug.ends_with('-') && !slug.contains("--"),
        "Slug cannot start/end with '-' or contain '--'"
    );
    require!(
        slug.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
        "Slug must contain only lowercase ASCII letters, digits, or '-'"
    );
}

fn decode_hex_32(hex: &str) -> [u8; 32] {
    let trimmed = hex.trim().strip_prefix("0x").unwrap_or(hex.trim());
    require!(trimmed.len() == 64, "SHA-256 hex string must be 64 hex chars");
    let mut out = [0u8; 32];
    for (i, slot) in out.iter_mut().enumerate() {
        let byte_str = &trimmed[i * 2..i * 2 + 2];
        *slot = u8::from_str_radix(byte_str, 16).expect("Invalid hex character in SHA-256 hash");
    }
    out
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

fn emit_nep171_mint(owner_id: &AccountId, token_id: &str) {
    env::log_str(&format!(
        r#"EVENT_JSON:{{"standard":"nep171","version":"1.0.0","event":"nft_mint","data":[{{"owner_id":"{}","token_ids":["{}"]}}]}}"#,
        owner_id, token_id
    ));
}

fn emit_nep171_transfer(
    old_owner_id: &AccountId,
    new_owner_id: &AccountId,
    token_id: &str,
    memo: Option<&str>,
) {
    if let Some(m) = memo {
        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"nep171","version":"1.0.0","event":"nft_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"],"memo":"{}"}}]}}"#,
            old_owner_id, new_owner_id, token_id, m
        ));
    } else {
        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"nep171","version":"1.0.0","event":"nft_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"]}}]}}"#,
            old_owner_id, new_owner_id, token_id
        ));
    }
}
