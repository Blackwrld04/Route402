import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { TESTNET_DEPLOYMENT } from '../testnet-manifest';
import type { DataSourceMode } from '../types';

interface MintEndpointPanelProps {
  sourceMode: DataSourceMode;
  busyAction: string | null;
  mintSlug: string;
  mintTitle: string;
  mintCategory: string;
  mintUpstream: string;
  mintPriceUsdc: string;
  onChangeSlug: (v: string) => void;
  onChangeTitle: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onChangeUpstream: (v: string) => void;
  onChangePriceUsdc: (v: string) => void;
  onSubmitMint: (e: React.FormEvent) => void;
}

export function MintEndpointPanel({
  sourceMode,
  busyAction,
  mintSlug,
  mintTitle,
  mintCategory,
  mintUpstream,
  mintPriceUsdc,
  onChangeSlug,
  onChangeTitle,
  onChangeCategory,
  onChangeUpstream,
  onChangePriceUsdc,
  onSubmitMint,
}: MintEndpointPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">
          <Plus size={16} />
          <span>Mint new sharded endpoint NFT</span>
        </h3>
        <span className="pill neutral">
          {sourceMode === 'sandbox' ? 'Interactive sandbox' : 'Testnet CLI generator'}
        </span>
      </div>
      <div className="panel-body">
        <form onSubmit={onSubmitMint} className="form-flex">
          <div className="field">
            <label htmlFor="slug">Sub-account slug</label>
            <input
              id="slug"
              type="text"
              value={mintSlug}
              onChange={(e) => onChangeSlug(e.target.value)}
              placeholder="sentiment-feed"
              pattern="[a-z0-9_-]+"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="price">Price per call (micro-USDC)</label>
            <input
              id="price"
              type="text"
              value={mintPriceUsdc}
              onChange={(e) => onChangePriceUsdc(e.target.value)}
              placeholder="40000 (= $0.04)"
              required
            />
          </div>
          <div className="field full">
            <label htmlFor="title">Display title</label>
            <input
              id="title"
              type="text"
              value={mintTitle}
              onChange={(e) => onChangeTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select
              id="cat"
              value={mintCategory}
              onChange={(e) => onChangeCategory(e.target.value)}
            >
              <option value="ai-service">AI / TEE inference</option>
              <option value="defi-oracle">DeFi / Intents oracle</option>
              <option value="analytics">Onchain analytics</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="upstream">Upstream handler</label>
            <select
              id="upstream"
              value={mintUpstream}
              onChange={(e) => onChangeUpstream(e.target.value)}
            >
              <option value="alpha-signal">alpha-signal (Intents spread)</option>
              <option value="tee-auditor">tee-auditor (NEAR AI TEE)</option>
              <option value="whale-pulse">whale-pulse (Corridor flow)</option>
            </select>
          </div>
          <div className="field full">
            {sourceMode === 'sandbox' ? (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busyAction !== null}
              >
                {busyAction === 'mint' ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <Plus size={15} />
                )}
                <span>
                  {busyAction === 'mint'
                    ? 'Minting in sandbox…'
                    : `Mint ${mintSlug}.r402-reg-v1.testnet`}
                </span>
              </button>
            ) : (
              <div className="wire-box">
                <div className="wire-box-head">
                  <span>Live NEAR Testnet CLI mint command</span>
                </div>
                <pre className="wire-pre">
                  {`near contract call-function as-transaction ${TESTNET_DEPLOYMENT.registryId} mint_endpoint json-args '{"slug":"${mintSlug}","title":"${mintTitle}","description":"Cash-flowing x402 API","category":"${mintCategory}","upstream_slug":"${mintUpstream}","price_per_call_usdc":"${mintPriceUsdc}","price_per_call_yocto":"10000000000000000000000"}' prepaid-gas '150.0 Tgas' attached-deposit '0.25 NEAR'`}
                </pre>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
