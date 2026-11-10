use near_api::{Account, AccountId, Contract, NearGas, NearToken, Signer};
use near_sdk::serde_json::{Value, json};
use std::path::PathBuf;

fn load_or_build_wasm(crate_dir: &str, wasm_name: &str) -> testresult::TestResult<Vec<u8>> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let prebuilt = manifest_dir
        .parent()
        .expect("contracts dir")
        .join(crate_dir)
        .join("target")
        .join("near")
        .join(wasm_name);

    if prebuilt.exists() {
        return Ok(std::fs::read(prebuilt)?);
    }

    let built = cargo_near_build::build_with_cli(cargo_near_build::BuildOpts {
        manifest_path: Some(
            manifest_dir
                .parent()
                .expect("contracts dir")
                .join(crate_dir)
                .join("Cargo.toml")
                .to_string_lossy()
                .into_owned()
                .into(),
        ),
        no_abi: true,
        ..Default::default()
    })?;
    Ok(std::fs::read(built)?)
}

async fn create_funded_account(
    sandbox: &near_sandbox::Sandbox,
    name: &str,
    near_amount: u128,
) -> testresult::TestResult<Account> {
    let account_id: AccountId = name.parse().unwrap();
    sandbox
        .create_account(account_id.clone().as_str().parse()?)
        .initial_balance(NearToken::from_near(near_amount))
        .send()
        .await?;
    Ok(Account(account_id))
}

#[tokio::test]
async fn test_sharded_x402_nft_lifecycle_and_all_6_threat_vectors() -> testresult::TestResult<()> {
    let registry_wasm_path = cargo_near_build::build_with_cli(cargo_near_build::BuildOpts {
        no_abi: true,
        ..Default::default()
    })?;
    let registry_wasm = std::fs::read(registry_wasm_path)?;
    let vault_wasm = load_or_build_wasm("endpoint-vault", "endpoint_vault.wasm")?;
    let mock_ft_wasm = load_or_build_wasm("mock-ft", "mock_ft.wasm")?;

    let sandbox = near_sandbox::Sandbox::start_sandbox().await?;
    let network = near_api::NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);
    let signer = Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
            .parse()
            .unwrap(),
    )?;

    // 1. Create accounts (registry funded with 35 NEAR to publish NEP-591 Global Contract)
    let admin = create_funded_account(&sandbox, "admin.sandbox", 10).await?;
    let alice = create_funded_account(&sandbox, "alice.sandbox", 10).await?;
    let bob = create_funded_account(&sandbox, "bob.sandbox", 10).await?;
    let operator = create_funded_account(&sandbox, "op.sandbox", 5).await?;
    let agent = create_funded_account(&sandbox, "agent.sandbox", 10).await?;
    let usdc_acc = create_funded_account(&sandbox, "usdc.sandbox", 10).await?;
    let registry_acc = create_funded_account(&sandbox, "registry.sandbox", 35).await?;

    let usdc = usdc_acc.as_contract();
    let registry = registry_acc.as_contract();

    // 2. Deploy Mock USDC (NEP-141) and mint 5.00 USDC to buyer agent
    Contract::deploy(usdc.account_id().clone())
        .use_code(mock_ft_wasm)
        .with_init_call("new", json!({}))?
        .with_signer(signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    usdc.call_function(
        "mint",
        json!({
            "account_id": agent.account_id(),
            "amount": "5000000"
        }),
    )
    .transaction()
    .with_signer(agent.account_id().clone(), signer.clone())
    .send_to(&network)
    .await?
    .assert_success();

    // 3. Deploy Route402 Registry & publish EndpointVault as an immutable NEP-591 Global Contract
    Contract::deploy(registry.account_id().clone())
        .use_code(registry_wasm)
        .with_init_call(
            "new",
            json!({
                "admin_id": admin.account_id(),
                "usdc_contract_id": usdc.account_id()
            }),
        )?
        .with_signer(signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    registry
        .call_function_raw("publish_global_vault_wasm", vault_wasm)
        .transaction()
        .gas(NearGas::from_tgas(250))
        .with_signer(admin.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let deploy_mode: String = registry
        .call_function("get_vault_deploy_mode", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert!(
        deploy_mode.starts_with("nep591-global-hash:"),
        "Expected NEP-591 global contract mode, got {deploy_mode}"
    );

    // 4. Alice mints `alpha-signal.registry.sandbox` attaching ONLY 0.25 NEAR (NEP-591 Global Contract!)
    registry
        .call_function(
            "mint_endpoint",
            json!({
                "slug": "alpha-signal",
                "owner_id": alice.account_id(),
                "title": "Intents Solver Spread Feed",
                "description": "Real-time cross-chain solver spread telemetry",
                "category": "defi-oracle",
                "upstream_slug": "alpha-signal",
                "mcp_tool_name": "get_alpha_signal",
                "price_per_call_usdc": "50000",
                "price_per_call_yocto": "10000000000000000000000"
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(150))
        .deposit(NearToken::from_millinear(250))
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let vault_id: AccountId = "alpha-signal.registry.sandbox".parse()?;
    let vault_account = Account(vault_id.clone());
    let vault = vault_account.as_contract();

    // =========================================================================
    // THREAT T-1 PROOF: Sub-account has ZERO access keys (`keys: []`)
    // =========================================================================
    let access_keys = vault_account.list_keys().fetch_from(&network).await?.data;
    assert!(
        access_keys.is_empty(),
        "THREAT T-1 VIOLATION: Sharded Endpoint-NFT account must have 0 access keys, found {:?}",
        access_keys
    );

    // =========================================================================
    // House of Stake `sharded-item-1.0.0` Self-Description & Collection Match
    // =========================================================================
    let item_info: Value = vault
        .call_function("nft_item_info", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(item_info["spec"], "sharded-item-1.0.0");
    assert_eq!(item_info["init"], true);
    assert_eq!(item_info["status"], "Active");
    assert_eq!(item_info["token_id"], "alpha-signal.registry.sandbox");
    assert_eq!(item_info["collection_id"], "registry.sandbox");
    assert_eq!(item_info["owner_id"], "alice.sandbox");
    assert_eq!(item_info["rotation_seq"], "0");

    let nep171_tok: Value = registry
        .call_function("nft_token", json!({ "token_id": vault_id }))
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(nep171_tok["owner_id"], "alice.sandbox");

    // 5. Buyer Agent settles an x402 NEP-141 USDC call directly into `alpha-signal.registry.sandbox`
    usdc.call_function(
        "ft_transfer_call",
        json!({
            "receiver_id": vault_id,
            "amount": "50000",
            "msg": "{\"request_id\":\"req-1\",\"resource_path\":\"/quotes\",\"rail\":\"nep141-usdc\"}"
        }),
    )
    .transaction()
    .gas(NearGas::from_tgas(100))
    .deposit(NearToken::from_yoctonear(1))
    .with_signer(agent.account_id().clone(), signer.clone())
    .send_to(&network)
    .await?
    .assert_success();

    let paid_1: bool = vault
        .call_function("is_request_paid", json!({ "request_id": "req-1" }))
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert!(paid_1, "Expected req-1 to be recorded on vault");

    // 6. Threat T-5 Setup: Alice binds an operator before listing
    vault
        .call_function(
            "set_operator",
            json!({ "operator_id": operator.account_id() }),
        )
        .transaction()
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    // 7. Alice lists `alpha-signal.registry.sandbox` for 2 NEAR -> Vault enters `Frozen` escrow
    registry
        .call_function(
            "list_endpoint",
            json!({
                "token_id": vault_id,
                "sale_price_yocto": NearToken::from_near(2).as_yoctonear().to_string()
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(100))
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let listing: Value = registry
        .call_function("get_listing", json!({ "token_id": vault_id }))
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    let pinned_nonce = listing["listed_state_nonce"].as_str().unwrap().to_string();
    let pinned_rot = listing["listed_rotation_seq"].as_str().unwrap().to_string();

    let frozen_info: Value = vault
        .call_function("nft_item_info", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(frozen_info["status"], "Frozen");

    // =========================================================================
    // THREAT T-2 PROOF: Seller Alice tries to front-run drain USDC while Frozen
    // =========================================================================
    vault
        .call_function(
            "withdraw_usdc",
            json!({
                "to": alice.account_id(),
                "amount": "50000"
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(80))
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    // =========================================================================
    // THREAT T-6 PROOF: Inbound x402 revenue succeeds while Frozen & preserves state_nonce
    // =========================================================================
    usdc.call_function(
        "ft_transfer_call",
        json!({
            "receiver_id": vault_id,
            "amount": "50000",
            "msg": "{\"request_id\":\"req-mid-sale-2\",\"resource_path\":\"/quotes\",\"rail\":\"nep141-usdc\"}"
        }),
    )
    .transaction()
    .gas(NearGas::from_tgas(100))
    .deposit(NearToken::from_yoctonear(1))
    .with_signer(agent.account_id().clone(), signer.clone())
    .send_to(&network)
    .await?
    .assert_success();

    let mid_summary: Value = vault
        .call_function("get_vault_summary", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(mid_summary["vault_usdc_balance"], "100000");
    assert_eq!(mid_summary["state_nonce"], pinned_nonce);

    // =========================================================================
    // THREAT T-3 PROOF: Buyer with stale/mismatched `expected_state_nonce` is blocked
    // =========================================================================
    registry
        .call_function(
            "buy_endpoint",
            json!({
                "token_id": vault_id,
                "expected_state_nonce": "999",
                "expected_rotation_seq": pinned_rot
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(100))
        .deposit(NearToken::from_near(2))
        .with_signer(bob.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    // =========================================================================
    // 8. Bob executes atomic purchase with pinned `state_nonce` & `rotation_seq`
    // =========================================================================
    let alice_before = alice.tokens().near_balance().fetch_from(&network).await?.total;

    registry
        .call_function(
            "buy_endpoint",
            json!({
                "token_id": vault_id,
                "expected_state_nonce": pinned_nonce,
                "expected_rotation_seq": pinned_rot
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(120))
        .deposit(NearToken::from_near(2))
        .with_signer(bob.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let alice_after = alice.tokens().near_balance().fetch_from(&network).await?.total;
    assert!(
        alice_after >= alice_before.saturating_add(NearToken::from_millinear(1999)),
        "Seller Alice did not receive 2 NEAR sale proceeds"
    );

    // Verify atomic owner & rotation_seq sync + Threat T-5 operator invalidation
    let post_summary: Value = vault
        .call_function("get_vault_summary", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(post_summary["owner_id"], "bob.sandbox");
    assert_eq!(post_summary["status"], "Active");
    assert_eq!(post_summary["rotation_seq"], "1");
    assert!(
        post_summary["operator_id"].is_null(),
        "THREAT T-5 VIOLATION: Stale operator must be wiped on rotation"
    );
    assert_eq!(post_summary["vault_usdc_balance"], "100000");

    let post_tok: Value = registry
        .call_function("nft_token", json!({ "token_id": vault_id }))
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(post_tok["owner_id"], "bob.sandbox");

    // Former owner Alice CANNOT withdraw after sale
    vault
        .call_function(
            "withdraw_usdc",
            json!({
                "to": alice.account_id(),
                "amount": "100000"
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(80))
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    // New owner Bob withdraws all 100,000 micro-USDC ($0.10 earned before + during sale!)
    vault
        .call_function(
            "withdraw_usdc",
            json!({
                "to": bob.account_id(),
                "amount": "100000"
            }),
        )
        .transaction()
        .gas(NearGas::from_tgas(100))
        .with_signer(bob.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let bob_usdc: String = usdc
        .call_function("ft_balance_of", json!({ "account_id": bob.account_id() }))
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(bob_usdc, "100000");

    Ok(())
}
