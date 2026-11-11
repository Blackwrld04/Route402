import { ArrowUpRight, Globe } from 'lucide-react';
import { Route402Mark } from './ChainIcons';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';

export function FooterSection() {
  return (
    <footer className="footer-luxury">
      <div className="wrap">
        <div className="footer-columns-grid">
          {/* Column 1: Monetization */}
          <div className="footer-col">
            <h4 className="footer-col-title">Monetization</h4>
            <ul className="footer-links">
              <li>
                <a href="#top">Sharded Endpoint NFTs</a>
              </li>
              <li>
                <a href="#top">Cash-Flowing x402</a>
              </li>
              <li>
                <a href="#top">Treasury Handover</a>
              </li>
              <li>
                <a href="#security">Atomic Escrow Freeze</a>
              </li>
              <li>
                <a href="#mint-section">Minting Sub-Accounts</a>
              </li>
            </ul>
          </div>

          {/* Column 2: Settlement Rails */}
          <div className="footer-col">
            <h4 className="footer-col-title">Settlement Rails</h4>
            <ul className="footer-links">
              <li>
                <a href="#top">NEP-141 USDC ft_transfer_call</a>
              </li>
              <li>
                <a href="#top">NEAR Intents 1Click Defusion</a>
              </li>
              <li>
                <a href="#top">Native yoctoNEAR Rail</a>
              </li>
              <li>
                <a href="#multirail">Base &amp; Solana Corridors</a>
              </li>
              <li>
                <a href="#multirail">Arbitrum Settlement</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Protocol & Trust */}
          <div className="footer-col">
            <h4 className="footer-col-title">Protocol &amp; Trust</h4>
            <ul className="footer-links">
              <li>
                <a href="#security">NEP-591 Global Contracts</a>
              </li>
              <li>
                <a href="#security">sharded-item-1.0.0 Standard</a>
              </li>
              <li>
                <a href="#security">Threat Model (T-1 to T-6)</a>
              </li>
              <li>
                <a href="#security">Dual-RPC Proof Verification</a>
              </li>
              <li>
                <a
                  href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  NearBlocks Contract Explorer
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Brand & Social */}
          <div className="footer-brand-col">
            <div className="footer-brand-row">
              <Route402Mark size={22} />
              <span className="brand-name">Route402</span>
            </div>
            <p className="footer-bio">
              Open-source x402 gateway and sharded Account-NFT registry for cash-flowing NEAR
              endpoints. Read-only Testnet preview by default; no signer is loaded.
            </p>
            <div className="footer-social-row">
              <a
                href="https://near.org"
                target="_blank"
                rel="noreferrer"
                className="footer-social-btn"
                aria-label="NEAR Ecosystem"
              >
                <Globe size={15} />
              </a>
              <a
                href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                target="_blank"
                rel="noreferrer"
                className="footer-social-btn"
                aria-label="Explorer"
              >
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Strip (Matching Image 4: Copyright on left, Year on right) */}
        <div className="footer-bottom-strip">
          <span>© Route402 Copyrights</span>
          <span className="num">2026</span>
        </div>
      </div>

      {/* Massive Watermark Word (Exact Cointrix Image 4 Style) */}
      <div className="footer-giant-watermark" aria-hidden="true">
        Route402
      </div>
    </footer>
  );
}
