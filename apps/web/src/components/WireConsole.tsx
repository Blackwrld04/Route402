import { Activity, Loader2, Zap } from 'lucide-react';
import { formatUsdc, type OneClickQuoteResponse } from '@route402/core';
import { ChainIcon } from './ChainIcons';
import type { DataSourceMode, EndpointEntry, OriginChainOption, WireExchangeLog } from '../types';

interface WireConsoleProps {
  selected: EndpointEntry | null;
  sourceMode: DataSourceMode;
  busyAction: string | null;
  originChain: string;
  chains: OriginChainOption[];
  quoteResult: {
    originChain: string;
    targetVault: string;
    quote: OneClickQuoteResponse;
  } | null;
  wireLog: WireExchangeLog | null;
  onSelectOriginChain: (chain: string) => void;
  onExecuteX402: () => void;
  onQuoteOneClick: () => void;
}

export function WireConsole({
  selected,
  sourceMode,
  busyAction,
  originChain,
  chains,
  quoteResult,
  wireLog,
  onSelectOriginChain,
  onExecuteX402,
  onQuoteOneClick,
}: WireConsoleProps) {
  return (
    <div className="panel hero-console">
      <div className="panel-header">
        <h2 className="panel-title">
          <Activity size={16} />
          <span>HTTP 402 wire &amp; NEAR Intents 1Click console</span>
        </h2>
        {selected && (
          <span className="pill">
            Owner: <code className="num">{selected.summary.owner_id}</code>
          </span>
        )}
      </div>

      <div className="panel-body">
        {selected ? (
          <>
            <div className="console-toolbar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyAction !== null}
                onClick={onExecuteX402}
              >
                {busyAction === 'x402' ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <Zap size={15} />
                )}
                <span>
                  {busyAction === 'x402'
                    ? sourceMode === 'sandbox'
                      ? 'Executing 402 handshake…'
                      : 'Reading live Testnet state…'
                    : sourceMode === 'sandbox'
                      ? `Pay $${formatUsdc(selected.summary.price_per_call_usdc)} USDC & call endpoint`
                      : 'Preview 402 challenge & verify T2 onchain'}
                </span>
              </button>

              <button
                type="button"
                className="btn"
                disabled={busyAction !== null}
                onClick={onQuoteOneClick}
              >
                {busyAction === '1click' ? <Loader2 size={14} className="spin" /> : null}
                <span>
                  {busyAction === '1click'
                    ? 'Requesting 1Click quote…'
                    : 'Preview 1Click cross-chain quote'}
                </span>
              </button>
            </div>

            {/* Origin Chain Selector for 1Click */}
            <div className="chain-selector-block">
              <div className="chain-selector-label">
                Cross-chain payer asset (routed via 1click.chaindefuser.com into{' '}
                <code>{selected.summary.token_id}</code>)
              </div>
              <div className="chain-strip">
                {chains.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chain-chip ${originChain === c.id ? 'selected' : ''}`}
                    aria-pressed={originChain === c.id}
                    onClick={() => onSelectOriginChain(c.id)}
                  >
                    <ChainIcon chain={c.id} size={15} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {quoteResult && (
              <div className="wire-box" style={{ marginBottom: 12 }}>
                <div className="wire-box-head">
                  <span>
                    NEAR Intents 1Click quote ({quoteResult.quote.simulated ? 'Simulated' : 'Live 1Click API'})
                  </span>
                  <span className="num">
                    {quoteResult.quote.quote?.amountInFormatted ?? '0.05'} USDC ({quoteResult.originChain}) -&gt;{' '}
                    {quoteResult.quote.quote?.amountOutFormatted ?? '0.05'} NEAR USDC
                  </span>
                </div>
                <pre className="wire-pre">
                  {JSON.stringify(
                    {
                      recipientAccountNft: quoteResult.targetVault,
                      amountIn: quoteResult.quote.quote?.amountIn,
                      amountOut: quoteResult.quote.quote?.amountOut,
                      estimatedTimeSec: quoteResult.quote.quote?.timeEstimate,
                      depositAddress: quoteResult.quote.quote?.depositAddress ?? '(dry preview)',
                      live1ClickApi: !quoteResult.quote.simulated,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            <div className="wire-steps">
              <div className="wire-box">
                <div className="wire-box-head">
                  <span>
                    {wireLog?.readOnly ? (
                      'Step 1 — Live HTTP 402 challenge preview (not fetched)'
                    ) : (
                      <>
                        Step 1 — <code>GET /x402/{selected.summary.token_id}/{selected.summary.upstream_slug}</code>
                      </>
                    )}
                  </span>
                  <span className="num">
                    {wireLog
                      ? wireLog.readOnly
                        ? 'Preview only'
                        : `HTTP ${wireLog.challengeStatus}`
                      : 'Ready'}
                  </span>
                </div>
                <pre className="wire-pre">
                  {wireLog
                    ? JSON.stringify(wireLog.challenge, null, 2)
                    : sourceMode === 'sandbox'
                      ? `Click "Pay $${formatUsdc(selected.summary.price_per_call_usdc)} USDC & call endpoint" above to execute the 402 handshake and verify T2 pair authenticity.`
                      : 'Click "Preview 402 challenge & verify T2 onchain" above to read the live vault summary and T2 proof from finalized RPC state. No payment is submitted in read-only Testnet mode.'}
                </pre>
              </div>

              {wireLog && (
                <div className="wire-box">
                  <div className="wire-box-head">
                    <span>
                      {wireLog.readOnly
                        ? 'Step 2 — Suggested payment & receipt shape (not executed)'
                        : 'Step 2 — Retry with X-PAYMENT -> Upstream payload & receipt'}
                    </span>
                    <span className="num">
                      {wireLog.readOnly ? 'No transaction sent' : `HTTP ${wireLog.paidStatus}`}
                    </span>
                  </div>
                  <pre className="wire-pre">
                    {JSON.stringify(
                      wireLog.readOnly
                        ? {
                            suggestedXPaymentHeader: wireLog.paymentHeaderPreview,
                            previewedReceiptShape: wireLog.receiptHeader,
                            body: wireLog.responseBody,
                          }
                        : {
                            xPaymentHeader: wireLog.paymentHeaderPreview,
                            xPaymentResponse: wireLog.receiptHeader,
                            body: wireLog.responseBody,
                          },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="wire-pre" style={{ color: 'var(--ink-2)', padding: '24px 0' }}>
            No endpoint account selected. Select an endpoint on the left to inspect its HTTP 402 wire exchange.
          </div>
        )}
      </div>
    </div>
  );
}

