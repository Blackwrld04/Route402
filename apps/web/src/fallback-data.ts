import type { EndpointEntry } from './types';

/**
 * Initial console state.
 *
 * IMPORTANT: this is intentionally EMPTY. It used to contain a fully
 * fabricated dataset (invented T2 proofs marked `VERIFIED`, invented receipts,
 * invented balances and call counts) which was rendered as if it were real
 * onchain state whenever the gateway or RPC was slow or unreachable.
 *
 * The console now starts with no endpoints and fills in only from:
 *   - `GET /api/endpoints` (sandbox mirror), or
 *   - finalized NEAR Testnet RPC reads (testnet mode).
 */
export const INITIAL_ENTRIES: EndpointEntry[] = [];
