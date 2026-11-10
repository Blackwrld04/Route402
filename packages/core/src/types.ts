export type ItemStatus = 'Parked' | 'Suspended' | 'Expired' | 'Frozen' | 'Active';

export interface NftItemInfo {
  spec: 'sharded-item-1.0.0' | string;
  init: boolean;
  status: ItemStatus;
  collection_id: string;
  token_id: string;
  owner_id: string;
  rotation_seq: string;
  rotation_epoch: number;
}

export interface Nep171Token {
  token_id: string;
  owner_id: string;
  metadata?: {
    title?: string | null;
    description?: string | null;
    media?: string | null;
    extra?: string | null;
  } | null;
}

export interface EndpointReceipt {
  receipt_id: string;
  request_id: string;
  payer_id: string;
  asset: string;
  amount: string;
  resource_path: string;
  rail: 'near-native' | 'nep141-usdc' | 'near-intents-1click';
  timestamp_ms: number;
}

export interface OwnershipRecord {
  from_owner: string;
  to_owner: string;
  rotation_seq: string;
  sale_price_yocto?: string | null;
  timestamp_ms: number;
}

export interface VaultSummary {
  spec: string;
  token_id: string;
  collection_id: string;
  owner_id: string;
  status: ItemStatus;
  title: string;
  description: string;
  category: string;
  upstream_slug: string;
  mcp_tool_name: string;
  price_per_call_usdc: string;
  price_per_call_yocto: string;
  usdc_contract_id: string;
  total_calls: number;
  total_earned_usdc: string;
  total_earned_yocto: string;
  total_withdrawn_usdc: string;
  total_withdrawn_yocto: string;
  vault_usdc_balance: string;
  state_nonce: string;
  rotation_seq: string;
  rotation_epoch: number;
  pending_outflows: number;
  operator_id?: string | null;
  operator_bound_seq?: string | null;
  recent_receipts: EndpointReceipt[];
  ownership_history: OwnershipRecord[];
}

export interface MarketListing {
  token_id: string;
  seller_id: string;
  sale_price_yocto: string;
  listed_state_nonce: string;
  listed_rotation_seq: string;
  listed_at_ms: number;
}

export type T2VerdictKind =
  | 'VERIFIED'
  | 'RETRYABLE_INDEX_LAGGING'
  | 'REFUSED_UNPINNED_COLLECTION'
  | 'REFUSED_IDENTITY_MISMATCH'
  | 'REFUSED_UNINITIALIZED'
  | 'REFUSED_NOT_IN_COLLECTION'
  | 'REFUSED_INVENTED_ROTATION'
  | 'REFUSED_OWNER_CORRUPTION'
  | 'REFUSED_UNSUPPORTED_SPEC';

export interface T2VerificationResult {
  ok: boolean;
  verdict: T2VerdictKind;
  blockHeight: number;
  blockHash: string;
  pinnedCollectionId: string;
  accountId: string;
  ownerId?: string;
  status?: ItemStatus;
  suitableToAct: boolean;
  itemInfo?: NftItemInfo;
  collectionToken?: Nep171Token | null;
  reason: string;
}

export interface X402PaymentRequirement {
  scheme: 'exact' | 'near-intents-1click';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

export interface X402ChallengeBody {
  x402Version: 1;
  error: string;
  accepts: X402PaymentRequirement[];
  t2Proof?: T2VerificationResult;
}

export interface X402PaymentPayload {
  x402Version: 1;
  scheme: 'exact' | 'near-intents-1click';
  network: string;
  payload: {
    txHash?: string;
    payerId: string;
    requestId: string;
    amount: string;
    asset: string;
    depositAddress?: string;
    simulated?: boolean;
    signature?: string;
  };
}
