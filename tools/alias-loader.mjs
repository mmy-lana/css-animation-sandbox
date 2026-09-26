// Temporary dev-only loader: maps the "@/*" tsconfig alias to ./src/* so the
// TypeScript sources can be executed directly by Node's type stripper.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2));
    const target = CANDIDATE_SUFFIXES.some((suffix) => existsSync(base + suffix))
      ? CANDIDATE_SUFFIXES.map((suffix) => base + suffix).find((candidate) => existsSync(candidate))
      : base;
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
