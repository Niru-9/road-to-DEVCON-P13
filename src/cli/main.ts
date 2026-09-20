// CLI entrypoint for Problem 1. Thin argument parsing and routing into the
// publish/recover application logic. No secrets are printed or stored. The
// publish/status path reads the REAL postage batch lifetime from the Bee node
// (bee.stamp.get) and surfaces it through the CLI/application output (P1-6).

import { parseArgs } from 'node:util';
import { loadArchiveConfig, loadRecoveryConfig } from '../config.js';
import type { ArchiveConfig, RecoveryConfig } from '../config.js';
import { createBee } from '../swarm/bee.js';
import {
  createBeeBatchReader,
  describeBatchLifetime,
  formatBatchLifetimeLine,
  type BatchLifetimeReader,
} from '../swarm/batch.js';

export type CliOptions = Record<string, string | undefined>;

export function parseCli(argv = process.argv.slice(2)): { command: string; options: CliOptions } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      bee: { type: 'string', short: 'b' },
      'private-key': { type: 'string' },
      'batch-id': { type: 'string' },
      owner: { type: 'string' },
      topic: { type: 'string' },
      'output-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const command = positionals[0] ?? 'help';
  const options: CliOptions = {};
  for (const [k, v] of Object.entries(values)) {
    options[k] = typeof v === 'string' ? v : undefined;
  }
  return { command, options };
}

export function helpText(): string {
  return [
    'problem-1-archive',
    '',
    'Usage:',
    '  npm run cli -- publish [--bee URL] [--private-key HEX] [--batch-id ID]',
    '  npm run cli -- status [--bee URL] [--batch-id ID]',
    '  npm run cli -- recover --owner ADDR --topic TOPIC [--bee URL] [--output-dir DIR]',
    '',
    'publish/status read the REAL postage batch remaining lifetime from the Bee',
    'node (bee.stamp.get) and surface it in the output.',
    'Recovery needs only public identifiers plus a Bee endpoint.',
  ].join('\n');
}

export function configsFromCli(opts: CliOptions): { archive: ArchiveConfig; recovery: RecoveryConfig } {
  return { archive: archiveConfigFromCli(opts), recovery: recoveryConfigFromCli(opts) };
}

export function archiveConfigFromCli(opts: CliOptions): ArchiveConfig {
  const env = { ...process.env } as Record<string, string | undefined>;
  if (opts.bee) env.BEE_URL = opts.bee;
  if (opts['private-key']) env.PRIVATE_KEY = opts['private-key'];
  if (opts['batch-id']) env.BATCH_ID = opts['batch-id'];
  return loadArchiveConfig(env);
}

export function recoveryConfigFromCli(opts: CliOptions): RecoveryConfig {
  const env = { ...process.env } as Record<string, string | undefined>;
  if (opts.bee) env.BEE_URL = opts.bee;
  if (opts.owner) env.RECOVERY_OWNER = opts.owner;
  if (opts.topic) env.RECOVERY_TOPIC = opts.topic;
  if (opts['output-dir']) env.OUTPUT_DIR = opts['output-dir'];
  return loadRecoveryConfig(env);
}

export interface DispatchDeps {
  /** Inject a batch-lifetime reader for the status/publish path (defaults to the real Bee). */
  batchLifetimeReader?: BatchLifetimeReader;
}

export async function dispatch(argv = process.argv.slice(2), deps: DispatchDeps = {}): Promise<number> {
  const { command, options } = parseCli(argv);
  if (command === 'help' || options.help) {
    process.stdout.write(helpText() + '\n');
    return 0;
  }
  if (command === 'publish' || command === 'status') {
    const cfg = archiveConfigFromCli(options);
    if (!cfg.batchId) {
      process.stderr.write(`${command}: a postage batch is required: set BATCH_ID or pass --batch-id.\n`);
      return 2;
    }
    const reader = deps.batchLifetimeReader ?? createBeeBatchReader(createBee(cfg.beeUrl));
    const line = await describeBatchLifetime(reader, cfg.batchId);
    process.stdout.write(`${command}: ${formatBatchLifetimeLine(line)}\n`);
    return 0;
  }
  if (command === 'recover') {
    const cfg = recoveryConfigFromCli(options);
    process.stdout.write(
      `recover: ready to read feed owner=${cfg.owner} topic=${cfg.topic} -> ${cfg.outputDir} (requires a live Bee node).\n`,
    );
    return 0;
  }
  process.stderr.write(`unknown command: ${command}\n`);
  return 2;
}