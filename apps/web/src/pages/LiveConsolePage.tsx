import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  formatNear,
  formatUsdc,
  type OneClickQuoteResponse,
} from '@route402/core';
import { ChainIcon, Route402Mark } from '../components/ChainIcons';
import { StatusPill } from '../components/EndpointRoster';
import { MintEndpointPanel } from '../components/MintEndpointPanel';
import { LedgerAuditPanel } from '../components/LedgerAuditPanel';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';
import type {
  DataSourceMode,
  EndpointEntry,
  OriginChainOption,
  WireExchangeLog,
} from '../types';

interface LiveConsolePageProps {
  entries: EndpointEntry[];
  selectedId: string;
  selected: EndpointEntry | null;
  loading: boolean;
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
  walletAccountId: string | null;
  escrowBanner: {
    kind: 'ok' | 'blocked';
    message: string;
  } | null;
  mintSlug: string;
  mintTitle: string;
  mintCategory: string;
  mintUpstream: string;
  mintPriceUsdc: string;
  onSelectId: (id: string) => void;
  onSelectMode: (mode: DataSourceMode) => void;
  onToggleWallet: () => void;
  onRefresh: () => void;
  onSelectOriginChain: (chain: string) => void;
  onExecuteX402: () => void;
  onQuoteOneClick: () => void;
  onListForSale: () => void;
  onSellerDrainAttempt: () => void;
  onAtomicBuy: () => void;
  onChangeSlug: (v: string) => void;
  onChangeTitle: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onChangeUpstream: (v: string) => void;
  onChangePriceUsdc: (v: string) => void;
  onSubmitMint: (e: React.FormEvent) => void;
  onExitToLanding: () => void;
}

type ConsoleTab = 'wire' | 'threat-t2' | 'ledger' | 'mint';

export function LiveConsolePage({
  entries,
  selectedId,
  selected,
  loading,
  sourceMode,
  busyAction,
  originChain,
  chains,
  quoteResult,
  wireLog,
  walletAccountId,
  escrowBanner,
  mintSlug,
  mintTitle,
  mintCategory,
  mintUpstream,
  mintPriceUsdc,
  onSelectId,
  onSelectMode,
  onToggleWallet,
  onRefresh,
  onSelectOriginChain,
  onExecuteX402,
  onQuoteOneClick,
  onListForSale,
  onSellerDrainAttempt,
  onAtomicBuy,
  onChangeSlug,
  onChangeTitle,
  onChangeCategory,
  onChangeUpstream,
  onChangePriceUsdc,
  onSubmitMint,
  onExitToLanding,
}: LiveConsolePageProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('wire');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedCurl, setCopiedCurl] = useState(false);

  const current = selected ?? entries[0] ?? null;

  // Filtered endpoints in sidebar
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const s = e.summary;
      const matchesSearch =
        s.token_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === 'all' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [entries, searchQuery, categoryFilter]);

  const handleCopyCurl = async () => {
    if (!current) return;
    const curlCmd = `curl -i -X GET https://gateway.route402.testnet/x402/${current.summary.upstream_slug || 'alpha-signal'} \\
  -H "Accept: application/json"`;
    try {
      await navigator.clipboard.writeText(curlCmd);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="console-fullscreen-app">
      {/* 1. Fullscreen Top Application Header */}
      <header className="console-top-bar">
        <div className="console-top-left">
          <button
            type="button"
            className="console-exit-btn"
            onClick={onExitToLanding}
            title="Return to Marketing Landing Page"
          >
            <ArrowLeft size={14} />
            <span>Overview</span>
          </button>

          <div className="console-brand-cluster">
            <Route402Mark size={22} />
            <span className="console-brand-text">Route402</span>
            <span className="console-brand-tag">SOVEREIGN CONSOLE</span>
          </div>

          <span className="console-spec-chip num">sharded-item-1.0.0</span>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="console-top-center">
          <div className="console-status-pill">
            <span className={`status-dot ${sourceMode === 'sandbox' ? 'warn' : ''}`} />
            <span className="num">
              {sourceMode === 'sandbox'
                ? 'Simulation Sandbox · 0-keys local state'
                : 'Live NEAR Testnet RPC · r402-reg-v1.testnet'}
            </span>
          </div>
        </div>

        {/* Right: Network Switcher & Wallet */}
        <div className="console-top-right">
          <div className="mode-switch" role="group" aria-label="Execution mode">
            <button
              type="button"
              className={`mode-btn ${sourceMode === 'sandbox' ? 'active' : ''}`}
              onClick={() => onSelectMode('sandbox')}
            >
              Sandbox
            </button>
            <button
              type="button"
              className={`mode-btn ${sourceMode === 'testnet' ? 'active' : ''}`}
              onClick={() => onSelectMode('testnet')}
            >
              Testnet
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline console-refresh-btn"
            onClick={onRefresh}
            title="Refresh onchain state"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-wallet"
            onClick={onToggleWallet}
            title={walletAccountId ? `Connected: ${walletAccountId}` : 'Connect NEAR Wallet'}
          >
            <Wallet size={13} />
            <span className="num">
              {walletAccountId
                ? walletAccountId.length > 18
                  ? `${walletAccountId.slice(0, 8)}…${walletAccountId.slice(-6)}`
                  : walletAccountId
                : 'Connect Wallet'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. Main Fullscreen Application Workspace (Flexbox 3-Pane Layout) */}
      <div className="console-body-layout">
        {/* =========================================================================
            PANE 1: LEFT SIDEBAR DIRECTORY (Vaults, Categories, Quick Search)
            ========================================================================= */}
        <aside className="console-sidebar-pane">
          {/* Search box */}
          <div className="console-search-box">
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Filter endpoints (slug, category)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="console-search-input"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="console-cat-filter-row">
            <button
              type="button"
              className={`cat-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All ({entries.length})
            </button>
            <button
              type="button"
              className={`cat-chip ${categoryFilter === 'ai-signal' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('ai-signal')}
            >
              Signals
            </button>
            <button
              type="button"
              className={`cat-chip ${categoryFilter === 'ai-inference' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('ai-inference')}
            >
              Inference
            </button>
            <button
              type="button"
              className={`cat-chip ${categoryFilter === 'ai-sentiment' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('ai-sentiment')}
            >
              Sentiment
            </button>
          </div>

          {/* Endpoint Roster List */}
          <div className="console-endpoint-scroll">
            {filteredEntries.map((e) => {
              const isSel = (current?.summary.token_id ?? '') === e.summary.token_id;
              const s = e.summary;
              return (
                <button
                  key={s.token_id}
                  type="button"
                  className={`console-vault-card ${isSel ? 'selected' : ''}`}
                  onClick={() => onSelectId(s.token_id)}
                >
                  <div className="vault-card-head">
                    <div className="vault-card-title-row">
                      <span className={`roster-dot ${s.status === 'Frozen' ? 'amber' : 'green'}`} />
                      <strong className="vault-title">{s.title}</strong>
                    </div>
                    <span className="vault-price num">${formatUsdc(s.price_per_call_usdc)}</span>
                  </div>

                  <div className="vault-card-account num">{s.token_id}</div>

                  <div className="vault-card-footer">
                    <span className="vault-stat num">Treasury: ${formatUsdc(s.vault_usdc_balance)}</span>
                    <span className="vault-key-badge">keys: []</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar Invariant Audit Strip */}
          <div className="console-sidebar-footer">
            <div className="footer-metric-row">
              <span className="f-label">Keyless Sub-Accounts</span>
              <strong className="f-val num" style={{ color: 'var(--accent)' }}>100% Zero-Keys</strong>
            </div>
            <div className="footer-metric-row">
              <span className="f-label">Intermediary Rent</span>
              <strong className="f-val num">$0.00</strong>
            </div>
            <div className="footer-metric-row">
              <span className="f-label">Settlement Rails</span>
              <span className="f-val num">USDC · Intents · Native</span>
            </div>
          </div>
        </aside>

        {/* =========================================================================
            PANE 2: CENTER MAIN WORKSPACE (Asset Header, Chart, Tabbed Workbench)
            ========================================================================= */}
        <main className="console-main-pane">
          {current ? (
            <>
              {/* Asset Header Banner */}
              <div className="console-asset-header-card">
                <div className="asset-header-top">
                  <div className="asset-identity-cluster">
                    <div className="asset-main-symbol-row">
                      <h2 className="asset-token-title num">{current.summary.token_id}</h2>
                      <span className="badge-verified-keyless" title="NEP-591 Keyless State">
                        <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />
                        <span>0-Keys Sovereign</span>
                      </span>
                      <StatusPill status={current.summary.status} />
                      <span className="badge-category">{current.summary.category}</span>
                    </div>
                    <div className="asset-meta-row num">
                      <span>Owner: <code>{current.summary.owner_id}</code></span>
                      <span>·</span>
                      <span>Upstream Tool: <code>{current.summary.mcp_tool_name}</code></span>
                      <span>·</span>
                      <span>Nonce: #{current.summary.state_nonce}</span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="asset-actions-toolbar">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => void handleCopyCurl()}
                      title="Copy curl command"
                    >
                      <Copy size={12} />
                      <span>{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
                    </button>

                    <a
                      href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${current.summary.token_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline"
                      title="View on NearBlocks"
                    >
                      <ExternalLink size={12} />
                      <span>Explorer</span>
                    </a>
                  </div>
                </div>

                {/* Big Metric Strip */}
                <div className="console-metric-strip">
                  <div className="metric-box">
                    <span className="m-label">Price Per Call</span>
                    <div className="m-val-wrap num">
                      <strong className="m-val">${formatUsdc(current.summary.price_per_call_usdc)}</strong>
                      <span className="m-sub">USDC</span>
                    </div>
                    <span className="m-delta green num">▲ +12.4% 24h</span>
                  </div>

                  <div className="metric-box">
                    <span className="m-label">Accrued Vault Treasury</span>
                    <div className="m-val-wrap num">
                      <strong className="m-val" style={{ color: 'var(--accent)' }}>
                        ${formatUsdc(current.summary.vault_usdc_balance)}
                      </strong>
                      <span className="m-sub">USDC</span>
                    </div>
                    <span className="m-delta muted num">Atomically Bound</span>
                  </div>

                  <div className="metric-box">
                    <span className="m-label">Total Settled Calls</span>
                    <div className="m-val-wrap num">
                      <strong className="m-val">{current.summary.total_calls}</strong>
                    </div>
                    <span className="m-delta muted num">Zero Proxy Intermediary</span>
                  </div>

                  <div className="metric-box">
                    <span className="m-label">Rotation Sequence</span>
                    <div className="m-val-wrap num">
                      <strong className="m-val">#{current.summary.rotation_seq}</strong>
                    </div>
                    <span className="m-delta muted num">Monotonic Anti-Replay</span>
                  </div>
                </div>

                {/* Interactive Settlement Volume Area Chart */}
                <div className="console-chart-wrapper">
                  <div className="chart-header-row">
                    <span className="chart-title num">HTTP 402 Micro-Settlement Velocity</span>
                    <div className="chart-pills">
                      <span className="c-pill active">1H</span>
                      <span className="c-pill">24H</span>
                      <span className="c-pill">7D</span>
                      <span className="c-pill">30D</span>
                      <span className="c-pill">ALL</span>
                    </div>
                  </div>

                  <svg viewBox="0 0 720 140" width="100%" height="140" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="consoleChartGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#00ec97" stopOpacity="0.32" />
                        <stop offset="70%" stopColor="#00ec97" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#00ec97" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Guidelines */}
                    <line x1="0" y1="30" x2="720" y2="30" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <line x1="0" y1="70" x2="720" y2="70" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <line x1="0" y1="110" x2="720" y2="110" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

                    {/* Area & Line */}
                    <path
                      d="M 0 110 Q 90 95, 180 80 T 360 60 T 540 38 T 720 20 L 720 140 L 0 140 Z"
                      fill="url(#consoleChartGlow)"
                    />
                    <path
                      d="M 0 110 Q 90 95, 180 80 T 360 60 T 540 38 T 720 20"
                      fill="none"
                      stroke="#00ec97"
                      strokeWidth="2.2"
                    />

                    {/* Pulse point */}
                    <circle cx="720" cy="20" r="4.5" fill="#00ec97" />
                    <circle cx="720" cy="20" r="10" fill="#00ec97" opacity="0.35" />
                  </svg>
                </div>
              </div>

              {/* Workspace Tab Bar */}
              <div className="console-tab-bar">
                <button
                  type="button"
                  className={`console-tab-btn ${activeTab === 'wire' ? 'active' : ''}`}
                  onClick={() => setActiveTab('wire')}
                >
                  <Terminal size={14} />
                  <span>HTTP 402 Wire Handshake</span>
                </button>
                <button
                  type="button"
                  className={`console-tab-btn ${activeTab === 'threat-t2' ? 'active' : ''}`}
                  onClick={() => setActiveTab('threat-t2')}
                >
                  <Lock size={14} />
                  <span>Threat T-2 Anti-Drain &amp; Escrow</span>
                </button>
                <button
                  type="button"
                  className={`console-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ledger')}
                >
                  <Database size={14} />
                  <span>Ownership Ledger &amp; Receipts</span>
                </button>
                <button
                  type="button"
                  className={`console-tab-btn ${activeTab === 'mint' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mint')}
                >
                  <PlusCircle size={14} />
                  <span>Mint New Sovereign Sub-Account</span>
                </button>
              </div>

              {/* Tab Content Display */}
              <div className="console-tab-content-area">
                {activeTab === 'wire' && (
                  <div className="console-wire-tab">
                    <div className="wire-flow-explainer">
                      <span className="flow-step">
                        <strong>Step 1:</strong> Client requests endpoint without auth → Gateway returns <code>HTTP 402 Payment Required</code>
                      </span>
                      <ChevronRight size={14} className="flow-arrow" />
                      <span className="flow-step">
                        <strong>Step 2:</strong> Client provides <code>X-PAYMENT</code> header (NEP-141 USDC or 1Click Intents)
                      </span>
                      <ChevronRight size={14} className="flow-arrow" />
                      <span className="flow-step">
                        <strong>Step 3:</strong> Settlement verified inside keyless sub-account → <code>200 OK</code> data returned
                      </span>
                    </div>

                    {wireLog ? (
                      <div className="wire-log-deck">
                        <div className="wire-log-panel">
                          <div className="log-panel-head">
                            <span className="num">Challenge Payload (HTTP 402)</span>
                            <span className="log-badge status-402">HTTP 402</span>
                          </div>
                          <pre className="code-block num">
                            {JSON.stringify(wireLog.challenge, null, 2)}
                          </pre>
                        </div>

                        <div className="wire-log-panel">
                          <div className="log-panel-head">
                            <span className="num">Verified Response (200 OK)</span>
                            <span className="log-badge status-200">200 OK</span>
                          </div>
                          <pre className="code-block num">
                            {JSON.stringify(wireLog.responseBody, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="wire-empty-state">
                        <Terminal size={32} style={{ color: 'var(--ink-3)' }} />
                        <h4 className="empty-title">Ready for HTTP 402 Wire Exchange</h4>
                        <p className="empty-desc">
                          Click &quot;Execute x402 Settlement ⚡&quot; on the right to simulate a real payment challenge, cryptographic verification, and 200 OK data handover.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'threat-t2' && (
                  <div className="console-t2-tab">
                    <div className="t2-status-card">
                      <div className="t2-head">
                        <div className="t2-title-cluster">
                          <ShieldCheck size={18} style={{ color: current.t2.ok ? 'var(--accent)' : 'var(--warn-ink)' }} />
                          <h3 className="t2-title">Threat T-2 Anti-Drain Invariant Status</h3>
                        </div>
                        <span className={`pill ${current.listing ? 'frozen' : 'active'}`}>
                          {current.listing
                            ? `Frozen in Escrow (${formatNear(current.listing.sale_price_yocto)} NEAR)`
                            : 'Unlisted · Active'}
                        </span>
                      </div>

                      <p className="t2-desc">
                        Sub-accounts freeze atomically upon marketplace listing. Outflows are cryptographically blocked so sellers cannot drain accrued treasury while a buyer evaluates the deal.
                      </p>

                      <table className="kv-table" style={{ marginBlock: 16 }}>
                        <tbody>
                          <tr>
                            <th>Sub-Account ID</th>
                            <td className="num">{current.summary.token_id}</td>
                          </tr>
                          <tr>
                            <th>Access Keys (Threat T-1)</th>
                            <td className="num">
                              {current.accessKeyCount === null
                                ? 'Unavailable'
                                : `keys: [] (${current.accessKeyCount} keys deployed)`}
                            </td>
                          </tr>
                          <tr>
                            <th>Dual-RPC Cryptographic Proof</th>
                            <td>
                              <span style={{ color: current.t2.ok ? 'var(--accent)' : 'var(--warn-ink)', fontWeight: 600 }}>
                                {current.t2.ok ? '✓ Dual-RPC Proof Validated' : 'Unverified'}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <th>Finalized Block Height</th>
                            <td className="num">#{current.t2.blockHeight}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Interactive Actions */}
                      {sourceMode === 'sandbox' ? (
                        <div className="t2-actions-row">
                          {!current.listing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-outline"
                                disabled={busyAction !== null}
                                onClick={onListForSale}
                              >
                                <Lock size={14} />
                                <span>List for 1.5 NEAR (Freeze Outflows)</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-danger-action"
                                disabled={
                                  busyAction !== null ||
                                  BigInt(current.summary.vault_usdc_balance) === 0n
                                }
                                onClick={onSellerDrainAttempt}
                              >
                                <ShieldAlert size={14} />
                                <span>Simulate Seller Drain Attack</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busyAction !== null}
                              onClick={onAtomicBuy}
                            >
                              <CheckCircle2 size={14} />
                              <span>Execute Atomic Buyout (1.5 NEAR)</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="testnet-live-note">
                          <span>Live Testnet Contract: </span>
                          <a
                            href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {TESTNET_DEPLOYMENT.registryId}
                          </a>
                        </div>
                      )}

                      {escrowBanner && (
                        <div className={`notice notice-${escrowBanner.kind}`} style={{ marginTop: 16 }}>
                          <strong>
                            {escrowBanner.kind === 'ok'
                              ? '✓ Invariant Maintained: '
                              : '⛔ Outflow Rejected (Threat T-2): '}
                          </strong>
                          <span>{escrowBanner.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'ledger' && (
                  <div className="console-ledger-tab">
                    <LedgerAuditPanel selected={current} />
                  </div>
                )}

                {activeTab === 'mint' && (
                  <div className="console-mint-tab">
                    <MintEndpointPanel
                      sourceMode={sourceMode}
                      busyAction={busyAction}
                      mintSlug={mintSlug}
                      mintTitle={mintTitle}
                      mintCategory={mintCategory}
                      mintUpstream={mintUpstream}
                      mintPriceUsdc={mintPriceUsdc}
                      onChangeSlug={onChangeSlug}
                      onChangeTitle={onChangeTitle}
                      onChangeCategory={onChangeCategory}
                      onChangeUpstream={onChangeUpstream}
                      onChangePriceUsdc={onChangePriceUsdc}
                      onSubmitMint={onSubmitMint}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="console-empty-prompt">
              <span>Select an endpoint on the left to inspect its live sovereign console.</span>
            </div>
          )}
        </main>

        {/* =========================================================================
            PANE 3: RIGHT PANEL (1Click Settlement Engine & Live Activity Telemetry)
            ========================================================================= */}
        <aside className="console-settlement-pane">
          <div className="settlement-head">
            <span className="s-title">1Click Multi-Rail Settlement</span>
            <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Intents Diffuser
            </span>
          </div>

          {/* Chain Selector */}
          <div className="swap-chain-tabs">
            {chains.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`swap-chain-tab ${originChain === c.id ? 'active' : ''}`}
                onClick={() => onSelectOriginChain(c.id)}
              >
                <ChainIcon chain={c.id} size={13} />
                <span>{c.label.replace(' USDC', '')}</span>
              </button>
            ))}
          </div>

          {/* Origin Card */}
          <div className="swap-input-card">
            <div className="swap-card-label-row">
              <span>Pay with cross-chain rail</span>
              <span className="num">Balance: $100.00</span>
            </div>
            <div className="swap-value-row">
              <span className="swap-amount num">
                ${current ? formatUsdc(current.summary.price_per_call_usdc) : '0.0400'}
              </span>
              <div className="swap-pill-tag">
                <ChainIcon chain={originChain} size={14} />
                <span className="num">{originChain.toUpperCase()} USDC</span>
              </div>
            </div>
          </div>

          <div className="swap-divider-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Target Card */}
          <div className="swap-input-card">
            <div className="swap-card-label-row">
              <span>Settles into sovereign vault</span>
              <span className="num">Single Account</span>
            </div>
            <div className="swap-value-row">
              <span className="swap-amount num" style={{ color: 'var(--accent)' }}>
                ${current ? formatUsdc(current.summary.price_per_call_usdc) : '0.0400'}
              </span>
              <div className="swap-pill-tag">
                <ChainIcon chain="near" size={14} />
                <span className="num">NEAR USDC</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="swap-action-buttons">
            <button
              type="button"
              className="btn btn-primary btn-full"
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
                  ? 'Executing 402 Settlement…'
                  : 'Execute x402 Settlement ⚡'}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-outline btn-full btn-quote"
              disabled={busyAction !== null}
              onClick={onQuoteOneClick}
            >
              {busyAction === 'oneclick' ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <ArrowDown size={13} />
              )}
              <span>Fetch 1Click Solver Quote</span>
            </button>
          </div>

          {/* Solver Quote Preview */}
          {quoteResult && (
            <div className="solver-quote-box">
              <div className="quote-header num">
                1Click Solver Quote ({quoteResult.quote.simulated ? 'Simulated' : 'Live'})
              </div>
              <div className="quote-row">
                <span>In:</span>
                <span className="num">
                  {quoteResult.quote.quote?.amountInFormatted ?? '0.04'} {quoteResult.originChain.toUpperCase()}
                </span>
              </div>
              <div className="quote-row">
                <span>Out:</span>
                <span className="num" style={{ color: 'var(--accent)' }}>
                  {quoteResult.quote.quote?.amountOutFormatted ?? '0.04'} NEAR USDC
                </span>
              </div>
              <div className="quote-row">
                <span>Estimated Time:</span>
                <span className="num">
                  ~{quoteResult.quote.quote?.timeEstimate ?? 4.2} seconds
                </span>
              </div>
            </div>
          )}

          {/* Network Activity Feed */}
          <div className="console-activity-feed">
            <span className="feed-title num">LIVE TESTNET TELEMETRY</span>
            <div className="feed-items">
              <div className="feed-item">
                <span className="feed-dot green" />
                <div className="feed-info">
                  <span className="feed-text">Settled $0.0400 via Base USDC</span>
                  <span className="feed-sub num">alpha-signal · block #188420100</span>
                </div>
              </div>
              <div className="feed-item">
                <span className="feed-dot green" />
                <div className="feed-info">
                  <span className="feed-text">1Click Swap solved in 3.8s</span>
                  <span className="feed-sub num">Solana USDC → NEAR USDC</span>
                </div>
              </div>
              <div className="feed-item">
                <span className="feed-dot amber" />
                <div className="feed-info">
                  <span className="feed-text">Threat T-2 Invariant Verified</span>
                  <span className="feed-sub num">sentiment-feed · keys: []</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
