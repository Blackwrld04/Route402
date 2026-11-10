import { Wallet } from 'lucide-react';
import { Route402Mark } from './ChainIcons';
import type { DataSourceMode } from '../types';

interface TopNavProps {
  sourceMode: DataSourceMode;
  onSelectMode: (mode: DataSourceMode) => void;
  walletAccountId: string | null;
  onToggleWallet: () => void;
}

export function TopNav({
  sourceMode,
  onSelectMode,
  walletAccountId,
  onToggleWallet,
}: TopNavProps) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <a href="#top" className="brand">
          <Route402Mark size={24} />
          <span className="brand-name">Route402</span>
          <span className="brand-sub">x402 · NEP-591</span>
        </a>

        {/* Center Nav Links */}
        <nav className="topbar-nav" aria-label="Main Navigation">
          <a href="#top" className="nav-link">
            Endpoints
          </a>
          <a href="#security" className="nav-link">
            Security (T-2)
          </a>
          <a href="#multirail" className="nav-link">
            Multi-Rail
          </a>
          <a href="#architecture" className="nav-link">
            Architecture
          </a>
          <a href="#faq" className="nav-link">
            FAQ
          </a>
          <a href="#mint-section" className="nav-link">
            Mint
          </a>
        </nav>

        <div className="nav-actions">
          <div className="mode-switch" role="group" aria-label="Execution mode">
            <button
              type="button"
              className={`mode-btn ${sourceMode === 'sandbox' ? 'active' : ''}`}
              aria-pressed={sourceMode === 'sandbox'}
              onClick={() => onSelectMode('sandbox')}
            >
              Sandbox<span className="mode-long"> (simulated)</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${sourceMode === 'testnet' ? 'active' : ''}`}
              aria-pressed={sourceMode === 'testnet'}
              onClick={() => onSelectMode('testnet')}
            >
              <span className="mode-long">Live NEAR </span>Testnet
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-wallet"
            title={walletAccountId ? `Connected as ${walletAccountId}` : 'Connect a NEAR wallet'}
            aria-label={
              walletAccountId
                ? `Connected as ${walletAccountId}. Click to disconnect.`
                : 'Connect a NEAR wallet'
            }
            onClick={onToggleWallet}
          >
            <Wallet size={14} />
            <span className="wallet-label">{walletAccountId ? walletAccountId : 'Connect wallet'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
