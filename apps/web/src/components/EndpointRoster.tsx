import { Activity, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { formatUsdc } from '@route402/core';
import { ChainIcon } from './ChainIcons';
import type { EndpointEntry } from '../types';

export function StatusPill({ status }: { status: string }) {
  if (status === 'Frozen') {
    return (
      <span className="pill frozen">
        <Lock size={12} />
        <span>Frozen in escrow</span>
      </span>
    );
  }
  if (status === 'Active') {
    return (
      <span className="pill active">
        <CheckCircle2 size={12} />
        <span>Active</span>
      </span>
    );
  }
  if (status === 'Suspended') {
    return (
      <span className="pill warn">
        <ShieldAlert size={12} />
        <span>Suspended</span>
      </span>
    );
  }
  return (
    <span className="pill neutral">
      <Activity size={12} />
      <span>{status}</span>
    </span>
  );
}

interface EndpointRosterProps {
  entries: EndpointEntry[];
  selectedId: string;
  onSelectId: (id: string) => void;
  loading: boolean;
}

export function EndpointRoster({
  entries,
  selectedId,
  onSelectId,
  loading,
}: EndpointRosterProps) {
  return (
    <div className="endpoint-roster-column">
      <p className="eyebrow">
        <ChainIcon chain="near" size={16} />
        <span>House of Stake sharded-item-1.0.0 · NEP-591 global contracts</span>
      </p>
      <h1 className="h1">
        Own the endpoint.{' '}
        <span className="muted">
          Every HTTP 402 payment settles inside its sharded NEAR account.
        </span>
      </h1>
      <p className="lead">
        Each minted NFT deploys a keyless NEAR sub-account (<code>keys: []</code>) that owns a
        monetized API or MCP tool. Agents pay per call in USDC or cross-chain via NEAR
        Intents; transferring the NFT hands over the live revenue stream and accrued treasury
        atomically.
      </p>

      <div className="endpoint-list" aria-busy={loading}>
        {loading && entries.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div className="endpoint-card skeleton-card" key={`skeleton-${i}`} aria-hidden="true">
                <span className="skeleton skeleton-line w-45" />
                <span className="skeleton skeleton-line w-70" />
                <div className="endpoint-metrics">
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line" />
                </div>
              </div>
            ))
          : null}
        {entries.map((entry) => {
          const s = entry.summary;
          const isSel = selectedId === s.token_id;
          return (
            <button
              key={s.token_id}
              type="button"
              className={`endpoint-card ${isSel ? 'selected' : ''}`}
              onClick={() => onSelectId(s.token_id)}
              aria-pressed={isSel}
            >
              <div className="endpoint-top">
                <span className="endpoint-title">{s.title}</span>
                <StatusPill status={s.status} />
              </div>
              <div className="endpoint-acct num">{s.token_id}</div>
              <div className="endpoint-metrics">
                <div>
                  <span className="metric-label">Price per call</span>
                  <span className="metric-val num">${formatUsdc(s.price_per_call_usdc)}</span>
                </div>
                <div>
                  <span className="metric-label">Vault treasury</span>
                  <span className="metric-val num">${formatUsdc(s.vault_usdc_balance)}</span>
                </div>
                <div>
                  <span className="metric-label">Settled calls</span>
                  <span className="metric-val num">{s.total_calls}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

