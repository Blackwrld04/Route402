import { bytesToUtf8, utf8ToBase64 } from './base64.js';
import type { Nep171Token, NftItemInfo, T2VerificationResult } from './types.js';

export interface NearRpcProvider {
  getFinalBlock(): Promise<{ height: number; hash: string }>;
  viewAtBlock<T>(accountId: string, methodName: string, args: Record<string, unknown>, blockId: number | string): Promise<T | null>;
}

/**
 * HttpNearRpcProvider — Lightweight zero-dependency NEAR JSON-RPC client
 * supporting strict `final` block pinning required by House of Stake's
 * `sharded-item-1.0.0` Tier-2 (T2) pair verification standard.
 */
export class HttpNearRpcProvider implements NearRpcProvider {
  constructor(public readonly rpcUrl: string = 'https://test.rpc.fastnear.com') {}

  private async rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) {
      throw new Error(`NEAR RPC HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { result?: T; error?: { message?: string; data?: unknown } };
    if (json.error) {
      throw new Error(`NEAR RPC Error: ${json.error.message ?? JSON.stringify(json.error)}`);
    }
    return json.result as T;
  }

  async getFinalBlock(): Promise<{ height: number; hash: string }> {
    const block = await this.rpc<{ header: { height: number; hash: string } }>('block', {
      finality: 'final',
    });
    return { height: block.header.height, hash: block.header.hash };
  }

  async viewAtBlock<T>(
    accountId: string,
    methodName: string,
    args: Record<string, unknown>,
    blockId: number | string,
  ): Promise<T | null> {
    const argsBase64 = utf8ToBase64(JSON.stringify(args));
    try {
      const out = await this.rpc<{ result: number[] }>('query', {
        request_type: 'call_function',
        block_id: blockId,
        account_id: accountId,
        method_name: methodName,
        args_base64: argsBase64,
      });
      const text = bytesToUtf8(out.result);
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async viewAccessKeys(accountId: string): Promise<unknown[]> {
    const out = await this.rpc<{ keys: unknown[] }>('query', {
      request_type: 'view_access_key_list',
      finality: 'final',
      account_id: accountId,
    });
    return out.keys ?? [];
  }
}

/**
 * T0 Namespace Check (offline, zero RPC calls):
 * Verifies `<label>.<pinnedParent>` structure so only `<pinnedParent>` could have created it.
 */
export function verifyT0Namespace(accountId: string, pinnedParentId: string): boolean {
  if (!accountId.endsWith(`.${pinnedParentId}`)) return false;
  const prefix = accountId.slice(0, accountId.length - pinnedParentId.length - 1);
  return prefix.length > 0 && !prefix.includes('.');
}

/**
 * T2 Pinned-Block Pair Check (`sharded-item-1.0.0` Section "Verification > T2, the pair"):
 *
 * Pins BOTH reads (`nft_item_info` on the child account and `nft_token` on the pinned
 * collection) to the EXACT SAME finalized block height so an attacker cannot supply a
 * forged collection or exploit asynchronous cross-receipt updates.
 */
export async function verifyT2ShardedItem(params: {
  provider: NearRpcProvider;
  accountId: string;
  pinnedCollectionId: string;
  maxRetries?: number;
  retryDelayMs?: number;
  /**
   * Optional pre-pinned finalized block. When supplied, the verifier reuses
   * this exact block instead of fetching a fresh one, so every read (and every
   * caller displaying the result) is coherent at a single block height.
   */
  pinnedBlock?: { height: number; hash: string };
}): Promise<T2VerificationResult> {
  const {
    provider,
    accountId,
    pinnedCollectionId,
    maxRetries = 2,
    retryDelayMs = 450,
    pinnedBlock,
  } = params;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // The pinned block is used for the first attempt only. Retries deliberately
    // re-read a fresh finalized block so a transient cross-receipt lag can
    // still be resolved (same behaviour as before pinning was introduced).
    const finalBlock =
      attempt === 0 && pinnedBlock ? pinnedBlock : await provider.getFinalBlock();
    const [item, token, collSeq] = await Promise.all([
      provider.viewAtBlock<NftItemInfo>(accountId, 'nft_item_info', {}, finalBlock.height),
      provider.viewAtBlock<Nep171Token>(
        pinnedCollectionId,
        'nft_token',
        { token_id: accountId },
        finalBlock.height,
      ),
      provider.viewAtBlock<string>(
        pinnedCollectionId,
        'get_token_rotation_seq',
        { token_id: accountId },
        finalBlock.height,
      ),
    ]);

    if (!item) {
      return {
        ok: false,
        verdict: 'REFUSED_UNINITIALIZED',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        suitableToAct: false,
        reason: `Account ${accountId} did not return nft_item_info() at final block #${finalBlock.height}.`,
      };
    }

    if (item.spec !== 'sharded-item-1.0.0') {
      return {
        ok: false,
        verdict: 'REFUSED_UNSUPPORTED_SPEC',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        suitableToAct: false,
        reason: `Unrecognized sharded item spec "${item.spec}" (expected "sharded-item-1.0.0").`,
      };
    }

    // Clause 1: item.collection_id MUST match the collection pinned from consumer config
    if (item.collection_id !== pinnedCollectionId) {
      return {
        ok: false,
        verdict: 'REFUSED_UNPINNED_COLLECTION',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        suitableToAct: false,
        reason: `Item claims collection "${item.collection_id}", expected pinned "${pinnedCollectionId}".`,
      };
    }

    // Clause 2: Identity clause — item.token_id MUST equal the account actually queried
    if (item.token_id !== accountId) {
      return {
        ok: false,
        verdict: 'REFUSED_IDENTITY_MISMATCH',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        suitableToAct: false,
        reason: `Identity mismatch: queried "${accountId}" but item answered for "${item.token_id}".`,
      };
    }

    // Clause 3: item.init MUST be true
    if (!item.init) {
      return {
        ok: false,
        verdict: 'REFUSED_UNINITIALIZED',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        suitableToAct: false,
        reason: `Item ${accountId} is parked / uninitialized (init=false).`,
      };
    }

    // Clause 4 & 5: Collection must confirm membership for the exact token_id
    if (!token || token.token_id !== item.token_id) {
      return {
        ok: false,
        verdict: 'REFUSED_NOT_IN_COLLECTION',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        collectionToken: token,
        suitableToAct: false,
        reason: `Pinned collection ${pinnedCollectionId} rejected membership for ${accountId}.`,
      };
    }

    // Clause 6: Owner comparison & typed rotation_seq divergence handling
    if (token.owner_id !== item.owner_id) {
      const itemSeq = BigInt(item.rotation_seq);
      const indexSeq = collSeq !== null ? BigInt(collSeq) : null;

      if (indexSeq !== null) {
        if (itemSeq < indexSeq) {
          return {
            ok: false,
            verdict: 'REFUSED_INVENTED_ROTATION',
            blockHeight: finalBlock.height,
            blockHash: finalBlock.hash,
            pinnedCollectionId,
            accountId,
            itemInfo: item,
            collectionToken: token,
            suitableToAct: false,
            reason: `Collection asserts rotation_seq=${indexSeq} > item rotation_seq=${itemSeq} (invented rotation).`,
          };
        }
        if (itemSeq === indexSeq) {
          return {
            ok: false,
            verdict: 'REFUSED_OWNER_CORRUPTION',
            blockHeight: finalBlock.height,
            blockHash: finalBlock.hash,
            pinnedCollectionId,
            accountId,
            itemInfo: item,
            collectionToken: token,
            suitableToAct: false,
            reason: `Equal rotation_seq=${itemSeq} with differing owners (${item.owner_id} vs ${token.owner_id}).`,
          };
        }
      }

      // item > index (or unknown index sequence): index is catching up across receipts
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }

      return {
        ok: false,
        verdict: 'RETRYABLE_INDEX_LAGGING',
        blockHeight: finalBlock.height,
        blockHash: finalBlock.hash,
        pinnedCollectionId,
        accountId,
        itemInfo: item,
        collectionToken: token,
        suitableToAct: false,
        reason: `Rotation in progress across receipts (item=${item.owner_id}, index=${token.owner_id}).`,
      };
    }

    return {
      ok: true,
      verdict: 'VERIFIED',
      blockHeight: finalBlock.height,
      blockHash: finalBlock.hash,
      pinnedCollectionId,
      accountId,
      ownerId: item.owner_id,
      status: item.status,
      suitableToAct: item.status === 'Active',
      itemInfo: item,
      collectionToken: token,
      reason: `Verified T2 pair at final block #${finalBlock.height} (owner=${item.owner_id}, status=${item.status}, seq=${item.rotation_seq}).`,
    };
  }

  throw new Error('Unreachable T2 verification state');
}
