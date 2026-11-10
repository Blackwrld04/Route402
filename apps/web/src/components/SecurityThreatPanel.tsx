import { ArrowUpRight, Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatNear, formatUsdc } from '@route402/core';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';
import { StatusPill } from './EndpointRoster';
import type { DataSourceMode, EndpointEntry } from '../types';

interface SecurityThreatPanelProps {
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

export function SecurityThreatPanel({
  selected,
  sourceMode,
  busyAction,
  escrowBanner,
  onListForSale,
  onSellerDrainAttempt,
  onAtomicBuy,
}: SecurityThreatPanelProps) {
  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">
          <ShieldCheck size={16} />
          <span>Formally verified invariant guarantees</span>
        </p>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Atomic escrow market &amp; anti-drain enforcement.{' '}
          <span className="muted">
            The sub-account freezes on listing; seller cannot withdraw treasury while buyer evaluates.
          </span>
        </h2>
        <p className="lead">
          NEP-591 global contracts guarantee single-account ownership without proxy indirection.
          Inbound x402 revenue keeps settling into the account during listing, while outward
          transfers are strictly blocked until sale settlement or cancellation.
        </p>

        <div className="split-2">
          {/* Left: Cryptographic Invariants Table */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <ShieldAlert size={16} />
                <span>Live T2 cryptographic invariants (House of Stake)</span>
              </h3>
              <span className={`pill ${selected.t2.ok ? 'active' : 'warn'}`}>
                {selected.t2.ok ? 'T2 dual-RPC proof valid' : 'T2 unverified'}
              </span>
            </div>
            <div className="panel-body">
              <table className="kv-table">
                <tbody>
                  <tr>
                    <th>Target sub-account</th>
                    <td>{selected.summary.token_id}</td>
                  </tr>
                  <tr>
                    <th>Pinned collection registry</th>
                    <td>{selected.summary.collection_id}</td>
                  </tr>
                  <tr>
                    <th>Access keys (Threat T-1)</th>
                    <td>
                      {selected.accessKeyCount === null
                        ? 'Unavailable (RPC error)'
                        : `keys: [] (${selected.accessKeyCount} keys)`}
                    </td>
                  </tr>
                  <tr>
                    <th>Finalized block height</th>
                    <td>#{selected.t2.blockHeight}</td>
                  </tr>
                  <tr>
                    <th>Verified owner_id</th>
                    <td>{selected.summary.owner_id}</td>
                  </tr>
                  <tr>
                    <th>Rotation sequence (rotation_seq)</th>
                    <td>{selected.summary.rotation_seq}</td>
                  </tr>
                  <tr>
                    <th>Mutation state_nonce</th>
                    <td>{selected.summary.state_nonce}</td>
                  </tr>
                  <tr>
                    <th>Pending async outflows</th>
                    <td>{selected.summary.pending_outflows}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Interactive Escrow & Seller Drain Blocker */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <Lock size={16} />
                <span>Atomic escrow market &amp; Threat T-2 stress test</span>
              </h3>
              <span className={`pill ${selected.listing ? 'frozen' : 'active'}`}>
                {selected.listing
                  ? `Listed for ${formatNear(selected.listing.sale_price_yocto)} NEAR`
                  : 'Not listed'}
              </span>
            </div>
            <div className="panel-body">
              <table className="kv-table">
                <tbody>
                  <tr>
                    <th>Vault status</th>
                    <td>
                      <StatusPill status={selected.summary.status} />
                    </td>
                  </tr>
                  <tr>
                    <th>Accrued vault USDC</th>
                    <td>${formatUsdc(selected.summary.vault_usdc_balance)} USDC</td>
                  </tr>
                  <tr>
                    <th>Pinned listing state_nonce</th>
                    <td>{selected.listing ? selected.listing.listed_state_nonce : '—'}</td>
                  </tr>
                  <tr>
                    <th>Pinned listing rotation_seq</th>
                    <td>{selected.listing ? selected.listing.listed_rotation_seq : '—'}</td>
                  </tr>
                </tbody>
              </table>

              {sourceMode === 'sandbox' ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 20,
                  }}
                >
                  {!selected.listing ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        disabled={busyAction !== null}
                        onClick={onListForSale}
                      >
                        {busyAction === 'list' ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Lock size={14} />
                        )}
                        <span>
                          {busyAction === 'list'
                            ? 'Listing and freezing outflows…'
                            : 'List for 1.5 NEAR (freeze outflows)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          busyAction !== null ||
                          BigInt(selected.summary.vault_usdc_balance) === 0n
                        }
                        onClick={onSellerDrainAttempt}
                      >
                        {busyAction === 'drain' ? (
                          <Loader2 size={14} className="spin" />
                        ) : null}
                        <span>
                          {busyAction === 'drain'
                            ? 'Attempting withdrawal…'
                            : 'Withdraw USDC as current owner'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyAction !== null}
                        onClick={onSellerDrainAttempt}
                      >
                        {busyAction === 'drain' ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <ShieldAlert size={14} />
                        )}
                        <span>
                          {busyAction === 'drain'
                            ? 'Testing seller drain block…'
                            : 'Attempt seller mid-sale drain (Threat T-2)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyAction !== null}
                        onClick={onAtomicBuy}
                      >
                        {busyAction === 'buy' ? (
                          <Loader2 size={14} className="spin" />
                        ) : null}
                        <span>
                          {busyAction === 'buy'
                            ? 'Executing atomic handover…'
                            : 'Buy atomically (1.5 NEAR) & rotate owner'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
                    Onchain proof transactions on NEAR Testnet:
                  </div>
                  {TESTNET_DEPLOYMENT.proofTransactions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {TESTNET_DEPLOYMENT.proofTransactions.map((tx) => (
                        <a
                          key={tx.txHash}
                          className="ext-link num"
                          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/txns/${tx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{tx.label}</span>
                          <ArrowUpRight size={12} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <a
                      className="ext-link num"
                      style={{ fontSize: 12 }}
                      href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${selected.summary.token_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Inspect {selected.summary.token_id} on NearBlocks Testnet
                    </a>
                  )}
                </div>
              )}

              {escrowBanner && (
                <div className={`alert-banner ${escrowBanner.kind}`}>
                  {escrowBanner.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
