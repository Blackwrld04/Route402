import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NearConnector } from '@hot-labs/near-connect';
import {
  FALLBACK_ONE_CLICK_TOKENS,
  HttpNearRpcProvider,
  OneClickClient,
  X402_HEADER_PAYMENT,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_RESPONSE,
  decodeX402ChallengeHeader,
  encodeX402Header,
  formatUsdc,
  verifyT2ShardedItem,
  type MarketListing,
  type Nep171Token,
  type OneClickQuoteResponse,
  type VaultSummary,
  type X402ChallengeBody,
} from '@route402/core';
import { CanvasGround } from './components/CanvasGround';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { TopNav } from './components/TopNav';
import { HeroSection } from './components/HeroSection';
import { PartnerLogos } from './components/PartnerLogos';
import { StatsRibbon } from './components/StatsRibbon';
import { ProtocolFeaturesTrio } from './components/ProtocolFeaturesTrio';
import { SecurityShowcase } from './components/SecurityShowcase';
import { MultiRailOrbit } from './components/MultiRailOrbit';
import { FaqSection } from './components/FaqSection';
import { CtaBanner } from './components/CtaBanner';
import { MintEndpointPanel } from './components/MintEndpointPanel';
import { LedgerAuditPanel } from './components/LedgerAuditPanel';
import { FooterSection } from './components/FooterSection';
import { NewsletterStrip } from './components/NewsletterStrip';
import { ToastNotice } from './components/ToastNotice';
import { INITIAL_ENTRIES } from './fallback-data';
import { TESTNET_DEPLOYMENT } from './testnet-manifest';
import { LiveConsolePage } from './pages/LiveConsolePage';
import type {
  DataSourceMode,
  EndpointEntry,
  Notice,
  OriginChainOption,
  WireExchangeLog,
} from './types';

const CHAINS: OriginChainOption[] = [
  { id: 'base', label: 'Base USDC' },
  { id: 'sol', label: 'Solana USDC' },
  { id: 'arb', label: 'Arbitrum USDC' },
  { id: 'eth', label: 'Ethereum USDC' },
];

export function App() {
  const [view, setView] = useState<'landing' | 'console'>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash === '#console' || window.location.pathname === '/console'
        ? 'console'
        : 'landing';
    }
    return 'landing';
  });

  const [sourceMode, setSourceMode] = useState<DataSourceMode>('sandbox');
  const [entries, setEntries] = useState<EndpointEntry[]>(INITIAL_ENTRIES);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [wireLog, setWireLog] = useState<WireExchangeLog | null>(null);
  const [originChain, setOriginChain] = useState<string>('base');
  const [quoteResult, setQuoteResult] = useState<{
    originChain: string;
    targetVault: string;
    quote: OneClickQuoteResponse;
    note?: string;
  } | null>(null);
  const [escrowBanner, setEscrowBanner] = useState<{
    kind: 'ok' | 'blocked';
    message: string;
  } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Mint form state
  const [mintSlug, setMintSlug] = useState('sentiment-feed');
  const [mintTitle, setMintTitle] = useState('Orderflow & Sentiment Oracle');
  const [mintCategory, setMintCategory] = useState('ai-service');
  const [mintUpstream, setMintUpstream] = useState('alpha-signal');
  const [mintPriceUsdc, setMintPriceUsdc] = useState('40000');

  // NEAR Wallet Connector
  const connectorRef = useRef<NearConnector | null>(null);
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const conn = new NearConnector({ network: 'testnet' });
      connectorRef.current = conn;
      conn
        .getConnectedWallet()
        .then(({ accounts }) => {
          if (accounts[0]?.accountId) {
            setWalletAccountId(accounts[0].accountId);
          }
        })
        .catch(() => {
          // Wallet uninitialized
        });
    } catch {
      // Wallet connector optional in headless environments
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleWalletToggle = async () => {
    const conn = connectorRef.current;
    if (!conn) return;
    if (walletAccountId) {
      await conn.disconnect();
      setWalletAccountId(null);
      return;
    }
    try {
      const wallet = await conn.connect();
      const accounts = await wallet.getAccounts();
      if (accounts[0]?.accountId) {
        setWalletAccountId(accounts[0].accountId);
      }
    } catch {
      setNotice({
        kind: 'info',
        message: 'Wallet connection was dismissed or is unavailable in this environment.',
      });
    }
  };

  const loadSandboxEndpoints = useCallback(async () => {
    const res = await fetch('/api/endpoints');
    if (!res.ok) {
      throw new Error(`Gateway /api/endpoints returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      endpoints: Array<{
        summary: VaultSummary;
        listing: MarketListing | null;
        t2: import('@route402/core').T2VerificationResult;
        accessKeyCount?: number | null;
      }>;
    };
    return data.endpoints.map((item) => ({
      ...item,
      // Read from the gateway (which queries the same provider that backs T2)
      // rather than assumed. `null` means "unknown", not "zero".
      accessKeyCount: item.accessKeyCount ?? null,
    }));
  }, []);

  const loadLiveTestnetEndpoints = useCallback(async (): Promise<EndpointEntry[]> => {
    const rpc = new HttpNearRpcProvider(TESTNET_DEPLOYMENT.rpcUrl);
    const finalBlock = await rpc.getFinalBlock();
    const [tokens, listings] = await Promise.all([
      rpc.viewAtBlock<Nep171Token[]>(
        TESTNET_DEPLOYMENT.registryId,
        'nft_tokens',
        { from_index: '0', limit: 30 },
        finalBlock.height,
      ),
      rpc.viewAtBlock<MarketListing[]>(
        TESTNET_DEPLOYMENT.registryId,
        'get_listings',
        {},
        finalBlock.height,
      ),
    ]);

    const tokenIds =
      tokens && tokens.length > 0
        ? tokens.map((t) => t.token_id)
        : TESTNET_DEPLOYMENT.seededEndpoints;

    const listingMap = new Map((listings ?? []).map((l) => [l.token_id, l]));

    const loaded = await Promise.all(
      tokenIds.map(async (id): Promise<EndpointEntry | null> => {
        const [summary, t2, keys] = await Promise.all([
          rpc.viewAtBlock<VaultSummary>(id, 'get_vault_summary', {}, finalBlock.height),
          verifyT2ShardedItem({
            provider: rpc,
            accountId: id,
            pinnedCollectionId: TESTNET_DEPLOYMENT.registryId,
            maxRetries: 1,
            // Pin every read to the SAME finalized block so the summary, the
            // T2 verdict and the listings shown in the console are one
            // coherent state rather than a mix of blocks.
            pinnedBlock: { height: finalBlock.height, hash: finalBlock.hash },
          }),
          rpc.viewAccessKeys(id).catch(() => null),
        ]);
        if (!summary) return null;
        return {
          summary,
          listing: listingMap.get(id) ?? null,
          t2,
          accessKeyCount: keys ? keys.length : null,
        };
      }),
    );

    return loaded.filter((x): x is EndpointEntry => x !== null);
  }, []);

  const modeRef = useRef<DataSourceMode>(sourceMode);
  const previousModeRef = useRef<DataSourceMode | null>(null);

  // Keep the ref in sync so in-flight loads can detect a mode switch.
  useEffect(() => {
    modeRef.current = sourceMode;
    if (previousModeRef.current !== null && previousModeRef.current !== sourceMode) {
      // Drop the previous mode's endpoints immediately so stale sandbox IDs are
      // never rendered under the Testnet label (or vice versa).
      setEntries([]);
      setSelectedId('');
    }
    previousModeRef.current = sourceMode;
  }, [sourceMode]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    const modeAtRequest = sourceMode;
    try {
      const next =
        modeAtRequest === 'sandbox'
          ? await loadSandboxEndpoints()
          : await loadLiveTestnetEndpoints();
      // Drop the response if the user switched mode while it was in flight —
      // otherwise the console would show the old mode's endpoints under the
      // new mode's label.
      if (modeRef.current !== modeAtRequest) return;
      setEntries(next);
      setSelectedId((prev) =>
        prev && next.some((e) => e.summary.token_id === prev)
          ? prev
          : (next[0]?.summary.token_id ?? ''),
      );
    } catch (err) {
      if (modeRef.current !== modeAtRequest) return;
      setEscrowBanner({
        kind: 'blocked',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (modeRef.current === modeAtRequest) setLoading(false);
    }
  }, [sourceMode, loadSandboxEndpoints, loadLiveTestnetEndpoints]);

  useEffect(() => {
    setEscrowBanner(null);
    setWireLog(null);
    setQuoteResult(null);
    setNotice(null);
    void refreshData();
  }, [refreshData]);

  const selected = useMemo(
    () => entries.find((e) => e.summary.token_id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId],
  );

  // Periodic background refresh for live testnet/sandbox state (silent background sync)
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshData();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshData]);
  const handleExecuteX402 = async () => {
    if (!selected) return;
    setBusyAction('x402');
    setEscrowBanner(null);
    try {
      const resource = `/x402/${selected.summary.token_id}/${selected.summary.upstream_slug}`;

      if (sourceMode === 'testnet') {
        const rpc = new HttpNearRpcProvider(TESTNET_DEPLOYMENT.rpcUrl);
        const t2 = await verifyT2ShardedItem({
          provider: rpc,
          accountId: selected.summary.token_id,
          pinnedCollectionId: TESTNET_DEPLOYMENT.registryId,
        });
        const challenge: X402ChallengeBody = {
          x402Version: 1,
          error:
            'HTTP 402 Payment Required — settle NEP-141 USDC on NEAR Testnet via ft_transfer_call to unlock resource',
          accepts: [
            {
              scheme: 'exact',
              network: 'near-testnet',
              maxAmountRequired: selected.summary.price_per_call_usdc,
              resource,
              description: `${selected.summary.title} (vault=${selected.summary.token_id})`,
              mimeType: 'application/json',
              payTo: selected.summary.token_id,
              maxTimeoutSeconds: 120,
              asset: selected.summary.usdc_contract_id,
            },
          ],
          t2Proof: t2,
        };
        setWireLog({
          timestamp: new Date().toISOString(),
          resource,
          challengeStatus: 402,
          challenge,
          paidStatus: 0,
          readOnly: true,
          paymentHeaderPreview: `Suggested CLI (not executed): near contract call-function as-transaction ${selected.summary.usdc_contract_id} ft_transfer_call json-args '{"receiver_id":"${selected.summary.token_id}","amount":"${selected.summary.price_per_call_usdc}","msg":"{\\"request_id\\":\\"live-cli-1\\"}"}' prepaid-gas '80.0 Tgas' attached-deposit '1 yoctoNEAR'`,
          responseBody: {
            preview: true,
            note: 'Read-only preview. No transaction was signed and no payment was submitted. The T2 proof and recent receipts below are live onchain state.',
            recentOnchainReceipts: selected.summary.recent_receipts,
          },
          receiptHeader: {
            preview: true,
            t2VerifiedOnTestnet: t2.ok,
            t2Verdict: t2.verdict,
            t2BlockHeight: t2.blockHeight,
            vaultUsdcBalance: selected.summary.vault_usdc_balance,
            beneficiaryOwner: selected.summary.owner_id,
          },
        });
        setNotice({
          kind: t2.ok ? 'info' : 'blocked',
          message: t2.ok
            ? `Read-only Testnet preview loaded (T2 ${t2.verdict} @ block #${t2.blockHeight}). No transaction was signed.`
            : `Read-only preview loaded, but T2 verification failed: ${t2.verdict}. No payment should be sent.`,
        });
        return;
      }

      // Sandbox Step 1: Unauthenticated call -> Receive real HTTP 402 challenge from gateway
      const res402 = await fetch(resource);
      const rawChallenge = res402.headers.get(X402_HEADER_PAYMENT_REQUIRED);
      const challenge: X402ChallengeBody = rawChallenge
        ? decodeX402ChallengeHeader(rawChallenge)
        : ((await res402.json()) as X402ChallengeBody);

      // Sandbox Step 2: Build X-PAYMENT header & retry -> Receive 200 OK + X-PAYMENT-RESPONSE
      const reqId = `ui-${Date.now()}`;
      const paymentHeader = encodeX402Header({
        x402Version: 1,
        scheme: 'exact',
        network: 'near-sandbox-demo',
        payload: {
          payerId: walletAccountId ?? 'agent-console.route402.testnet',
          requestId: reqId,
          amount: selected.summary.price_per_call_usdc,
          asset: selected.summary.usdc_contract_id,
          simulated: true,
        },
      });

      const res200 = await fetch(resource, {
        headers: {
          [X402_HEADER_PAYMENT]: paymentHeader,
        },
      });
      const body200 = await res200.json();
      const rawReceipt = res200.headers.get(X402_HEADER_PAYMENT_RESPONSE);
      const receiptHeader = rawReceipt
        ? (JSON.parse(atob(rawReceipt)) as Record<string, unknown>)
        : null;

      setWireLog({
        timestamp: new Date().toISOString(),
        resource,
        challengeStatus: res402.status,
        challenge,
        paidStatus: res200.status,
        readOnly: false,
        paymentHeaderPreview: `${paymentHeader.slice(0, 58)}...`,
        responseBody: body200,
        receiptHeader,
      });

      setNotice({
        kind: res200.ok ? 'ok' : 'blocked',
        message: res200.ok
          ? 'Sandbox payment simulated and upstream response received.'
          : `Gateway returned HTTP ${res200.status}.`,
      });
      await refreshData();
    } catch (err) {
      setNotice({
        kind: 'blocked',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Preview cross-chain NEAR Intents 1Click quote
  const handleQuoteOneClick = async () => {
    if (!selected) return;
    setBusyAction('1click');
    try {
      if (sourceMode === 'sandbox') {
        const res = await fetch('/api/quote-1click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointId: selected.summary.token_id,
            originChain,
            dry: true,
          }),
        });
        const data = (await res.json()) as {
          originChain: string;
          targetVaultRecipient: string;
          quote: OneClickQuoteResponse;
        };
        setQuoteResult({
          originChain: data.originChain,
          targetVault: data.targetVaultRecipient,
          quote: data.quote,
        });
      } else {
        const client = new OneClickClient('https://1click.chaindefuser.com');
        const originTok =
          FALLBACK_ONE_CLICK_TOKENS.find((t) => t.blockchain === originChain) ??
          FALLBACK_ONE_CLICK_TOKENS[2];
        const nearUsdc = FALLBACK_ONE_CLICK_TOKENS[0];
        const refundMap: Record<string, string> = {
          base: '0x1111111111111111111111111111111111111111',
          arb: '0x1111111111111111111111111111111111111111',
          eth: '0x1111111111111111111111111111111111111111',
          sol: '11111111111111111111111111111111',
        };
        const crossChainAmt = String(
          Math.max(Number(selected.summary.price_per_call_usdc), 250_000),
        );
        const quote = await client.requestQuote(
          {
            dry: true,
            swapType: 'EXACT_OUTPUT',
            slippageTolerance: 100,
            originAsset: originTok.assetId,
            depositType: 'ORIGIN_CHAIN',
            destinationAsset: nearUsdc.assetId,
            amount: crossChainAmt,
            refundTo: refundMap[originChain] ?? refundMap.base,
            refundType: 'ORIGIN_CHAIN',
            recipient: 'intents.near',
            recipientType: 'DESTINATION_CHAIN',
            deadline: new Date(Date.now() + 600_000).toISOString(),
          },
          true,
        );
        setQuoteResult({
          originChain,
          targetVault: selected.summary.token_id,
          quote,
          note: 'Dry quote uses intents.near as the mainnet recipient because .testnet vault IDs are not valid mainnet accounts.',
        });
      }
      setNotice({
        kind: 'info',
        message: '1Click dry quote preview loaded. No funds move in this step.',
      });
    } catch (err) {
      setNotice({
        kind: 'blocked',
        message: `1Click quote failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Sandbox Escrow & Security Actions
  const handleListForSale = async () => {
    if (!selected || sourceMode !== 'sandbox') return;
    setBusyAction('list');
    try {
      const res = await fetch('/api/demo/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: selected.summary.token_id,
          callerId: selected.summary.owner_id,
          salePriceYocto: '1500000000000000000000000',
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEscrowBanner({ kind: 'blocked', message: json.error ?? 'Failed to list' });
      } else {
        setEscrowBanner({
          kind: 'ok',
          message: `Vault ${selected.summary.token_id} frozen in escrow at state_nonce=${BigInt(selected.summary.state_nonce) + 1n}. Outflows locked; inbound x402 revenue remains open.`,
        });
      }
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleSellerDrainAttempt = async () => {
    if (!selected || sourceMode !== 'sandbox') return;
    setBusyAction('drain');
    try {
      const res = await fetch('/api/demo/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: selected.summary.token_id,
          callerId: selected.summary.owner_id,
          amountUsdc:
            BigInt(selected.summary.vault_usdc_balance) > 0n
              ? selected.summary.vault_usdc_balance
              : '50000',
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEscrowBanner({
          kind: 'blocked',
          message: json.error ?? 'Withdrawal blocked by Frozen status',
        });
      } else {
        setEscrowBanner({
          kind: 'ok',
          message: `Owner ${selected.summary.owner_id} withdrew $${formatUsdc(selected.summary.vault_usdc_balance)} USDC while Active.`,
        });
      }
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleAtomicBuy = async () => {
    if (!selected || !selected.listing || sourceMode !== 'sandbox') return;
    setBusyAction('buy');
    try {
      const buyer =
        selected.summary.owner_id === 'alice.route402.testnet'
          ? 'bob.route402.testnet'
          : 'alice.route402.testnet';
      const res = await fetch('/api/demo/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: selected.summary.token_id,
          buyerId: buyer,
          expectedStateNonce: selected.listing.listed_state_nonce,
          expectedRotationSeq: selected.listing.listed_rotation_seq,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        summary?: VaultSummary;
      };
      if (!res.ok) {
        setEscrowBanner({ kind: 'blocked', message: json.error ?? 'Purchase blocked' });
      } else {
        setEscrowBanner({
          kind: 'ok',
          message: `Atomic handover complete: owner rotated to ${buyer} (rotation_seq=${json.summary?.rotation_seq}). Full $${formatUsdc(json.summary?.vault_usdc_balance ?? '0')} USDC treasury transferred intact.`,
        });
      }
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleMintEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceMode !== 'sandbox') return;
    setBusyAction('mint');
    try {
      const res = await fetch('/api/demo/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: mintSlug,
          ownerId: walletAccountId ?? 'alice.route402.testnet',
          title: mintTitle,
          description: 'Keyless sharded-item-1.0.0 cash-flowing x402 API endpoint',
          category: mintCategory,
          upstreamSlug: mintUpstream,
          pricePerCallUsdc: mintPriceUsdc,
        }),
      });
      const json = (await res.json()) as { error?: string; summary?: VaultSummary };
      if (!res.ok) {
        setEscrowBanner({ kind: 'blocked', message: json.error ?? 'Mint failed' });
      } else if (json.summary) {
        setSelectedId(json.summary.token_id);
        setNotice({
          kind: 'ok',
          message: `Sandbox endpoint ${json.summary.token_id} minted. No real transaction was sent.`,
        });
        await refreshData();
      }
    } catch (err) {
      setNotice({
        kind: 'blocked',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHash = () => {
      setView(window.location.hash === '#console' ? 'console' : 'landing');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleLaunchConsole = () => {
    window.location.hash = '#console';
    setView('console');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleExitToLanding = () => {
    window.location.hash = '';
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (view === 'console') {
    return (
      <div className="app-shell console-page-shell">
        <LiveConsolePage
          entries={entries}
          selectedId={selectedId}
          selected={selected}
          loading={loading}
          sourceMode={sourceMode}
          busyAction={busyAction}
          originChain={originChain}
          chains={CHAINS}
          quoteResult={quoteResult}
          wireLog={wireLog}
          walletAccountId={walletAccountId}
          escrowBanner={escrowBanner}
          mintSlug={mintSlug}
          mintTitle={mintTitle}
          mintCategory={mintCategory}
          mintUpstream={mintUpstream}
          mintPriceUsdc={mintPriceUsdc}
          onSelectId={setSelectedId}
          onSelectMode={setSourceMode}
          onToggleWallet={() => void handleWalletToggle()}
          onRefresh={() => void refreshData()}
          onSelectOriginChain={setOriginChain}
          onExecuteX402={() => void handleExecuteX402()}
          onQuoteOneClick={() => void handleQuoteOneClick()}
          onListForSale={() => void handleListForSale()}
          onSellerDrainAttempt={() => void handleSellerDrainAttempt()}
          onAtomicBuy={() => void handleAtomicBuy()}
          onChangeSlug={setMintSlug}
          onChangeTitle={setMintTitle}
          onChangeCategory={setMintCategory}
          onChangeUpstream={setMintUpstream}
          onChangePriceUsdc={setMintPriceUsdc}
          onSubmitMint={(e) => void handleMintEndpoint(e)}
          onExitToLanding={handleExitToLanding}
        />
        <ToastNotice notice={notice} onDismiss={() => setNotice(null)} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <CanvasGround />

      {/* 1. Global Navigation Bar with Silent Background Sync Indicator */}
      <TopNav
        sourceMode={sourceMode}
        onSelectMode={setSourceMode}
        walletAccountId={walletAccountId}
        onToggleWallet={() => void handleWalletToggle()}
        onLaunchConsole={handleLaunchConsole}
        loading={loading}
      />

      {/* 2. Hero Section with Grand Editorial Serif & Floating Terminal Mockup (Image 1) */}
      <HeroSection
        entries={entries}
        selectedId={selectedId}
        selected={selected}
        loading={loading}
        sourceMode={sourceMode}
        busyAction={busyAction}
        originChain={originChain}
        chains={CHAINS}
        quoteResult={quoteResult}
        wireLog={wireLog}
        onSelectId={setSelectedId}
        onSelectOriginChain={setOriginChain}
        onExecuteX402={() => void handleExecuteX402()}
        onQuoteOneClick={() => void handleQuoteOneClick()}
        onScrollToSecurity={() => scrollToSection('security')}
        onLaunchConsole={handleLaunchConsole}
      />

      {/* 4. Ecosystem & Partner Logos Bar (Image 1 lower) */}
      <PartnerLogos />

      {/* 5. Stats Ribbon & Mid-Page Transition (Image 1 bottom) */}
      <StatsRibbon />

      {/* 6. Protocol Features Trio Cards (Image 2 top) */}
      <ProtocolFeaturesTrio />

      {/* 7. Asymmetric Security Invariants & Live Stress Test Terminal (Image 2 bottom) */}
      {selected && (
        <SecurityShowcase
          selected={selected}
          sourceMode={sourceMode}
          busyAction={busyAction}
          escrowBanner={escrowBanner}
          onListForSale={() => void handleListForSale()}
          onSellerDrainAttempt={() => void handleSellerDrainAttempt()}
          onAtomicBuy={() => void handleAtomicBuy()}
        />
      )}

      {/* 8. Multi-Rail & Orbital Currency Showcase (Image 3 top) */}
      <div id="multirail">
        <MultiRailOrbit onScrollToConsole={() => scrollToSection('top')} />
      </div>

      {/* 9. Single-Account Routing Topology & Architecture Flow */}
      <section id="architecture" className="section">
        <div className="wrap">
          <div className="section-head text-center">
            <span className="pill-outline">
              <span>NEP-591 Routing Architecture</span>
            </span>
            <h2 className="serif-display-title">
              One HTTP 402 Gateway. Three Sovereign Settlement Rails.
            </h2>
            <p className="section-desc">
              All payment rails resolve directly into the keyless sub-account vault with zero intermediary proxy fees.
            </p>
          </div>

          <ArchitectureDiagram
            selectedTokenId={selected?.summary.token_id ?? 'alpha-signal.route402.testnet'}
            ownerId={selected?.summary.owner_id ?? 'alice.route402.testnet'}
            rotationSeq={selected?.summary.rotation_seq ?? '0'}
            accessKeyCount={selected?.accessKeyCount ?? null}
          />
        </div>
      </section>

      {/* 10. Sharded Minting Terminal & Ownership Rotation Audit Ledger */}
      <section id="mint-section" className="section">
        <div className="wrap">
          <div className="section-head text-center">
            <span className="pill-outline">
              <span>Onchain Operations</span>
            </span>
            <h2 className="serif-display-title">
              Mint Sharded Endpoints &amp; Audit Ownership History
            </h2>
            <p className="section-desc">
              Deploy new keyless sub-accounts or audit historical transfers and settled micro-payments.
            </p>
          </div>

          <div className="split-2">
            <MintEndpointPanel
              sourceMode={sourceMode}
              busyAction={busyAction}
              mintSlug={mintSlug}
              mintTitle={mintTitle}
              mintCategory={mintCategory}
              mintUpstream={mintUpstream}
              mintPriceUsdc={mintPriceUsdc}
              onChangeSlug={setMintSlug}
              onChangeTitle={setMintTitle}
              onChangeCategory={setMintCategory}
              onChangeUpstream={setMintUpstream}
              onChangePriceUsdc={setMintPriceUsdc}
              onSubmitMint={(e) => void handleMintEndpoint(e)}
            />

            <LedgerAuditPanel selected={selected} />
          </div>
        </div>
      </section>

      {/* 11. FAQ Section with Illustrative Graph Visualizer (Image 3 bottom) */}
      <FaqSection />

      {/* 12. High-Impact Call-to-Action Banner (Image 4 top) */}
      <CtaBanner onScrollToMint={() => scrollToSection('mint-section')} />

      {/* 13. Developer Updates Strip (Image 4 middle) */}
      <NewsletterStrip />

      {/* 14. Luxury Multi-Column Footer with Giant Watermark (Image 4 bottom) */}
      <FooterSection />

      {/* Accessible Toast Alerts */}
      <ToastNotice notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}
