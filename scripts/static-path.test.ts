import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveStaticFile } from './static-path.js';

describe('demo static file resolution', () => {
  let root = '';
  let emptyRoot = '';

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'route402-static-'));
    emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'route402-empty-'));
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log(1)');
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  });

  it('serves the SPA index and built assets', () => {
    expect(resolveStaticFile(root, '/')).toEqual({
      ok: true,
      file: fs.realpathSync(path.join(root, 'index.html')),
    });
    expect(resolveStaticFile(root, '/assets/app.js')).toEqual({
      ok: true,
      file: fs.realpathSync(path.join(root, 'assets', 'app.js')),
    });
    expect(resolveStaticFile(root, '/nested/client/route')).toEqual({
      ok: true,
      file: fs.realpathSync(path.join(root, 'index.html')),
    });
  });

  it('rejects raw and encoded path traversal', () => {
    for (const attack of [
      '/../../../../etc/passwd',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/assets/..%2f..%2f..%2fetc%2fpasswd',
      '/assets/%00/app.js',
    ]) {
      expect(resolveStaticFile(root, attack)).toEqual({ ok: false, reason: 'forbidden' });
    }
  });

  it('rejects symlinks that escape the web root', () => {
    if (process.platform === 'win32') return;
    const link = path.join(root, 'escape.js');
    fs.symlinkSync('/etc/passwd', link);
    expect(resolveStaticFile(root, '/escape.js')).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('reports a missing build instead of serving arbitrary files', () => {
    expect(resolveStaticFile(emptyRoot, '/')).toEqual({ ok: false, reason: 'not-found' });
  });
});
