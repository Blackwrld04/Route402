import http from 'node:http';
import {
  FALLBACK_ONE_CLICK_TOKENS,
  OneClickClient,
  X402_HEADER_PAYMENT,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_RESPONSE,
  decodeX402PaymentHeader,
  encodeX402Header,
  type X402ChallengeBody,
  type X402PaymentPayload,
} from '@route402/core';
import { Route402StateEngine, type Route402Mode } from './state.js';
import { executeUpstreamService } from './upstreams.js';

export interface GatewayConfig {
  port: number;
  mode: Route402Mode;
  registryId: string;
  usdcContractId: string;
  rpcUrl?: string;
  oneClickUrl?: string;
  oneClickJwt?: string;
}

const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REPLAY_ENTRIES = 10_000;

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT, Authorization',
    'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE',
    ...extraHeaders,
  });
  res.end(payload);
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function createRoute402Gateway(cfg: GatewayConfig) {
  const engine = new Route402StateEngine(
    cfg.mode,
    cfg.registryId,
    cfg.usdcContractId,
    cfg.rpcUrl ?? 'https://test.rpc.fastnear.com',
  );
  const oneClick = new OneClickClient(
    cfg.oneClickUrl ?? 'https://1click.chaindefuser.com',
    cfg.oneClickJwt,
  );

  /**
   * In-memory replay guard for x402 request_ids. Onchain `is_request_paid`
   * stays true forever, so without this a captured X-PAYMENT header could be
   * replayed indefinitely against the same vault. Entries are scoped per
   * endpoint account and expire after REPLAY_WINDOW_MS.
   */
  const consumedPayments = new Map<
    string,
    { consumedAt: number; fingerprint: string }
  >();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${cfg.port}`}`);
      const pathname = url.pathname;

      // 1. Health & Mode Truth Banner
      if (pathname === '/health' && req.method === 'GET') {
        sendJson(res, 200, {
          service: 'route402-x402-gateway',
          status: 'ok',
          mode: cfg.mode,
          simulated: cfg.mode === 'demo',
          registryId: cfg.registryId,
          usdcContractId: cfg.usdcContractId,
          rpcUrl: cfg.rpcUrl ?? 'https://test.rpc.fastnear.com',
        });
        return;
      }

      // 2. Standard x402 Discovery Catalog (`GET /discover` & `/.well-known/x402`)
      if ((pathname === '/discover' || pathname === '/.well-known/x402') && req.method === 'GET') {
        const endpoints = await engine.getAllEndpoints();
        const items = await Promise.all(
          endpoints.map(async ({ summary, listing }) => {
            const t2 = await engine.verifyEndpointT2(summary.token_id);
            return {
              endpointAccount: summary.token_id,
              title: summary.title,
              description: summary.description,
              category: summary.category,
              mcpToolName: summary.mcp_tool_name,
              resource: `/x402/${summary.token_id}/${summary.upstream_slug}`,
              ownerId: summary.owner_id,
              status: summary.status,
              t2Verified: t2.ok,
              t2BlockHeight: t2.blockHeight,
              rotationSeq: summary.rotation_seq,
              stateNonce: summary.state_nonce,
              vaultUsdcBalance: summary.vault_usdc_balance,
              totalCalls: summary.total_calls,
              totalEarnedUsdc: summary.total_earned_usdc,
              listing,
              accepts: [
                {
                  scheme: 'exact',
                  network: cfg.mode === 'demo' ? 'near-sandbox-demo' : 'near-testnet',
                  payTo: summary.token_id,
                  maxAmountRequired: summary.price_per_call_usdc,
                  asset: summary.usdc_contract_id,
                  description: `${summary.title} (NEP-141 USDC into keyless Account-NFT)`,
                },
                {
                  scheme: 'near-intents-1click',
                  network: 'multichain-intents',
                  payTo: summary.token_id,
                  maxAmountRequired: summary.price_per_call_usdc,
                  asset: 'USDC (Base / Solana / Arbitrum / Ethereum -> NEAR Intents)',
                  description: `Cross-chain 1Click settlement into ${summary.token_id}`,
                },
              ],
            };
          }),
        );

        sendJson(res, 200, {
          x402Version: 1,
          mode: cfg.mode,
          simulated: cfg.mode === 'demo',
          registryId: cfg.registryId,
          items,
        });
        return;
      }

      // 3. Full Data Room API (`/api/endpoints` & `/api/endpoints/:id`)
      if (pathname === '/api/endpoints' && req.method === 'GET') {
        const items = await engine.getAllEndpoints();
        const enriched = await Promise.all(
          items.map(async (entry) => ({
            ...entry,
            t2: await engine.verifyEndpointT2(entry.summary.token_id),
            accessKeyCount: await engine.getAccessKeyCount(entry.summary.token_id),
          })),
        );
        sendJson(res, 200, {
          mode: cfg.mode,
          simulated: cfg.mode === 'demo',
          registryId: cfg.registryId,
          usdcContractId: cfg.usdcContractId,
          endpoints: enriched,
        });
        return;
      }

      if (pathname.startsWith('/api/t2/') && req.method === 'GET') {
        const accountId = decodeURIComponent(pathname.slice('/api/t2/'.length));
        const t2 = await engine.verifyEndpointT2(accountId);
        sendJson(res, t2.ok ? 200 : 422, {
          mode: cfg.mode,
          simulated: cfg.mode === 'demo',
          t2,
        });
        return;
      }

      // 4. NEAR Intents 1Click Cross-Chain Quote Endpoint (`/api/quote-1click`)
      if (pathname === '/api/quote-1click' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const endpointId = String(body.endpointId ?? '');
        const originChain = String(body.originChain ?? 'base');
        const dry = body.dry !== false;
        const summary = await engine.getEndpointSummary(endpointId);
        if (!summary) {
          sendJson(res, 404, { error: `Unknown endpoint ${endpointId}` });
          return;
        }

        const tokenCatalog = await oneClick.getTokens(true);
        const originToken =
          tokenCatalog.tokens.find(
            (t) => t.blockchain.toLowerCase() === originChain.toLowerCase() && t.symbol === 'USDC',
          ) ?? FALLBACK_ONE_CLICK_TOKENS[2];
        const nearUsdc =
          tokenCatalog.tokens.find(
            (t) => t.blockchain.toLowerCase() === 'near' && t.symbol === 'USDC',
          ) ?? FALLBACK_ONE_CLICK_TOKENS[0];

        const refundDefaults: Record<string, string> = {
          base: '0x1111111111111111111111111111111111111111',
          eth: '0x1111111111111111111111111111111111111111',
          arb: '0x1111111111111111111111111111111111111111',
          sol: '11111111111111111111111111111111',
          near: 'alice.near',
        };

        const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        // 1Click cross-chain bridge enforces a ~0.15 USDC minimum floor; automatically batch
        // micro-priced calls to >= 0.25 USDC when originating cross-chain.
        const minBridgeFloorUsdc = originChain.toLowerCase() === 'near' ? 0 : 250_000;
        const quoteAmountUsdc = String(
          Math.max(Number(summary.price_per_call_usdc), minBridgeFloorUsdc),
        );
        const callsCovered = Math.max(
          1,
          Math.floor(Number(quoteAmountUsdc) / Number(summary.price_per_call_usdc)),
        );

        // In `dry` and `live` modes we hit real 1Click API (`https://1click.chaindefuser.com/v0/quote`)
        // using a valid mainnet recipient format when previewing dry quotes for `.testnet` vaults.
        const recipientForQuote =
          dry && endpointId.endsWith('.testnet') ? 'intents.near' : endpointId;

        const quote = await oneClick.requestQuote(
          {
            dry,
            swapType: 'EXACT_OUTPUT',
            slippageTolerance: 100,
            originAsset: originToken.assetId,
            depositType: 'ORIGIN_CHAIN',
            destinationAsset: nearUsdc.assetId,
            amount: quoteAmountUsdc,
            refundTo: String(body.refundTo ?? refundDefaults[originChain] ?? refundDefaults.base),
            refundType: 'ORIGIN_CHAIN',
            recipient: recipientForQuote,
            recipientType: 'DESTINATION_CHAIN',
            deadline,
          },
          cfg.mode === 'demo',
        );

        sendJson(res, 200, {
          endpointAccount: endpointId,
          originChain,
          originAsset: originToken.assetId,
          destinationAsset: nearUsdc.assetId,
          targetVaultRecipient: endpointId,
          callsCovered,
          quote,
        });
        return;
      }

      // 5. Interactive Sandbox Actions (Available in `demo` mode for 1-click Judge & UI exploration)
      if (pathname.startsWith('/api/demo/')) {
        if (cfg.mode !== 'demo') {
          sendJson(res, 403, {
            error: 'Sandbox mutation routes are only enabled in `demo` mode. Use wallet / testnet CLI in `dry`/`live` mode.',
          });
          return;
        }
        const action = pathname.slice('/api/demo/'.length);
        const body = await readJsonBody(req);

        if (action === 'mint' && req.method === 'POST') {
          const created = engine.sandboxMirror.mintEndpoint({
            slug: String(body.slug ?? ''),
            ownerId: String(body.ownerId ?? 'alice.route402.testnet'),
            title: String(body.title ?? 'Custom x402 Endpoint'),
            description: String(body.description ?? 'Cash-flowing API inside a keyless NEAR sub-account'),
            category: String(body.category ?? 'ai-service'),
            upstreamSlug: String(body.upstreamSlug ?? 'alpha-signal'),
            pricePerCallUsdc: String(body.pricePerCallUsdc ?? '50000'),
          });
          sendJson(res, 201, { simulated: true, summary: created });
          return;
        }

        if (action === 'list' && req.method === 'POST') {
          const listing = engine.sandboxMirror.listEndpoint(
            String(body.tokenId ?? ''),
            String(body.callerId ?? ''),
            String(body.salePriceYocto ?? '1500000000000000000000000'),
          );
          sendJson(res, 200, { simulated: true, listing });
          return;
        }

        if (action === 'withdraw' && req.method === 'POST') {
          try {
            const updated = engine.sandboxMirror.withdrawUsdc(
              String(body.tokenId ?? ''),
              String(body.callerId ?? ''),
              String(body.amountUsdc ?? '0'),
            );
            sendJson(res, 200, { simulated: true, summary: updated });
          } catch (err) {
            sendJson(res, 409, {
              simulated: true,
              blocked: true,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }

        if (action === 'buy' && req.method === 'POST') {
          try {
            const rotated = engine.sandboxMirror.buyEndpoint({
              tokenId: String(body.tokenId ?? ''),
              buyerId: String(body.buyerId ?? 'bob.route402.testnet'),
              expectedStateNonce: String(body.expectedStateNonce ?? '0'),
              expectedRotationSeq: String(body.expectedRotationSeq ?? '0'),
            });
            sendJson(res, 200, { simulated: true, summary: rotated });
          } catch (err) {
            sendJson(res, 409, {
              simulated: true,
              blocked: true,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }
      }

      // 6. Core Monetized Reverse Proxy: `GET|POST /x402/:endpointAccount/*`
      if (pathname.startsWith('/x402/')) {
        const rest = pathname.slice('/x402/'.length);
        const slashIdx = rest.indexOf('/');
        const endpointAccount = decodeURIComponent(slashIdx === -1 ? rest : rest.slice(0, slashIdx));
        const subPath = slashIdx === -1 ? '/' : rest.slice(slashIdx);

        // Step A: Normative House of Stake T2 Pinned-Block Pair Check BEFORE moving value
        const t2 = await engine.verifyEndpointT2(endpointAccount);
        if (!t2.ok) {
          sendJson(res, 422, {
            error: 'Sharded Account-NFT failed T2 pinned-block authenticity verification',
            t2,
          });
          return;
        }

        const summary = await engine.getEndpointSummary(endpointAccount);
        if (!summary) {
          sendJson(res, 404, { error: `Endpoint summary unavailable for ${endpointAccount}` });
          return;
        }

        if (summary.status === 'Suspended' || summary.status === 'Parked') {
          sendJson(res, 423, {
            error: `Endpoint ${endpointAccount} is currently ${summary.status}`,
            t2,
          });
          return;
        }

        // Step B: Check for `X-PAYMENT` header; if absent, issue standard `HTTP 402 Payment Required`
        const rawPayment = req.headers[X402_HEADER_PAYMENT];
        if (!rawPayment || typeof rawPayment !== 'string') {
          const challenge: X402ChallengeBody = {
            x402Version: 1,
            error: 'HTTP 402 Payment Required — settle into sharded Account-NFT vault to unlock resource',
            accepts: [
              {
                scheme: 'exact',
                network: cfg.mode === 'demo' ? 'near-sandbox-demo' : 'near-testnet',
                maxAmountRequired: summary.price_per_call_usdc,
                resource: pathname,
                description: `${summary.title} — owned by ${summary.owner_id} (vault=${summary.token_id})`,
                mimeType: 'application/json',
                payTo: summary.token_id,
                maxTimeoutSeconds: 120,
                asset: summary.usdc_contract_id,
                extra: {
                  pricePerCallYoctoNear: summary.price_per_call_yocto,
                  vaultStatus: summary.status,
                  currentOwner: summary.owner_id,
                  rotationSeq: summary.rotation_seq,
                },
              },
              {
                scheme: 'near-intents-1click',
                network: 'multichain-intents',
                maxAmountRequired: summary.price_per_call_usdc,
                resource: pathname,
                description: `Pay from Base, Solana, Arbitrum, or Ethereum via NEAR Intents 1Click -> ${summary.token_id}`,
                mimeType: 'application/json',
                payTo: summary.token_id,
                maxTimeoutSeconds: 600,
                asset: 'USDC',
                extra: {
                  quoteEndpoint: '/api/quote-1click',
                },
              },
            ],
            t2Proof: t2,
          };

          sendJson(res, 402, challenge, {
            [X402_HEADER_PAYMENT_REQUIRED]: encodeX402Header(challenge),
          });
          return;
        }

        // Step C: Validate `X-PAYMENT` envelope before any state changes.
        let parsedPayment: X402PaymentPayload;
        try {
          parsedPayment = decodeX402PaymentHeader(rawPayment);
        } catch (err) {
          sendJson(res, 400, {
            error: `Malformed X-PAYMENT header: ${err instanceof Error ? err.message : String(err)}`,
          });
          return;
        }

        const payment = parsedPayment.payload;
        if (parsedPayment.scheme !== 'exact' && parsedPayment.scheme !== 'near-intents-1click') {
          sendJson(res, 400, { error: `Unsupported x402 scheme "${parsedPayment.scheme}"` });
          return;
        }
        if (!payment.requestId || payment.requestId.length > 256) {
          sendJson(res, 400, {
            error: 'x402 payload must include a requestId of at most 256 characters',
          });
          return;
        }

        let paidAmount: bigint;
        try {
          paidAmount = BigInt(payment.amount);
        } catch {
          sendJson(res, 400, { error: `Invalid x402 amount "${payment.amount}"` });
          return;
        }
        if (paidAmount < BigInt(summary.price_per_call_usdc)) {
          sendJson(res, 402, {
            error: `Payment amount ${paidAmount} is below required ${summary.price_per_call_usdc} micro-USDC`,
          });
          return;
        }

        const expectedAsset =
          parsedPayment.scheme === 'exact' ? summary.usdc_contract_id : 'USDC';
        if (payment.asset !== expectedAsset) {
          sendJson(res, 400, {
            error: `Payment asset "${payment.asset}" does not match required "${expectedAsset}"`,
          });
          return;
        }

        const expectedNetwork =
          parsedPayment.scheme === 'exact'
            ? cfg.mode === 'demo'
              ? 'near-sandbox-demo'
              : 'near-testnet'
            : 'multichain-intents';
        if (parsedPayment.network !== expectedNetwork) {
          sendJson(res, 400, {
            error: `Payment network "${parsedPayment.network}" does not match required "${expectedNetwork}"`,
          });
          return;
        }

        // Replay guard: a request_id may be consumed exactly once per vault.
        // Mark it consumed before settlement/upstream work so concurrent
        // duplicates cannot both pass the check.
        const replayKey = `${endpointAccount}:${payment.requestId}`;
        const nowMs = Date.now();
        const fingerprint = [
          parsedPayment.scheme,
          payment.payerId,
          payment.amount,
          payment.asset,
          payment.txHash ?? '',
        ].join('|');
        const prior = consumedPayments.get(replayKey);
        if (prior && nowMs - prior.consumedAt < REPLAY_WINDOW_MS) {
          sendJson(res, 409, {
            error: `x402 replay rejected: request_id "${payment.requestId}" was already consumed for ${endpointAccount}`,
            requestId: payment.requestId,
            consumedAt: new Date(prior.consumedAt).toISOString(),
            conflictingPayload: prior.fingerprint !== fingerprint,
          });
          return;
        }
        if (prior) consumedPayments.delete(replayKey);

        if (consumedPayments.size >= MAX_REPLAY_ENTRIES) {
          for (const [key, entry] of consumedPayments) {
            if (nowMs - entry.consumedAt >= REPLAY_WINDOW_MS) {
              consumedPayments.delete(key);
            }
          }
          while (consumedPayments.size >= MAX_REPLAY_ENTRIES) {
            const oldest = consumedPayments.keys().next().value;
            if (oldest === undefined) break;
            consumedPayments.delete(oldest);
          }
        }
        consumedPayments.set(replayKey, { consumedAt: nowMs, fingerprint });

        let settledTxHash = payment.txHash ?? '';
        let updatedSummary = summary;

        try {
          if (cfg.mode === 'demo') {
            const settled = engine.sandboxMirror.recordX402Payment({
              tokenId: endpointAccount,
              payerId: payment.payerId,
              requestId: payment.requestId,
              amountUsdc: payment.amount,
              resourcePath: subPath,
              rail:
                parsedPayment.scheme === 'near-intents-1click'
                  ? 'near-intents-1click'
                  : 'nep141-usdc',
            });
            settledTxHash = settled.txHash;
            updatedSummary = settled.summary;
          } else {
            // Live/Dry Testnet Verification: confirm `is_request_paid(request_id)` directly on the vault contract!
            const blk = await engine.rpcProvider.getFinalBlock();
            const paidOnChain = await engine.rpcProvider.viewAtBlock<boolean>(
              endpointAccount,
              'is_request_paid',
              { request_id: payment.requestId },
              blk.height,
            );
            if (!paidOnChain) {
              consumedPayments.delete(replayKey);
              sendJson(res, 402, {
                error: `Onchain receipt not yet finalized on ${endpointAccount} for request_id="${payment.requestId}"`,
                expectedVault: endpointAccount,
              });
              return;
            }
            updatedSummary = (await engine.getEndpointSummary(endpointAccount)) ?? summary;
          }
        } catch (err) {
          consumedPayments.delete(replayKey);
          if (cfg.mode === 'demo') {
            engine.sandboxMirror.releaseX402Payment(endpointAccount, payment.requestId);
          }
          throw err;
        }

        // Step D: Execute upstream API & return `200 OK` + `X-PAYMENT-RESPONSE` receipt header
        const reqBody = req.method === 'POST' ? await readJsonBody(req) : undefined;
        let upstreamOut: Awaited<ReturnType<typeof executeUpstreamService>>;
        try {
          upstreamOut = await executeUpstreamService(
            summary.upstream_slug,
            url.searchParams,
            reqBody,
          );
        } catch (err) {
          // Release the consumed request_id so the payer can retry after a
          // transient upstream failure instead of losing the payment.
          consumedPayments.delete(replayKey);
          if (cfg.mode === 'demo') {
            engine.sandboxMirror.releaseX402Payment(endpointAccount, payment.requestId);
          }
          throw err;
        }

        const receiptHeader = {
          settled: true,
          simulated: cfg.mode === 'demo',
          endpointAccount,
          creditedVault: endpointAccount,
          beneficiaryOwner: updatedSummary.owner_id,
          vaultStatus: updatedSummary.status,
          vaultUsdcBalance: updatedSummary.vault_usdc_balance,
          requestId: parsedPayment.payload.requestId,
          txHash: settledTxHash,
          t2BlockHeight: t2.blockHeight,
        };

        sendJson(
          res,
          200,
          {
            ok: true,
            simulated: cfg.mode === 'demo',
            paymentReceipt: receiptHeader,
            upstream: upstreamOut,
          },
          {
            [X402_HEADER_PAYMENT_RESPONSE]: encodeX402Header(receiptHeader),
          },
        );
        return;
      }

      sendJson(res, 404, { error: `Route ${pathname} not found on Route402 Gateway` });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { server, engine, oneClick };
}
