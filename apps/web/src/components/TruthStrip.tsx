import { RefreshCw } from 'lucide-react';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';
import type { DataSourceMode } from '../types';

interface TruthStripProps {
  sourceMode: DataSourceMode;
  loading: boolean;
  onRefresh: () => void;
}

export function TruthStrip({ sourceMode, loading, onRefresh }: TruthStripProps) {
  return (
    <div className="truth-strip">
      <div className="wrap truth-inner">
        <div>
          <span className={`status-dot ${sourceMode === 'sandbox' ? 'warn' : ''}`} />
          {sourceMode === 'sandbox' ? (
            <span>
              <strong>Simulated sandbox</strong> — in-memory NEAR state without keys. Switch to{' '}
              <strong>Live NEAR Testnet</strong> to read deployed contracts over RPC.
            </span>
          ) : (
            <span>
              <strong>Live NEAR Testnet RPC (read-only)</strong> — reading finalized state
              directly from <code>{TESTNET_DEPLOYMENT.registryId}</code> via{' '}
              <code>{TESTNET_DEPLOYMENT.rpcUrl}</code>. No signer loaded; read-only console.
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'spin' : undefined} />
          <span>{loading ? 'Refreshing…' : 'Refresh state'}</span>
        </button>
      </div>
    </div>
  );
}

