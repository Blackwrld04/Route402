import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { formatUsdc, type OneClickQuoteResponse } from '@route402/core';
import { ChainIcon } from './ChainIcons';
import { MountainBackdrop } from './MountainBackdrop';
import type {
  DataSourceMode,
  EndpointEntry,
  OriginChainOption,
  WireExchangeLog,
} from '../types';

interface HeroSectionProps {
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
  onSelectId: (id: string) => void;
  onSelectOriginChain: (chain: string) => void;
  onExecuteX402: () => void;
  onQuoteOneClick: () => void;
  onScrollToSecurity: () => void;
  onLaunchConsole: () => void;
}

export function HeroSection({
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
  onSelectId,
  onSelectOriginChain,
  onExecuteX402,
  onQuoteOneClick,
  onScrollToSecurity,
  onLaunchConsole,
}: HeroSectionProps) {
  const current = selected ?? entries[0] ?? null;

  return (
    <section id="top" className="hero-editorial-section">
      {/* Soft Mountain Horizon Atmosphere (Exact Cointrix Image 1 Sky & Ridges) */}
      <MountainBackdrop className="hero-mountain-backdrop" height={780} showSky={true} />

      <div className="wrap text-center" style={{ position: 'relative', zIndex: 2 }}>
        {/* Eyebrow Tag Pill (Cointrix style) */}
        <div className="hero-tag-wrap">
          <span className="hero-pill-badge">
            THE FIRST CASH-FLOWING ACCOUNT-NFT PLATFORM ON NEAR
          </span>
        </div>

        {/* Grand Editorial Serif Title (Playfair Display) */}
        <h1 className="hero-serif-title">
          Cash-Flowing x402 Endpoints
          <br />
          Made Sovereign on NEAR
        </h1>

        {/* Subhead in warm muted gray */}
        <p className="hero-lead-text">
          From risk to sovereign reward, our sharded endpoint platform gives AI agents and developers
          complete visibility, autonomous settlements, and atomic revenue control.
        </p>

        {/* Dual CTA Buttons (Matching Image 1: Dark charcoal button + Champagne pill) */}
        <div className="hero-cta-group">
          <button
            type="button"
            className="btn btn-dark-charcoal btn-hero-primary-console"
            onClick={onLaunchConsole}
          >
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span>Launch Live Console</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="btn btn-champagne-pill"
            onClick={onScrollToSecurity}
          >
            <span>Explore Testnet Vaults</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Cointrix-Style 3-Part Floating Live Terminal Mockup (Exact Image 1 Architecture) */}
        <div id="live-console-mockup" className="hero-mockup-frame">
          {/* Window Header Bar */}
          <div className="mockup-window-bar">
            <div className="mockup-dots">
              <span className="dot dot-close" />
              <span className="dot dot-min" />
              <span className="dot dot-max" />
            </div>
            <div className="mockup-title num">
              Route402 Sovereign Console · {current?.summary.token_id ?? 'alpha-signal.route402.testnet'}
            </div>
            <div className="mockup-mode-indicator" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="btn btn-sm btn-outline mockup-fullscreen-btn"
                onClick={onLaunchConsole}
                title="Open Dedicated Full-Screen Console Page"
              >
                <Maximize2 size={11} />
                <span>Open Full-Screen Console ↗</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`status-dot ${sourceMode === 'sandbox' ? 'warn' : ''}`} />
                <span className="num" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {sourceMode === 'sandbox' ? 'sandbox:0-keys' : 'finalized:rpc'}
                </span>
              </div>
            </div>
          </div>

          {/* Window Body: 3-Column Luxury Fintech Terminal Layout */}
          <div className="terminal-three-col-layout">
            {/* 1. Left Sidebar Navigation & Vault Switcher */}
            <aside className="terminal-sidebar">
              <div className="terminal-nav-group">
                <button type="button" className="terminal-nav-item active">
                  <Compass size={15} />
                  <span>Explore</span>
                </button>
                <button type="button" className="terminal-nav-item">
                  <Database size={15} />
                  <span>Marketplace</span>
                </button>
                <button type="button" className="terminal-nav-item">
                  <Layers size={15} />
                  <span>My Vaults</span>
                </button>
                <button type="button" className="terminal-nav-item">
                  <Activity size={15} />
                  <span>Activity</span>
                </button>
                <button type="button" className="terminal-nav-item">
                  <Users size={15} />
                  <span>Community</span>
                </button>
              </div>

              <div className="terminal-roster-subgroup">
                <span className="terminal-roster-label">SOVEREIGN ENDPOINTS</span>
                <div className="terminal-roster-list">
                  {entries.map((e) => {
                    const isSel = (current?.summary.token_id ?? '') === e.summary.token_id;
                    return (
                      <button
                        key={e.summary.token_id}
                        type="button"
                        className={`terminal-roster-btn ${isSel ? 'active' : ''}`}
                        onClick={() => onSelectId(e.summary.token_id)}
                      >
                        <div className="roster-btn-row">
                          <span className={`roster-dot ${e.summary.status === 'Frozen' ? 'amber' : 'green'}`} />
                          <span className="roster-title">{e.summary.upstream_slug || e.summary.token_id}</span>
                        </div>
                        <span className="roster-price num">${formatUsdc(e.summary.price_per_call_usdc)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* 2. Center Stage: Asset Details, Price, and Live Financial Area Chart */}
            <main className="terminal-main-stage">
              {current && (
                <>
                  {/* Asset Header Row */}
                  <div className="stage-asset-header">
                    <div className="stage-title-wrap">
                      <div className="stage-symbol-row">
                        <span className="stage-asset-name">{current.summary.token_id}</span>
                        <span className="stage-verified-badge" title="NEP-591 Keyless Sub-Account">
                          <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />
                          <span>0-Keys</span>
                        </span>
                        <span className="stage-category-chip">{current.summary.category}</span>
                      </div>
                      <span className="stage-owner-sub num">
                        Owner: <code>{current.summary.owner_id}</code> · Standard: <code>sharded-item-1.0.0</code>
                      </span>
                    </div>

                    <div className="stage-window-actions">
                      <span className="stage-action-icon" title="Expand view"><Maximize2 size={13} /></span>
                      <span className="stage-action-icon" title="Configure"><Sliders size={13} /></span>
                      <span className="stage-action-icon" title="Close"><X size={13} /></span>
                    </div>
                  </div>

                  {/* Price & Settlement Metric Bar */}
                  <div className="stage-price-row">
                    <div>
                      <div className="stage-big-price num">
                        ${formatUsdc(current.summary.price_per_call_usdc)}{' '}
                        <span className="stage-currency">USDC/call</span>
                      </div>
                      <div className="stage-delta-row num">
                        <span className="delta-green">▲ +12.4% 24h</span>
                        <span className="delta-timestamp">Nov 10, 2026 · 16:40 UTC</span>
                      </div>
                    </div>

                    <div className="stage-secondary-metrics num">
                      <div>
                        <span className="sec-label">Accrued Treasury</span>
                        <strong className="sec-val" style={{ color: 'var(--accent)' }}>
                          ${formatUsdc(current.summary.vault_usdc_balance)} USDC
                        </strong>
                      </div>
                      <div>
                        <span className="sec-label">Total Calls</span>
                        <strong className="sec-val">{current.summary.total_calls}</strong>
                      </div>
                    </div>
                  </div>

                  {/* High-Fidelity SVG Live Area Chart (Matching Cointrix Image 1) */}
                  <div className="stage-chart-card">
                    <svg viewBox="0 0 540 180" width="100%" height="180" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f7f6f3" stopOpacity="0.25" />
                          <stop offset="60%" stopColor="#f7f6f3" stopOpacity="0.04" />
                          <stop offset="100%" stopColor="#f7f6f3" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Subtle coordinate grid lines */}
                      <line x1="0" y1="40" x2="540" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                      <line x1="0" y1="90" x2="540" y2="90" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                      <line x1="0" y1="140" x2="540" y2="140" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

                      {/* Financial Area Fill */}
                      <path
                        d="M 0 140 Q 60 130, 120 110 T 240 80 T 360 65 T 450 40 T 540 25 L 540 180 L 0 180 Z"
                        fill="url(#chartGlow)"
                      />

                      {/* Glowing Line */}
                      <path
                        d="M 0 140 Q 60 130, 120 110 T 240 80 T 360 65 T 450 40 T 540 25"
                        fill="none"
                        stroke="#f7f6f3"
                        strokeWidth="2"
                      />

                      {/* Pulse marker on current height */}
                      <circle cx="540" cy="25" r="4.5" fill="#f7f6f3" />
                      <circle cx="540" cy="25" r="9" fill="#f7f6f3" opacity="0.3" />
                    </svg>

                    {/* Chart Time Filter Tabs */}
                    <div className="stage-time-tabs">
                      <span className="time-tab">1H</span>
                      <span className="time-tab active">24H</span>
                      <span className="time-tab">7D</span>
                      <span className="time-tab">30D</span>
                      <span className="time-tab">ALL</span>
                    </div>
                  </div>
                </>
              )}
            </main>

            {/* 3. Right Panel: 1Click Cross-Chain Swap & HTTP 402 Execution Terminal */}
            <aside className="terminal-swap-panel">
              <div className="swap-panel-head">
                <span className="swap-title">1Click Multi-Rail Settlement</span>
                <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  Intents Diffuser
                </span>
              </div>

              {/* Origin Chain Selector */}
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

              {/* Origin Currency Box */}
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

              {/* Arrow divider */}
              <div className="swap-divider-arrow">
                <ArrowDown size={14} />
              </div>

              {/* Target Sub-Account Vault Box */}
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

              {/* Live Wire Log Status */}
              {wireLog ? (
                <div className="swap-log-preview">
                  <div className="log-row">
                    <span className="log-badge status-402">HTTP 402</span>
                    <span className="log-text">Challenge received</span>
                  </div>
                  <div className="log-row">
                    <span className="log-badge status-200">200 OK</span>
                    <span className="log-text">Settled in vault #{wireLog.receiptHeader?.receipt_id ? '✓' : '1'}</span>
                  </div>
                </div>
              ) : (
                <div className="swap-log-hint">
                  <span>Ready. Solvers front NEAR USDC in ~4s with zero proxy rent.</span>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
