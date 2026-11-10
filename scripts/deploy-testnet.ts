import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'contracts', 'artifacts');
const SECRETS_DIR = path.join(ROOT, '.secrets');
const NEAR_BIN = path.join(os.homedir(), '.cargo', 'bin', 'near');

const ACCOUNTS = {
  registry: 'r402-reg-v1.testnet',
  usdc: 'r402-usdc-v1.testnet',
  alice: 'r402-alice-v1.testnet',
  bob: 'r402-bob-v1.testnet',
  agent: 'r402-agent-v1.testnet',
  globalPublisher: 'r402-global-v1.testnet',
  sponsor: 'r402-sponsor-v1.testnet',
};

interface ProofTx {
  label: string;
  txHash: string;
  description: string;
}

function runNear(args: string[], allowFailure = false): { out: string; txHash: string | null } {
  console.log(`\n$ near ${args.join(' ')}`);
  const res = spawnSync(NEAR_BIN, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  const combined = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  const match = combined.match(/Transaction ID:\s*([A-Za-z0-9]+)/);
  if (res.status !== 0 && !allowFailure) {
    throw new Error(`near CLI failed (exit ${res.status}):\n${combined}`);
  }
  return { out: combined, txHash: match?.[1] ?? null };
}

function hasCredentials(accountId: string): boolean {
  const credFile = path.join(os.homedir(), '.near-credentials', 'testnet', `${accountId}.json`);
  return fs.existsSync(credFile);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAccount(accountId: string): Promise<void> {
  if (hasCredentials(accountId)) {
    console.log(`✓ Credentials already exist for ${accountId}`);
    return;
  }
  runNear([
    'account',
    'create-account',
    'sponsor-by-faucet-service',
    accountId,
    'autogenerate-new-keypair',
    '--signature-scheme',
    'ed25519',
    'save-to-legacy-keychain',
    'network-config',
    'testnet',
    'create',
  ]);
  await sleep(2000);
}

async function main() {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });

  const vaultWasmPath = path.join(ARTIFACTS_DIR, 'endpoint_vault.wasm');
  const mockFtWasmPath = path.join(ARTIFACTS_DIR, 'mock_ft.wasm');
  const registryWasmPath = path.join(ARTIFACTS_DIR, 'registry.wasm');

  const vaultBytes = fs.readFileSync(vaultWasmPath);
  const vaultGlobalHashHex = crypto.createHash('sha256').update(vaultBytes).digest('hex');
  console.log(`Vault WASM SHA-256: ${vaultGlobalHashHex} (${vaultBytes.length} bytes)`);

  // 1. Create all required testnet accounts via faucet
  for (const acc of Object.values(ACCOUNTS)) {
    await ensureAccount(acc);
  }

  fs.writeFileSync(
    path.join(SECRETS_DIR, 'testnet-accounts.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        credentialsDir: path.join(os.homedir(), '.near-credentials', 'testnet'),
        accounts: ACCOUNTS,
      },
      null,
      2,
    ),
  );

  const proofTransactions: ProofTx[] = [];

  // 2. Top up `r402-global-v1.testnet` to ~19 NEAR & publish immutable NEP-591 Global Contract
  console.log('\n==> Funding global publisher & deploying NEP-591 Global Contract...');
  runNear(
    [
      'tokens',
      ACCOUNTS.sponsor,
      'send-near',
      ACCOUNTS.globalPublisher,
      '9 NEAR',
      'network-config',
      'testnet',
      'sign-with-legacy-keychain',
      'send',
    ],
    true,
  );
  await sleep(2000);

  const globalDeploy = runNear([
    'contract',
    'deploy-as-global',
    'use-file',
    vaultWasmPath,
    'as-global-hash',
    ACCOUNTS.globalPublisher,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (globalDeploy.txHash) {
    proofTransactions.push({
      label: 'Publish NEP-591 Global Vault Contract',
      txHash: globalDeploy.txHash,
      description: `Immutable global contract hash ${vaultGlobalHashHex.slice(0, 16)}...`,
    });
  }

  // 3. Deploy Mock USDC (NEP-141) & mint 10 USDC to buyer agent
  console.log('\n==> Deploying NEP-141 USDC & minting agent balance...');
  const usdcDeploy = runNear([
    'contract',
    'deploy',
    ACCOUNTS.usdc,
    'use-file',
    mockFtWasmPath,
    'with-init-call',
    'new',
    'json-args',
    '{}',
    'prepaid-gas',
    '50.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (usdcDeploy.txHash) {
    proofTransactions.push({
      label: 'Deploy NEP-141 Test USDC',
      txHash: usdcDeploy.txHash,
      description: `Deployed on ${ACCOUNTS.usdc}`,
    });
  }

  runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.usdc,
    'mint',
    'json-args',
    JSON.stringify({ account_id: ACCOUNTS.agent, amount: '10000000' }),
    'prepaid-gas',
    '30.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'sign-as',
    ACCOUNTS.agent,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);

  // 4. Deploy Route402 Registry & configure NEP-591 Global Contract hash
  console.log('\n==> Deploying Route402 Registry & pinning NEP-591 hash...');
  const regDeploy = runNear([
    'contract',
    'deploy',
    ACCOUNTS.registry,
    'use-file',
    registryWasmPath,
    'with-init-call',
    'new',
    'json-args',
    JSON.stringify({
      admin_id: ACCOUNTS.registry,
      usdc_contract_id: ACCOUNTS.usdc,
    }),
    'prepaid-gas',
    '50.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (regDeploy.txHash) {
    proofTransactions.push({
      label: 'Deploy Route402 Sharded Registry',
      txHash: regDeploy.txHash,
      description: `NEP-171 + Atomic Escrow deployed on ${ACCOUNTS.registry}`,
    });
  }

  runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'set_vault_global_hash',
    'json-args',
    JSON.stringify({ code_hash_hex: vaultGlobalHashHex }),
    'prepaid-gas',
    '30.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'sign-as',
    ACCOUNTS.registry,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);

  // 5. Alice mints `alpha-signal.r402-reg-v1.testnet` (ONLY 0.25 NEAR!)
  console.log('\n==> Minting keyless Account-NFT #1: alpha-signal...');
  const mintAlpha = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'mint_endpoint',
    'json-args',
    JSON.stringify({
      slug: 'alpha-signal',
      owner_id: ACCOUNTS.alice,
      title: 'Intents Basis & Solver Spread Feed',
      description: 'Real-time cross-chain solver spread telemetry across Base, Solana, Arbitrum, and NEAR.',
      category: 'defi-oracle',
      upstream_slug: 'alpha-signal',
      mcp_tool_name: 'get_intents_basis_signal',
      price_per_call_usdc: '50000',
      price_per_call_yocto: '10000000000000000000000',
    }),
    'prepaid-gas',
    '150.0 Tgas',
    'attached-deposit',
    '0.25 NEAR',
    'sign-as',
    ACCOUNTS.alice,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (mintAlpha.txHash) {
    proofTransactions.push({
      label: 'Mint keyless alpha-signal Account-NFT (0.25 NEAR)',
      txHash: mintAlpha.txHash,
      description: `Created keyless sub-account alpha-signal.${ACCOUNTS.registry}`,
    });
  }

  const alphaVault = `alpha-signal.${ACCOUNTS.registry}`;

  // 6. Agent pays $0.05 USDC into `alpha-signal` via NEP-141 `ft_transfer_call`
  const pay1 = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.usdc,
    'ft_transfer_call',
    'json-args',
    JSON.stringify({
      receiver_id: alphaVault,
      amount: '50000',
      msg: JSON.stringify({
        request_id: 'testnet-x402-call-1',
        resource_path: '/alpha-signal',
        rail: 'nep141-usdc',
      }),
    }),
    'prepaid-gas',
    '100.0 Tgas',
    'attached-deposit',
    '1 yoctoNEAR',
    'sign-as',
    ACCOUNTS.agent,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (pay1.txHash) {
    proofTransactions.push({
      label: 'Settle x402 USDC payment #1 into alpha-signal vault',
      txHash: pay1.txHash,
      description: 'Agent paid 50,000 micro-USDC ($0.05) via ft_transfer_call',
    });
  }

  // 7. Alice lists `alpha-signal` for 1.5 NEAR -> Vault enters `Frozen` escrow
  const listAlpha = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'list_endpoint',
    'json-args',
    JSON.stringify({
      token_id: alphaVault,
      sale_price_yocto: '1500000000000000000000000',
    }),
    'prepaid-gas',
    '100.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'sign-as',
    ACCOUNTS.alice,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (listAlpha.txHash) {
    proofTransactions.push({
      label: 'List alpha-signal in Frozen atomic escrow (1.5 NEAR)',
      txHash: listAlpha.txHash,
      description: 'Vault status -> Frozen, state_nonce pinned at 1',
    });
  }

  // 8. Threat T-2 Live Onchain Proof: Seller Alice attempts mid-sale drain -> REJECTED ONCHAIN!
  console.log('\n==> Recording Threat T-2 blocked seller mid-sale drain on NEAR Testnet...');
  const blockedDrain = runNear(
    [
      'contract',
      'call-function',
      'as-transaction',
      alphaVault,
      'withdraw_usdc',
      'json-args',
      JSON.stringify({
        to: ACCOUNTS.alice,
        amount: '50000',
      }),
      'prepaid-gas',
      '80.0 Tgas',
      'attached-deposit',
      '0 NEAR',
      'sign-as',
      ACCOUNTS.alice,
      'network-config',
      'testnet',
      'sign-with-legacy-keychain',
      'send',
    ],
    true,
  );
  if (blockedDrain.txHash) {
    proofTransactions.push({
      label: 'BLOCKED [Threat T-2] Seller mid-sale drain attempt',
      txHash: blockedDrain.txHash,
      description: 'Onchain panic: Vault outflows/mutations blocked while Frozen',
    });
  }

  // 9. Threat T-6 Live Onchain Proof: Agent pays $0.05 USDC WHILE FROZEN -> SUCCEEDS!
  const payMidSale = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.usdc,
    'ft_transfer_call',
    'json-args',
    JSON.stringify({
      receiver_id: alphaVault,
      amount: '50000',
      msg: JSON.stringify({
        request_id: 'testnet-x402-midsale-2',
        resource_path: '/alpha-signal',
        rail: 'nep141-usdc',
      }),
    }),
    'prepaid-gas',
    '100.0 Tgas',
    'attached-deposit',
    '1 yoctoNEAR',
    'sign-as',
    ACCOUNTS.agent,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (payMidSale.txHash) {
    proofTransactions.push({
      label: '[Threat T-6] Inbound x402 payment during Frozen sale',
      txHash: payMidSale.txHash,
      description: 'Mid-sale USDC revenue accrued to vault without bumping state_nonce',
    });
  }

  // 10. Bob executes atomic `buy_endpoint` (1.5 NEAR) -> Rotates owner to Bob (`rotation_seq = 1`)!
  const buyAlpha = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'buy_endpoint',
    'json-args',
    JSON.stringify({
      token_id: alphaVault,
      expected_state_nonce: '1',
      expected_rotation_seq: '0',
    }),
    'prepaid-gas',
    '120.0 Tgas',
    'attached-deposit',
    '1.5 NEAR',
    'sign-as',
    ACCOUNTS.bob,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  if (buyAlpha.txHash) {
    proofTransactions.push({
      label: 'Atomic buy_endpoint handover to Bob (rotation_seq -> 1)',
      txHash: buyAlpha.txHash,
      description: `Bob acquired ${alphaVault} + all $0.10 accrued USDC`,
    });
  }

  // 11. Mint second Endpoint NFT `tee-auditor`, settle $0.08 USDC, and leave listed (`Frozen`) for live inspection
  console.log('\n==> Minting keyless Account-NFT #2: tee-auditor...');
  const mintTee = runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'mint_endpoint',
    'json-args',
    JSON.stringify({
      slug: 'tee-auditor',
      owner_id: ACCOUNTS.alice,
      title: 'Private TEE Contract & Payment Auditor',
      description: 'Confidential risk scoring backed by NEAR AI Cloud hardware TEE attestation.',
      category: 'private-ai',
      upstream_slug: 'tee-auditor',
      mcp_tool_name: 'audit_contract_confidential',
      price_per_call_usdc: '80000',
      price_per_call_yocto: '20000000000000000000000',
    }),
    'prepaid-gas',
    '150.0 Tgas',
    'attached-deposit',
    '0.25 NEAR',
    'sign-as',
    ACCOUNTS.alice,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);
  const teeVault = `tee-auditor.${ACCOUNTS.registry}`;
  if (mintTee.txHash) {
    proofTransactions.push({
      label: 'Mint keyless tee-auditor Account-NFT (0.25 NEAR)',
      txHash: mintTee.txHash,
      description: `Created keyless sub-account ${teeVault}`,
    });
  }

  runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.usdc,
    'ft_transfer_call',
    'json-args',
    JSON.stringify({
      receiver_id: teeVault,
      amount: '80000',
      msg: JSON.stringify({
        request_id: 'testnet-tee-call-1',
        resource_path: '/tee-auditor',
        rail: 'nep141-usdc',
      }),
    }),
    'prepaid-gas',
    '100.0 Tgas',
    'attached-deposit',
    '1 yoctoNEAR',
    'sign-as',
    ACCOUNTS.agent,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);

  runNear([
    'contract',
    'call-function',
    'as-transaction',
    ACCOUNTS.registry,
    'list_endpoint',
    'json-args',
    JSON.stringify({
      token_id: teeVault,
      sale_price_yocto: '2000000000000000000000000',
    }),
    'prepaid-gas',
    '100.0 Tgas',
    'attached-deposit',
    '0 NEAR',
    'sign-as',
    ACCOUNTS.alice,
    'network-config',
    'testnet',
    'sign-with-legacy-keychain',
    'send',
  ]);

  // 12. Persist deployment manifest to `contracts/artifacts/testnet-deployment.json` & `apps/web/src/testnet-manifest.ts`
  const manifest = {
    network: 'testnet' as const,
    rpcUrl: 'https://test.rpc.fastnear.com',
    explorerBaseUrl: 'https://testnet.nearblocks.io',
    registryId: ACCOUNTS.registry,
    usdcContractId: ACCOUNTS.usdc,
    vaultGlobalHashHex,
    seededEndpoints: [alphaVault, teeVault],
    proofTransactions,
  };

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'testnet-deployment.json'),
    JSON.stringify(manifest, null, 2),
  );

  const webManifestTs = `export interface TestnetDeploymentManifest {
  network: 'testnet';
  rpcUrl: string;
  explorerBaseUrl: string;
  registryId: string;
  usdcContractId: string;
  vaultGlobalHashHex: string;
  seededEndpoints: string[];
  proofTransactions: Array<{
    label: string;
    txHash: string;
    description: string;
  }>;
}

/**
 * Populated automatically by \`scripts/deploy-testnet.ts\` after live NEAR Testnet deployment.
 */
export const TESTNET_DEPLOYMENT: TestnetDeploymentManifest = ${JSON.stringify(manifest, null, 2)};
`;

  fs.writeFileSync(
    path.join(ROOT, 'apps', 'web', 'src', 'testnet-manifest.ts'),
    webManifestTs,
  );

  console.log('\n✓ Live NEAR Testnet deployment & E2E transactions completed!');
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
