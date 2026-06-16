// Set env var in terminal before running:
// export BITBUCKET_USERNAME="..." BITBUCKET_TOKEN="..."
// rerun: node scripts/test_bitbucket_pr.mjs

// Once it runs, it will print either:
// PR created: <url> (success), or
// PR creation failed: <status> <body> (gives exact API/auth error).

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const workspaceRoot = path.resolve(process.cwd(), process.env.TEST_WORKSPACE_ROOT || 'server/workspaces');
const taskId = `bitbucket-pr-test-${crypto.randomUUID()}`;
const repoUrl = process.env.TEST_REPO_URL || 'https://vyr983ygvf-admin@bitbucket.org/vyr983ygvf/ai-orchestration.git';
const baseBranch = process.env.TEST_TARGET_BRANCH || 'main';
const branchName = `ai-orchestration/pr-test-${taskId}`;

const bitbucketUser = process.env.BITBUCKET_USERNAME;
const bitbucketBearer = process.env.BITBUCKET_TOKEN;

if (!bitbucketUser) {
  console.error('Missing env var BITBUCKET_USERNAME');
  process.exit(1);
}
if (!bitbucketBearer) {
  console.error('Missing env var BITBUCKET_TOKEN (bearer token)');
  process.exit(1);
}

const taskFolder = path.join(workspaceRoot, taskId);
const repoDestination = path.join(taskFolder, 'repo');

await fs.rm(taskFolder, { recursive: true, force: true });
await fs.mkdir(taskFolder, { recursive: true });

function runGit(args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return res;
}

console.log('[test] Cloning:', repoUrl);
// Clone with provided URL (repoUrl may include basic creds; if it does, git will use them)
{
  const args = ['clone', '--depth', '1', '--branch', baseBranch, '--single-branch', repoUrl, repoDestination];
  const res = runGit(args);
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    throw new Error('git clone failed');
  }
}

console.log('[test] Creating branch:', branchName);
runGit(['checkout', '-b', branchName], { cwd: repoDestination });

const readmePath = path.join(repoDestination, 'README.md');
const before = await fs.readFile(readmePath, 'utf8');
const marker = `\n\n## AI PR Test ${taskId}\n\n- Greeting: hello from orchestration test\n`;

if (!before.includes(marker.trim())) {
  await fs.writeFile(readmePath, before + marker, 'utf8');
}

console.log('[test] Committing');
runGit(['add', 'README.md'], { cwd: repoDestination });
runGit(['commit', '-m', `AI PR Test: ${taskId}`], { cwd: repoDestination });

// Configure origin to use bearer token for push if possible (Bitbucket supports HTTPS with token as password for basic auth,
// but codebase uses bearer only for API. For push, the existing repoUrl credentials should already work.
// We'll still set origin to the same repoUrl to keep behavior consistent.)
console.log('[test] Pushing');
const pushRes = runGit(['push', '-u', 'origin', branchName], { cwd: repoDestination });
if (pushRes.status !== 0) {
  console.error('git push failed:', pushRes.stderr || pushRes.stdout);
  throw new Error('git push failed');
}

// Parse workspace + repo from repoUrl
const m =
  // Handles URLs like: https://user@bitbucket.org/workspace/repo.git
  repoUrl.match(/^https?:\/\/(?:[^@/]+@)?bitbucket\.org\/([^/]+)\/([^/]+?)(?:\.git)?$/i) ||
  // Handles URLs like: git@bitbucket.org:workspace/repo.git
  repoUrl.match(/git@bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/i);

if (!m) {
  console.error('Could not parse bitbucket workspace/repo from TEST_REPO_URL');
  process.exit(1);
}
const workspace = m[1];
const repoSlug = m[2].replace(/\.git$/i, '');

console.log('[test] Creating Bitbucket PR via API');
const prApiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests`;
const prTitle = `AI PR Test: ${taskId}`;
const prBody = `This PR was created by the orchestration engine test script.\n\nTaskId: ${taskId}`;

const prResp = await fetch(prApiUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${bitbucketBearer}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: prTitle,
    description: prBody,
    source: { branch: { name: branchName } },
    destination: { branch: { name: baseBranch } },
  }),
});

const text = await prResp.text();
if (!prResp.ok) {
  console.error('PR creation failed:', prResp.status, text);
  process.exit(2);
}

let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

console.log('PR created:', json?.links?.html?.href || json?.id || '(unknown)');
console.log('Full response keys:', Object.keys(json || {}));
