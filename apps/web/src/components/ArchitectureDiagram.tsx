export function ArchitectureDiagram({
  selectedTokenId,
  ownerId,
  rotationSeq,
  accessKeyCount,
}: {
  selectedTokenId: string;
  ownerId: string;
  rotationSeq: string;
  accessKeyCount: number | null;
}) {
  return (
    <>
    <div className="panel diagram-desktop" style={{ padding: '24px' }}>
      <svg
        viewBox="0 0 980 270"
        width="100%"
        role="img"
        aria-label="Route402 sharded Account-NFT settlement flow"
        style={{ display: 'block' }}
      >
        {/* Base connectors */}
        <path
          d="M 190 135 L 330 135"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 500 135 C 540 135, 540 58, 575 58"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 500 135 L 575 135"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 500 135 C 540 135, 540 212, 575 212"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 745 58 C 780 58, 780 135, 805 135"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 745 135 L 805 135"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 745 212 C 780 212, 780 135, 805 135"
          stroke="rgba(242,243,245,0.18)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Animated pulses */}
        <path
          className="pulse-line"
          d="M 190 135 L 330 135"
          stroke="#00EC97"
          strokeWidth="2"
          fill="none"
        />
        <path
          className="pulse-line"
          d="M 500 135 C 540 135, 540 58, 575 58 L 745 58 C 780 58, 780 135, 805 135"
          stroke="#00EC97"
          strokeWidth="2"
          fill="none"
        />
        <path
          className="pulse-line"
          d="M 500 135 L 805 135"
          stroke="#00EC97"
          strokeWidth="2"
          fill="none"
        />

        {/* Node 1: Caller Agent */}
        <rect
          x="16"
          y="93"
          width="174"
          height="84"
          rx="10"
          fill="#121418"
          stroke="rgba(242,243,245,0.22)"
        />
        <text x="32" y="122" fill="#F2F3F5" fontSize="13" fontWeight="600">
          AI agent or MCP client
        </text>
        <text x="32" y="143" fill="#A2A8B4" fontSize="11.5" fontFamily="JetBrains Mono, monospace">
          GET /x402/... -&gt; 402
        </text>
        <text x="32" y="161" fill="#8A92A2" fontSize="11">
          Retries with X-PAYMENT
        </text>

        {/* Node 2: Pinned-Block T2 Verifier */}
        <rect
          x="330"
          y="85"
          width="170"
          height="100"
          rx="10"
          fill="#121418"
          stroke="rgba(0,236,151,0.45)"
        />
        <text x="346" y="114" fill="#F2F3F5" fontSize="13" fontWeight="600">
          T2 pair verifier
        </text>
        <text x="346" y="135" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          nft_item_info() @ blk
        </text>
        <text x="346" y="153" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          nft_token(id)   @ blk
        </text>
        <text x="346" y="171" fill="#00EC97" fontSize="11" fontFamily="JetBrains Mono, monospace">
          seq={rotationSeq} verified
        </text>

        {/* Parallel Rail 1 */}
        <rect
          x="575"
          y="30"
          width="170"
          height="56"
          rx="8"
          fill="#171A20"
          stroke="rgba(242,243,245,0.16)"
        />
        <text x="590" y="54" fill="#F2F3F5" fontSize="12.5" fontWeight="600">
          NEP-141 USDC rail
        </text>
        <text x="590" y="72" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          ft_transfer_call
        </text>

        {/* Parallel Rail 2 */}
        <rect
          x="575"
          y="107"
          width="170"
          height="56"
          rx="8"
          fill="#171A20"
          stroke="rgba(242,243,245,0.16)"
        />
        <text x="590" y="131" fill="#F2F3F5" fontSize="12.5" fontWeight="600">
          NEAR Intents 1Click
        </text>
        <text x="590" y="149" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          Base / Sol / Arb -&gt; NEAR
        </text>

        {/* Parallel Rail 3 */}
        <rect
          x="575"
          y="184"
          width="170"
          height="56"
          rx="8"
          fill="#171A20"
          stroke="rgba(242,243,245,0.16)"
        />
        <text x="590" y="208" fill="#F2F3F5" fontSize="12.5" fontWeight="600">
          Native NEAR rail
        </text>
        <text x="590" y="226" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          pay_native_x402()
        </text>

        {/* Destination Node: Keyless Sharded Account-NFT */}
        <rect
          x="805"
          y="75"
          width="160"
          height="120"
          rx="10"
          fill="#121418"
          stroke="#00EC97"
          strokeWidth="1.5"
        />
        <text x="820" y="103" fill="#00EC97" fontSize="12" fontWeight="600">
          Keyless Account-NFT
        </text>
        <text x="820" y="123" fill="#F2F3F5" fontSize="11" fontFamily="JetBrains Mono, monospace">
          {selectedTokenId.split('.')[0]}.*
        </text>
        <text x="820" y="143" fill="#A2A8B4" fontSize="11" fontFamily="JetBrains Mono, monospace">
          keys: [] (NEP-591)
        </text>
        <text x="820" y="162" fill="#A2A8B4" fontSize="11">
          Owner: {ownerId.split('.')[0]}
        </text>
        <text x="820" y="180" fill="#8A92A2" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
          sharded-item-1.0.0
        </text>
      </svg>
    </div>

    <div className="panel diagram-mobile" style={{ padding: '18px' }}>
      <ol className="flow-list">
        <li className="flow-step">
          <span className="flow-kicker">1 · Request</span>
          <span className="flow-title">AI agent or MCP client</span>
          <code className="flow-code">GET /x402/... → 402</code>
          <code className="flow-code">Retries with X-PAYMENT</code>
        </li>
        <li className="flow-step">
          <span className="flow-kicker">2 · Verify</span>
          <span className="flow-title">Pinned-block T2 verifier</span>
          <code className="flow-code">nft_item_info() @ blk</code>
          <code className="flow-code">nft_token(id) @ blk</code>
          <code className="flow-code flow-ok">seq={rotationSeq} verified</code>
        </li>
        <li className="flow-step">
          <span className="flow-kicker">3 · Settle</span>
          <span className="flow-title">Three payment rails</span>
          <div className="flow-rails">
            <span className="flow-rail">
              <span>NEP-141 USDC</span>
              <code>ft_transfer_call</code>
            </span>
            <span className="flow-rail">
              <span>NEAR Intents 1Click</span>
              <code>Base / Sol / Arb → NEAR</code>
            </span>
            <span className="flow-rail">
              <span>Native NEAR</span>
              <code>pay_native_x402()</code>
            </span>
          </div>
        </li>
        <li className="flow-step">
          <span className="flow-kicker">4 · Own</span>
          <span className="flow-title">Keyless Account-NFT</span>
          <code className="flow-code flow-ok">{selectedTokenId.split('.')[0]}.*</code>
          <code className="flow-code">
            keys: {accessKeyCount === 0 ? '[]' : accessKeyCount === null ? '?' : accessKeyCount}{' '}
            (NEP-591)
          </code>
          <span className="flow-owner">Owner: {ownerId.split('.')[0]}</span>
          <code className="flow-code">sharded-item-1.0.0</code>
        </li>
      </ol>
    </div>
    </>
  );
}
