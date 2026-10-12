// data-dir.ts — works from src/ (tests) and dist/ (built), both one level below the package root
import { readFileSync, readdirSync } from 'node:fs';
const DATA_DIR = new URL('../data/', import.meta.url);
export function readDataJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, DATA_DIR), 'utf8'));
}
export function listFixtureFiles(): string[] {
  return readdirSync(new URL('fixtures/', DATA_DIR)).filter(name => name.endsWith('.json')).sort();
}
