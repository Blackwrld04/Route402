import readline from 'node:readline';
import { Route402AgentClient, type Route402AgentClientOptions } from './client.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const MCP_TOOLS = [
  {
    name: 'discover_x402_endpoints',
    description:
      'Discover cash-flowing x402 API & MCP endpoints owned by sharded NEAR Account-NFTs (sharded-item-1.0.0), including current owner, T2 verification status, pricing, and vault treasury balances.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'call_x402_endpoint',
    description:
      'Call a monetized Route402 x402 endpoint. Automatically handles HTTP 402 challenge parsing, T2 pinned-block Account-NFT authenticity verification, budget checks, and X-PAYMENT settlement.',
    inputSchema: {
      type: 'object',
      properties: {
        resourcePath: {
          type: 'string',
          description:
            'Endpoint resource path (e.g. "/x402/alpha-signal.registry.route402.testnet/alpha-signal")',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST'],
          description: 'HTTP method (default GET)',
        },
        body: {
          type: 'object',
          description: 'Optional JSON body when method is POST',
        },
      },
      required: ['resourcePath'],
    },
  },
  {
    name: 'inspect_endpoint_nft',
    description:
      'Run a House of Stake sharded-item-1.0.0 Tier-2 (T2) pinned-block authenticity check on a Route402 Account-NFT.',
    inputSchema: {
      type: 'object',
      properties: {
        endpointAccount: {
          type: 'string',
          description: 'Sharded sub-account ID (e.g. "alpha-signal.registry.route402.testnet")',
        },
      },
      required: ['endpointAccount'],
    },
  },
  {
    name: 'quote_cross_chain_1click',
    description:
      'Request a NEAR Intents 1Click cross-chain USDC settlement quote (from Base, Solana, Arbitrum, or Ethereum) routed directly into an Account-NFT treasury.',
    inputSchema: {
      type: 'object',
      properties: {
        endpointId: {
          type: 'string',
          description: 'Target Account-NFT ID',
        },
        originChain: {
          type: 'string',
          enum: ['base', 'sol', 'arb', 'eth', 'near'],
          description: 'Source blockchain paying into the x402 endpoint',
        },
      },
      required: ['endpointId'],
    },
  },
];

export function startRoute402McpServer(opts: Route402AgentClientOptions): void {
  const client = new Route402AgentClient(opts);
  const baseUrl = opts.gatewayBaseUrl.replace(/\/$/, '');

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  function sendResponse(id: string | number | null | undefined, result: unknown): void {
    if (id === undefined) return;
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
  }

  function sendError(
    id: string | number | null | undefined,
    code: number,
    message: string,
  ): void {
    if (id === undefined) return;
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`,
    );
  }

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      sendError(null, -32700, 'Invalid JSON-RPC payload');
      return;
    }

    try {
      if (req.method === 'initialize') {
        sendResponse(req.id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'route402-agent-mcp',
            version: '0.1.0',
          },
        });
        return;
      }

      if (req.method === 'notifications/initialized') {
        return;
      }

      if (req.method === 'tools/list') {
        sendResponse(req.id, { tools: MCP_TOOLS });
        return;
      }

      if (req.method === 'tools/call') {
        const name = String(req.params?.name ?? '');
        const args = (req.params?.arguments ?? {}) as Record<string, unknown>;

        if (name === 'discover_x402_endpoints') {
          const catalog = await client.discoverEndpoints();
          sendResponse(req.id, {
            content: [{ type: 'text', text: JSON.stringify(catalog, null, 2) }],
          });
          return;
        }

        if (name === 'call_x402_endpoint') {
          const out = await client.callEndpoint(String(args.resourcePath ?? ''), {
            method: args.method === 'POST' ? 'POST' : 'GET',
            body:
              args.body && typeof args.body === 'object'
                ? (args.body as Record<string, unknown>)
                : undefined,
          });
          sendResponse(req.id, {
            content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
          });
          return;
        }

        if (name === 'inspect_endpoint_nft') {
          const acc = encodeURIComponent(String(args.endpointAccount ?? ''));
          const res = await fetch(`${baseUrl}/api/t2/${acc}`);
          const payload = await res.json();
          sendResponse(req.id, {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          });
          return;
        }

        if (name === 'quote_cross_chain_1click') {
          const res = await fetch(`${baseUrl}/api/quote-1click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpointId: String(args.endpointId ?? ''),
              originChain: String(args.originChain ?? 'base'),
              dry: true,
            }),
          });
          const payload = await res.json();
          sendResponse(req.id, {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          });
          return;
        }

        sendError(req.id, -32601, `Unknown MCP tool "${name}"`);
        return;
      }

      sendError(req.id, -32601, `Unsupported JSON-RPC method "${req.method}"`);
    } catch (err) {
      sendError(
        req.id,
        -32000,
        err instanceof Error ? err.message : String(err),
      );
    }
  });
}
