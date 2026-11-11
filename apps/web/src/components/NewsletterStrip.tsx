import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';

/**
 * Developer updates strip.
 *
 * This build has NO mailing-list backend, so this deliberately renders real
 * links instead of a subscribe form that would silently do nothing. It used to
 * show a fake "Thank you! You are subscribed" confirmation.
 */
export function NewsletterStrip() {
  return (
    <section className="section newsletter-section">
      <div className="wrap">
        <div className="newsletter-card">
          <div className="newsletter-text">
            <h3 className="newsletter-title">Developer updates</h3>
            <p className="newsletter-desc">
              Follow the live deployment and the verifier output. No mailing list is collected in
              this build.
            </p>
          </div>

          <div className="newsletter-action-wrap">
            <div className="newsletter-input-group-cointrix">
              <a
                href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-dark-charcoal"
              >
                <span>Live registry on NearBlocks</span>
                <ArrowUpRight size={14} />
              </a>
              <a
                href={`${TESTNET_DEPLOYMENT.explorerBaseUrl}/address/${TESTNET_DEPLOYMENT.registryId}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-dark-charcoal"
              >
                <span>Minted Account-NFTs</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
            <p className="newsletter-desc" style={{ fontSize: 11, marginTop: 10 }}>
              Run <code>npm run verify:testnet</code> for the zero-key onchain proof.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
