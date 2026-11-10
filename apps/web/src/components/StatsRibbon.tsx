import { Crown, Star, TrendingUp } from 'lucide-react';

export function StatsRibbon() {
  return (
    <section className="section stats-ribbon-section">
      <div className="wrap text-center">
        {/* Verification Pill */}
        <div>
          <span className="pill-outline">
            <span style={{ color: 'var(--accent)' }}>✓</span>
            <span>Formally verified on NEAR Testnet</span>
          </span>
        </div>

        {/* Serif Headline with Glyphs (Playfair Display) */}
        <h2 className="serif-display-title">
          Powering Sovereign <span className="title-glyph">✦</span> API Monetization For{' '}
          <span className="title-glyph">⤢</span> Autonomous Agents, Developers &amp; Protocol Treasuries
        </h2>

        {/* 3 Column Metric Counters with Vertical Dividers (Matching Image 1) */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrap">
              <Crown size={16} />
            </div>
            <div className="stat-number num">100%</div>
            <div className="stat-title">Keyless Sub-Accounts</div>
            <div className="stat-caption">
              Zero access keys (<code>keys: []</code>) governed strictly via NEP-591 global contracts.
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap">
              <TrendingUp size={16} />
            </div>
            <div className="stat-number num">3 Rails</div>
            <div className="stat-title">Multi-Rail Settlement</div>
            <div className="stat-caption">
              Direct NEP-141 USDC, cross-chain NEAR Intents 1Click, and native yoctoNEAR.
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap">
              <Star size={16} />
            </div>
            <div className="stat-number num">$0.00</div>
            <div className="stat-title">Intermediary Rent</div>
            <div className="stat-caption">
              All payment value settles directly into the Account-NFT&apos;s own balance. Zero proxy skimming.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
