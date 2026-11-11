import crypto from 'node:crypto';
import {
  HttpNearRpcProvider,
  type EndpointReceipt,
  type ItemStatus,
  type MarketListing,
  type NearRpcProvider,
  type Nep171Token,
  type NftItemInfo,
  type VaultSummary,
  verifyT2ShardedItem,
} from '@route402/core';

export type Route402Mode = 'demo' | 'dry' | 'live';

interface SandboxVaultRecord extends VaultSummary {
  frozen_for_sale: boolean;
  suspended: boolean;
}

/**
 * Deterministic in-process NEAR state mirror used ONLY in zero-key `demo` mode
 * (or as fallback when offline). Implements the exact same `NearRpcProvider`
 * interface so `verifyT2ShardedItem` runs 100% of its normative clauses.
 */
export class SandboxChainMirror implements NearRpcProvider {
  public blockHeight = 188_420_100;
  public configEpoch = 1;
  private vaults = new Map<string, SandboxVaultRecord>();
  private listings = new Map<string, MarketListing>();
  private processedRequests = new Map<
    string,
    { tokenId: string; amountUsdc: bigint }
  >();

  constructor(
    public readonly registryId: string,
    public readonly usdcContractId: string,
  ) {
    this.seedDefaults();
  }

  private nextBlock(): { height: number; hash: string } {
    this.blockHeight += 1;
    const hash = crypto
      .createHash('sha256')
      .update(`sim-block-${this.blockHeight}`)
      .digest('hex')
      .slice(0, 44);
    return { height: this.blockHeight, hash: `sim_${hash}` };
  }

  private seedDefaults(): void {
    const now = Date.now();
    const seeds: Array<{
      slug: string;
      owner: string;
      title: string;
      desc: string;
      cat: string;
      upstream: string;
      tool: string;
      priceUsdc: string;
      priceYocto: string;
      calls: number;
      earnedUsdc: string;
      listedPriceYocto?: string;
    }> = [
      {
        slug: 'alpha-signal',
        owner: 'alice.route402.testnet',
        title: 'Intents Basis & Solver Spread Feed',
        desc: 'Real-time cross-chain solver spread telemetry across Base, Solana, Arbitrum, and NEAR.',
        cat: 'defi-oracle',
        upstream: 'alpha-signal',
        tool: 'get_intents_basis_signal',
        priceUsdc: '50000', // $0.05 USDC
        priceYocto: '10000000000000000000000', // 0.01 NEAR
        calls: 14,
        earnedUsdc: '700000', // $0.70 inside vault
        listedPriceYocto: '1500000000000000000000000', // 1.5 NEAR listing
      },
      {
        slug: 'tee-auditor',
        owner: 'alice.route402.testnet',
        title: 'Private TEE Contract & Payment Auditor',
        desc: 'Contract risk scoring via NEAR AI Cloud; TEE attestation is not independently verified by Route402.',
        cat: 'private-ai',
        upstream: 'tee-auditor',
        tool: 'audit_contract_confidential',
        priceUsdc: '80000', // $0.08 USDC
        priceYocto: '20000000000000000000000', // 0.02 NEAR
        calls: 9,
        earnedUsdc: '720000', // $0.72 inside vault
      },
      {
        slug: 'whale-pulse',
        owner: 'bob.route402.testnet',
        title: 'House of Stake & Whale Corridor Feed',
        desc: 'Tracks multichain USDC inflows into NEAR Intents and veNEAR staking shifts.',
        cat: 'analytics',
        upstream: 'whale-pulse',
        tool: 'get_whale_corridor_pulse',
        priceUsdc: '30000', // $0.03 USDC
        priceYocto: '10000000000000000000000', // 0.01 NEAR
        calls: 22,
        earnedUsdc: '660000', // $0.66 inside vault
      },
    ];

    for (const s of seeds) {
      const tokenId = `${s.slug}.${this.registryId}`;
      const frozen = Boolean(s.listedPriceYocto);
      const status: ItemStatus = frozen ? 'Frozen' : 'Active';
      const nonce = frozen ? '1' : '0';

      const receipts: EndpointReceipt[] = [
        {
          receipt_id: `rcpt-${s.calls}`,
          request_id: `sim-seed-${s.slug}-1`,
          payer_id: 'buyer-agent.route402.testnet',
          asset: 'USDC',
          amount: s.priceUsdc,
          resource_path: `/${s.upstream}`,
          rail: 'nep141-usdc',
          timestamp_ms: now - 42_000,
        },
      ];

      this.vaults.set(tokenId, {
        spec: 'sharded-item-1.0.0',
        token_id: tokenId,
        collection_id: this.registryId,
        owner_id: s.owner,
        status,
        frozen_for_sale: frozen,
        suspended: false,
        title: s.title,
        description: s.desc,
        category: s.cat,
        upstream_slug: s.upstream,
        mcp_tool_name: s.tool,
        price_per_call_usdc: s.priceUsdc,
        price_per_call_yocto: s.priceYocto,
        usdc_contract_id: this.usdcContractId,
        total_calls: s.calls,
        total_earned_usdc: s.earnedUsdc,
        total_earned_yocto: '0',
        total_withdrawn_usdc: '0',
        total_withdrawn_yocto: '0',
        vault_usdc_balance: s.earnedUsdc,
        state_nonce: nonce,
        rotation_seq: '0',
        rotation_epoch: 1,
        pending_outflows: 0,
        operator_id: null,
        operator_bound_seq: null,
        recent_receipts: receipts,
        ownership_history: [
          {
            from_owner: this.registryId,
            to_owner: s.owner,
            rotation_seq: '0',
            sale_price_yocto: null,
            timestamp_ms: now - 3_600_000,
          },
        ],
      });

      if (s.listedPriceYocto) {
        this.listings.set(tokenId, {
          token_id: tokenId,
          seller_id: s.owner,
          sale_price_yocto: s.listedPriceYocto,
          listed_state_nonce: nonce,
          listed_rotation_seq: '0',
          listed_at_ms: now - 600_000,
        });
      }
    }
  }

  async getFinalBlock(): Promise<{ height: number; hash: string }> {
    const hash = crypto
      .createHash('sha256')
      .update(`sim-block-${this.blockHeight}`)
      .digest('hex')
      .slice(0, 44);
    return { height: this.blockHeight, hash: `sim_${hash}` };
  }

  async viewAtBlock<T>(
    accountId: string,
    methodName: string,
    args: Record<string, unknown>,
    _blockId: number | string,
  ): Promise<T | null> {
    if (accountId === this.registryId) {
      if (methodName === 'nft_token') {
        const tid = String(args.token_id ?? '');
        const v = this.vaults.get(tid);
        if (!v) return null;
        const tok: Nep171Token = {
          token_id: v.token_id,
          owner_id: v.owner_id,
          metadata: { title: v.title, description: v.description },
        };
        return tok as unknown as T;
      }
      if (methodName === 'get_token_rotation_seq') {
        const tid = String(args.token_id ?? '');
        const v = this.vaults.get(tid);
        return (v ? v.rotation_seq : null) as unknown as T;
      }
      if (methodName === 'config_epoch') {
        return this.configEpoch as unknown as T;
      }
      if (methodName === 'get_listings') {
        return Array.from(this.listings.values()) as unknown as T;
      }
      if (methodName === 'nft_tokens') {
        return Array.from(this.vaults.values()).map((v) => ({
          token_id: v.token_id,
          owner_id: v.owner_id,
          metadata: { title: v.title, description: v.description },
        })) as unknown as T;
      }
    }

    const v = this.vaults.get(accountId);
    if (!v) return null;

    if (methodName === 'nft_item_info') {
      const info: NftItemInfo = {
        spec: 'sharded-item-1.0.0',
        init: true,
        status: v.frozen_for_sale ? 'Frozen' : v.suspended ? 'Suspended' : 'Active',
        collection_id: v.collection_id,
        token_id: accountId,
        owner_id: v.owner_id,
        rotation_seq: v.rotation_seq,
        rotation_epoch: v.rotation_epoch,
      };
      return info as unknown as T;
    }

    if (methodName === 'get_vault_summary') {
      return {
        ...v,
        status: v.frozen_for_sale ? 'Frozen' : v.suspended ? 'Suspended' : 'Active',
      } as unknown as T;
    }

    return null;
  }

  listAllSummaries(): Array<{ summary: VaultSummary; listing: MarketListing | null }> {
    return Array.from(this.vaults.values()).map((v) => ({
      summary: {
        ...v,
        status: v.frozen_for_sale ? 'Frozen' : v.suspended ? 'Suspended' : 'Active',
      },
      listing: this.listings.get(v.token_id) ?? null,
    }));
  }

  /**
   * Access keys for a mirrored vault. The sandbox mirror only ever models
   * keyless NEP-591 global-contract vaults, so the key list is empty by
   * construction — the same invariant the real Testnet vaults are checked
   * against with `view_access_key_list`.
   */
  async viewAccessKeys(_accountId: string): Promise<unknown[]> {
    return [];
  }

  mintEndpoint(input: {
    slug: string;
    ownerId: string;
    title: string;
    description: string;
    category: string;
    upstreamSlug: string;
    pricePerCallUsdc: string;
  }): VaultSummary {
    const cleanSlug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug || cleanSlug.length < 2) {
      throw new Error('Slug must be at least 2 alphanumeric characters');
    }
    const tokenId = `${cleanSlug}.${this.registryId}`;
    if (this.vaults.has(tokenId)) {
      throw new Error(`Endpoint sub-account ${tokenId} already exists`);
    }
    this.nextBlock();
    const now = Date.now();
    const rec: SandboxVaultRecord = {
      spec: 'sharded-item-1.0.0',
      token_id: tokenId,
      collection_id: this.registryId,
      owner_id: input.ownerId,
      status: 'Active',
      frozen_for_sale: false,
      suspended: false,
      title: input.title,
      description: input.description,
      category: input.category || 'ai-service',
      upstream_slug: input.upstreamSlug || 'alpha-signal',
      mcp_tool_name: `call_${cleanSlug.replace(/-/g, '_')}`,
      price_per_call_usdc: input.pricePerCallUsdc,
      price_per_call_yocto: '10000000000000000000000',
      usdc_contract_id: this.usdcContractId,
      total_calls: 0,
      total_earned_usdc: '0',
      total_earned_yocto: '0',
      total_withdrawn_usdc: '0',
      total_withdrawn_yocto: '0',
      vault_usdc_balance: '0',
      state_nonce: '0',
      rotation_seq: '0',
      rotation_epoch: 1,
      pending_outflows: 0,
      operator_id: null,
      operator_bound_seq: null,
      recent_receipts: [],
      ownership_history: [
        {
          from_owner: this.registryId,
          to_owner: input.ownerId,
          rotation_seq: '0',
          sale_price_yocto: null,
          timestamp_ms: now,
        },
      ],
    };
    this.vaults.set(tokenId, rec);
    return rec;
  }

  recordX402Payment(input: {
    tokenId: string;
    payerId: string;
    requestId: string;
    amountUsdc: string;
    resourcePath: string;
    rail?: 'near-native' | 'nep141-usdc' | 'near-intents-1click';
  }): { txHash: string; summary: VaultSummary } {
    const v = this.vaults.get(input.tokenId);
    if (!v) throw new Error(`Unknown endpoint account ${input.tokenId}`);
    if (this.processedRequests.has(input.requestId)) {
      throw new Error(`Duplicate x402 request_id replay rejected: ${input.requestId}`);
    }
    const amt = BigInt(input.amountUsdc);
    if (amt < BigInt(v.price_per_call_usdc)) {
      throw new Error(`Payment ${amt} below required ${v.price_per_call_usdc} micro-USDC`);
    }
    this.processedRequests.set(input.requestId, {
      tokenId: input.tokenId,
      amountUsdc: amt,
    });
    const blk = this.nextBlock();

    // T-6 Invariant: Inbound customer payments work even while Frozen and NEVER bump state_nonce!
    v.vault_usdc_balance = (BigInt(v.vault_usdc_balance) + amt).toString();
    v.total_earned_usdc = (BigInt(v.total_earned_usdc) + amt).toString();
    v.total_calls += 1;
    v.recent_receipts = [
      ...v.recent_receipts.slice(-31),
      {
        receipt_id: `rcpt-${v.total_calls}`,
        request_id: input.requestId,
        payer_id: input.payerId,
        asset: 'USDC',
        amount: amt.toString(),
        resource_path: input.resourcePath,
        rail: input.rail ?? 'nep141-usdc',
        timestamp_ms: Date.now(),
      },
    ];

    return {
      txHash: `sim_tx_${blk.height}_${input.requestId.slice(0, 10)}`,
      summary: { ...v, status: v.frozen_for_sale ? 'Frozen' : 'Active' },
    };
  }

  /**
   * Roll back a sandbox payment when the paid upstream call fails before a
   * response is delivered. This mirrors a reverted settlement so the payer can
   * retry the same request_id instead of losing funds to a 5xx.
   */
  releaseX402Payment(tokenId: string, requestId: string): boolean {
    const rec = this.processedRequests.get(requestId);
    const v = this.vaults.get(tokenId);
    if (!rec || !v || rec.tokenId !== tokenId) return false;

    this.processedRequests.delete(requestId);
    v.vault_usdc_balance = (BigInt(v.vault_usdc_balance) - rec.amountUsdc).toString();
    v.total_earned_usdc = (BigInt(v.total_earned_usdc) - rec.amountUsdc).toString();
    v.total_calls = Math.max(0, v.total_calls - 1);
    v.recent_receipts = v.recent_receipts.filter((r) => r.request_id !== requestId);
    return true;
  }

  listEndpoint(tokenId: string, callerId: string, salePriceYocto: string): MarketListing {
    const v = this.vaults.get(tokenId);
    if (!v) throw new Error(`Endpoint ${tokenId} not found`);
    if (v.owner_id !== callerId) throw new Error(`Unauthorized: ${callerId} is not owner (${v.owner_id})`);
    if (v.frozen_for_sale) throw new Error('Endpoint is already listed and frozen');

    this.nextBlock();
    v.frozen_for_sale = true;
    v.status = 'Frozen';
    v.state_nonce = (BigInt(v.state_nonce) + 1n).toString();

    const listing: MarketListing = {
      token_id: tokenId,
      seller_id: callerId,
      sale_price_yocto: salePriceYocto,
      listed_state_nonce: v.state_nonce,
      listed_rotation_seq: v.rotation_seq,
      listed_at_ms: Date.now(),
    };
    this.listings.set(tokenId, listing);
    return listing;
  }

  withdrawUsdc(tokenId: string, callerId: string, amountUsdc: string): VaultSummary {
    const v = this.vaults.get(tokenId);
    if (!v) throw new Error(`Endpoint ${tokenId} not found`);
    if (v.owner_id !== callerId) {
      throw new Error(`Unauthorized: ${callerId} is no longer owner (current owner: ${v.owner_id})`);
    }
    if (v.frozen_for_sale) {
      throw new Error(
        'BLOCKED [Threat T-2]: Vault status is Frozen during active listing — seller front-run drain refused!',
      );
    }
    const amt = BigInt(amountUsdc);
    const bal = BigInt(v.vault_usdc_balance);
    if (amt <= 0n || amt > bal) {
      throw new Error(`Insufficient vault USDC balance (${bal})`);
    }
    this.nextBlock();
    v.vault_usdc_balance = (bal - amt).toString();
    v.total_withdrawn_usdc = (BigInt(v.total_withdrawn_usdc) + amt).toString();
    v.state_nonce = (BigInt(v.state_nonce) + 1n).toString();
    return { ...v, status: 'Active' };
  }

  buyEndpoint(input: {
    tokenId: string;
    buyerId: string;
    expectedStateNonce: string;
    expectedRotationSeq: string;
  }): VaultSummary {
    const v = this.vaults.get(input.tokenId);
    const listing = this.listings.get(input.tokenId);
    if (!v || !listing) throw new Error(`Endpoint ${input.tokenId} is not listed for sale`);

    if (v.state_nonce !== input.expectedStateNonce) {
      throw new Error(
        `BLOCKED [Threat T-3]: state_nonce changed since buyer inspection (expected ${input.expectedStateNonce}, found ${v.state_nonce})`,
      );
    }
    if (v.rotation_seq !== input.expectedRotationSeq) {
      throw new Error(
        `BLOCKED: rotation_seq changed since buyer inspection (expected ${input.expectedRotationSeq}, found ${v.rotation_seq})`,
      );
    }

    this.nextBlock();
    const prevOwner = v.owner_id;
    v.owner_id = input.buyerId;
    v.frozen_for_sale = false;
    v.status = 'Active';
    v.rotation_seq = (BigInt(v.rotation_seq) + 1n).toString();
    v.state_nonce = (BigInt(v.state_nonce) + 1n).toString();
    v.operator_id = null;
    v.operator_bound_seq = null;
    v.ownership_history.push({
      from_owner: prevOwner,
      to_owner: input.buyerId,
      rotation_seq: v.rotation_seq,
      sale_price_yocto: listing.sale_price_yocto,
      timestamp_ms: Date.now(),
    });
    this.listings.delete(input.tokenId);
    return { ...v, status: 'Active' };
  }
}

export class Route402StateEngine {
  public readonly rpcProvider: NearRpcProvider;
  public readonly sandboxMirror: SandboxChainMirror;

  constructor(
    public readonly mode: Route402Mode,
    public readonly registryId: string,
    public readonly usdcContractId: string,
    public readonly rpcUrl: string = 'https://test.rpc.fastnear.com',
  ) {
    this.sandboxMirror = new SandboxChainMirror(registryId, usdcContractId);
    this.rpcProvider =
      mode === 'demo' ? this.sandboxMirror : new HttpNearRpcProvider(rpcUrl);
  }

  async verifyEndpointT2(accountId: string) {
    return verifyT2ShardedItem({
      provider: this.rpcProvider,
      accountId,
      pinnedCollectionId: this.registryId,
    });
  }

  /**
   * Number of access keys on the endpoint's sub-account, read from the same
   * provider that backs the T2 verification (real RPC in dry/live mode, the
   * in-process mirror in demo mode). Returns `null` when the key list could
   * not be read, so callers can distinguish "0 keys" from "unknown".
   */
  async getAccessKeyCount(accountId: string): Promise<number | null> {
    try {
      const provider = this.rpcProvider as NearRpcProvider & {
        viewAccessKeys?: (id: string) => Promise<unknown[]>;
      };
      if (typeof provider.viewAccessKeys !== 'function') return null;
      const keys = await provider.viewAccessKeys(accountId);
      return Array.isArray(keys) ? keys.length : null;
    } catch {
      return null;
    }
  }

  async getAllEndpoints(): Promise<Array<{ summary: VaultSummary; listing: MarketListing | null }>> {
    if (this.mode === 'demo') {
      return this.sandboxMirror.listAllSummaries();
    }
    const block = await this.rpcProvider.getFinalBlock();
    const [tokens, listings] = await Promise.all([
      this.rpcProvider.viewAtBlock<Nep171Token[]>(
        this.registryId,
        'nft_tokens',
        { from_index: '0', limit: 50 },
        block.height,
      ),
      this.rpcProvider.viewAtBlock<MarketListing[]>(
        this.registryId,
        'get_listings',
        {},
        block.height,
      ),
    ]);

    if (!tokens || tokens.length === 0) {
      return [];
    }

    const listingMap = new Map((listings ?? []).map((l) => [l.token_id, l]));
    const summaries = await Promise.all(
      tokens.map((t) =>
        this.rpcProvider.viewAtBlock<VaultSummary>(
          t.token_id,
          'get_vault_summary',
          {},
          block.height,
        ),
      ),
    );

    return summaries
      .filter((s): s is VaultSummary => s !== null)
      .map((summary) => ({
        summary,
        listing: listingMap.get(summary.token_id) ?? null,
      }));
  }

  async getEndpointSummary(accountId: string): Promise<VaultSummary | null> {
    if (this.mode === 'demo') {
      const hit = this.sandboxMirror
        .listAllSummaries()
        .find((x) => x.summary.token_id === accountId);
      return hit?.summary ?? null;
    }
    const block = await this.rpcProvider.getFinalBlock();
    return this.rpcProvider.viewAtBlock<VaultSummary>(
      accountId,
      'get_vault_summary',
      {},
      block.height,
    );
  }
}
