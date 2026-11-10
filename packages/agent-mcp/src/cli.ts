import { startRoute402McpServer } from './mcp-server.js';

const gatewayBaseUrl = process.env.ROUTE402_GATEWAY_URL ?? 'http://127.0.0.1:4402';
const payerId = process.env.ROUTE402_AGENT_ID ?? 'buyer-agent.route402.testnet';
const pinnedCollectionId = process.env.NEAR_REGISTRY_ID;

startRoute402McpServer({
  gatewayBaseUrl,
  payerId,
  pinnedCollectionId,
});
