import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import db from './db.js';
import { getPipeline, listPipelines, getPipelineSync, listPipelinesSync } from './pipelines.js';
import { runDevinStage, buildStagePrompt as buildDevinStagePrompt } from './agents/devin.js';
import { runGeminiStage, buildStagePrompt as buildGeminiStagePrompt } from './agents/gemini.js';
import { runOllamaStage, buildStagePrompt as buildOllamaStagePrompt } from './agents/ollama.js';
import { listAgents } from './agents.js';
import { autoSelectPipelineAndAgent } from './auto-selector.js';
import { attemptRebaseWithResolution } from './conflict-resolver.js';
import io from 'socket.io-client';


const workspaceRoot = path.resolve(process.cwd(), process.env.TEST_WORKSPACE_ROOT || 'server/workspaces');

// ──────────────────────────────────────────────────────────────────────────────
// Real-time log streamer — connects to Flask-SocketIO and forwards agent output
// ──────────────────────────────────────────────────────────────────────────────

let _logSocket = null;
let _pendingResolves = [];
let _socketInstanceCount = 0;

function getLogSocket() {
  if (_logSocket) {
    if (_logSocket.connected) return _logSocket;
    // Socket exists but disconnected — call connect() to reconnect it
    _logSocket.connect();
    return _logSocket;
  }

  // If FLASK_SOCKET_URL isn't explicitly provided, skip socket connection entirely.
  // This prevents worker execution from being spammed/having noisy connect attempts.
  const flaskUrl = process.env.FLASK_SOCKET_URL;
  if (!flaskUrl) {
    return null;
  }

  _logSocket = io(flaskUrl, {
    transports: [process.env.FLASK_SOCKET_TRANSPORT || 'websocket'],
    autoConnect: false,

  });
  _socketInstanceCount++;
  console.log(`[log-streamer] ★ Created socket #${_socketInstanceCount}`);

  _logSocket.on('connect', () => {
    console.log(`[log-streamer] ★★★ CONNECT fired (socket #${_socketInstanceCount})`);
    _pendingResolves.forEach((r) => r(_logSocket));
    _pendingResolves = [];
  });

  _logSocket.on('disconnect', () => {
    console.log('[log-streamer] ✗ DISCONNECT fired');
  });

  _logSocket.on('connect_error', (err) => {
    console.log(`[log-streamer] ✗ CONNECT_ERROR: ${err.message}`);
    console.log(`[log-streamer] ➜ Is the Flask Socket.IO server running at ${flaskUrl}?`);
    console.log(`[log-streamer] ➜ Verify: cd server-flask && python app.py`);
    console.log(`[log-streamer] ➜ Also verify port matches: node expects ${flaskUrl}`);
    if (process.env.FLASK_SOCKET_URL === undefined) {
      console.log(`[log-streamer] ➜ Note: FLASK_SOCKET_URL was not set; defaulting to http://localhost:5002`);
    }

  });

  const flaskTransportHint = process.env.FLASK_SOCKET_TRANSPORT || 'websocket';
  console.log(`[log-streamer] Calling socket.connect()... (${flaskUrl}, transport=${flaskTransportHint})`);
  _logSocket.connect();
  return _logSocket;
}


function waitForSocket() {
  const socket = getLogSocket();
  if (socket.connected) return Promise.resolve(socket);

  return new Promise((resolve) => {
    _pendingResolves.push(resolve);
    
    // Add timeout to prevent worker from hanging indefinitely if Flask server is down
    setTimeout(() => {
      if (!socket.connected) {
        console.warn(`[log-streamer] ⚠ Timeout waiting for Flask Socket.IO server. Continuing without log streaming...`);
        // Remove this resolve from the pending list
        const index = _pendingResolves.indexOf(resolve);
        if (index > -1) {
          _pendingResolves.splice(index, 1);
        }
        resolve(socket);
      }
    }, 3000);
  });
}

async function streamLog(taskId, stageId, type, data, end = false) {
  try {
    // Don't block waiting for socket - just skip if not connected
    const socket = getLogSocket();
    if (!socket || !socket.connected) {
      // Silently skip log streaming if socket not available
      return;
    }
    socket.emit('agent-log', { taskId, stageId, type, data, end });
  } catch (err) {
    console.error('[log-streamer] Failed to emit log:', err.message);
  }
}

function streamLogSync(taskId, stageId, type, data, end = false) {
  streamLog(taskId, stageId, type, data, end).catch(() => {});
}

function now() {
  return new Date().toISOString();
}
export async function ensureTaskWorkspace(taskId) {
  const taskFolder = path.join(workspaceRoot, taskId);
  await fs.mkdir(taskFolder, { recursive: true });
  return taskFolder;
}
export async function ensureWorkspace(taskId, stageId) {
  const stageFolder = path.join(workspaceRoot, taskId, stageId);
  await fs.mkdir(stageFolder, { recursive: true });
  return stageFolder;
}
function normalizeRepositoryUrl(repository) {
  if (!repository) return repository;

  const repo = repository.trim();

  // Normalize Bitbucket web URLs like:
  // https://bitbucket.org/<workspace>/<repo>/src/<branch>/
  // -> https://bitbucket.org/<workspace>/<repo>.git
  // Also handle optional trailing segments.
  const bitbucketSrcMatch = repo.match(
    /^https?:\/\/(?:www\.)?bitbucket\.org\/([^/]+)\/([^/]+)\/src\/(?:([^/?#]+)\/?)?/i
  );
  if (bitbucketSrcMatch) {
    const workspace = bitbucketSrcMatch[1];
    const project = bitbucketSrcMatch[2].replace(/\.git$/i, '');
    return `https://bitbucket.org/${workspace}/${project}.git`;
  }

  // If it's an https URL without .git but looks like a repo root, add .git
  // Example: https://bitbucket.org/<workspace>/<repo>
  const bitbucketRepoRootMatch = repo.match(/^https?:\/\/(?:www\.)?bitbucket\.org\/([^/]+)\/([^/?#]+)$/i);
  if (bitbucketRepoRootMatch && !repo.endsWith('.git')) {
    return `${repo}.git`;
  }

  // Normalize GitHub web URLs like:
  // https://github.com/<owner>/<repo>/tree/<branch>
  // https://github.com/<owner>/<repo>/blob/<branch>/...
  // -> https://github.com/<owner>/<repo>.git
  const githubMatch = repo.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/.*)?$/i);
  if (githubMatch) {
    const owner = githubMatch[1];
    const repoName = githubMatch[2].replace(/\.git$/i, '');
    return `https://github.com/${owner}/${repoName}.git`;
  }

  return repository;
}

function parseGitHubRepo(repository) {
  if (!repository) return null;
  const repo = repository.trim();
  // https://github.com/<owner>/<repo>.git or without .git
  const httpsMatch = repo.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?$/i);
  if (httpsMatch) return { owner: httpsMatch[1], repoName: httpsMatch[2] };
  // ssh git@github.com:<owner>/<repo>.git
  const sshMatch = repo.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) return { owner: sshMatch[1], repoName: sshMatch[2] };
  return null;
}

function buildGitHubAuthenticatedHttpsUrl({ owner, repoName }, token) {
  if (!token) return null;
  // Use x-access-token as username to support PATs (common GitHub behavior for HTTPS)
  // Result: https://x-access-token:<token>@github.com/<owner>/<repo>.git
  return `https://${encodeURIComponent('x-access-token')}:${encodeURIComponent(token)}@github.com/${owner}/${repoName}.git`;
}


export function looksLikeGitRepo(repository) {
  return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+|.+\.git$/i.test(repository);
}
export async function cloneRepository(repository, branch, destination) {
  if (!repository) {
    throw new Error('No repository URL provided.');
  }

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });

  // Normalize/parse repository URL.
  // NOTE: Earlier failures show git trying to clone from malformed HTTPS like:
  //   https://vyr983ygvf/ai-orchestration.git/
  // so we must avoid accidental rewriting of the DB-provided repo URL.
  let effectiveRepoUrl = repository;

  // Check for SSH format URLs: git@bitbucket.org:workspace/repo.git
  const sshMatch = repository.match(/^git@bitbucket\.org:([^/]+)\/([^/]+?)(\.git)?$/i);
  // Check for HTTPS format URLs: https://bitbucket.org/workspace/repo.git
  const httpsMatch = repository.match(/^https:\/\/(?:www\.)?bitbucket\.org\/([^/]+)\/([^/]+?)(\.git)?$/i);

  // Only use HTTPS basic-auth if we have a real Bitbucket app password.
  // (Your earlier failure showed a placeholder password was being injected.)
  const bitbucketUser = process.env.BITBUCKET_USERNAME;
  const bitbucketPass = process.env.BITBUCKET_APP_PASSWORD;
  const hasBasicCreds = bitbucketUser && bitbucketPass && !/your-bitbucket-app-password/i.test(bitbucketPass);

  // Apply basic auth credentials to HTTPS URLs
  if (hasBasicCreds && httpsMatch) {
    const workspace = httpsMatch[1];
    const repoName = httpsMatch[2];
    effectiveRepoUrl = `https://${encodeURIComponent(bitbucketUser)}:${encodeURIComponent(bitbucketPass)}@bitbucket.org/${workspace}/${repoName}.git`;
  } else if (hasBasicCreds && sshMatch) {
    // Apply basic auth to SSH-formatted URLs
    const workspace = sshMatch[1];
    const repoName = sshMatch[2];
    effectiveRepoUrl = `https://${encodeURIComponent(bitbucketUser)}:${encodeURIComponent(bitbucketPass)}@bitbucket.org/${workspace}/${repoName}.git`;
  }

  // Support token-based HTTPS cloning.
  // Use BITBUCKET_USERNAME with BITBUCKET_HTTPS_TOKEN as password:
  //   https://username:token@bitbucket.org/<workspace>/<repo>.git
  // Also support BITBUCKET_TOKEN as an alias.
  const token = process.env.BITBUCKET_HTTPS_TOKEN || process.env.BITBUCKET_TOKEN;

  if (token && bitbucketUser && httpsMatch) {
    const workspace = httpsMatch[1];
    const repoName = httpsMatch[2];
    effectiveRepoUrl = `https://${encodeURIComponent(bitbucketUser)}:${encodeURIComponent(token)}@bitbucket.org/${workspace}/${repoName}.git`;
  } else if (token && bitbucketUser && sshMatch) {
    // Apply token auth to SSH-formatted URLs
    const workspace = sshMatch[1];
    const repoName = sshMatch[2];
    effectiveRepoUrl = `https://${encodeURIComponent(bitbucketUser)}:${encodeURIComponent(token)}@bitbucket.org/${workspace}/${repoName}.git`;
  }


  // GitHub token-based HTTPS cloning.
  // Use GITHUB_TOKEN as PAT for HTTPS clones/pushes.
  // Expected env:
  //   GITHUB_TOKEN=<PAT>
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    const gh = parseGitHubRepo(repository);
    if (gh) {
      const authUrl = buildGitHubAuthenticatedHttpsUrl(gh, githubToken);
      if (authUrl) {
        effectiveRepoUrl = authUrl;
      }
    }
  }

  const args = ['clone', '--depth', '1'];
  if (branch) {
    args.push('--branch', branch, '--single-branch');
  }

  // Make git non-interactive and non-prompty.
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    // Avoid SSH hostkey / yes-no prompts.
    GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/dev/null -o BatchMode=yes',
    // If a redirect requires auth, this helps git avoid opening editors.
    SSH_ASKPASS: 'echo',

    // Fail fast when the connection is stalled (helps prevent “silent hang”).
    GIT_HTTP_LOW_SPEED_LIMIT: process.env.GIT_HTTP_LOW_SPEED_LIMIT || '1000', // bytes/sec
    GIT_HTTP_LOW_SPEED_TIME: process.env.GIT_HTTP_LOW_SPEED_TIME || '20', // seconds

    // More verbose HTTP diagnostics (useful when the clone appears stuck).
    GIT_CURL_VERBOSE: process.env.GIT_CURL_VERBOSE || '1',
  };

  console.log('[cloneRepository] effectiveRepoUrl:', effectiveRepoUrl);
  args.push(effectiveRepoUrl, destination);
  console.log('[cloneRepository] git args:', JSON.stringify(args));

  const cloneTimeoutMs = Number(process.env.CLONE_TIMEOUT_MS || 600000); // default 10 minutes
  const { spawn } = await import('child_process');

  // Use async spawn with a timeout so git clone can’t hang forever.
  // Important: kill the *process group* to terminate all git sub-processes (git/ssh/https).
  await new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: process.cwd(),
      env,
      detached: true,
    });

    console.log('[cloneRepository] git clone started pid=', child.pid);

    let stderr = '';
    let stdout = '';

    child.stdout?.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      process.stdout.write(`[git-clone stdout] ${text}`);
    });
    child.stderr?.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      process.stderr.write(`[git-clone stderr] ${text}`);
    });

    const t = setTimeout(async () => {
      try {
        // Kill process group
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch {}
      }
      // Clean up partial clone so next run can retry cleanly
      try { await fs.rm(destination, { recursive: true, force: true }); } catch {}
      reject(new Error(`git clone timed out after ${cloneTimeoutMs}ms`));
    }, cloneTimeoutMs);

    child.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve(undefined);
      const errMsg = `git clone failed: ${stderr || stdout || 'exit code ' + code}`;
      console.error('[cloneRepository] ERROR:', errMsg);
      reject(new Error(errMsg));
    });
  });
}
export function recordActivity({ taskId, event_type, message, details }) {
  const insert = db.prepare(`
    INSERT INTO activity_log (id, task_id, event_type, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run(crypto.randomUUID(), taskId || null, event_type, message, details || null, now());
}
export function normalizePipelineId(value) {
  if (!value) {
    return 'plan-code-review';
  }
  const mapping = {
    'Plan → Code → Review': 'plan-code-review',
    'Code Only': 'code-only',
    'Release Ready': 'plan-code-review',
  };
  return mapping[value] || value;
}
export function createTask(payload) {
  const id = crypto.randomUUID();
  const pipelineId = normalizePipelineId(payload.pipeline);
  const insert = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, repository, target_branch, pipeline_id, retry_count, created_at, updated_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 0, ?, ?)
  `);
  insert.run(
    id,
    payload.title,
    payload.description || null,
    payload.priority || 'medium',
    payload.repository || null,
    payload.targetBranch || null,
    pipelineId,
    now(),
    now(),
  );
  recordActivity({
    taskId: id,
    event_type: 'created',
    message: 'Task created and queued for execution.',
    details: JSON.stringify({ pipeline: pipelineId, repository: payload.repository }),
  });
  return getTaskById(id);
}
export function getTaskById(id) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row || null;
}
export function listTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all();
}
export function getTaskExecution(taskId) {
  return db.prepare('SELECT * FROM executions WHERE task_id = ? ORDER BY started_at DESC LIMIT 1').get(taskId);
}
export function getStagesForExecution(executionId) {
  return db.prepare('SELECT * FROM stage_executions WHERE execution_id = ? ORDER BY started_at ASC').all(executionId);
}
export function getArtifactsForExecution(executionId) {
  return db.prepare('SELECT * FROM artifacts WHERE execution_id = ? ORDER BY created_at ASC').all(executionId);
}
export function getEvents() {
  return db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200').all();
}
export function getPullRequestForExecution(executionId) {
  return db.prepare('SELECT * FROM pull_requests WHERE execution_id = ?').get(executionId);
}
export function claimQueuedTask() {
  const tx = db.transaction(() => {
    const task = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC LIMIT 1').get('queued');
    if (!task) {
      return null;
    }
    db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('running', now(), task.id);
    return task;
  });
  return tx();
}
export async function deleteTask(taskId) {
  // Delete a task and associated rows.
  // Deletes in dependency order to satisfy foreign keys.
  db.prepare('DELETE FROM stage_executions WHERE execution_id IN (SELECT id FROM executions WHERE task_id = ?)').run(taskId);
  db.prepare('DELETE FROM artifacts WHERE execution_id IN (SELECT id FROM executions WHERE task_id = ?)').run(taskId);
  db.prepare('DELETE FROM pull_requests WHERE execution_id IN (SELECT id FROM executions WHERE task_id = ?)').run(taskId);
  db.prepare('DELETE FROM executions WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM activity_log WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

  // Also remove workspace folder if it exists
  try {
    const taskFolder = path.join(workspaceRoot, taskId);
    await fs.rm(taskFolder, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return { ok: true };
}

export async function processTask(task) {
  console.log('[processTask] START');
  // Use task's pipeline_id if specified (not 'auto'), otherwise auto-select
  let auto;
  if (task.pipeline_id && task.pipeline_id !== 'auto') {
    console.log('[processTask] using specified pipeline:', task.pipeline_id);
    auto = {
      pipelineId: task.pipeline_id,
      selectedAgent: 'devin', // default, will be overridden by pipeline stages
      reasoning: { why: 'User-specified pipeline' }
    };
  } else {
    auto = autoSelectPipelineAndAgent(task);
    console.log('[processTask] autoSelect done:', auto.pipelineId);
  }

  recordActivity({
    taskId: task.id,
    event_type: 'agent_assigned',
    message: `Auto-selected ${auto.selectedAgent} with pipeline '${auto.pipelineId}': ${auto.reasoning.why}`,
    details: JSON.stringify({ selectedAgent: auto.selectedAgent, pipelineId: auto.pipelineId, reasoning: auto.reasoning }),
  });

  const pipeline = await getPipeline(auto.pipelineId);
  console.log('[processTask] pipeline:', pipeline ? pipeline.name : 'NOT FOUND');
  if (!pipeline) {
    recordActivity({
      taskId: task.id,
      event_type: 'failed',
      message: `Pipeline '${task.pipeline_id}' not found.`,
    });
    db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('failed', now(), task.id);
    return;
  }
  const taskWorkspace = await ensureTaskWorkspace(task.id);
  console.log('[processTask] workspace:', taskWorkspace);
  let repositoryPath = null;
  if (task.repository) {
    console.log('[processTask] cloning repo:', task.repository);
    if (!looksLikeGitRepo(task.repository)) {
      recordActivity({
        taskId: task.id,
        event_type: 'failed',
        message: `Repository value does not appear to be a valid Git URL: '${task.repository}'.`,
      });
      db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('failed', now(), task.id);
      return;
    }
    const repoDestination = path.join(taskWorkspace, 'repo');
    try {
      await cloneRepository(task.repository, task.target_branch, repoDestination);
      repositoryPath = repoDestination;
      recordActivity({
        taskId: task.id,
        event_type: 'repository_cloned',
        message: `Repository cloned to workspace.`,
        details: JSON.stringify({ repository: task.repository, branch: task.target_branch || 'default' }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      recordActivity({
        taskId: task.id,
        event_type: 'failed',
        message: `Repository clone failed: ${errorMessage}`,
      });
      db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('failed', now(), task.id);
      return;
    }
  } else {
    console.log('[processTask] no repository — skipping clone');
  }
  const executionId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO executions (id, task_id, pipeline_id, status, started_at)
    VALUES (?, ?, ?, 'running', ?)
  `).run(executionId, task.id, pipeline.id, now());
  console.log('[processTask] execution created, about to stream acceptance log');
  recordActivity({
    taskId: task.id,
    event_type: 'stage_started',
    message: `Task execution started for pipeline '${pipeline.name}'.`,
  });

  await streamLog(task.id, 'init', 'system', `\x1b[1;35m>>> Task accepted — pipeline: ${pipeline.name}\x1b[0m\r\n`);

  let previousOutputs = [];
  let finalVerdict = null;
  let failed = false;
  for (const stage of pipeline.stages) {
    const stageId = `${executionId}-${stage.id}`;
    const stageFolder = await ensureWorkspace(task.id, stage.id);
    
    let prompt;
    let result;
    
    // Use the correct prompt builder based on agent
    if (stage.agent === 'gemini') {
      prompt = buildGeminiStagePrompt(stage, task, previousOutputs, repositoryPath);
    } else if (stage.agent === 'ollama') {
      prompt = buildOllamaStagePrompt(stage, task, previousOutputs, repositoryPath);
    } else {
      // devin and other agents
      prompt = buildDevinStagePrompt(stage, task, previousOutputs, repositoryPath);
    }

    db.prepare(`
      INSERT INTO stage_executions (id, execution_id, stage_name, status, input_data, started_at)
      VALUES (?, ?, ?, 'running', ?, ?)
    `).run(stageId, executionId, stage.id, JSON.stringify({ prompt, task }), now());
    db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(stage.id, now(), task.id);
    recordActivity({
      taskId: task.id,
      event_type: 'stage_started',
      message: `Stage '${stage.name}' started.`,
      details: JSON.stringify({ stage: stage.id }),
    });

    await streamLog(task.id, stage.id, 'system', `\x1b[1;34m>>> Starting stage: ${stage.name}\x1b[0m`);

    const stageLogId = stage.id;
    // Use the correct agent based on stage configuration
    if (stage.agent === 'gemini') {
      result = await runGeminiStage({
        prompt,
        stageId: stage.id,
        workspace: stageFolder,
        onStdout: (chunk) => streamLogSync(task.id, stageLogId, 'stdout', chunk),
        onStderr: (chunk) => streamLogSync(task.id, stageLogId, 'stderr', chunk),
      });
    } else if (stage.agent === 'ollama') {
      result = await runOllamaStage({
        prompt,
        stageId: stage.id,
        workspace: stageFolder,
        onStdout: (chunk) => streamLogSync(task.id, stageLogId, 'stdout', chunk),
        onStderr: (chunk) => streamLogSync(task.id, stageLogId, 'stderr', chunk),
      });
    } else {
      result = await runDevinStage({
        prompt,
        stageId: stage.id,
        workspace: stageFolder,
        onStdout: (chunk) => streamLogSync(task.id, stageLogId, 'stdout', chunk),
        onStderr: (chunk) => streamLogSync(task.id, stageLogId, 'stderr', chunk),
      });
    }


    await streamLog(task.id, stageLogId, 'system', `\x1b[1;32m>>> Stage complete (exit ${result.exitCode})\x1b[0m`, true);

    const output = result.output || ''; 
    const logs = [result.logs, output].filter(Boolean).join('\n');
    const verdictMatch = output.match(/VERDICT:\s*(GO|FAIL|SPEC_FAIL|ESCALATE)/i);
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : null;
    db.prepare(`
      UPDATE stage_executions
      SET status = ?, verdict = ?, output_data = ?, logs = ?, completed_at = ?
      WHERE id = ?
    `).run(result.exitCode === 0 ? 'completed' : 'failed', verdict, output, logs, now(), stageId);
    const artifactPath = path.join(stageFolder, 'output.txt');
    await fs.writeFile(artifactPath, [output, result.logs].filter(Boolean).join('\n\n'), 'utf8');
    await db.prepare(`
      INSERT INTO artifacts (id, execution_id, type, file_path, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      executionId,
      stage.id,
      artifactPath,
      JSON.stringify({ stage: stage.id, verdict, exitCode: result.exitCode }),
    );
    recordActivity({
      taskId: task.id,
      event_type: result.exitCode === 0 ? 'stage_completed' : 'failed',
      message: `Stage '${stage.name}' ${result.exitCode === 0 ? 'completed' : 'failed'}.`,
      details: JSON.stringify({ stage: stage.id, verdict }),
    });
    if (result.exitCode !== 0) {
      failed = true;
      break;
    }
    if (stage.id === 'reviewing') {
      finalVerdict = verdict || 'FAIL';
      if (finalVerdict !== 'GO') {
        if (task.retry_count < 2) {
          const nextStatus = finalVerdict === 'ESCALATE' ? 'failed' : 'queued';
          db.prepare('UPDATE tasks SET status = ?, retry_count = ?, updated_at = ? WHERE id = ?')
            .run(nextStatus, task.retry_count + 1, now(), task.id);
          recordActivity({
            taskId: task.id,
            event_type: finalVerdict === 'ESCALATE' ? 'escalated' : 'retry',
            message: `Review verdict was ${finalVerdict}. Task ${nextStatus === 'queued' ? 'requeued' : 'escalated'}.`,
            details: JSON.stringify({ verdict: finalVerdict, retryCount: task.retry_count + 1 }),
          });
        } else {
          db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('failed', now(), task.id);
          recordActivity({
            taskId: task.id,
            event_type: 'failed',
            message: `Task failed after ${task.retry_count + 1} retries.`,
            details: JSON.stringify({ verdict: finalVerdict }),
          });
        }
        failed = true;
      }
    }
    previousOutputs.push(stage.id);
  }
  if (!failed) {
    db.prepare('UPDATE executions SET status = ?, completed_at = ? WHERE id = ?').run('completed', now(), executionId);
    if (finalVerdict === 'GO' || pipeline.stages[pipeline.stages.length - 1].id !== 'reviewing') {
      let prUrl = `https://example.com/${task.repository || 'repo'}/pull/unknown`;
      let prNumber = `branch-task-${task.id.slice(0, 8)}`;
      if (repositoryPath) {
        try {
          const branchName = `task-${task.id.slice(0, 8)}`;
          
          // Check if there are changes
          const statusResult = spawnSync('git', ['status', '--porcelain'], { cwd: repositoryPath, encoding: 'utf8' });
          
          if (statusResult.stdout && statusResult.stdout.trim() !== '') {
            // Configure remote with HTTPS credentials for push
            // (Bitbucket + GitHub)
            const bitbucketToken = process.env.BITBUCKET_HTTPS_TOKEN;
            const bitbucketUser = process.env.BITBUCKET_USERNAME;
            if (bitbucketToken && bitbucketUser && task.repository) {
              const httpsMatch = task.repository.match(/^https:\/\/(?:www\.)?bitbucket\.org\/([^/]+)\/([^/]+?)(\.git)?$/i);
              const sshMatch = task.repository.match(/^git@bitbucket\.org:([^/]+)\/([^/]+?)(\.git)?$/i);
              let workspace, repoName;
              if (httpsMatch) {
                workspace = httpsMatch[1];
                repoName = httpsMatch[2];
              } else if (sshMatch) {
                workspace = sshMatch[1];
                repoName = sshMatch[2];
              }
              if (workspace && repoName) {
                const remoteUrl = `https://${encodeURIComponent(bitbucketUser)}:${encodeURIComponent(bitbucketToken)}@bitbucket.org/${workspace}/${repoName}.git`;
                spawnSync('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: repositoryPath });
              }
            }

            const githubToken = process.env.GITHUB_TOKEN;
            if (githubToken && task.repository) {
              const gh = parseGitHubRepo(task.repository);
              if (gh) {
                const remoteUrl = buildGitHubAuthenticatedHttpsUrl(gh, githubToken);
                if (remoteUrl) {
                  spawnSync('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: repositoryPath });
                }
              }
            }


            spawnSync('git', ['checkout', '-b', branchName], { cwd: repositoryPath });
            spawnSync('git', ['add', '.'], { cwd: repositoryPath });
            spawnSync('git', ['commit', '-m', `Agent update for task: ${task.title}`], { cwd: repositoryPath });
            
            // Rebase-before-push guardrail with conflict resolution
            if (task.target_branch) {
              console.log(`[processTask] Attempting rebase-before-push to ${task.target_branch}`);
              const rebaseResult = await attemptRebaseWithResolution(repositoryPath, task.target_branch, task.id);
              
              if (rebaseResult.success) {
                console.log(`[processTask] Rebase-before-push successful${rebaseResult.conflicts ? ' with conflict resolution' : ''}`);
                if (rebaseResult.conflicts) {
                  recordActivity({
                    taskId: task.id,
                    event_type: 'conflict_resolved',
                    message: `Rebase conflicts resolved automatically (${rebaseResult.resolved} file(s))`,
                    details: JSON.stringify(rebaseResult),
                  });
                }
              } else if (rebaseResult.manualTask) {
                console.log(`[processTask] Rebase conflicts require manual resolution. Created task: ${rebaseResult.manualTask}`);
                recordActivity({
                  taskId: task.id,
                  event_type: 'conflict_manual',
                  message: 'Rebase conflicts require manual resolution. Created separate task.',
                  details: JSON.stringify({ manualTask: rebaseResult.manualTask, failedFiles: rebaseResult.failedFiles }),
                });
                // Skip push for this task since manual resolution is needed
                db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('conflict_resolution', now(), task.id);
                return;
              } else {
                console.warn(`[processTask] Rebase-before-push failed: ${rebaseResult.error}. Proceeding with push anyway.`);
                recordActivity({
                  taskId: task.id,
                  event_type: 'rebase_failed',
                  message: `Rebase-before-push failed: ${rebaseResult.error}. Proceeding with push.`,
                  details: JSON.stringify(rebaseResult),
                });
              }
            }
            
            // Push using credentials configured above
            const pushResult = spawnSync('git', ['push', '-u', 'origin', branchName], { cwd: repositoryPath, encoding: 'utf8' });

            
            if (pushResult.status === 0) {
              prNumber = branchName;
              // Create actual pull request via Bitbucket API (reuse token from clone)
              if (process.env.BITBUCKET_HTTPS_TOKEN && bitbucketUser && task.repository) {
                const httpsMatch = task.repository.match(/^https:\/\/(?:www\.)?bitbucket\.org\/([^/]+)\/([^/]+?)(\.git)?$/i);
                const sshMatch = task.repository.match(/^git@bitbucket\.org:([^/]+)\/([^/]+?)(\.git)?$/i);
                let workspace, repoName;
                if (httpsMatch) { workspace = httpsMatch[1]; repoName = httpsMatch[2]; }
                else if (sshMatch) { workspace = sshMatch[1]; repoName = sshMatch[2]; }
                if (workspace && repoName) {
                  try {
                    // Only attempt PR creation if we actually have a token for API auth
                    const bitbucketApiToken = process.env.BITBUCKET_HTTPS_TOKEN || process.env.BITBUCKET_TOKEN;
                    if (!bitbucketApiToken) {
                      throw new Error('Missing BITBUCKET_HTTPS_TOKEN / BITBUCKET_TOKEN for Bitbucket PR API auth');
                    }

                    const prApiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/pullrequests`;
                    const prTitle = task.title || `Agent update: ${branchName}`;
                    const prDesc = `Created by AI agent orchestration for task: ${task.id}\n\nTask: ${task.title}\nBranch: ${branchName}`;
                    const prResp = await fetch(prApiUrl, {
                      method: 'POST',
                      headers: {
'Authorization': `Basic ${Buffer.from(`${bitbucketUser}:${bitbucketApiToken}`).toString('base64')}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        title: prTitle,
                        description: prDesc,
                        source: { branch: { name: branchName } },
                        destination: { branch: { name: 'main' } },
                      }),
                    });
                    if (prResp.ok) {
                      const prData = await prResp.json();
                      prNumber = prData.id || branchName;
                      prUrl = prData.links?.html?.href || prUrl;
                      console.log('[createPullRequest] PR created:', prNumber, prUrl);
                    } else {
                      const errText = await prResp.text();
                      console.error('[createPullRequest] API error:', prResp.status, errText);
                    }
                  } catch (e) {
                    console.error('[createPullRequest] failed:', e.message);
                  }
                }
              }
              prUrl = task.repository ? task.repository.replace('.git', '') + `/tree/${branchName}` : prUrl;

              // Real GitHub or Bitbucket PR Creation
              const githubToken = process.env.GITHUB_TOKEN;
              const repoMatch = task.repository ? task.repository.match(/(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^.]+)(?:\.git)?/) : null;
              
              const bitbucketUsername = process.env.BITBUCKET_USERNAME;
              const bitbucketAppPassword = process.env.BITBUCKET_APP_PASSWORD;
              const bitbucketToken = process.env.BITBUCKET_TOKEN;
              const bitbucketMatch = task.repository ? task.repository.match(/(?:https:\/\/bitbucket\.org\/|git@bitbucket\.org:)([^/]+)\/([^.]+)(?:\.git)?/) : null;
              
              if (githubToken && repoMatch) {
                const owner = repoMatch[1];
                const repoName = repoMatch[2].replace(/\.git$/, '');
                
                console.log(`[processTask] Creating GitHub PR for ${owner}/${repoName}...`);
                
                const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    title: `Agent update for task: ${task.title}`,
                    body: `Automated PR generated by agent for task: ${task.title}\n\nTask Description:\n${task.description || 'No description provided.'}`,
                    head: branchName,
                    base: task.target_branch || 'main'
                  })
                });

                if (prResponse.ok) {
                  const prData = await prResponse.json();
                  prUrl = prData.html_url;
                  prNumber = prData.number.toString();
                  console.log(`[processTask] PR created successfully: ${prUrl}`);
                } else {
                  const errorData = await prResponse.text();
                  console.error(`[processTask] GitHub API failed to create PR: ${prResponse.status} ${errorData}`);
                }
              } else if (bitbucketMatch && (bitbucketToken || (bitbucketUsername && bitbucketAppPassword))) {
                const workspace = bitbucketMatch[1];
                const repoSlug = bitbucketMatch[2].replace(/\.git$/, '');
                
                console.log(`[processTask] Creating Bitbucket PR for ${workspace}/${repoSlug}...`);
                
                const authHeader = bitbucketToken 
                  ? `Bearer ${bitbucketToken}` 
                  : `Basic ${Buffer.from(`${bitbucketUsername}:${bitbucketAppPassword}`).toString('base64')}`;
                
                const prResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests`, {
                  method: 'POST',
                  headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    title: `Agent update for task: ${task.title}`,
                    description: `Automated PR generated by agent for task: ${task.title}\n\nTask Description:\n${task.description || 'No description provided.'}`,
                    source: {
                      branch: { name: branchName }
                    },
                    destination: {
                      branch: { name: task.target_branch || 'main' }
                    }
                  })
                });

                if (prResponse.ok) {
                  const prData = await prResponse.json();
                  prUrl = prData.links.html.href;
                  prNumber = prData.id.toString();
                  console.log(`[processTask] PR created successfully: ${prUrl}`);
                } else {
                  const errorData = await prResponse.text();
                  console.error(`[processTask] Bitbucket API failed to create PR: ${prResponse.status} ${errorData}`);
                }
              } else {
                console.log('[processTask] Skipping real PR creation: missing provider token/credentials or not a supported repository.');
                console.log('[processTask] PR creds debug:', {
                  BITBUCKET_USERNAME: process.env.BITBUCKET_USERNAME ? '***' : null,
                  BITBUCKET_HTTPS_TOKEN: process.env.BITBUCKET_HTTPS_TOKEN ? '***' : null,
                  BITBUCKET_TOKEN: process.env.BITBUCKET_TOKEN ? '***' : null,
                  BITBUCKET_APP_PASSWORD: process.env.BITBUCKET_APP_PASSWORD ? '***' : null,
                  GITHUB_TOKEN: process.env.GITHUB_TOKEN ? '***' : null,
                  repo: task.repository || null,
                });
              }
            } else {
              console.error(`Git push failed: ${pushResult.stderr}`);
            }
          } else {
            console.log('No changes detected by agent, skipping push.');
          }
        } catch (e) {
          console.error('Git PR operations failed', e);
        }
      }
      const prId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pull_requests (id, execution_id, repo, pr_number, url, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(prId, executionId, task.repository || 'unknown', prNumber, prUrl, 'open');
      db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('pr_created', now(), task.id);
      recordActivity({
        taskId: task.id,
        event_type: 'pipeline_complete',
        message: 'Task pipeline completed and changes pushed to branch.',
        details: JSON.stringify({ prCreated: true, branch: prNumber }),
      });
    } else {
      db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('completed', now(), task.id);
    }
  } else {
    db.prepare('UPDATE executions SET status = ?, completed_at = ? WHERE id = ?').run('failed', now(), executionId);
  }
}
export async function getPipelineDefinitions() {
  return await listPipelines();
}

export { getPipeline, getPipelineSync } from './pipelines.js';

export function getAutoSelection(task) { return autoSelectPipelineAndAgent(task); }

export function getAgentDefinitions() {
  return listAgents();
}
