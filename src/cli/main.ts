// CLI entrypoint for Problem 1. Thin argument parsing and routing into the
// publish/recover application logic. No secrets are printed or stored.

import { parseArgs } from 'node:util';
import { loadArchiveConfig, loadRecoveryConfig } from '../config.js';
import type { ArchiveConfig, RecoveryConfig } from '../config.js';

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
    '  npm run cli -- recover --owner ADDR --topic TOPIC [--bee URL] [--output-dir DIR]',
    '',
    'Recovery needs only public identifiers plus a Bee endpoint.',
  ].join('\n');
}

export function configsFromCli(opts: CliOptions): { archive: ArchiveConfig; recovery: RecoveryConfig } {
  const env = { ...process.env } as Record<string, string | undefined>;
  if (opts.bee) env.BEE_URL = opts.bee;
  if (opts['private-key']) env.PRIVATE_KEY = opts['private-key'];
  if (opts['batch-id']) env.BATCH_ID = opts['batch-id'];
  if (opts.owner) env.RECOVERY_OWNER = opts.owner;
  if (opts.topic) env.RECOVERY_TOPIC = opts.topic;
  if (opts['output-dir']) env.OUTPUT_DIR = opts['output-dir'];
  return { archive: loadArchiveConfig(env), recovery: loadRecoveryConfig(env) };
}

export function dispatch(argv = process.argv.slice(2)): number {
  const { command, options } = parseCli(argv);
  if (command === 'help' || options.help) {
    process.stdout.write(helpText() + '\n');
    return 0;
  }
  if (command === 'publish') {
    configsFromCli(options).archive;
    process.stdout.write('publish: configuration loaded (execution requires a live Bee node).\n');
    return 0;
  }
  if (command === 'recover') {
    const cfg = configsFromCli(options).recovery;
    process.stdout.write(
      `recover: ready to read feed owner=${cfg.owner} topic=${cfg.topic} -> ${cfg.outputDir} (requires a live Bee node).\n`,
    );
    return 0;
  }
  process.stderr.write(`unknown command: ${command}\n`);
  return 2;
}