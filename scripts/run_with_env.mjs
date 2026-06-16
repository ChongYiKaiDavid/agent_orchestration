import fs from 'fs';
import path from 'path';

const envFile = process.env.ENV_FILE || path.resolve(process.cwd(), '.env.agent_orchestration');

function parseDotEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

if (!fs.existsSync(envFile)) {
  console.error(`[run_with_env] Missing env file: ${envFile}`);
  process.exit(1);
}

const content = fs.readFileSync(envFile, 'utf8');
const envVars = parseDotEnv(content);

for (const [k, v] of Object.entries(envVars)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

// remaining args: node run_with_env.mjs <script.js|mjs> [args...]
const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error('[run_with_env] Usage: node scripts/run_with_env.mjs <script> [args...]');
  process.exit(1);
}

const mod = await import(path.resolve(process.cwd(), script));
if (typeof mod?.default === 'function') {
  await mod.default(...rest);
}
