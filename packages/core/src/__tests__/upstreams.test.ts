import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { executeUpstreamService } from '../../../x402-gateway/src/upstreams.js';

describe('tee-auditor attestation truthfulness', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'test-model',
          choices: [
            {
              message: {
                content: '{"risk_level":"LOW","findings":[],"safe_to_sign":true}',
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}/v1`;
    process.env.NEAR_AI_API_KEY = 'test-key';
    process.env.NEAR_AI_API_URL = baseUrl;
  });

  afterAll(async () => {
    delete process.env.NEAR_AI_API_KEY;
    delete process.env.NEAR_AI_API_URL;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('does not claim a verified TEE attestation from a plain HTTP 200', async () => {
    const out = await executeUpstreamService('tee-auditor', new URLSearchParams());

    expect(out.teeAttested).toBe(false);
    expect(out.teeProof?.verified).toBe(false);
    expect(out.teeProof?.attestationNote).toMatch(/independently verified/i);
    expect(out.data.zeroServerRetention).toBe('unverified');
  });
});
