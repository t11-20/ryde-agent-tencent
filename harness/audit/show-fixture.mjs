// Prints what the evidence package computes for one fixture, so nobody has to work numbers out by hand.
// Usage (from the repository root, after `npm run build`):
//   node harness/audit/show-fixture.mjs R1
//   node harness/audit/show-fixture.mjs N2 --raw      (full JSON instead of the short view)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const entry = process.env.AUDIT_EVIDENCE_MODULE ?? join(repo, 'packages', 'evidence', 'dist', 'index.js');
const id = process.argv[2];
const raw = process.argv.includes('--raw');
const fixturePath = join(here, '..', 'data', 'fixtures', `${id}.json`);
if (!id || !existsSync(fixturePath)) {
  console.log('Usage: node harness/audit/show-fixture.mjs <R1|R1S|R2|R3|X1|N1|N2|N2H|N3|X2|X3> [--raw]');
  process.exit(1);
}
if (!existsSync(entry)) { console.log('Run `npm run build` first.'); process.exit(1); }
const ev = await import(pathToFileURL(entry).href);
const policy = JSON.parse(readFileSync(join(here, '..', 'data', 'policy.json'), 'utf8'));
const fixture = () => JSON.parse(readFileSync(fixturePath, 'utf8'));
const show = (title, fn) => {
  console.log(`\n== ${title}`);
  try { const value = fn(); console.log(raw ? JSON.stringify(value, null, 2) : JSON.stringify(value)); }
  catch (error) { console.log(`(not available: ${error instanceof Error ? error.message : String(error)})`); }
};
const f = fixture();
console.log(`Fixture ${id}: ${f.label} (${f.dispute.category}). Values below are computed by the code in packages/evidence.`);
if (typeof ev.routeMetrics === 'function') show('routeMetrics', () => ev.routeMetrics(fixture(), policy.params));
if (typeof ev.pickupMetrics === 'function') show('pickupMetrics', () => ev.pickupMetrics(fixture(), policy.params));
if (typeof ev.analyseChat === 'function') show('analyseChat (summary)', () => {
  const a = ev.analyseChat(fixture(), policy.params);
  return raw ? a : {tags: Object.fromEntries(a.messages.filter((m) => m.tags.length).map((m) => [m.id, m.tags])), sentimentCounts: a.sentimentCounts, driverContactAttemptsBeforeCancel: a.driverContactAttemptsBeforeCancel, contactAttemptIds: a.contactAttemptIds};
});
if (typeof ev.checkFare === 'function') show('checkFare', () => (f.payment.status === 'available' ? ev.checkFare(fixture().payment) : 'payment unavailable'));
if (typeof ev.remedyBasis === 'function') show('remedyBasis', () => {
  const g = fixture();
  return ev.remedyBasis(g, typeof ev.routeMetrics === 'function' ? ev.routeMetrics(g, policy.params) : null, g.payment.status === 'available' ? ev.checkFare(g.payment) : null);
});
if (typeof ev.buildEvidence === 'function') show('buildEvidence (IDs and summaries)', () => {
  const b = ev.buildEvidence(fixture(), policy);
  return raw ? b : {records: b.records.map((r) => `${r.id}: ${r.facts.summary}`), unavailable: b.unavailable};
});
