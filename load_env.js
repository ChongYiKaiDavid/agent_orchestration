import fs from 'fs';
import path from 'path';

// Loads key/value pairs from a local env file into process.env.
// Intentionally does NOT depend on dotenv package.
export function loadEnv(envFilePath) {
  const filePath = envFilePath
    ? path.resolve(envFilePath)
    : path.resolve(process.cwd(), '.env.agent_orchestration');

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    // Strip optional surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key) continue;

    // Don’t override if already set by caller
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

