import { useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Why sharded sub-accounts instead of a centralized escrow smart contract?',
    a: 'Centralized escrow contracts introduce platform risk, single points of failure, and rent-seeking fees. With NEP-591 and House of Stake sharded items, every endpoint is an autonomous NEAR account owned by the NFT holder. Inbound payment revenue accumulates directly inside the endpoint’s own treasury balance with zero proxy overhead.',
  },
  {
    q: 'How does Threat T-2 prevent sellers from draining the treasury mid-sale?',
    a: 'When an endpoint is listed for sale, the vault atomically transitions to Frozen. In this state, inbound HTTP 402 revenue keeps settling normally, but all outward withdrawals (ft_transfer) are rejected by the contract. The buyer is cryptographically guaranteed that the treasury balance cannot be drained while they inspect or purchase the listing.',
  },
  {
    q: 'How does cross-chain 1Click swap settle into a keyless NEAR account?',
    a: 'Through NEAR Intents 1Click, market-maker solvers observe the cross-chain deposit on Base, Solana, or Arbitrum, and front NEP-141 USDC directly into the target endpoint sub-account within ~4 seconds. The calling AI agent never needs a NEAR wallet or NEAR gas tokens.',
  },
  {
    q: 'What is NEP-591 and how does it enable Account-NFTs?',
    a: 'NEP-591 is the NEAR standard for Global Contracts. It allows a single registered contract to govern the execution logic of thousands of sub-accounts without deploying individual bytecode copies. This makes deploying fully functional sovereign sub-accounts extremely fast and cost-effective.',
  },
  {
    q: 'Can autonomous AI agents and MCP clients use Route402 without humans?',
    a: 'Yes. Route402 provides an official Model Context Protocol (MCP) server (@route402/agent-mcp) and standard HTTP 402 client. When an agent receives an HTTP 402 Payment Required response, it parses the challenge, provides the X-PAYMENT header, and receives the upstream data automatically.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section id="faq" className="section faq-section">
      <div className="wrap">
        <div className="faq-split">
          {/* Left: Graphic Visualizer Card with Floating White Tooltips (Image 3 style) */}
          <div className="faq-visualizer-card">
            <div className="faq-viz-header">
              <span className="pill-outline">
                <ShieldCheck size={12} style={{ color: 'var(--accent)' }} />
                <span>Onchain Telemetry</span>
              </span>
              <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Finalized Blocks
              </span>
            </div>

            {/* Visualizer Chart SVG */}
            <div className="faq-chart-wrap">
              <svg viewBox="0 0 400 230" width="100%" height="230" fill="none">
                {/* Grid guidelines */}
                <line x1="20" y1="50" x2="380" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="110" x2="380" y2="110" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="170" x2="380" y2="170" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                {/* Jagged / smooth telemetry curve matching Image 3 */}
                <path
                  d="M 20 190 L 70 170 L 110 185 L 150 130 L 190 145 L 240 85 L 280 110 L 330 65 L 380 40"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M 20 185 Q 90 160, 150 120 T 260 75 T 380 35"
                  stroke="#00EC97"
                  strokeWidth="2.2"
                  fill="none"
                />
                <circle cx="150" cy="120" r="4.5" fill="#00EC97" />
                <circle cx="260" cy="75" r="4.5" fill="#00EC97" />
                <circle cx="380" cy="35" r="5" fill="#00EC97" />
              </svg>

              {/* Floating Crisp White Tooltips (Exact Cointrix Image 3 Style) */}
              <div className="faq-floating-white-chip chip-top-left">
                <span className="white-chip-tag">RPC Verified</span>
                <div className="white-chip-val-row num">
                  <strong>#188420100</strong>
                  <span className="chip-delta-green">▲ 5.87%</span>
                </div>
              </div>

              <div className="faq-floating-white-chip chip-mid-right">
                <span className="white-chip-muted-date">10 Nov 2026</span>
                <span className="white-chip-main num">$0.70 USDC</span>
              </div>

              <div className="faq-floating-white-chip chip-bottom-mid">
                <span className="white-chip-tag">Zero Keys</span>
                <div className="white-chip-val-row num">
                  <strong>keys: []</strong>
                  <span className="chip-delta-green">▲ Valid</span>
                </div>
              </div>
            </div>

            <div className="faq-viz-footer">
              <span>Dual-RPC Invariant Engine</span>
              <span className="num" style={{ color: 'var(--accent)' }}>0.00ms latency</span>
            </div>
          </div>

          {/* Right: FAQ Accordion */}
          <div className="faq-accordion-wrap">
            <span className="pill-outline">
              <HelpCircle size={13} style={{ color: 'var(--accent)' }} />
              <span>FAQ</span>
            </span>
            <h2 className="serif-display-title" style={{ textAlign: 'left', margin: '16px 0 24px' }}>
              Frequently Asked Questions
            </h2>

            <div className="faq-list">
              {FAQS.map((faq, i) => {
                const isOpen = openIndex === i;
                return (
                  <div key={faq.q} className={`faq-row ${isOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="faq-question-btn"
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-q-text">{faq.q}</span>
                      <ChevronDown
                        size={16}
                        className={`faq-chevron ${isOpen ? 'rotate' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="faq-answer">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
