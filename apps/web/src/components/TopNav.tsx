import { Terminal, Wallet } from 'lucide-react';
import { Route402Mark } from './ChainIcons';
import type { DataSourceMode } from '../types';

interface TopNavProps {
  sourceMode: DataSourceMode;
  onSelectMode: (mode: DataSourceMode) => void;
  walletAccountId: string | null;
  onToggleWallet: () => void;
  onLaunchConsole: () => void;
}

export function TopNav({
  sourceMode,
  onSelectMode,
  walletAccountId,
  onToggleWallet,
  onLaunchConsole,
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
          <button
            type="button"
            className="nav-link nav-btn-link"
            onClick={onLaunchConsole}
          >
            Live Console ⚡
          </button>
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
          <button
            type="button"
            className="btn btn-sm btn-dark-charcoal nav-console-cta"
            onClick={onLaunchConsole}
          >
            <Terminal size={12} />
            <span>Launch Console</span>
          </button>

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
                : 'Connect NEAR wallet'
            }
            onClick={onToggleWallet}
          >
            <Wallet size={14} />
            <span className="num">
              {walletAccountId
                ? walletAccountId.length > 18
                  ? `${walletAccountId.slice(0, 8)}…${walletAccountId.slice(-6)}`
                  : walletAccountId
                : 'Connect wallet'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
