import fs from 'node:fs';
import path from 'node:path';

export type StaticFileResolution =
  | { ok: true; file: string }
  | { ok: false; reason: 'forbidden' | 'not-found' };

/**
 * Resolve a browser request path against the built web root without ever
 * escaping that root. Handles encoded traversal, null bytes, and symlinks.
 */
export function resolveStaticFile(root: string, requestUrl: string): StaticFileResolution {
  const rawPath = requestUrl.split('?')[0] ?? '/';

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, reason: 'forbidden' };
  }
  if (decoded.includes('\0')) {
    return { ok: false, reason: 'forbidden' };
  }

  const rootResolved = path.resolve(root);
  const rootPrefix = rootResolved.endsWith(path.sep)
    ? rootResolved
    : `${rootResolved}${path.sep}`;
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(rootResolved, rel);

  if (candidate !== rootResolved && !candidate.startsWith(rootPrefix)) {
    return { ok: false, reason: 'forbidden' };
  }

  const resolveRealFile = (file: string): StaticFileResolution | null => {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
    try {
      const realRoot = fs.realpathSync(rootResolved);
      const realFile = fs.realpathSync(file);
      if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
        return { ok: false, reason: 'forbidden' };
      }
      return { ok: true, file: realFile };
    } catch {
      return { ok: false, reason: 'not-found' };
    }
  };

  const direct = resolveRealFile(candidate);
  if (direct) return direct;

  const index = resolveRealFile(path.join(rootResolved, 'index.html'));
  return index ?? { ok: false, reason: 'not-found' };
}
