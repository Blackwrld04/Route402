import { formatUsdc } from '@route402/core';
import type { EndpointEntry } from '../types';

interface LedgerAuditPanelProps {
  selected: EndpointEntry | null;
}

export function LedgerAuditPanel({ selected }: LedgerAuditPanelProps) {
  if (!selected) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <span>Vault receipt &amp; ownership rotation ledger</span>
          </h3>
        </div>
        <div className="panel-body">
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            Select an endpoint above to view its settled receipts and rotation history.
          </p>
        </div>
      </div>
    );
  }

  const { ownership_history, recent_receipts } = selected.summary;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">
          <span>Vault receipt &amp; ownership rotation ledger</span>
        </h3>
        <span className="pill neutral">
          {ownership_history.length} rotation{ownership_history.length === 1 ? '' : 's'} · {recent_receipts.length} receipt{recent_receipts.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="panel-body">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Ownership rotations ({ownership_history.length})
        </div>
        <table className="kv-table" style={{ marginBottom: 20 }}>
          <tbody>
            {ownership_history.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ textAlign: 'left', color: 'var(--ink-3)' }}>
                  Original minter retains ownership (rotation_seq=0)
                </td>
              </tr>
            ) : (
              ownership_history.map((rec) => (
                <tr key={`${rec.rotation_seq}-${rec.timestamp_ms}`}>
                  <th>seq #{rec.rotation_seq}</th>
                  <td>
                    {rec.from_owner.split('.')[0]} -&gt; {rec.to_owner}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Recent settled x402 receipts ({recent_receipts.length})
        </div>
        <table className="kv-table">
          <tbody>
            {recent_receipts.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ textAlign: 'left', color: 'var(--ink-3)' }}>
                  No receipts recorded yet for this vault.
                </td>
              </tr>
            ) : (
              recent_receipts
                .slice(-5)
                .reverse()
                .map((r) => (
                  <tr key={r.receipt_id}>
                    <th>
                      {r.receipt_id} ({r.rail})
                    </th>
                    <td>
                      +${formatUsdc(r.amount)} from {r.payer_id.split('.')[0]}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

