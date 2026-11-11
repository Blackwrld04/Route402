import { ArrowUpRight } from 'lucide-react';
import { MountainBackdrop } from './MountainBackdrop';

export function CtaBanner({ onScrollToMint }: { onScrollToMint: () => void }) {
  return (
    <section className="section cta-banner-section">
      <div className="wrap">
        <div className="cta-banner-card">
          {/* Mountain Landscape Background Art (Exact Cointrix Image 4 Top) */}
          <MountainBackdrop className="cta-mountain-backdrop" height={380} showSky={true} />

          <div className="cta-banner-content" style={{ position: 'relative', zIndex: 2 }}>
            <h2 className="serif-display-title cta-title">
              Maximize Insights
              <br />
              Grow Sovereign Wealth
            </h2>
            <p className="cta-desc">
              Upgrade your API monetization strategy today. Track revenue, automate micro-payments, and make sovereign moves with our sharded Account-NFT architecture.
            </p>
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-dark-charcoal"
                onClick={onScrollToMint}
              >
                <span>Start Monetizing Now!</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          <div className="cta-banner-art" style={{ position: 'relative', zIndex: 2 }}>
            <div className="cta-art-window">
              <div className="cta-art-top-bar">
                <span className="dot dot-close" />
                <span className="dot dot-min" />
                <span className="dot dot-max" />
                <span className="cta-art-title num">alpha-signal.r402-reg-v1.testnet</span>
              </div>
              <div className="cta-art-body">
                <div className="cta-art-metric-row">
                  <span className="cta-art-label">Vault Treasury</span>
                  <strong className="num" style={{ color: 'var(--accent)' }}>NEP-141 USDC</strong>
                </div>
                <div className="cta-art-metric-row">
                  <span className="cta-art-label">Access Keys</span>
                  <span className="num">keys: [] (0 keys)</span>
                </div>
                <div className="cta-art-badge">
                  <span className="status-dot" />
                  <span>Zero Proxy Intermediary</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
