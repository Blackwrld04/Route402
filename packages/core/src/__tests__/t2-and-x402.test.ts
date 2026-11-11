import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  type NearRpcProvider,
  type Nep171Token,
  type NftItemInfo,
  verifyT0Namespace,
  verifyT2ShardedItem,
} from '../t2-verifier.js';
import { createRoute402Gateway } from '../../../x402-gateway/src/server.js';
import { Route402AgentClient } from '../../../agent-mcp/src/client.js';
import { X402_HEADER_PAYMENT, encodeX402Header } from '../x402.js';

describe('House of Stake sharded-item-1.0.0 T0 & T2 Verification', () => {
  it('validates T0 direct sub-account namespace', () => {
    expect(verifyT0Namespace('alpha-signal.reg.testnet', 'reg.testnet')).toBe(true);
    expect(verifyT0Namespace('deep.sub.reg.testnet', 'reg.testnet')).toBe(false);
    expect(verifyT0Namespace('alpha-signal.evil.testnet', 'reg.testnet')).toBe(false);
  });

  it('refuses forged self-asserted collection (Threat: Unpinned Collection)', async () => {
    const fakeProvider: NearRpcProvider = {
      async getFinalBlock() {
        return { height: 500, hash: 'blk_500' };
      },
      async viewAtBlock<T>(accountId: string, methodName: string): Promise<T | null> {
        if (methodName === 'nft_item_info') {
          const item: NftItemInfo = {
            spec: 'sharded-item-1.0.0',
            init: true,
            status: 'Active',
            collection_id: 'attacker-coll.testnet',
            token_id: accountId,
            owner_id: 'attacker.testnet',
            rotation_seq: '0',
            rotation_epoch: 1,
          };
          return item as unknown as T;
        }
        return null;
      },
    };

    const res = await verifyT2ShardedItem({
      provider: fakeProvider,
      accountId: 'fake.attacker-coll.testnet',
      pinnedCollectionId: 'trusted-reg.testnet',
    });
    expect(res.ok).toBe(false);
    expect(res.verdict).toBe('REFUSED_UNPINNED_COLLECTION');
  });

  it('refuses identity spoofing where item answers with another token_id', async () => {
    const fakeProvider: NearRpcProvider = {
      async getFinalBlock() {
        return { height: 501, hash: 'blk_501' };
      },
      async viewAtBlock<T>(_accountId: string, methodName: string): Promise<T | null> {
        if (methodName === 'nft_item_info') {
          const item: NftItemInfo = {
            spec: 'sharded-item-1.0.0',
            init: true,
            status: 'Active',
            collection_id: 'trusted-reg.testnet',
            token_id: 'other.trusted-reg.testnet',
            owner_id: 'alice.testnet',
            rotation_seq: '0',
            rotation_epoch: 1,
          };
          return item as unknown as T;
        }
        return null;
      },
    };

    const res = await verifyT2ShardedItem({
      provider: fakeProvider,
      accountId: 'spoof.trusted-reg.testnet',
      pinnedCollectionId: 'trusted-reg.testnet',
    });
    expect(res.ok).toBe(false);
    expect(res.verdict).toBe('REFUSED_IDENTITY_MISMATCH');
  });

  it('uses the caller-supplied pinned block for every read of the T2 pair', async () => {
    const seenBlockIds: Array<number | string> = [];
    let blockFetches = 0;
    const provider: NearRpcProvider = {
      async getFinalBlock() {
        blockFetches += 1;
        return { height: 900, hash: 'blk_900' };
      },
      async viewAtBlock<T>(
        _accountId: string,
        methodName: string,
        _args: Record<string, unknown>,
        blockId: number | string,
      ): Promise<T | null> {
        seenBlockIds.push(blockId);
        if (methodName === 'nft_item_info') {
          return {
            spec: 'sharded-item-1.0.0',
            init: true,
            status: 'Active',
            collection_id: 'trusted-reg.testnet',
            token_id: 'pinned.trusted-reg.testnet',
            owner_id: 'alice.testnet',
            rotation_seq: '0',
            rotation_epoch: 1,
          } as unknown as T;
        }
        if (methodName === 'nft_token') {
          return { token_id: 'pinned.trusted-reg.testnet', owner_id: 'alice.testnet' } as unknown as T;
        }
        if (methodName === 'get_token_rotation_seq') {
          return '0' as unknown as T;
        }
        return null;
      },
    };

    const res = await verifyT2ShardedItem({
      provider,
      accountId: 'pinned.trusted-reg.testnet',
      pinnedCollectionId: 'trusted-reg.testnet',
      pinnedBlock: { height: 12345, hash: 'blk_12345' },
    });

    expect(res.ok).toBe(true);
    expect(res.blockHeight).toBe(12345);
    expect(res.blockHash).toBe('blk_12345');
    // Every read of the pair must be pinned to the SAME block...
    expect(seenBlockIds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seenBlockIds)).toEqual(new Set([12345]));
    // ...and no extra block fetch is required for the pinned attempt.
    expect(blockFetches).toBe(0);
  });

  it('distinguishes invented rotation vs transient cross-receipt lag', async () => {
    const providerInvented: NearRpcProvider = {
      async getFinalBlock() {
        return { height: 502, hash: 'blk_502' };
      },
      async viewAtBlock<T>(
        accountId: string,
        methodName: string,
        args: Record<string, unknown>,
      ): Promise<T | null> {
        if (methodName === 'nft_item_info') {
          return {
            spec: 'sharded-item-1.0.0',
            init: true,
            status: 'Active',
            collection_id: 'trusted-reg.testnet',
            token_id: accountId,
            owner_id: 'alice.testnet',
            rotation_seq: '1',
            rotation_epoch: 1,
          } as unknown as T;
        }
        if (methodName === 'nft_token') {
          const tok: Nep171Token = {
            token_id: String(args.token_id),
            owner_id: 'bob.testnet',
          };
          return tok as unknown as T;
        }
        if (methodName === 'get_token_rotation_seq') {
          return '2' as unknown as T;
        }
        return null;
      },
    };

    const invented = await verifyT2ShardedItem({
      provider: providerInvented,
      accountId: 'item.trusted-reg.testnet',
      pinnedCollectionId: 'trusted-reg.testnet',
      maxRetries: 0,
    });
    expect(invented.ok).toBe(false);
    expect(invented.verdict).toBe('REFUSED_INVENTED_ROTATION');
  });
});

describe('Route402 x402 Gateway + Agent Client + Mid-Sale Escrow Invariants', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    const { server } = createRoute402Gateway({
      port: 0,
      mode: 'demo',
      registryId: 'registry.route402.testnet',
      usdcContractId: 'usdc.route402.testnet',
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    closeServer = () => new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
    await closeServer();
  });

  it('completes HTTP 402 -> X-PAYMENT -> 200 OK while Frozen, blocks seller drain, and transfers vault to buyer', async () => {
    const tokenId = 'alpha-signal.registry.route402.testnet';
    const agent = new Route402AgentClient({
      gatewayBaseUrl: baseUrl,
      payerId: 'autonomous-agent.testnet',
      pinnedCollectionId: 'registry.route402.testnet',
      // Sandbox mirror is not queryable over NEAR RPC; opt into trusting the
      // gateway's T2 proof for this demo-mode test only.
      allowUnverifiedT2: true,
    });

    // 1. Agent calls listed (`Frozen`) endpoint -> inbound x402 revenue succeeds (Threat T-6!)
    const paidCall = await agent.callEndpoint<{
      ok: boolean;
      paymentReceipt: { vaultUsdcBalance: string; beneficiaryOwner: string; vaultStatus: string };
    }>(`/x402/${tokenId}/alpha-signal`);

    expect(paidCall.status).toBe(200);
    expect(paidCall.data.ok).toBe(true);
    expect(paidCall.data.paymentReceipt.vaultStatus).toBe('Frozen');
    expect(paidCall.data.paymentReceipt.vaultUsdcBalance).toBe('750000'); // $0.70 seed + $0.05 call

    // 2. Seller Alice tries to front-run drain USDC while Frozen -> HTTP 409 BLOCKED [Threat T-2]
    const drainAttempt = await fetch(`${baseUrl}/api/demo/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId,
        callerId: 'alice.route402.testnet',
        amountUsdc: '750000',
      }),
    });
    expect(drainAttempt.status).toBe(409);
    const drainJson = (await drainAttempt.json()) as { blocked: boolean; error: string };
    expect(drainJson.blocked).toBe(true);
    expect(drainJson.error).toContain('Threat T-2');

    // 3. Buyer Bob purchases with pinned state_nonce="1" & rotation_seq="0" -> Atomic Handover!
    const buyRes = await fetch(`${baseUrl}/api/demo/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId,
        buyerId: 'bob.route402.testnet',
        expectedStateNonce: '1',
        expectedRotationSeq: '0',
      }),
    });
    expect(buyRes.status).toBe(200);
    const buyJson = (await buyRes.json()) as {
      summary: { owner_id: string; status: string; rotation_seq: string; vault_usdc_balance: string };
    };
    expect(buyJson.summary.owner_id).toBe('bob.route402.testnet');
    expect(buyJson.summary.status).toBe('Active');
    expect(buyJson.summary.rotation_seq).toBe('1');
    expect(buyJson.summary.vault_usdc_balance).toBe('750000');

    // 4. Subsequent x402 calls automatically accrue to new owner Bob!
    const postSaleCall = await agent.callEndpoint<{
      paymentReceipt: { beneficiaryOwner: string; vaultUsdcBalance: string };
    }>(`/x402/${tokenId}/alpha-signal`);
    expect(postSaleCall.data.paymentReceipt.beneficiaryOwner).toBe('bob.route402.testnet');
    expect(postSaleCall.data.paymentReceipt.vaultUsdcBalance).toBe('800000');
  });

  it('rejects a replayed X-PAYMENT request_id with HTTP 409', async () => {
    const tokenId = 'whale-pulse.registry.route402.testnet';
    const resource = `/x402/${tokenId}/whale-pulse`;
    const payment = {
      x402Version: 1 as const,
      scheme: 'exact' as const,
      network: 'near-sandbox-demo',
      payload: {
        txHash: 'sim_replay_test_tx',
        payerId: 'replay-agent.route402.testnet',
        requestId: 'req-replay-test-001',
        amount: '30000',
        asset: 'usdc.route402.testnet',
        simulated: true,
      },
    };

    const call = () =>
      fetch(`${baseUrl}${resource}`, {
        headers: { [X402_HEADER_PAYMENT]: encodeX402Header(payment) },
      });

    const first = await call();
    expect(first.status).toBe(200);

    const replay = await call();
    expect(replay.status).toBe(409);
    const replayJson = (await replay.json()) as {
      error: string;
      requestId: string;
      conflictingPayload: boolean;
    };
    expect(replayJson.error).toContain('replay rejected');
    expect(replayJson.requestId).toBe('req-replay-test-001');
    expect(replayJson.conflictingPayload).toBe(false);

    // Reusing the same request_id with a different payload is also rejected.
    const conflicting = await fetch(`${baseUrl}${resource}`, {
      headers: {
        [X402_HEADER_PAYMENT]: encodeX402Header({
          ...payment,
          payload: { ...payment.payload, amount: '60000' },
        }),
      },
    });
    expect(conflicting.status).toBe(409);
    const conflictingJson = (await conflicting.json()) as { conflictingPayload: boolean };
    expect(conflictingJson.conflictingPayload).toBe(true);
  });

  it('rejects a malformed or underpriced X-PAYMENT before settlement', async () => {
    const resource = '/x402/whale-pulse.registry.route402.testnet/whale-pulse';

    const underpriced = await fetch(`${baseUrl}${resource}`, {
      headers: {
        [X402_HEADER_PAYMENT]: encodeX402Header({
          x402Version: 1,
          scheme: 'exact',
          network: 'near-sandbox-demo',
          payload: {
            payerId: 'underpayer.route402.testnet',
            requestId: 'req-underpriced-001',
            amount: '1',
            asset: 'usdc.route402.testnet',
          },
        }),
      },
    });
    expect(underpriced.status).toBe(402);

    const wrongAsset = await fetch(`${baseUrl}${resource}`, {
      headers: {
        [X402_HEADER_PAYMENT]: encodeX402Header({
          x402Version: 1,
          scheme: 'exact',
          network: 'near-sandbox-demo',
          payload: {
            payerId: 'wrongasset.route402.testnet',
            requestId: 'req-wrong-asset-001',
            amount: '30000',
            asset: 'attacker-token.testnet',
          },
        }),
      },
    });
    expect(wrongAsset.status).toBe(400);
  });
});

describe('Route402AgentClient trust boundaries', () => {
  const tokenId = 'alpha-signal.registry.route402.testnet';
  const resource = `/x402/${tokenId}/alpha-signal`;
  const pinned = 'registry.route402.testnet';

  async function startChallengeServer(opts: {
    payTo: string;
    t2Proof?: Record<string, unknown>;
    omitT2?: boolean;
  }): Promise<{ url: string; close: () => Promise<void> }> {
    const server = http.createServer((_req, res) => {
      const challenge = {
        x402Version: 1,
        error: 'HTTP 402 Payment Required',
        accepts: [
          {
            scheme: 'exact',
            network: 'near-sandbox-demo',
            maxAmountRequired: '50000',
            resource,
            description: 'test endpoint',
            mimeType: 'application/json',
            payTo: opts.payTo,
            maxTimeoutSeconds: 120,
            asset: 'usdc.route402.testnet',
          },
        ],
        ...(opts.omitT2 ? {} : { t2Proof: opts.t2Proof }),
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
    });
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        resolve({
          url: `http://127.0.0.1:${addr.port}`,
          close: () => new Promise<void>((done) => server.close(() => done())),
        });
      });
    });
  }

  function proof(accountId: string): Record<string, unknown> {
    return {
      ok: true,
      verdict: 'VERIFIED',
      blockHeight: 100,
      blockHash: 'blk_100',
      pinnedCollectionId: pinned,
      accountId,
      ownerId: 'alice.route402.testnet',
      status: 'Frozen',
      suitableToAct: true,
      reason: 'ok',
    };
  }

  it('refuses a payTo that is not the resource endpoint', async () => {
    const attacker = 'attacker.registry.route402.testnet';
    const srv = await startChallengeServer({ payTo: attacker, t2Proof: proof(attacker) });
    try {
      const client = new Route402AgentClient({
        gatewayBaseUrl: srv.url,
        payerId: 'agent.testnet',
        pinnedCollectionId: pinned,
        allowUnverifiedT2: true,
      });
      await expect(client.callEndpoint(resource)).rejects.toThrow(
        /does not match resource endpoint/,
      );
    } finally {
      await srv.close();
    }
  });

  it('refuses a forged T2 proof after independent RPC verification', async () => {
    const srv = await startChallengeServer({ payTo: tokenId, t2Proof: proof(tokenId) });
    const provider: NearRpcProvider = {
      async getFinalBlock() {
        return { height: 100, hash: 'blk_100' };
      },
      async viewAtBlock<T>(): Promise<T | null> {
        return null;
      },
    };
    try {
      const client = new Route402AgentClient({
        gatewayBaseUrl: srv.url,
        payerId: 'agent.testnet',
        pinnedCollectionId: pinned,
        rpcProvider: provider,
      });
      await expect(client.callEndpoint(resource)).rejects.toThrow(
        /independent T2 verification failed/,
      );
    } finally {
      await srv.close();
    }
  });

  it('refuses a challenge with no T2 proof', async () => {
    const srv = await startChallengeServer({ payTo: tokenId, omitT2: true });
    try {
      const client = new Route402AgentClient({
        gatewayBaseUrl: srv.url,
        payerId: 'agent.testnet',
        pinnedCollectionId: pinned,
        allowUnverifiedT2: true,
      });
      await expect(client.callEndpoint(resource)).rejects.toThrow(
        /did not provide a sharded-item T2 proof/,
      );
    } finally {
      await srv.close();
    }
  });
});
