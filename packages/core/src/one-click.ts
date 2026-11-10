export interface OneClickToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string;
}

export interface OneClickQuoteRequest {
  dry: boolean;
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT' | 'ANY_INPUT';
  slippageTolerance: number;
  originAsset: string;
  depositType?: 'ORIGIN_CHAIN' | 'INTENTS';
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType?: 'ORIGIN_CHAIN' | 'INTENTS';
  recipient: string;
  recipientType?: 'DESTINATION_CHAIN' | 'INTENTS';
  deadline: string;
}

export interface OneClickQuoteResponse {
  timestamp?: string;
  signature?: string;
  quoteRequest?: OneClickQuoteRequest;
  quote?: {
    depositAddress?: string;
    amountIn: string;
    amountInFormatted: string;
    amountInUsd?: string;
    minAmountIn?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd?: string;
    minAmountOut?: string;
    timeEstimate?: number;
    deadline?: string;
  };
  simulated?: boolean;
}

/**
 * Curated fallback snapshot of canonical 1Click asset IDs so `npm run demo` works
 * deterministically even in air-gapped environments while `dry`/`live` hit
 * `https://1click.chaindefuser.com/v0/...` directly.
 */
export const FALLBACK_ONE_CLICK_TOKENS: OneClickToken[] = [
  {
    assetId: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
    decimals: 6,
    blockchain: 'near',
    symbol: 'USDC',
    price: 1.0,
  },
  {
    assetId: 'nep141:wrap.near',
    decimals: 24,
    blockchain: 'near',
    symbol: 'wNEAR',
    price: 4.2,
  },
  {
    assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    decimals: 6,
    blockchain: 'base',
    symbol: 'USDC',
    price: 1.0,
  },
  {
    assetId: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
    decimals: 6,
    blockchain: 'sol',
    symbol: 'USDC',
    price: 1.0,
  },
  {
    assetId: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
    decimals: 6,
    blockchain: 'arb',
    symbol: 'USDC',
    price: 1.0,
  },
  {
    assetId: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    decimals: 6,
    blockchain: 'eth',
    symbol: 'USDC',
    price: 1.0,
  },
];

export class OneClickClient {
  private tokenCache: OneClickToken[] | null = null;

  constructor(
    public readonly baseUrl: string = 'https://1click.chaindefuser.com',
    private readonly jwt?: string,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.jwt) {
      h['Authorization'] = `Bearer ${this.jwt}`;
    }
    return h;
  }

  async getTokens(allowFallback = true): Promise<{ tokens: OneClickToken[]; simulated: boolean }> {
    if (this.tokenCache) {
      return { tokens: this.tokenCache, simulated: false };
    }
    try {
      const res = await fetch(`${this.baseUrl}/v0/tokens`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`1Click /v0/tokens HTTP ${res.status}`);
      const tokens = (await res.json()) as OneClickToken[];
      this.tokenCache = tokens;
      return { tokens, simulated: false };
    } catch (err) {
      if (!allowFallback) throw err;
      return { tokens: FALLBACK_ONE_CLICK_TOKENS, simulated: true };
    }
  }

  async requestQuote(
    req: OneClickQuoteRequest,
    allowSimulatedFallback = false,
  ): Promise<OneClickQuoteResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v0/quote`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(6500),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`1Click /v0/quote HTTP ${res.status}: ${body}`);
      }
      const data = (await res.json()) as OneClickQuoteResponse;
      return { ...data, simulated: false };
    } catch (err) {
      if (!allowSimulatedFallback) throw err;
      const amtNum = Number(req.amount) || 50000;
      const feeAdjusted = Math.ceil(amtNum * 1.0025);
      return {
        timestamp: new Date().toISOString(),
        quoteRequest: req,
        simulated: true,
        quote: {
          depositAddress: req.dry ? undefined : `sim-1click-deposit-${req.recipient}`,
          amountIn: String(feeAdjusted),
          amountInFormatted: (feeAdjusted / 1_000_000).toFixed(6),
          amountInUsd: (feeAdjusted / 1_000_000).toFixed(4),
          amountOut: String(amtNum),
          amountOutFormatted: (amtNum / 1_000_000).toFixed(6),
          amountOutUsd: (amtNum / 1_000_000).toFixed(4),
          timeEstimate: 4,
          deadline: req.deadline,
        },
      };
    }
  }

  async getStatus(depositAddress: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`1Click /v0/status HTTP ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }
}
