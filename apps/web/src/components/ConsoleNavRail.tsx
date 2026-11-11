import { useCallback, useMemo } from 'react';
import { Activity, Compass, Database, Layers, Users } from 'lucide-react';
import type { EndpointEntry } from '../types';

/**
 * Left-rail scopes. Each one is a filter over the LIVE endpoint list, so the
 * counts shown next to every item are derived from real gateway / RPC state
 * rather than being decorative.
 */
export type NavScope = 'explore' | 'marketplace' | 'vaults' | 'activity' | 'community';

export const NAV_ITEMS: Array<{
  id: NavScope;
  label: string;
  icon: typeof Compass;
  title: string;
}> = [
  {
    id: 'explore',
    label: 'Explore',
    icon: Compass,
    title: 'All sharded endpoints in the pinned registry',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: Database,
    title: 'Endpoints currently listed in atomic escrow (Frozen)',
  },
  {
    id: 'vaults',
    label: 'My Vaults',
    icon: Layers,
    title: 'Endpoints owned by the connected NEAR wallet',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    title: 'Endpoints with settled x402 calls',
  },
  {
    id: 'community',
    label: 'Community',
    icon: Users,
    title: 'Endpoints with shared ownership history (rotation_seq > 0)',
  },
];

/**
 * Shared scope logic for the left rail. Used by both the full-screen console
 * and the landing-page console preview so the two never drift apart.
 */
export function useNavScope(
  entries: EndpointEntry[],
  walletAccountId: string | null,
  scope: NavScope,
) {
  /**
   * Per-scope endpoint counts, derived from live state. `My Vaults` is only
   * meaningful once a wallet is connected, so it reports the connected
   * account's endpoints and shows `null` ("—") when there is no wallet.
   */
  const counts = useMemo(
    () => ({
      explore: entries.length,
      marketplace: entries.filter((e) => e.listing !== null).length,
      vaults: walletAccountId
        ? entries.filter((e) => e.summary.owner_id === walletAccountId).length
        : null,
      activity: entries.filter((e) => Number(e.summary.total_calls) > 0).length,
      community: entries.filter((e) => Number(e.summary.rotation_seq) > 0).length,
    }),
    [entries, walletAccountId],
  );

  const matches = useCallback(
    (entry: EndpointEntry): boolean => {
      switch (scope) {
        case 'explore':
          return true;
        case 'marketplace':
          return entry.listing !== null;
        case 'vaults':
          return walletAccountId !== null && entry.summary.owner_id === walletAccountId;
        case 'activity':
          return Number(entry.summary.total_calls) > 0;
        case 'community':
          return Number(entry.summary.rotation_seq) > 0;
      }
    },
    [scope, walletAccountId],
  );

  return { counts, matches };
}

interface ConsoleNavRailProps {
  entries: EndpointEntry[];
  walletAccountId: string | null;
  scope: NavScope;
  onScopeChange: (scope: NavScope) => void;
  className?: string;
  itemClassName?: string;
}

/**
 * The left rail navigation shared by the full-screen console and the landing
 * page console preview.
 */
export function ConsoleNavRail({
  entries,
  walletAccountId,
  scope,
  onScopeChange,
  className = 'console-nav-group',
  itemClassName = 'console-nav-item',
}: ConsoleNavRailProps) {
  const { counts } = useNavScope(entries, walletAccountId, scope);

  return (
    <nav className={className} aria-label="Console sections">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const count = counts[item.id];
        return (
          <button
            key={item.id}
            type="button"
            className={`${itemClassName} ${scope === item.id ? 'active' : ''}`}
            onClick={() => onScopeChange(item.id)}
            title={item.title}
            aria-current={scope === item.id ? 'page' : undefined}
          >
            <Icon size={15} />
            <span className="console-nav-label">{item.label}</span>
            <span className="console-nav-count num">{count === null ? '—' : count}</span>
          </button>
        );
      })}
    </nav>
  );
}
