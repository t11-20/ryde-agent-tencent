import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { RunSchema, type Run } from '@fairtrip/contracts';

// A replay entry is a raw eval record (packages/eval results/runs/<fixture>-1.json):
// the recorded terminal run is re-emitted event by event without model calls.
const ReplayRecordSchema = z.looseObject({fixtureId: z.string().min(1), run: z.unknown()});

export interface ReplayEntry {
  sourceRunId: string;
  recordedAt: string;
  run: Run;
}

export function loadReplays(dir: string): Map<string, ReplayEntry> {
  let names: string[];
  try {
    names = readdirSync(dir).filter(name => name.endsWith('.json'));
  } catch {
    throw new Error(`Replay directory is missing or unreadable: ${dir}`);
  }
  const entries = new Map<string, ReplayEntry>();
  for (const name of names) {
    const file = join(dir, name);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      throw new Error(`Replay file ${name} is not valid JSON`);
    }
    const record = ReplayRecordSchema.safeParse(raw);
    if (!record.success) throw new Error(`Replay file ${name} has no fixtureId/run`);
    const parsed = RunSchema.safeParse(record.data.run);
    if (!parsed.success) throw new Error(`Replay file ${name} failed RunSchema: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
    const run = parsed.data;
    if (run.status !== 'completed' && run.status !== 'incomplete')
      throw new Error(`Replay file ${name} is a ${run.status} run; only completed or incomplete records are replayable`);
    const firstEvent = run.events[0];
    if (firstEvent === undefined) throw new Error(`Replay file ${name} has no recorded events`);
    if (entries.has(record.data.fixtureId)) throw new Error(`Duplicate replay for fixture ${record.data.fixtureId}`);
    entries.set(record.data.fixtureId, {sourceRunId: run.id, recordedAt: firstEvent.timestamp, run});
  }
  if (entries.size === 0) throw new Error(`Replay directory ${dir} contains no replay files`);
  return entries;
}

export function replaySourceName(dir: string): string {
  return basename(dir.replace(/[/\\]+$/, '')) || dir;
}
