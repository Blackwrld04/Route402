export interface TestnetDeploymentManifest {
  network: 'testnet';
  rpcUrl: string;
  explorerBaseUrl: string;
  registryId: string;
  usdcContractId: string;
  vaultGlobalHashHex: string;
  seededEndpoints: string[];
  proofTransactions: Array<{
    label: string;
    txHash: string;
    description: string;
  }>;
}

/**
 * Populated from live NEAR Testnet deployment (`r402-reg-v1.testnet`).
 */
export const TESTNET_DEPLOYMENT: TestnetDeploymentManifest = {
  network: 'testnet',
  rpcUrl: 'https://test.rpc.fastnear.com',
  explorerBaseUrl: 'https://testnet.nearblocks.io',
  registryId: 'r402-reg-v1.testnet',
  usdcContractId: 'r402-usdc-v1.testnet',
  vaultGlobalHashHex: '1bbce4c18cc8cb838730db0a792b0ebece17ac22f03917fa66270c959164bc03',
  seededEndpoints: [
    'alpha-signal.r402-reg-v1.testnet',
    'tee-auditor.r402-reg-v1.testnet',
  ],
  proofTransactions: [
    {
      label: 'Create registry account r402-reg-v1.testnet',
      txHash: 'CAtoeTXFKmGuvdqK6bmeGCEBvWFUx8oMHbDLCcZEBCfs',
      description: 'Genesis account creation for Route402 sharded collection registry',
    },
    {
      label: 'BLOCKED [Threat T-2] Seller mid-sale drain attempt',
      txHash: '4y4gSjQpXx8kuj7kqcobkW6dWe16NK5eAc6jKLCdejbs',
      description: 'Onchain panic: Vault outflows/mutations blocked while Frozen',
    },
    {
      label: '[Threat T-6] Live mid-sale x402 USDC settlement into Frozen vault',
      txHash: '2sct1tUAS16xTdbxeSgUzzHHDu9D9eq4ex65kCrwQJX8',
      description: '80,000 micro-USDC ($0.08) settled into tee-auditor.r402-reg-v1.testnet while Frozen',
    },
  ],
};
