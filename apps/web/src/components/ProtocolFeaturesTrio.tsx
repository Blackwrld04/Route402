import { ArrowUpRight, MousePointer2 } from 'lucide-react';
import { MountainBackdrop } from './MountainBackdrop';

export function ProtocolFeaturesTrio() {
  return (
    <section className="section protocol-trio-section">
      <div className="wrap">
        <div className="section-head text-center">
          <span className="pill-outline">
            <span style={{ color: 'var(--accent)' }}>✦</span>
            <span>New Protocol Features</span>
          </span>
          <h2 className="serif-display-title">
            Revolutionize your API monetization with Account-NFTs
          </h2>
          <p className="section-desc">
            Leverage single-account sharding and predictive cryptographic invariants to monetize your APIs.
          </p>
        </div>

        <div className="trio-cards">
          {/* Card 1: Sub-Account Sovereignty (Floating White Card like Image 2 Card 1) */}
          <div className="trio-card">
            <div className="trio-card-preview">
              <MountainBackdrop className="card-mountain-backdrop" height={270} showSky={true} />
              
              <div className="floating-white-card">
                <div className="white-card-tag-green">
                  <span>✦ AI Suggestion</span>
                </div>
                <div className="white-card-body-text">
                  Auto-route 15% of endpoint cashflow to liquid staking pools to maximize treasury return.
                </div>
                <div className="white-card-action-row">
                  <span className="white-card-sub-muted">Balance sovereign vault</span>
                  <div className="white-card-dark-pill">
                    <span>View More</span>
                    <ArrowUpRight size={11} />
                    <MousePointer2 size={12} className="pointer-cursor-icon" />
                  </div>
                </div>
              </div>
            </div>
            <div className="trio-card-content">
              <h3 className="trio-card-title">Keyless Sub-Account Sovereignty</h3>
              <p className="trio-card-desc">
                Endpoints exist as first-class NEAR accounts without proxy indirection. Direct <code>ft_on_transfer</code> hooks receive payments with zero intermediary risk.
              </p>
            </div>
          </div>

          {/* Card 2: Threat T-2 Anti-Drain (Floating Circular Donut Gauge like Image 2 Card 2) */}
          <div className="trio-card">
            <div className="trio-card-preview">
              <MountainBackdrop className="card-mountain-backdrop" height={270} showSky={true} />
              
              <div className="floating-white-card">
                <div className="donut-meter-wrap">
                  <svg viewBox="0 0 100 100" width="80" height="80">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#eaecf0"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#00EC97"
                      strokeWidth="10"
                      strokeDasharray="238"
                      strokeDashoffset="60"
                      strokeLinecap="round"
                      fill="none"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="donut-center-text">
                    <span className="donut-num num">0</span>
                    <span className="donut-sub">Keys</span>
                  </div>
                </div>
                <div className="donut-legend-row">
                  <div className="legend-chip">
                    <span className="legend-dot dot-green" />
                    <span>Sovereign</span>
                  </div>
                  <div className="legend-chip">
                    <span className="legend-dot dot-amber" />
                    <span>Escrowed</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="trio-card-content">
              <h3 className="trio-card-title">Atomic Escrow &amp; Anti-Drain Freeze</h3>
              <p className="trio-card-desc">
                Sub-accounts freeze automatically upon marketplace listing. Outflows are cryptographically blocked so sellers cannot drain accrued treasury while a buyer evaluates the deal.
              </p>
            </div>
          </div>

          {/* Card 3: Cross-Chain 1Click (Floating Asset List like Image 2 Card 3) */}
          <div className="trio-card">
            <div className="trio-card-preview">
              <MountainBackdrop className="card-mountain-backdrop" height={270} showSky={true} />
              
              <div className="floating-white-card">
                <div className="white-asset-row">
                  <div className="asset-left">
                    <span className="token-dot-blue" />
                    <span className="asset-name">Base USDC</span>
                  </div>
                  <div className="asset-right num">
                    <span>$0.0400</span>
                    <span className="asset-delta-green">▲ 1.4%</span>
                  </div>
                </div>

                <div className="white-asset-row">
                  <div className="asset-left">
                    <span className="token-dot-purple" />
                    <span className="asset-name">Solana USDC</span>
                  </div>
                  <div className="asset-right num">
                    <span>$0.0400</span>
                    <span className="asset-delta-green">▲ 2.1%</span>
                  </div>
                </div>

                <div className="white-asset-row active-highlight">
                  <div className="asset-left">
                    <span className="token-dot-green" />
                    <span className="asset-name">NEAR USDC</span>
                  </div>
                  <div className="asset-right num">
                    <span>$0.0400</span>
                    <span className="asset-instant-tag">Instant</span>
                    <MousePointer2 size={12} className="pointer-cursor-icon-static" />
                  </div>
                </div>
              </div>
            </div>
            <div className="trio-card-content">
              <h3 className="trio-card-title">Universal Cross-Chain Settlement</h3>
              <p className="trio-card-desc">
                Any agent on Base, Solana, or Arbitrum pays via NEAR Intents 1Click. Solvers front the NEAR USDC immediately; the caller never needs a NEAR wallet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
