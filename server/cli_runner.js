#!/usr/bin/env node

/**
 * Generic provider-CLI runner.
 *
 * Goal: engine always uses a single interface:
 *   node server/cli_runner.js \
 *     --provider gemini \
 *     --prompt-file /abs/path/prompt.txt \
 *     --output-file /abs/path/output.txt \
 *     --model <optional>
 *
 * This file then loads provider config from server/agents/<provider>.json
 * and invokes the provider's actual CLI with provider-native arguments.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';

function parseArgs(argv) {
  const out = { provider: null, promptFile: null, outputFile: null, model: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--provider') out.provider = argv[++i];
    else if (a === '--prompt-file') out.promptFile = argv[++i];
    else if (a === '--output-file') out.outputFile = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function substitute(template, vars) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? `{${key}}}` : String(v);
  });
}

function normalizeNewlines(s) {
  return typeof s === 'string' ? s.replace(/\r\n/g, '\n') : s;
}

function parseFileBlocks(output) {
  const files = {};
  const fileRegex = /FILE:\s*([^\s\n]+)\s*\n\s*---\s*\n([\s\S]*?)\s*\n\s*---\s*\n/g;
  let match;
  while ((match = fileRegex.exec(output)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.provider || !args.promptFile || !args.outputFile) {
    console.error(
      'Usage: node server/cli_runner.js --provider <provider> --prompt-file <file> --output-file <file> [--model <model>]'
    );
    process.exit(2);
  }

  const repoPath = null; // runner itself just writes output.txt; engine may handle coding-stage file blocks.

  const thisFileDir = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = process.env.AGENT_ORCHESTRATION_ROOT || path.resolve(thisFileDir, '..');

  // Resolve promptPath robustly relative to where runner was invoked.
  // Engine passes absolute paths, but tests/tools might pass relative paths.
  const promptPath = path.isAbsolute(args.promptFile)
    ? args.promptFile
    : path.resolve(process.cwd(), args.promptFile);

  const workspace = path.dirname(promptPath);

  const providerFile = path.join(projectRoot, 'server', 'agents', `${args.provider}.json`);
  if (!fsSync.existsSync(providerFile)) {
    console.error(`[cli_runner] Provider config not found: ${providerFile}`);
    process.exit(2);
  }

  const providerConfig = JSON.parse(await fs.readFile(providerFile, 'utf8'));
  const cli = providerConfig?.cli;
  if (!cli || !cli.command) {
    console.error(`[cli_runner] Provider config missing cli.command for provider=${args.provider}`);
    process.exit(2);
  }

  // We support two layouts for flexibility:
  // A) cli.command + cli.args already provider-native.
  // B) cli.providerTemplate: { command, args } and cli.argsTemplate env.
  // For your immediate Gemini fix, layout A is enough.

  let command = cli.command;
  let commandArgs = Array.isArray(cli.args) ? [...cli.args] : [];
  const envVars = cli.env && typeof cli.env === 'object' ? { ...cli.env } : {};

  // Read prompt text once (some CLIs need inline prompt, others need prompt-file)
  const promptText = await fs.readFile(promptPath, 'utf8');

  const vars = {
    promptFile: args.promptFile,
    prompt: promptText,
    model: args.model || '',
    // convenience placeholders
    outputFile: args.outputFile,
  };

  command = substitute(command, vars);
  commandArgs = commandArgs.map((a) => substitute(a, vars));

  // Also allow env placeholders
  const finalEnv = { ...process.env };
  for (const [k, v] of Object.entries(envVars)) {
    finalEnv[k] = substitute(v, vars);
  }

  const child = spawn(command, commandArgs, {
    cwd: workspace,
    env: finalEnv,
    shell: process.platform === 'win32',
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text); // keep streaming to existing log pipeline
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text); // keep streaming
  });

  child.on('error', async (err) => {
    const msg = normalizeNewlines(String(err?.message || err));
    stderr += msg;
    try {
      await fs.writeFile(args.outputFile, '', 'utf8');
    } catch {}
    process.exit(1);
  });

  child.on('close', async (code) => {
    const finalStdout = normalizeNewlines(stdout.trimEnd());
    try {
      await fs.mkdir(path.dirname(args.outputFile), { recursive: true });
      await fs.writeFile(args.outputFile, finalStdout, 'utf8');
    } catch (e) {
      console.error('[cli_runner] Failed to write output file:', e?.message || String(e));
    }

    // exit with provider exit code
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error('[cli_runner] Fatal:', e?.stack || e?.message || String(e));
  process.exit(1);
});

