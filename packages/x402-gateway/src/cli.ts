import { createRoute402Gateway } from './server.js';
import type { Route402Mode } from './state.js';

const port = Number(process.env.GATEWAY_PORT || 4020);
const mode = (process.env.ROUTE402_MODE || 'demo') as Route402Mode;
const registryId = process.env.ROUTE402_REGISTRY_ID || 'v1.route402.testnet';
const usdcContractId = process.env.ROUTE402_USDC_ID || 'usdc.route402.testnet';

const { server } = createRoute402Gateway({
  port,
  mode,
  registryId,
  usdcContractId,
  rpcUrl: process.env.NEAR_RPC_URL,
  oneClickUrl: process.env.ONE_CLICK_API_URL,
  oneClickJwt: process.env.ONE_CLICK_JWT,
});

server.listen(port, () => {
  console.log(
    `[Route402 Gateway] listening on http://localhost:${port} (mode=${mode}, registry=${registryId})`,
  );
});
