import { ChainIcon } from './ChainIcons';

export function PartnerLogos() {
  const partners = [
    { name: 'NEAR Protocol', tag: 'NEP-591 & NEP-171', icon: 'near' },
    { name: 'House of Stake', tag: 'sharded-item-1.0.0', icon: 'near' },
    { name: 'NEAR Intents', tag: '1Click Defusion', icon: 'near' },
    { name: 'Base', tag: 'USDC Settlement', icon: 'base' },
    { name: 'Solana', tag: '1Click Payer Rail', icon: 'sol' },
    { name: 'Arbitrum', tag: 'Arbitrum One USDC', icon: 'arb' },
    { name: 'Ethereum', tag: 'ERC-20 Inflows', icon: 'eth' },
  ];

  return (
    <section className="partner-bar">
      <div className="wrap partner-inner">
        {partners.map((p) => (
          <div key={p.name} className="partner-item">
            <ChainIcon chain={p.icon} size={15} />
            <span className="partner-name">{p.name}</span>
            <span className="partner-tag">{p.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

