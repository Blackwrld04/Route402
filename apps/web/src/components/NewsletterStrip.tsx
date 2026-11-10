import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function NewsletterStrip() {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
  };

  return (
    <section className="section newsletter-section">
      <div className="wrap">
        <div className="newsletter-card">
          <div className="newsletter-text">
            <h3 className="newsletter-title">Get the update about Route402!</h3>
            <p className="newsletter-desc">
              Subscribe to our developer dispatch and never miss an opportunity to monetize or deploy endpoints.
            </p>
          </div>

          <div className="newsletter-action-wrap">
            {subscribed ? (
              <div className="newsletter-success">
                <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                <span>Thank you! You are subscribed to Route402 developer notices.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="newsletter-form">
                <div className="newsletter-input-group-cointrix">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="What's your email?"
                    required
                    className="newsletter-white-input"
                  />
                  <button type="submit" className="btn btn-dark-charcoal btn-subscribe-cointrix">
                    Subscribe
                  </button>
                </div>
                <label className="newsletter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    required
                  />
                  <span>I agree to the Terms &amp; privacy policy</span>
                </label>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
