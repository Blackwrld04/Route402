import { ArrowUpRight, CheckCircle2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatNear, formatUsdc } from '@route402/core';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';
import { StatusPill } from './EndpointRoster';
import type { DataSourceMode, EndpointEntry } from '../types';

interface SecurityShowcaseProps {
  selected: EndpointEntry;
  sourceMode: DataSourceMode;
  busyAction: string | null;
  escrowBanner: {
    kind: 'ok' | 'blocked';
    message: string;
  } | null;
  onListForSale: () => void;
  onSellerDrainAttempt: () => void;
  onAtomicBuy: () => void;
}

export function SecurityShowcase({
  selected,
  sourceMode,
  busyAction,
  escrowBanner,
  onListForSale,
  onSellerDrainAttempt,
  onAtomicBuy,
}: SecurityShowcaseProps) {
  return (
    <section id="security" className="section security-showcase-section">
      <div className="wrap">
        <div className="section-head text-center">
          <span className="pill-outline">
            <ShieldCheck size={13} style={{ color: 'var(--accent)' }} />
            <span>Valuable Features</span>
          </span>
          <h2 className="serif-display-title">
            Powerful Tools for Sovereign Endpoint Management
          </h2>
          <p className="section-desc">
            Take full control of your endpoint cash flows with robust invariants designed to simplify transfers, guarantee buyer escrow, and prevent key retention.
          </p>
        </div>

        <div className="security-split">
          {/* Left: 4 Feature Boxes in 2x2 with Champagne Buttons (Matching Image 2 bottom left) */}
          <div className="security-quad">
            {/* Box 1 with Champagne View Details Button */}
            <div className="security-card">
              <h3 className="security-card-title">Keyless Sub-Account Sovereignty</h3>
              <p className="security-card-desc">
                Guarantees <code>keys: []</code> directly on the NEAR state tree. Minters and sellers cannot secretly retain full access keys to hijack future cash flows.
              </p>
              <div className="security-card-champagne-btn">
                <span>View Details</span>
                <ArrowUpRight size={13} />
              </div>
            </div>

            {/* Box 2 with Champagne View Details Button */}
            <div className="security-card">
              <h3 className="security-card-title">Seller Mid-Sale Drain Blocker</h3>
              <p className="security-card-desc">
                Freezes the sub-account upon marketplace listing. All outgoing <code>ft_transfer</code> calls are rejected until purchase completes or listing cancels.
              </p>
              <div className="security-card-champagne-btn">
                <span>View Details</span>
                <ArrowUpRight size={13} />
              </div>
            </div>

            {/* Box 3 */}
            <div className="security-card">
              <h3 className="security-card-title">Universal Cross-Chain Settlement</h3>
              <p className="security-card-desc">
                Enforces strictly monotonic <code>rotation_seq</code> on every ownership transfer. Past signatures cannot be replayed after a buyer takes ownership.
              </p>
            </div>

            {/* Box 4 */}
            <div className="security-card">
              <h3 className="security-card-title">Atomic Ownership &amp; Treasury Handover</h3>
              <p className="security-card-desc">
                Transferring the NFT hands over the sub-account, accrued USDC treasury balance, and active HTTP 402 revenue stream in one atomic transaction.
              </p>
            </div>
          </div>

          {/* Right: Crisp Light-Mode macOS Dashboard Window (Matching Image 2 bottom right) */}
          <div className="security-terminal-wrap">
            <div className="mockup-light-window">
              {/* Window Header */}
              <div className="light-window-bar">
                <div className="light-dots">
                  <span className="dot dot-close" />
                  <span className="dot dot-min" />
                  <span className="dot dot-max" />
                </div>
                <div className="light-window-url num">
                  route402.testnet/vaults/{selected.summary.upstream_slug || selected.summary.token_id}
                </div>
              </div>

              {/* Window Body */}
              <div className="light-window-body">
                {/* Header row */}
                <div className="light-card-top-row">
                  <div>
                    <span className="light-eyebrow">TARGET SUB-ACCOUNT</span>
                    <h4 className="light-token-title num">{selected.summary.token_id}</h4>
                  </div>
                  <div className="light-status-cluster">
                    <span className="light-verified-tag">
                      <CheckCircle2 size={12} style={{ color: '#027a48' }} />
                      <span>Verified: keys: []</span>
                    </span>
                    <StatusPill status={selected.summary.status} />
                  </div>
                </div>

                {/* Big Metric & Subtitle */}
                <div className="light-metric-banner">
                  <div>
                    <span className="light-metric-label">Total Accrued Cashflow</span>
                    <div className="light-big-num num">
                      ${formatUsdc(selected.summary.vault_usdc_balance)}{' '}
                      <span className="light-currency">USDC</span>
                    </div>
                  </div>
                  <div className="light-delta-box num">
                    <span className="light-delta-green">▲ +12.4%</span>
                    <span className="light-sub-label">24h Volume</span>
                  </div>
                </div>

                {/* Light Area Chart */}
                <div className="light-chart-wrap">
                  <svg viewBox="0 0 460 110" width="100%" height="110" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lightChartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#00EC97" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#00EC97" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 85 Q 60 75, 120 60 T 230 45 T 340 30 T 460 15 L 460 110 L 0 110 Z"
                      fill="url(#lightChartGrad)"
                    />
                    <path
                      d="M 0 85 Q 60 75, 120 60 T 230 45 T 340 30 T 460 15"
                      fill="none"
                      stroke="#027a48"
                      strokeWidth="2"
                    />
                    <circle cx="460" cy="15" r="4" fill="#027a48" />
                  </svg>
                </div>

                {/* Invariant Table */}
                <table className="light-table">
                  <tbody>
                    <tr>
                      <th>Access Keys (Threat T-1)</th>
                      <td className="num">
                        {selected.accessKeyCount === null
                          ? 'Unavailable'
                          : `keys: [] (${selected.accessKeyCount} keys deployed)`}
                      </td>
                    </tr>
                    <tr>
                      <th>Threat T-2 Status</th>
                      <td>
                        <span style={{ color: selected.t2.ok ? '#027a48' : '#b54708', fontWeight: 600 }}>
                          {selected.t2.ok ? '✓ Dual-RPC Proof Valid' : 'Unverified'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th>Finalized Block</th>
                      <td className="num">#{selected.t2.blockHeight}</td>
                    </tr>
                    <tr>
                      <th>Current Owner</th>
                      <td className="num">{selected.summary.owner_id}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Interactive Stress Test Actions */}
                {sourceMode === 'sandbox' ? (
                  <div className="light-actions-row">
                    {!selected.listing ? (
                      <>
                        <button
                          type="button"
                          className="btn-light-secondary"
                          disabled={busyAction !== null}
                          onClick={onListForSale}
                        >
                          <Lock size={13} />
                          <span>List for 1.5 NEAR (Freeze)</span>
                        </button>
                        <button
                          type="button"
                          className="btn-light-danger"
                          disabled={
                            busyAction !== null ||
                            BigInt(selected.summary.vault_usdc_balance) === 0n
                          }
                          onClick={onSellerDrainAttempt}
                        >
                          <ShieldAlert size={13} />
                          <span>Simulate Seller Drain</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-light-primary"
                        disabled={busyAction !== null}
                        onClick={onAtomicBuy}
                      >
                        <CheckCircle2 size={13} />
                        <span>Execute Atomic Buyout (1.5 NEAR)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="light-testnet-note">
                    <span>Testnet Live Contract: </span>
                    <a
                      href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {TESTNET_DEPLOYMENT.registryId}
                    </a>
                  </div>
                )}

                {/* Escrow Result Banner */}
                {escrowBanner && (
                  <div
                    className={`light-banner ${
                      escrowBanner.kind === 'ok' ? 'ok' : 'blocked'
                    }`}
                  >
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
          </div>
        </div>
      </div>
    </section>
  );
}
