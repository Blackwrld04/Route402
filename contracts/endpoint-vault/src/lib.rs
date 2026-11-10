use near_sdk::json_types::{U64, U128};
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, env, ext_contract, near,
    require,
};

const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(15);
const GAS_FOR_WITHDRAW_CALLBACK: Gas = Gas::from_tgas(10);
const MIN_STORAGE_RESERVE_YOCTO: u128 = 120_000_000_000_000_000_000_000; // 0.12 NEAR reserve
const MAX_RECENT_RECEIPTS: usize = 32;

#[ext_contract(ext_ft_core)]
pub trait ExtFungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

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

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct EndpointReceipt {
    pub receipt_id: String,
    pub request_id: String,
    pub payer_id: AccountId,
    pub asset: String,
    pub amount: U128,
    pub resource_path: String,
    pub rail: String,
    pub timestamp_ms: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct OwnershipRecord {
    pub from_owner: AccountId,
    pub to_owner: AccountId,
    pub rotation_seq: U64,
    pub sale_price_yocto: Option<U128>,
    pub timestamp_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct VaultListingSnapshot {
    pub state_nonce: U64,
    pub rotation_seq: U64,
    pub vault_usdc_balance: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct VaultSummary {
    pub spec: String,
    pub token_id: String,
    pub collection_id: AccountId,
    pub owner_id: AccountId,
    pub status: ItemStatus,
    pub title: String,
    pub description: String,
    pub category: String,
    pub upstream_slug: String,
    pub mcp_tool_name: string_alias::Str,
    pub price_per_call_usdc: U128,
    pub price_per_call_yocto: U128,
    pub usdc_contract_id: AccountId,
    pub total_calls: u64,
    pub total_earned_usdc: U128,
    pub total_earned_yocto: U128,
    pub total_withdrawn_usdc: U128,
    pub total_withdrawn_yocto: U128,
    pub vault_usdc_balance: U128,
    pub state_nonce: U64,
    pub rotation_seq: U64,
    pub rotation_epoch: u32,
    pub pending_outflows: u32,
    pub operator_id: Option<AccountId>,
    pub operator_bound_seq: Option<U64>,
    pub recent_receipts: Vec<EndpointReceipt>,
    pub ownership_history: Vec<OwnershipRecord>,
}

mod string_alias {
    pub type Str = String;
}

#[derive(near_sdk::serde::Deserialize, Default)]
#[serde(crate = "near_sdk::serde")]
struct X402TransferMemo {
    request_id: Option<String>,
    resource_path: Option<String>,
    rail: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EndpointVaultContract {
    initialized: bool,
    collection_id: AccountId,
    owner_id: AccountId,
    usdc_contract_id: AccountId,
    suspended: bool,
    frozen_for_sale: bool,
    title: String,
    description: String,
    category: String,
    upstream_slug: String,
    mcp_tool_name: String,
    price_per_call_usdc: u128,
    price_per_call_yocto: u128,
    total_calls: u64,
    total_earned_usdc: u128,
    total_earned_yocto: u128,
    total_withdrawn_usdc: u128,
    total_withdrawn_yocto: u128,
    vault_usdc_balance: u128,
    state_nonce: u64,
    rotation_seq: u64,
    rotation_epoch: u32,
    pending_outflows: u32,
    operator_id: Option<AccountId>,
    operator_bound_seq: Option<u64>,
    processed_requests: LookupMap<String, bool>,
    recent_receipts: Vec<EndpointReceipt>,
    ownership_history: Vec<OwnershipRecord>,
}

#[near]
impl EndpointVaultContract {
    #[init]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        collection_id: AccountId,
        owner_id: AccountId,
        usdc_contract_id: AccountId,
        title: String,
        description: String,
        category: String,
        upstream_slug: String,
        mcp_tool_name: String,
        price_per_call_usdc: U128,
        price_per_call_yocto: U128,
    ) -> Self {
        // Normative Requirement #3 of sharded-item-1.0.0:
        // An item MUST refuse to name itself as its own collection at initialisation.
        require!(
            collection_id != env::current_account_id(),
            "sharded-item-1.0.0: item cannot name itself as its own collection"
        );

        let initial_record = OwnershipRecord {
            from_owner: collection_id.clone(),
            to_owner: owner_id.clone(),
            rotation_seq: U64(0),
            sale_price_yocto: None,
            timestamp_ms: env::block_timestamp_ms(),
        };

        Self {
            initialized: true,
            collection_id,
            owner_id,
            usdc_contract_id,
            suspended: false,
            frozen_for_sale: false,
            title,
            description,
            category,
            upstream_slug,
            mcp_tool_name,
            price_per_call_usdc: price_per_call_usdc.0,
            price_per_call_yocto: price_per_call_yocto.0,
            total_calls: 0,
            total_earned_usdc: 0,
            total_earned_yocto: 0,
            total_withdrawn_usdc: 0,
            total_withdrawn_yocto: 0,
            vault_usdc_balance: 0,
            state_nonce: 0,
            rotation_seq: 0,
            rotation_epoch: 1,
            pending_outflows: 0,
            operator_id: None,
            operator_bound_seq: None,
            processed_requests: LookupMap::new(b"r"),
            recent_receipts: Vec::new(),
            ownership_history: vec![initial_record],
        }
    }

    // =========================================================================
    // House of Stake `sharded-item-1.0.0` Normative Interface
    // =========================================================================

    pub fn nft_item_info(&self) -> NftItemInfo {
        NftItemInfo {
            spec: "sharded-item-1.0.0".to_string(),
            init: self.initialized,
            status: self.current_status(),
            collection_id: self.collection_id.clone(),
            // Normative Requirement #1: derived directly from current_account_id, never stored.
            token_id: env::current_account_id().to_string(),
            // Normative Requirement #4: read directly from governing owner state.
            owner_id: self.owner_id.clone(),
            rotation_seq: U64(self.rotation_seq),
            rotation_epoch: self.rotation_epoch,
        }
    }

    pub fn get_vault_summary(&self) -> VaultSummary {
        let valid_op = if self.operator_bound_seq == Some(self.rotation_seq) {
            self.operator_id.clone()
        } else {
            None
        };
        VaultSummary {
            spec: "sharded-item-1.0.0".to_string(),
            token_id: env::current_account_id().to_string(),
            collection_id: self.collection_id.clone(),
            owner_id: self.owner_id.clone(),
            status: self.current_status(),
            title: self.title.clone(),
            description: self.description.clone(),
            category: self.category.clone(),
            upstream_slug: self.upstream_slug.clone(),
            mcp_tool_name: self.mcp_tool_name.clone(),
            price_per_call_usdc: U128(self.price_per_call_usdc),
            price_per_call_yocto: U128(self.price_per_call_yocto),
            usdc_contract_id: self.usdc_contract_id.clone(),
            total_calls: self.total_calls,
            total_earned_usdc: U128(self.total_earned_usdc),
            total_earned_yocto: U128(self.total_earned_yocto),
            total_withdrawn_usdc: U128(self.total_withdrawn_usdc),
            total_withdrawn_yocto: U128(self.total_withdrawn_yocto),
            vault_usdc_balance: U128(self.vault_usdc_balance),
            state_nonce: U64(self.state_nonce),
            rotation_seq: U64(self.rotation_seq),
            rotation_epoch: self.rotation_epoch,
            pending_outflows: self.pending_outflows,
            operator_id: valid_op,
            operator_bound_seq: self.operator_bound_seq.map(U64),
            recent_receipts: self.recent_receipts.clone(),
            ownership_history: self.ownership_history.clone(),
        }
    }

    pub fn is_request_paid(&self, request_id: String) -> bool {
        self.processed_requests.get(&request_id).copied().unwrap_or(false)
    }

    // =========================================================================
    // Inbound x402 Revenue Paths (Allowed During Listing; Never Bump state_nonce)
    // =========================================================================

    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id() == self.usdc_contract_id,
            "Unsupported NEP-141 token contract"
        );
        require!(self.initialized && !self.suspended, "Endpoint vault is not accepting traffic");
        require!(
            amount.0 >= self.price_per_call_usdc,
            "Payment below endpoint x402 USDC price_per_call"
        );

        let parsed: X402TransferMemo = if msg.trim_start().starts_with('{') {
            near_sdk::serde_json::from_str(&msg).unwrap_or_default()
        } else {
            X402TransferMemo {
                request_id: if msg.is_empty() { None } else { Some(msg) },
                resource_path: None,
                rail: None,
            }
        };

        let req_id = parsed
            .request_id
            .unwrap_or_else(|| format!("ft-{}-{}", env::block_height(), self.total_calls + 1));

        require!(
            !self.processed_requests.contains_key(&req_id),
            "Duplicate x402 request_id replay rejected"
        );
        self.processed_requests.insert(req_id.clone(), true);

        self.vault_usdc_balance = self.vault_usdc_balance.saturating_add(amount.0);
        self.total_earned_usdc = self.total_earned_usdc.saturating_add(amount.0);
        self.total_calls = self.total_calls.saturating_add(1);

        let resource = parsed.resource_path.unwrap_or_else(|| format!("/{}", self.upstream_slug));
        let rail = parsed.rail.unwrap_or_else(|| "nep141-usdc".to_string());

        self.push_receipt(EndpointReceipt {
            receipt_id: format!("rcpt-{}", self.total_calls),
            request_id: req_id.clone(),
            payer_id: sender_id.clone(),
            asset: self.usdc_contract_id.to_string(),
            amount,
            resource_path: resource.clone(),
            rail: rail.clone(),
            timestamp_ms: env::block_timestamp_ms(),
        });

        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"x402_payment","data":[{{"endpoint_id":"{}","payer_id":"{}","amount":"{}","asset":"USDC","request_id":"{}","rail":"{}","owner_at_settlement":"{}"}}]}}"#,
            env::current_account_id(),
            sender_id,
            amount.0,
            req_id,
            rail,
            self.owner_id
        ));

        PromiseOrValue::Value(U128(0))
    }

    #[payable]
    pub fn pay_native_x402(&mut self, request_id: String, resource_path: Option<String>) {
        require!(self.initialized && !self.suspended, "Endpoint vault is not accepting traffic");
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit > 0, "Attached NEAR deposit must be positive");
        require!(
            deposit >= self.price_per_call_yocto,
            "Deposit below endpoint x402 NEAR price_per_call"
        );
        require!(
            !self.processed_requests.contains_key(&request_id),
            "Duplicate x402 request_id replay rejected"
        );
        self.processed_requests.insert(request_id.clone(), true);

        self.total_earned_yocto = self.total_earned_yocto.saturating_add(deposit);
        self.total_calls = self.total_calls.saturating_add(1);

        let caller = env::predecessor_account_id();
        let res_path = resource_path.unwrap_or_else(|| format!("/{}", self.upstream_slug));

        self.push_receipt(EndpointReceipt {
            receipt_id: format!("rcpt-{}", self.total_calls),
            request_id: request_id.clone(),
            payer_id: caller.clone(),
            asset: "NEAR".to_string(),
            amount: U128(deposit),
            resource_path: res_path,
            rail: "near-native".to_string(),
            timestamp_ms: env::block_timestamp_ms(),
        });

        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"x402_payment","data":[{{"endpoint_id":"{}","payer_id":"{}","amount":"{}","asset":"NEAR","request_id":"{}","rail":"near-native","owner_at_settlement":"{}"}}]}}"#,
            env::current_account_id(),
            caller,
            deposit,
            request_id,
            self.owner_id
        ));
    }

    // =========================================================================
    // Owner Outflows & Configuration (Blocked While Frozen; Always Bump state_nonce)
    // =========================================================================

    pub fn update_endpoint_config(
        &mut self,
        title: Option<String>,
        description: Option<String>,
        upstream_slug: Option<String>,
        price_per_call_usdc: Option<U128>,
        price_per_call_yocto: Option<U128>,
    ) {
        self.assert_owner_active_and_settled();
        if let Some(t) = title {
            self.title = t;
        }
        if let Some(d) = description {
            self.description = d;
        }
        if let Some(u) = upstream_slug {
            self.upstream_slug = u;
        }
        if let Some(pu) = price_per_call_usdc {
            self.price_per_call_usdc = pu.0;
        }
        if let Some(py) = price_per_call_yocto {
            self.price_per_call_yocto = py.0;
        }
        self.state_nonce = self.state_nonce.saturating_add(1);
    }

    pub fn set_operator(&mut self, operator_id: Option<AccountId>) {
        self.assert_owner_active_and_settled();
        self.operator_bound_seq = operator_id.as_ref().map(|_| self.rotation_seq);
        self.operator_id = operator_id;
        self.state_nonce = self.state_nonce.saturating_add(1);
    }

    pub fn withdraw_usdc(&mut self, to: AccountId, amount: U128) -> Promise {
        self.assert_owner_active_and_settled();
        require!(amount.0 > 0, "Withdrawal amount must be positive");
        require!(
            self.vault_usdc_balance >= amount.0,
            "Insufficient vault USDC balance"
        );

        self.vault_usdc_balance -= amount.0;
        self.total_withdrawn_usdc = self.total_withdrawn_usdc.saturating_add(amount.0);
        self.state_nonce = self.state_nonce.saturating_add(1);
        self.pending_outflows = self.pending_outflows.saturating_add(1);

        ext_ft_core::ext(self.usdc_contract_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(to.clone(), amount, Some("Route402 vault withdrawal".to_string()))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_WITHDRAW_CALLBACK)
                    .on_withdraw_usdc_complete(to, amount),
            )
    }

    #[private]
    pub fn on_withdraw_usdc_complete(&mut self, _to: AccountId, amount: U128) -> bool {
        self.pending_outflows = self.pending_outflows.saturating_sub(1);
        if env::promise_result_checked(0, 64).is_err() {
            // Rollback optimistic deduction if token transfer failed
            self.vault_usdc_balance = self.vault_usdc_balance.saturating_add(amount.0);
            self.total_withdrawn_usdc = self.total_withdrawn_usdc.saturating_sub(amount.0);
            return false;
        }
        true
    }

    pub fn withdraw_near(&mut self, to: AccountId, amount: U128) -> Promise {
        self.assert_owner_active_and_settled();
        require!(amount.0 > 0, "Withdrawal amount must be positive");
        let bal = env::account_balance().as_yoctonear();
        require!(
            bal.saturating_sub(amount.0) >= MIN_STORAGE_RESERVE_YOCTO,
            "Withdrawal would breach 0.12 NEAR storage reserve"
        );

        self.total_withdrawn_yocto = self.total_withdrawn_yocto.saturating_add(amount.0);
        self.state_nonce = self.state_nonce.saturating_add(1);
        self.pending_outflows = self.pending_outflows.saturating_add(1);

        Promise::new(to.clone())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_WITHDRAW_CALLBACK)
                    .on_withdraw_near_complete(amount),
            )
    }

    #[private]
    pub fn on_withdraw_near_complete(&mut self, amount: U128) -> bool {
        self.pending_outflows = self.pending_outflows.saturating_sub(1);
        if env::promise_result_checked(0, 64).is_err() {
            self.total_withdrawn_yocto = self.total_withdrawn_yocto.saturating_sub(amount.0);
            return false;
        }
        true
    }

    // =========================================================================
    // Registry-Only Atomic Escrow & Rotation Hooks
    // =========================================================================

    pub fn prepare_listing(&mut self) -> VaultListingSnapshot {
        self.assert_collection_caller();
        require!(
            self.blocking_condition().is_none(),
            "Vault must be Active to enter escrow listing"
        );
        require!(
            self.pending_outflows == 0,
            "Cannot list vault while async outflow is pending"
        );
        self.frozen_for_sale = true;
        self.state_nonce = self.state_nonce.saturating_add(1);
        VaultListingSnapshot {
            state_nonce: U64(self.state_nonce),
            rotation_seq: U64(self.rotation_seq),
            vault_usdc_balance: U128(self.vault_usdc_balance),
        }
    }

    pub fn cancel_listing(&mut self) {
        self.assert_collection_caller();
        self.frozen_for_sale = false;
        self.state_nonce = self.state_nonce.saturating_add(1);
    }

    pub fn on_registry_rotate(
        &mut self,
        new_owner_id: AccountId,
        sale_price_yocto: Option<U128>,
    ) -> NftItemInfo {
        self.assert_collection_caller();
        require!(
            self.pending_outflows == 0,
            "Cannot rotate vault while async outflow is in flight"
        );

        let prev_owner = self.owner_id.clone();
        self.owner_id = new_owner_id.clone();
        self.frozen_for_sale = false;
        // Normative Requirement #7 + Threat T-5: monotonic rotation_seq & instant operator invalidation
        self.rotation_seq = self.rotation_seq.saturating_add(1);
        self.state_nonce = self.state_nonce.saturating_add(1);
        self.operator_id = None;
        self.operator_bound_seq = None;

        self.ownership_history.push(OwnershipRecord {
            from_owner: prev_owner.clone(),
            to_owner: new_owner_id.clone(),
            rotation_seq: U64(self.rotation_seq),
            sale_price_yocto,
            timestamp_ms: env::block_timestamp_ms(),
        });

        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"route402","version":"1.0.0","event":"sharded_item_rotate","data":[{{"token_id":"{}","from_owner":"{}","to_owner":"{}","rotation_seq":"{}"}}]}}"#,
            env::current_account_id(),
            prev_owner,
            new_owner_id,
            self.rotation_seq
        ));

        self.nft_item_info()
    }

    // =========================================================================
    // Internal Predicates (Requirement #9: status & gating share 1 predicate)
    // =========================================================================

    fn blocking_condition(&self) -> Option<ItemStatus> {
        if !self.initialized {
            Some(ItemStatus::Parked)
        } else if self.suspended {
            Some(ItemStatus::Suspended)
        } else if self.frozen_for_sale {
            Some(ItemStatus::Frozen)
        } else {
            None
        }
    }

    fn current_status(&self) -> ItemStatus {
        self.blocking_condition().unwrap_or(ItemStatus::Active)
    }

    fn assert_owner_active_and_settled(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Unauthorized: caller is not current NFT owner"
        );
        if let Some(blocked) = self.blocking_condition() {
            env::panic_str(&format!(
                "Vault outflows/mutations blocked: current status is {:?}",
                blocked
            ));
        }
        require!(
            self.pending_outflows == 0,
            "Vault has an async withdrawal in flight"
        );
    }

    fn assert_collection_caller(&self) {
        require!(
            env::predecessor_account_id() == self.collection_id,
            "Unauthorized: only pinned collection registry can invoke lifecycle hook"
        );
    }

    fn push_receipt(&mut self, receipt: EndpointReceipt) {
        if self.recent_receipts.len() >= MAX_RECENT_RECEIPTS {
            self.recent_receipts.remove(0);
        }
        self.recent_receipts.push(receipt);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn ctx(current: &str, predecessor: &str, deposit_yocto: u128) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id(current.parse().unwrap())
            .predecessor_account_id(predecessor.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
            .account_balance(NearToken::from_near(2));
        b
    }

    fn make_vault() -> EndpointVaultContract {
        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        EndpointVaultContract::new(
            "reg.testnet".parse().unwrap(),
            "alice.testnet".parse().unwrap(),
            "usdc.testnet".parse().unwrap(),
            "Alpha Signal API".to_string(),
            "Real-time Intents spread feed".to_string(),
            "defi-oracle".to_string(),
            "alpha-signal".to_string(),
            "get_alpha_signal".to_string(),
            U128(50_000), // $0.05 USDC
            U128(10_000_000_000_000_000_000_000), // 0.01 NEAR
        )
    }

    #[test]
    fn sharded_item_self_describes_and_derives_token_id() {
        let vault = make_vault();
        let info = vault.nft_item_info();
        assert_eq!(info.spec, "sharded-item-1.0.0");
        assert!(info.init);
        assert_eq!(info.status, ItemStatus::Active);
        assert_eq!(info.token_id, "alpha.reg.testnet");
        assert_eq!(info.collection_id.as_str(), "reg.testnet");
        assert_eq!(info.owner_id.as_str(), "alice.testnet");
        assert_eq!(info.rotation_seq.0, 0);
        assert_eq!(info.rotation_epoch, 1);
    }

    #[test]
    #[should_panic(expected = "cannot name itself")]
    fn refuses_self_as_collection() {
        testing_env!(ctx("reg.testnet", "reg.testnet", 0).build());
        let _ = EndpointVaultContract::new(
            "reg.testnet".parse().unwrap(),
            "alice.testnet".parse().unwrap(),
            "usdc.testnet".parse().unwrap(),
            "Bad".into(),
            "Bad".into(),
            "bad".into(),
            "bad".into(),
            "bad".into(),
            U128(1),
            U128(1),
        );
    }

    #[test]
    fn frozen_blocks_seller_drain_while_allowing_inbound_x402_revenue() {
        let mut vault = make_vault();

        // Registry freezes vault for listing
        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        let snap = vault.prepare_listing();
        assert_eq!(vault.nft_item_info().status, ItemStatus::Frozen);
        let listed_nonce = snap.state_nonce.0;

        // Customer pays x402 USDC while NFT is Frozen (in middle of sale!)
        testing_env!(ctx("alpha.reg.testnet", "usdc.testnet", 0).build());
        let res = vault.ft_on_transfer(
            "agent.testnet".parse().unwrap(),
            U128(50_000),
            r#"{"request_id":"req-1","resource_path":"/quotes"}"#.to_string(),
        );
        assert!(matches!(res, PromiseOrValue::Value(U128(0))));
        assert_eq!(vault.get_vault_summary().vault_usdc_balance.0, 50_000);
        // Crucial T-6 guarantee: inbound payment did NOT bump state_nonce!
        assert_eq!(vault.get_vault_summary().state_nonce.0, listed_nonce);

        // Registry completes atomic rotation to Bob
        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        let rotated = vault.on_registry_rotate("bob.testnet".parse().unwrap(), Some(U128(100)));
        assert_eq!(rotated.owner_id.as_str(), "bob.testnet");
        assert_eq!(rotated.status, ItemStatus::Active);
        assert_eq!(rotated.rotation_seq.0, 1);
    }

    #[test]
    #[should_panic(expected = "Vault outflows/mutations blocked: current status is Frozen")]
    fn seller_cannot_withdraw_while_frozen() {
        let mut vault = make_vault();
        testing_env!(ctx("alpha.reg.testnet", "usdc.testnet", 0).build());
        let _ = vault.ft_on_transfer("agent.testnet".parse().unwrap(), U128(50_000), "req-1".into());

        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        let _ = vault.prepare_listing();

        // Seller Alice tries to front-run drain while Frozen -> MUST PANIC
        testing_env!(ctx("alpha.reg.testnet", "alice.testnet", 0).build());
        let _ = vault.withdraw_usdc("alice.testnet".parse().unwrap(), U128(50_000));
    }

    #[test]
    #[should_panic(expected = "Cannot list vault while async outflow is pending")]
    fn t4_pending_outflow_blocks_listing() {
        let mut vault = make_vault();
        testing_env!(ctx("alpha.reg.testnet", "usdc.testnet", 0).build());
        let _ = vault.ft_on_transfer(
            "agent.testnet".parse().unwrap(),
            U128(50_000),
            r#"{"request_id":"t4-seed"}"#.to_string(),
        );

        // Seller starts an async USDC withdrawal; the callback has not settled yet.
        testing_env!(ctx("alpha.reg.testnet", "alice.testnet", 0).build());
        let _ = vault.withdraw_usdc("alice.testnet".parse().unwrap(), U128(25_000));
        assert_eq!(vault.pending_outflows, 1);

        // Threat T-4: listing while the outflow is still in flight must be refused.
        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        let _ = vault.prepare_listing();
    }

    #[test]
    #[should_panic(expected = "Cannot rotate vault while async outflow is in flight")]
    fn t4_pending_outflow_blocks_rotation() {
        let mut vault = make_vault();
        testing_env!(ctx("alpha.reg.testnet", "usdc.testnet", 0).build());
        let _ = vault.ft_on_transfer(
            "agent.testnet".parse().unwrap(),
            U128(50_000),
            r#"{"request_id":"t4-seed"}"#.to_string(),
        );

        testing_env!(ctx("alpha.reg.testnet", "alice.testnet", 0).build());
        let _ = vault.withdraw_usdc("alice.testnet".parse().unwrap(), U128(25_000));
        assert_eq!(vault.pending_outflows, 1);

        // Threat T-4: ownership rotation while the outflow is in flight must be refused.
        testing_env!(ctx("alpha.reg.testnet", "reg.testnet", 0).build());
        let _ = vault.on_registry_rotate("bob.testnet".parse().unwrap(), None);
    }
}
