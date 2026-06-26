// Test Jira API connection using env variables.
// Usage:
//   node scripts/test_jira_connection.mjs
//
// Reads credentials from .env.agent_orchestration (or set them in your shell):
//   JIRA_BASE_URL=https://your-domain.atlassian.net
//   JIRA_USER=your-email@example.com
//   JIRA_API_TOKEN=your-api-token
//
// What it tests:
//   1. Credentials are present
//   2. /rest/api/3/myself  — auth check
//   3. /rest/api/3/project — list accessible projects
//   4. /rest/api/3/search  — fetch open/in-progress issues (same query as the dashboard)

import { loadEnv } from '../load_env.js';

loadEnv();

const base = (() => {
  const raw = process.env.JIRA_BASE_URL || '';
  try {
    const { origin } = new URL(raw);
    return origin; // strips path, query, fragment — keeps https://host
  } catch {
    return raw.replace(/\/$/, '');
  }
})();
const user = process.env.JIRA_USER;
const token = process.env.JIRA_API_TOKEN;

// --- 1. Check env vars -------------------------------------------------------
console.log('=== Jira Connection Test ===\n');

if (!base || !user || !token) {
  console.error('Missing required env vars:');
  if (!base)  console.error('  JIRA_BASE_URL   (e.g. https://your-domain.atlassian.net)');
  if (!user)  console.error('  JIRA_USER       (your Atlassian email)');
  if (!token) console.error('  JIRA_API_TOKEN  (from https://id.atlassian.com/manage-profile/security/api-tokens)');
  process.exit(1);
}

console.log(`JIRA_BASE_URL  : ${base}`);
console.log(`JIRA_USER      : ${user}`);
console.log(`JIRA_API_TOKEN : ${'*'.repeat(8)}${token.slice(-4)}`);
const encoded = Buffer.from(`${user}:${token}`).toString('base64');
console.log(`Authorization  : Basic ${encoded.slice(0, 8)}...${encoded.slice(-4)}`);
console.log(`Decoded check  : ${user}:<token_length=${token.length}>\n`);
// Uncomment the next line temporarily if still getting 401:
// console.log(`Full decoded   : ${Buffer.from(encoded, 'base64').toString()}`)

const headers = {
  Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`,
  Accept: 'application/json',
};

async function jiraGet(path) {
  const res = await fetch(`${base}${path}`, { headers });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}):\n${body.slice(0, 500)}`);
  }
}

// --- 2. Auth check -----------------------------------------------------------
process.stdout.write('[1/3] Checking credentials (GET /rest/api/3/myself) ... ');
try {
  const me = await jiraGet('/rest/api/3/myself');
  console.log(`OK — logged in as: ${me.displayName} <${me.emailAddress}>`);
} catch (err) {
  console.error(`FAILED\n  ${err.message}`);
  process.exit(1);
}

// --- 3. List projects --------------------------------------------------------
process.stdout.write('[2/3] Listing projects (GET /rest/api/3/project) ... ');
try {
  const projects = await jiraGet('/rest/api/3/project');
  const list = Array.isArray(projects) ? projects : (projects.values || []);
  if (list.length === 0) {
    console.log('OK — (no accessible projects found)');
  } else {
    console.log(`OK — ${list.length} project(s):`);
    list.slice(0, 10).forEach(p => console.log(`    ${p.key.padEnd(12)} ${p.name}`));
    if (list.length > 10) console.log(`    ... and ${list.length - 10} more`);
  }
} catch (err) {
  console.error(`FAILED\n  ${err.message}`);
  process.exit(1);
}

// --- 4. Fetch open issues (same query as the dashboard) ----------------------
process.stdout.write('[3/3] Fetching open issues (statusCategory in ("new","indeterminate")) ... ');
try {
  const jql = 'statusCategory in ("new","indeterminate") ORDER BY updated DESC';
  const data = await jiraGet(
    `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,priority,assignee`
  );
  const issues = data.issues || [];
  console.log(`OK — ${data.total} total issue(s), showing first ${issues.length}:`);
  issues.forEach(i => {
    const priority = i.fields.priority?.name || 'none';
    const status   = i.fields.status?.name || '?';
    const assignee = i.fields.assignee?.displayName || 'unassigned';
    console.log(`    ${i.key.padEnd(12)} [${status}] [${priority}] ${i.fields.summary.slice(0, 60)} — ${assignee}`);
  });
} catch (err) {
  console.error(`FAILED\n  ${err.message}`);
  process.exit(1);
}

console.log('\n✅ All checks passed — Jira connection is working.');
