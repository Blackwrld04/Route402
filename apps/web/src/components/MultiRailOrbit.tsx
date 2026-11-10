import { ArrowDown, LayoutGrid, Layers } from 'lucide-react';
import { ChainIcon } from './ChainIcons';

export function MultiRailOrbit({ onScrollToConsole }: { onScrollToConsole: () => void }) {
  const rails = [
    { chain: 'base', name: 'Base USDC', offset: 16 },
    { chain: 'sol', name: 'Solana USDC', offset: 4 },
    { chain: 'near', name: 'NEAR USDC', offset: -8 },
    { chain: 'arb', name: 'Arbitrum USDC', offset: 4 },
    { chain: 'eth', name: 'Ethereum USDC', offset: 16 },
  ];

  return (
    <section className="section multirail-orbit-section">
      <div className="wrap text-center">
        {/* Curved Orbital Badges Arc (Matching Image 3 Top) */}
        <div className="orbit-tokens-row">
          {rails.map((r) => (
            <div
              key={r.chain}
              className="orbit-token-bubble"
              style={{ transform: `translateY(${r.offset}px)` }}
            >
              <ChainIcon chain={r.chain} size={20} />
              <span className="orbit-token-name">{r.name}</span>
            </div>
          ))}
        </div>

        {/* Section Pill Badge */}
        <div style={{ marginTop: 42 }}>
          <span className="pill-outline">
            <Layers size={13} style={{ color: 'var(--accent)' }} />
            <span>All Types of Settlement</span>
          </span>
        </div>

        {/* Serif Headline */}
        <h2 className="serif-display-title">
          Monetize Endpoints Across Every Asset Rail
        </h2>
        <p className="section-desc">
          Accept micro-payments natively in NEP-141 USDC, cross-chain through NEAR Intents 1Click,
          or in yoctoNEAR. Callers pay on the chain they already use.
        </p>

        {/* Action Button (Matching Image 3 Top "View more markets ⊞") */}
        <div style={{ marginTop: 28 }}>
          <button
            type="button"
            className="btn btn-dark-charcoal"
            onClick={onScrollToConsole}
          >
            <span>View supported rails</span>
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
