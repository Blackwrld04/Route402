import type {
  MarketListing,
  T2VerificationResult,
  VaultSummary,
  X402ChallengeBody,
} from '@route402/core';

export type DataSourceMode = 'sandbox' | 'testnet';

export interface EndpointEntry {
  summary: VaultSummary;
  listing: MarketListing | null;
  t2: T2VerificationResult;
  accessKeyCount: number | null;
}

export interface WireExchangeLog {
  timestamp: string;
  resource: string;
  challengeStatus: number;
  challenge: X402ChallengeBody;
  paidStatus: number;
  readOnly: boolean;
  paymentHeaderPreview: string;
  responseBody: unknown;
  receiptHeader: Record<string, unknown> | null;
}

export interface Notice {
  kind: 'ok' | 'blocked' | 'info';
  message: string;
}

export interface OriginChainOption {
  id: string;
  label: string;
}

