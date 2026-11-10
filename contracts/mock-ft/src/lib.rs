use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, PromiseResult, env,
    ext_contract, near, require,
};

const GAS_FOR_FT_TRANSFER_CALL: Gas = Gas::from_tgas(35);
const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas::from_tgas(10);

#[ext_contract(ext_ft_receiver)]
pub trait FungibleTokenReceiver {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128>;
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct FtMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
}

#[near(serializers = [json])]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockUsdcContract {
    balances: LookupMap<AccountId, u128>,
    total_supply: u128,
    name: String,
    symbol: String,
    decimals: u8,
}

#[near]
impl MockUsdcContract {
    #[init]
    pub fn new(name: Option<String>, symbol: Option<String>, decimals: Option<u8>) -> Self {
        Self {
            balances: LookupMap::new(b"b"),
            total_supply: 0,
            name: name.unwrap_or_else(|| "Route402 Test USDC".to_string()),
            symbol: symbol.unwrap_or_else(|| "USDC".to_string()),
            decimals: decimals.unwrap_or(6),
        }
    }

    /// Public testnet/sandbox faucet so judges and agents can mint test USDC freely.
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        let amt = amount.0;
        require!(amt > 0, "Amount must be positive");
        let cur = self.balances.get(&account_id).copied().unwrap_or(0);
        self.balances.insert(account_id.clone(), cur + amt);
        self.total_supply = self.total_supply.saturating_add(amt);
        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"nep141","version":"1.0.0","event":"ft_mint","data":[{{"owner_id":"{}","amount":"{}"}}]}}"#,
            account_id, amt
        ));
    }

    #[payable]
    pub fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        _registration_only: Option<bool>,
    ) -> StorageBalance {
        let acct = account_id.unwrap_or_else(env::predecessor_account_id);
        if !self.balances.contains_key(&acct) {
            self.balances.insert(acct, 0);
        }
        StorageBalance {
            total: U128(env::attached_deposit().as_yoctonear()),
            available: U128(0),
        }
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        if self.balances.contains_key(&account_id) {
            Some(StorageBalance {
                total: U128(1_250_000_000_000_000_000_000),
                available: U128(0),
            })
        } else {
            None
        }
    }

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        require!(
            env::attached_deposit() >= NearToken::from_yoctonear(1),
            "Requires attached deposit of at least 1 yoctoNEAR"
        );
        let sender_id = env::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount.0, memo.as_deref());
    }

    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> Promise {
        require!(
            env::attached_deposit() >= NearToken::from_yoctonear(1),
            "Requires attached deposit of at least 1 yoctoNEAR"
        );
        let sender_id = env::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount.0, memo.as_deref());

        ext_ft_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FOR_FT_TRANSFER_CALL)
            .ft_on_transfer(sender_id.clone(), amount, msg)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE_TRANSFER)
                    .ft_resolve_transfer(sender_id, receiver_id, amount),
            )
    }

    #[private]
    pub fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let unused = match env::promise_result_checked(0, 128) {
            Ok(bytes) => near_sdk::serde_json::from_slice::<U128>(&bytes)
                .map(|v| v.0.min(amount.0))
                .unwrap_or(0),
            Err(_) => amount.0,
        };

        if unused > 0 {
            let rec_bal = self.balances.get(&receiver_id).copied().unwrap_or(0);
            let refund = unused.min(rec_bal);
            if refund > 0 {
                self.balances.insert(receiver_id, rec_bal - refund);
                let send_bal = self.balances.get(&sender_id).copied().unwrap_or(0);
                self.balances.insert(sender_id, send_bal + refund);
            }
            return U128(amount.0 - refund);
        }
        amount
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.balances.get(&account_id).copied().unwrap_or(0))
    }

    pub fn ft_total_supply(&self) -> U128 {
        U128(self.total_supply)
    }

    pub fn ft_metadata(&self) -> FtMetadata {
        FtMetadata {
            spec: "ft-1.0.0".to_string(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            decimals: self.decimals,
        }
    }

    fn internal_transfer(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        amount: u128,
        memo: Option<&str>,
    ) {
        require!(sender_id != receiver_id, "Sender and receiver must differ");
        require!(amount > 0, "Transfer amount must be positive");
        let sender_bal = self.balances.get(sender_id).copied().unwrap_or(0);
        require!(sender_bal >= amount, "Insufficient NEP-141 token balance");
        self.balances.insert(sender_id.clone(), sender_bal - amount);
        let rec_bal = self.balances.get(receiver_id).copied().unwrap_or(0);
        self.balances.insert(receiver_id.clone(), rec_bal + amount);
        let _ = PromiseResult::Successful(vec![]);
        env::log_str(&format!(
            r#"EVENT_JSON:{{"standard":"nep141","version":"1.0.0","event":"ft_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","amount":"{}","memo":"{}"}}]}}"#,
            sender_id,
            receiver_id,
            amount,
            memo.unwrap_or("")
        ));
    }
}
