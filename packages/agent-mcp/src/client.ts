import crypto from 'node:crypto';
import {
  HttpNearRpcProvider,
  X402_HEADER_PAYMENT,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_RESPONSE,
  decodeX402ChallengeHeader,
  encodeX402Header,
  verifyT2ShardedItem,
  type NearRpcProvider,
  type X402ChallengeBody,
  type X402PaymentPayload,
  type X402PaymentRequirement,
} from '@route402/core';

export interface Route402SettlementContext {
  requirement: X402PaymentRequirement;
  challenge: X402ChallengeBody;
  requestId: string;
  payerId: string;
}

export interface Route402SettlementProof {
  txHash?: string;
  scheme?: 'exact' | 'near-intents-1click';
  network?: string;
  simulated?: boolean;
}

export interface Route402AgentClientOptions {
  gatewayBaseUrl: string;
  payerId: string;
  pinnedCollectionId?: string;
  maxBudgetPerCallUsdc?: bigint;
  maxSessionSpendUsdc?: bigint;
  /**
   * Custom onchain settlement callback (e.g. `near-cli-rs` / `near-api` `ft_transfer_call`
   * on NEAR Testnet). If omitted, produces a zero-key sandbox settlement proof for `demo` mode.
   */
  settleOnChain?: (ctx: Route402SettlementContext) => Promise<Route402SettlementProof>;
  /** NEAR RPC used to independently verify the gateway's T2 proof. */
  rpcUrl?: string;
  /** Custom provider for independent T2 verification (takes precedence over `rpcUrl`). */
  rpcProvider?: NearRpcProvider;
  /**
   * Sandbox/demo only: accept the gateway's `t2Proof` without re-querying NEAR
   * RPC. The proof must still be `ok` and match `payTo`/the pinned collection.
   * Never enable this for real Testnet payments.
   */
  allowUnverifiedT2?: boolean;
}

function extractEndpointAccount(resource: string): string | null {
  let pathname = resource;
  try {
    pathname = new URL(resource, 'http://route402.local').pathname;
  } catch {
    // Keep the raw value and try the regex below.
  }
  const match = pathname.match(/^\/x402\/([^/]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export interface Route402CallResult<T = unknown> {
  status: number;
  challenge: X402ChallengeBody;
  paymentHeader: string;
  paymentReceipt: Record<string, unknown> | null;
  data: T;
  spentMicroUsdc: string;
  cumulativeSessionSpendMicroUsdc: string;
}

/**
 * Route402AgentClient — Autonomous HTTP 402 buyer client with built-in
 * House of Stake `sharded-item-1.0.0` T2 verification & session spend limits.
 */
export class Route402AgentClient {
  private sessionSpent = 0n;
  private readonly maxPerCall: bigint;
  private readonly maxSession: bigint;

  constructor(private readonly opts: Route402AgentClientOptions) {
    this.maxPerCall = opts.maxBudgetPerCallUsdc ?? 500_000n; // default $0.50/call cap
    this.maxSession = opts.maxSessionSpendUsdc ?? 5_000_000n; // default $5.00 session cap
  }

  get cumulativeSpentMicroUsdc(): bigint {
    return this.sessionSpent;
  }

  async discoverEndpoints(): Promise<unknown> {
    const res = await fetch(`${this.opts.gatewayBaseUrl.replace(/\/$/, '')}/discover`);
    if (!res.ok) {
      throw new Error(`Discovery failed with HTTP ${res.status}`);
    }
    return res.json();
  }

  async callEndpoint<T = unknown>(
    resourcePath: string,
    init: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
  ): Promise<Route402CallResult<T>> {
    const base = this.opts.gatewayBaseUrl.replace(/\/$/, '');
    const targetUrl = resourcePath.startsWith('http')
      ? resourcePath
      : `${base}${resourcePath.startsWith('/') ? '' : '/'}${resourcePath}`;

    const method = init.method ?? 'GET';
    const baseHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    const serializedBody =
      method === 'POST' && init.body ? JSON.stringify(init.body) : undefined;
    if (serializedBody) {
      baseHeaders['Content-Type'] = 'application/json';
    }

    // Step 1: Initial unauthenticated call -> Expect HTTP 402 Payment Required
    const firstRes = await fetch(targetUrl, {
      method,
      headers: baseHeaders,
      body: serializedBody,
    });

    if (firstRes.status !== 402) {
      const text = await firstRes.text();
      throw new Error(
        `Expected HTTP 402 challenge from ${targetUrl}, got HTTP ${firstRes.status}: ${text}`,
      );
    }

    const rawChallengeHeader = firstRes.headers.get(X402_HEADER_PAYMENT_REQUIRED);
    const challenge: X402ChallengeBody = rawChallengeHeader
      ? decodeX402ChallengeHeader(rawChallengeHeader)
      : ((await firstRes.json()) as X402ChallengeBody);

    const exactReq = challenge.accepts.find((a) => a.scheme === 'exact') ?? challenge.accepts[0];
    if (!exactReq) {
      throw new Error('HTTP 402 challenge did not advertise any accepted payment scheme');
    }

    // Step 2a: Bind `payTo` to the resource token so a malicious gateway cannot
    // redirect payment to a different (attacker-owned) vault.
    const targetPathname = new URL(targetUrl).pathname;
    const expectedEndpoint =
      extractEndpointAccount(exactReq.resource) ?? extractEndpointAccount(targetPathname);
    if (!expectedEndpoint) {
      throw new Error(
        `Refusing to pay: cannot derive an endpoint account from resource "${exactReq.resource}"`,
      );
    }
    if (exactReq.payTo !== expectedEndpoint) {
      throw new Error(
        `Refusing to pay: challenge payTo "${exactReq.payTo}" does not match resource endpoint "${expectedEndpoint}"`,
      );
    }
    const resourcePathname = new URL(exactReq.resource, targetUrl).pathname;
    if (resourcePathname !== targetPathname) {
      throw new Error(
        `Refusing to pay: challenge resource "${exactReq.resource}" does not match requested path "${targetPathname}"`,
      );
    }

    // Step 2b: Enforce T2 authenticity before spending 1 micro-USDC. In demo /
    // sandbox mode the caller may opt out of the independent RPC re-check, but
    // the gateway's proof must still be well-formed and bound to `payTo`.
    if (!challenge.t2Proof) {
      throw new Error(
        'Refusing to pay: gateway did not provide a sharded-item T2 proof in the 402 challenge',
      );
    }
    const t2Proof = challenge.t2Proof;
    if (!t2Proof.ok) {
      throw new Error(
        `Refusing to pay unverified Account-NFT: verdict "${t2Proof.verdict}" (${t2Proof.reason})`,
      );
    }
    if (t2Proof.accountId !== exactReq.payTo) {
      throw new Error(
        `Refusing to pay: T2 proof account "${t2Proof.accountId}" does not match payTo "${exactReq.payTo}"`,
      );
    }
    if (
      this.opts.pinnedCollectionId &&
      t2Proof.pinnedCollectionId !== this.opts.pinnedCollectionId
    ) {
      throw new Error(
        `Refusing to pay unverified Account-NFT: expected collection "${this.opts.pinnedCollectionId}", got "${t2Proof.pinnedCollectionId}"`,
      );
    }

    if (!this.opts.allowUnverifiedT2) {
      const pinnedCollectionId = this.opts.pinnedCollectionId ?? t2Proof.pinnedCollectionId;
      const provider =
        this.opts.rpcProvider ?? new HttpNearRpcProvider(this.opts.rpcUrl);
      const independent = await verifyT2ShardedItem({
        provider,
        accountId: exactReq.payTo,
        pinnedCollectionId,
        maxRetries: 2,
      });
      if (!independent.ok) {
        throw new Error(
          `Refusing to pay: independent T2 verification failed with "${independent.verdict}" (${independent.reason})`,
        );
      }
      if (independent.accountId !== exactReq.payTo) {
        throw new Error(
          `Refusing to pay: independent T2 account "${independent.accountId}" does not match payTo "${exactReq.payTo}"`,
        );
      }
      if (independent.pinnedCollectionId !== pinnedCollectionId) {
        throw new Error(
          `Refusing to pay: independent T2 collection "${independent.pinnedCollectionId}" does not match pinned "${pinnedCollectionId}"`,
        );
      }
      if (
        independent.ownerId &&
        t2Proof.ownerId &&
        independent.ownerId !== t2Proof.ownerId
      ) {
        throw new Error(
          `Refusing to pay: T2 owner mismatch (gateway "${t2Proof.ownerId}", RPC "${independent.ownerId}")`,
        );
      }
    }

    const requiredAmt = BigInt(exactReq.maxAmountRequired);
    if (requiredAmt > this.maxPerCall) {
      throw new Error(
        `Endpoint price (${requiredAmt} micro-USDC) exceeds agent per-call budget (${this.maxPerCall})`,
      );
    }
    if (this.sessionSpent + requiredAmt > this.maxSession) {
      throw new Error(
        `Payment (${requiredAmt}) would exceed agent session budget (${this.maxSession})`,
      );
    }

    // Step 3: Settle into the NFT's keyless sub-account (`exactReq.payTo`)
    const requestId = `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const proof: Route402SettlementProof = this.opts.settleOnChain
      ? await this.opts.settleOnChain({
          requirement: exactReq,
          challenge,
          requestId,
          payerId: this.opts.payerId,
        })
      : {
          txHash: `sim_agent_${requestId}`,
          scheme: 'exact',
          network: exactReq.network,
          simulated: true,
        };

    const paymentPayload: X402PaymentPayload = {
      x402Version: 1,
      scheme: proof.scheme ?? 'exact',
      network: proof.network ?? exactReq.network,
      payload: {
        txHash: proof.txHash,
        payerId: this.opts.payerId,
        requestId,
        amount: exactReq.maxAmountRequired,
        asset: exactReq.asset,
        simulated: proof.simulated ?? false,
      },
    };
    const encodedPayment = encodeX402Header(paymentPayload);

    // Step 4: Retry request with `X-PAYMENT` header -> Receive `200 OK` + `X-PAYMENT-RESPONSE`
    const paidRes = await fetch(targetUrl, {
      method,
      headers: {
        ...baseHeaders,
        [X402_HEADER_PAYMENT]: encodedPayment,
      },
      body: serializedBody,
    });

    const data = (await paidRes.json()) as T;
    if (!paidRes.ok) {
      throw new Error(
        `Paid retry failed with HTTP ${paidRes.status}: ${JSON.stringify(data)}`,
      );
    }

    this.sessionSpent += requiredAmt;

    const rawReceipt = paidRes.headers.get(X402_HEADER_PAYMENT_RESPONSE);
    const paymentReceipt = rawReceipt
      ? (JSON.parse(Buffer.from(rawReceipt, 'base64').toString('utf8')) as Record<string, unknown>)
      : null;

    return {
      status: paidRes.status,
      challenge,
      paymentHeader: encodedPayment,
      paymentReceipt,
      data,
      spentMicroUsdc: requiredAmt.toString(),
      cumulativeSessionSpendMicroUsdc: this.sessionSpent.toString(),
    };
  }
}
