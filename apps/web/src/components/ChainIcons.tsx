export function Route402Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="#F2F3F5" strokeWidth="1.5" />
      <path
        d="M7 15.5L12 8.5L17 15.5"
        stroke="#00EC97"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15.5" r="2" fill="#00EC97" />
    </svg>
  );
}

export function ChainIcon({ chain, size = 16 }: { chain: string; size?: number }) {
  const c = chain.toLowerCase();
  if (c === 'near') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#00EC97" />
        <path
          d="M16.2 7.2L13.1 11.8C12.9 12.1 13.2 12.4 13.5 12.1L16.5 9.5V16.6C16.5 16.9 16.1 17.1 15.9 16.8L8.4 7.3C8.1 6.9 7.5 7.1 7.5 7.6V16.5C7.5 16.8 7.8 17 8.1 16.8L11.1 12.2"
          stroke="#061911"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (c === 'base') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#0052FF" />
        <path d="M12 17.5A5.5 5.5 0 1 0 12 6.5a5.5 5.5 0 0 0-5.4 4.5H14v2H6.6A5.5 5.5 0 0 0 12 17.5Z" fill="#FFF" />
      </svg>
    );
  }
  if (c === 'sol' || c === 'solana') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#141822" stroke="#14F195" strokeWidth="1.2" />
        <path d="M7 9h8.5L17 7.5H8.5L7 9Zm1.5 3.8H17L15.5 11.2H7l1.5 1.6ZM7 16.5h8.5L17 15H8.5L7 16.5Z" fill="#14F195" />
      </svg>
    );
  }
  if (c === 'arb' || c === 'arbitrum') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#28A0F0" />
        <path d="M10.2 7.5L6.8 16.2h2.2l3.4-8.7h-2.2Zm3.6 0l-2.1 5.4 1.1 3.3h2.1l1-2.8 1.2 2.8h2.1l-3.3-8.7h-2.1Z" fill="#FFF" />
      </svg>
    );
  }
  // Ethereum / default
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#627EEA" />
      <path d="M12 5.5L7.8 12.3L12 14.8L16.2 12.3L12 5.5Z" fill="#FFF" />
      <path d="M12 15.8L7.8 13.3L12 19L16.2 13.3L12 15.8Z" fill="#DCE4FF" />
    </svg>
  );
}
