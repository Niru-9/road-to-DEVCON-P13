import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts')) out.push(full);
    }
  };
  walk(srcDir);
  return out;
}

function readImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const matches = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
  const requireMatches = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]!);
  return [...matches, ...requireMatches];
}

describe('architecture: recovery independence (P1-5)', () => {
  it('recovery imports only feeds/manifests/swarm boundaries, never the publisher or app state', () => {
    const recoveryFile = join(srcDir, 'archive', 'recovery.ts');
    const imports = readImports(recoveryFile).map((imp) => imp.replace(/\.js$/, ''));
    for (const imp of imports) {
      // Must not import the publishing orchestration or any persisted/local state module.
      expect(imp).not.toMatch(/publisher|authority|db|database|sqlite|storage|feed\.json/i);
    }
  });

  it('publisher derives the next index from the network, with no local counter persistence anywhere in src', () => {
    // The only module that touches indexes is src/swarm/feed.ts, which is
    // stateless (no fs writes, no db, no JSON persistence).
    for (const file of sourceFiles()) {
      const src = readFileSync(file, 'utf8');
      const rel = relative(srcDir, file);
      if (rel.includes('cli')) continue; // cli may print, but not persist
      expect(src, `${rel}: must not persist an index locally`).not.toMatch(/appendFileSync|writeFileSync|createWriteStream|DB_API|sqlite|indexFilename|\.counter/i);
    }
  });
});

describe('architecture: recovery entrypoint needs no private credentials (P1-5, P1-8)', () => {
  it('recovery module ignores private keys by construction', () => {
    const recoveryFile = join(srcDir, 'archive', 'recovery.ts');
    const src = readFileSync(recoveryFile, 'utf8');
    expect(src).not.toMatch(/privateKey|PRIVATE_KEY|signer|batchId|BATCH_ID/i);
  });
});

describe('architecture: no secrets in tracked source (P1-8)', () => {
  it('src never logs or embeds a private key, batch id, or real Bee URL', () => {
    for (const file of sourceFiles()) {
      const src = readFileSync(file, 'utf8');
      // No hardcoded hex secrets / private key literals / real wallet addresses.
      expect(src).not.toMatch(/[0-9a-f]{64}/i);
      expect(src).not.toMatch(/BEGIN PRIVATE KEY|mnemonic|seed phrase|BEE_URL\s*=\s*['\"]https/i);
    }
  });

  it('no generated artifacts are checked in (dist must stay ignored)', () => {
    // dist/ is in .gitignore; assert no build artifact sneaks into git ls-files.
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    expect(tracked.some((f: string) => f.startsWith('dist/'))).toBe(false);
    expect(tracked.some((f: string) => f.includes('.env') && !f.includes('.env.example'))).toBe(false);
  });
});