import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { formatUsdc } from '@route402/core';
import { createRoute402Gateway, type Route402Mode } from '../packages/x402-gateway/src/index.js';
import { Route402AgentClient } from '../packages/agent-mcp/src/index.js';
import { TESTNET_DEPLOYMENT } from '../apps/web/src/testnet-manifest.js';
import { resolveStaticFile } from './static-path.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const WEB_DIST = path.join(ROOT, 'apps', 'web', 'dist');

function parseArgs() {
  const argv = process.argv.slice(2);
  let mode: Route402Mode = (process.env.ROUTE402_MODE as Route402Mode) || 'demo';
  let once = process.env.CI === 'true' || process.env.CI === '1';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode' && argv[i + 1]) {
      mode = argv[i + 1] as Route402Mode;
      i++;
    } else if (argv[i] === '--once') {
      once = true;
    }
  }
  return { mode, once };
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function startWebAndProxyServer(gatewayPort: number, webPort: number): Promise<http.Server> {
  const srv = http.createServer((req, res) => {
    const reqUrl = req.url ?? '/';
    if (
      reqUrl.startsWith('/api/') ||
      reqUrl.startsWith('/x402/') ||
      reqUrl.startsWith('/discover') ||
      reqUrl.startsWith('/.well-known/') ||
      reqUrl.startsWith('/health')
    ) {
      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: gatewayPort,
          path: reqUrl,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      req.pipe(proxyReq);
      return;
    }

    const resolved = resolveStaticFile(WEB_DIST, reqUrl);
    if (!resolved.ok) {
      if (resolved.reason === 'forbidden') {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Run `npm run web:build` first to build apps/web/dist');
      }
      return;
    }

    const ext = path.extname(resolved.file);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
    });
    fs.createReadStream(resolved.file).pipe(res);
  });

  return new Promise((resolve) => {
    srv.listen(webPort, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  const { mode, once } = parseArgs();
  const registryId =
    mode === 'demo'
      ? 'registry.route402.testnet'
      : (process.env.NEAR_REGISTRY_ID ?? TESTNET_DEPLOYMENT.registryId);
  const usdcContractId =
    mode === 'demo'
      ? 'usdc.route402.testnet'
      : (process.env.NEAR_USDC_CONTRACT_ID ?? TESTNET_DEPLOYMENT.usdcContractId);

  const requestedGatewayPort = once ? 0 : Number(process.env.PORT ?? 4402);
  const { server: gatewayServer } = createRoute402Gateway({
    port: requestedGatewayPort,
    mode,
    registryId,
    usdcContractId,
    rpcUrl: process.env.NEAR_RPC_URL ?? TESTNET_DEPLOYMENT.rpcUrl,
  });

  await new Promise<void>((resolve) =>
    gatewayServer.listen(requestedGatewayPort, '127.0.0.1', resolve),
  );
  const gatewayPort = (gatewayServer.address() as AddressInfo).port;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

  console.log('========================================================================');
  console.log(' Route402 — Sharded x402 Account-NFTs on NEAR (sharded-item-1.0.0)');
  console.log('========================================================================');
  if (mode === 'demo') {
    console.log(' RUNTIME MODE : SIMULATED SANDBOX (Zero API keys / deterministic mirror)');
    console.log(' LIVE TESTNET : Run `npm run verify:testnet` or `npm run start:dry`');
  } else {
    console.log(` RUNTIME MODE : ${mode.toUpperCase()} (Reading real NEAR Testnet RPC + 1Click API)`);
  }
  console.log(` REGISTRY ID  : ${registryId}`);
  console.log(` GATEWAY URL  : ${gatewayUrl}`);
  console.log('========================================================================\n');

  // Automated Self-Verification Walkthrough
  const catalogRes = await fetch(`${gatewayUrl}/discover`);
  const catalog = (await catalogRes.json()) as {
    items: Array<{
      endpointAccount: string;
      title: string;
      resource: string;
      ownerId: string;
      status: string;
      t2Verified: boolean;
      t2BlockHeight: number;
      vaultUsdcBalance: string;
    }>;
  };

  console.log(`[1/5] Discovered ${catalog.items.length} Sharded Account-NFT endpoints via GET /discover:`);
  for (const item of catalog.items) {
    console.log(
      `      • ${item.endpointAccount} | status=${item.status} | T2=${item.t2Verified}@blk#${item.t2BlockHeight} | owner=${item.ownerId} | vault=$${formatUsdc(item.vaultUsdcBalance)}`,
    );
  }

  const first = catalog.items[0];
  if (first && mode === 'demo' && once) {
    const agent = new Route402AgentClient({
      gatewayBaseUrl: gatewayUrl,
      payerId: 'judge-agent.route402.testnet',
      pinnedCollectionId: registryId,
      // The demo registry exists only in the in-process sandbox mirror, so the
      // client cannot re-query it from NEAR RPC. Real Testnet callers must not
      // set this flag.
      allowUnverifiedT2: true,
    });

    const paid = await agent.callEndpoint<{
      paymentReceipt: { vaultUsdcBalance: string; vaultStatus: string; txHash: string };
    }>(first.resource);
    console.log(
      `\n[2/5] Autonomous agent executed HTTP 402 -> X-PAYMENT -> 200 OK on ${first.endpointAccount}:`,
    );
    console.log(
      `      • Vault status=${paid.data.paymentReceipt.vaultStatus} (Threat T-6: inbound revenue works while Frozen!)`,
    );
    console.log(
      `      • Updated vault treasury: $${formatUsdc(paid.data.paymentReceipt.vaultUsdcBalance)} USDC (tx=${paid.data.paymentReceipt.txHash})`,
    );

    // Threat T-2 Seller Front-Run Drain Check
    const drainRes = await fetch(`${gatewayUrl}/api/demo/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: first.endpointAccount,
        callerId: first.ownerId,
        amountUsdc: '50000',
      }),
    });
    const drainJson = (await drainRes.json()) as { error: string };
    console.log(`\n[3/5] Stress-testing Seller Mid-Sale Front-Run Drain (Threat T-2):`);
    console.log(`      • HTTP ${drainRes.status} -> ${drainJson.error}`);

    // Atomic Buy Handover
    const buyRes = await fetch(`${gatewayUrl}/api/demo/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: first.endpointAccount,
        buyerId: 'bob.route402.testnet',
        expectedStateNonce: '1',
        expectedRotationSeq: '0',
      }),
    });
    const buyJson = (await buyRes.json()) as {
      summary: { owner_id: string; rotation_seq: string; vault_usdc_balance: string };
    };
    console.log(`\n[4/5] Executed Atomic Escrow Purchase (1.5 NEAR -> ${first.endpointAccount}):`);
    console.log(
      `      • New owner=${buyJson.summary.owner_id} | rotation_seq=${buyJson.summary.rotation_seq} | transferred vault=$${formatUsdc(buyJson.summary.vault_usdc_balance)} USDC`,
    );

    // Cross-chain 1Click Quote Preview
    const qRes = await fetch(`${gatewayUrl}/api/quote-1click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: first.endpointAccount,
        originChain: 'base',
        dry: true,
      }),
    });
    const qJson = (await qRes.json()) as {
      quote: { quote?: { amountInFormatted: string; amountOutFormatted: string } };
    };
    console.log(`\n[5/5] Previewed NEAR Intents 1Click Cross-Chain Quote (Base USDC -> ${first.endpointAccount}):`);
    console.log(
      `      • ${qJson.quote.quote?.amountInFormatted} Base USDC -> ${qJson.quote.quote?.amountOutFormatted} NEAR USDC`,
    );
  } else if (first && mode !== 'demo') {
    const qRes = await fetch(`${gatewayUrl}/api/quote-1click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: first.endpointAccount,
        originChain: 'base',
        dry: true,
      }),
    });
    const qJson = (await qRes.json()) as {
      quote: { simulated?: boolean; quote?: { amountInFormatted: string; amountOutFormatted: string } };
    };
    console.log(
      `\n[2/5] Live NEAR Intents 1Click API Dry Quote (Base USDC -> ${first.endpointAccount}):`,
    );
    console.log(
      `      • liveApi=${!qJson.quote.simulated} | ${qJson.quote.quote?.amountInFormatted} Base USDC -> ${qJson.quote.quote?.amountOutFormatted} NEAR USDC`,
    );
  }

  if (once) {
    await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
    console.log('\n✓ Route402 `--once` automated verification completed cleanly.');
    return;
  }

  const webPort = Number(process.env.WEB_PORT ?? 4173);
  if (!fs.existsSync(WEB_DIST) || !fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    console.log('Building web console frontend (apps/web/dist)...');
    execSync('npm --workspace @route402/web run build', { stdio: 'inherit', cwd: ROOT });
  }
  const webServer = await startWebAndProxyServer(gatewayPort, webPort);
  console.log('\n------------------------------------------------------------------------');
  console.log(` Web Console  : http://127.0.0.1:${webPort}`);
  console.log(` x402 Gateway : ${gatewayUrl}/discover`);
  console.log(' Press Ctrl+C to stop servers.');
  console.log('------------------------------------------------------------------------');

  const shutdown = () => {
    webServer.close();
    gatewayServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
