import {
  HttpNearRpcProvider,
  formatNear,
  formatUsdc,
  verifyT2ShardedItem,
  type MarketListing,
  type Nep171Token,
  type VaultSummary,
} from '@route402/core';
import { TESTNET_DEPLOYMENT } from '../apps/web/src/testnet-manifest.js';

async function main() {
  const rpc = new HttpNearRpcProvider(TESTNET_DEPLOYMENT.rpcUrl);
  const finalBlock = await rpc.getFinalBlock();

  console.log('========================================================================');
  console.log(' Route402 — Live NEAR Testnet Onchain Verification (Zero Keys Required)');
  console.log('========================================================================');
  console.log(`RPC Endpoint      : ${TESTNET_DEPLOYMENT.rpcUrl}`);
  console.log(`Finalized Block   : #${finalBlock.height} (${finalBlock.hash})`);
  console.log(`Pinned Registry   : ${TESTNET_DEPLOYMENT.registryId}`);
  console.log(`NEP-141 Test USDC : ${TESTNET_DEPLOYMENT.usdcContractId}`);

  const [deployMode, configEpoch, tokens, listings] = await Promise.all([
    rpc.viewAtBlock<string>(
      TESTNET_DEPLOYMENT.registryId,
      'get_vault_deploy_mode',
      {},
      finalBlock.height,
    ),
    rpc.viewAtBlock<number>(TESTNET_DEPLOYMENT.registryId, 'config_epoch', {}, finalBlock.height),
    rpc.viewAtBlock<Nep171Token[]>(
      TESTNET_DEPLOYMENT.registryId,
      'nft_tokens',
      { from_index: '0', limit: 20 },
      finalBlock.height,
    ),
    rpc.viewAtBlock<MarketListing[]>(
      TESTNET_DEPLOYMENT.registryId,
      'get_listings',
      {},
      finalBlock.height,
    ),
  ]);

  console.log(`Vault Deploy Mode : ${deployMode}`);
  console.log(`Config Epoch      : ${configEpoch}`);
  console.log(`Minted AccountNFTs: ${tokens?.length ?? 0}`);
  console.log(`Active Listings   : ${listings?.length ?? 0}\n`);

  if (!tokens || tokens.length === 0) {
    throw new Error(`No minted tokens found on ${TESTNET_DEPLOYMENT.registryId}`);
  }

  for (const tok of tokens) {
    const [t2, summary, keys] = await Promise.all([
      verifyT2ShardedItem({
        provider: rpc,
        accountId: tok.token_id,
        pinnedCollectionId: TESTNET_DEPLOYMENT.registryId,
      }),
      rpc.viewAtBlock<VaultSummary>(
        tok.token_id,
        'get_vault_summary',
        {},
        finalBlock.height,
      ),
      rpc.viewAccessKeys(tok.token_id),
    ]);

    if (!t2.ok || !summary) {
      throw new Error(`T2 verification failed for ${tok.token_id}: ${t2.reason}`);
    }
    if (keys.length !== 0) {
      throw new Error(
        `THREAT T-1 VIOLATION on ${tok.token_id}: expected 0 access keys, found ${keys.length}`,
      );
    }

    const listing = listings?.find((l) => l.token_id === tok.token_id) ?? null;

    console.log(`------------------------------------------------------------------------`);
    console.log(`Account-NFT       : ${tok.token_id}`);
    console.log(`T2 Verdict        : ${t2.verdict} @ final block #${t2.blockHeight}`);
    console.log(`Keyless Proof     : keys: [] (${keys.length} access keys)`);
    console.log(`Owner             : ${summary.owner_id} (rotation_seq=${summary.rotation_seq})`);
    console.log(`Vault Status      : ${summary.status} (state_nonce=${summary.state_nonce})`);
    console.log(
      `Vault Treasury    : $${formatUsdc(summary.vault_usdc_balance)} USDC (${summary.total_calls} settled x402 calls)`,
    );
    if (listing) {
      console.log(
        `Escrow Listing    : ${formatNear(listing.sale_price_yocto)} NEAR (pinned nonce=${listing.listed_state_nonce})`,
      );
    }
  }

  console.log(`\n✓ All ${tokens.length} live NEAR Testnet Sharded Account-NFTs passed T2 & keyless checks!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
