import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import db from './db.js';
import { getPipeline, listPipelines } from './pipelines.js';
import { runDevinStage, buildStagePrompt as buildDevinStagePrompt } from './agents/devin.js';
import { runGeminiStage, buildStagePrompt as buildGeminiStagePrompt } from './agents/gemini.js';
import { listAgents } from './agents.js';
import { autoSelectPipelineAndAgent } from './auto-selector.js';
import { io } from 'socket.io-client';

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

  const flaskUrl = process.env.FLASK_SOCKET_URL || 'http://localhost:5002';
  _logSocket = io(flaskUrl, {
    transports: ['websocket'],
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
  });

  console.log('[log-streamer] Calling socket.connect()...');
  _logSocket.connect();
  return _logSocket;
}

function waitForSocket() {
  const socket = getLogSocket();
  if (socket.connected) return Promise.resolve(socket);

  return new Promise((resolve) => {
    _pendingResolves.push(resolve);
  });
}

async function streamLog(taskId, stageId, type, data, end = false) {
  try {
    await waitForSocket();
    _logSocket.emit('agent-log', { taskId, stageId, type, data, end });
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
export function looksLikeGitRepo(repository) {
  return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+|.+\.git$/i.test(repository);
}
export async function cloneRepository(repository, branch, destination) {
  if (!repository) {
    throw new Error('No repository URL provided.');
  }
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  const args = ['clone', '--depth', '1'];
  if (branch) {
    args.push('--branch', branch, '--single-branch');
  }
  args.push(repository, destination);
  const result = spawnSync('git', args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git clone failed: ${result.stderr || result.stdout}`);
  }
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
  // Auto-select the best pipeline and agent based on task content
  const auto = autoSelectPipelineAndAgent(task);
  console.log('[processTask] autoSelect done:', auto.pipelineId);

  recordActivity({
    taskId: task.id,
    event_type: 'agent_assigned',
    message: `Auto-selected ${auto.selectedAgent} with pipeline '${auto.pipelineId}': ${auto.reasoning.why}`,
    details: JSON.stringify({ selectedAgent: auto.selectedAgent, pipelineId: auto.pipelineId, reasoning: auto.reasoning }),
  });

  const pipeline = getPipeline(auto.pipelineId);
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
    
    if (stage.agent === 'gemini') {
      prompt = buildGeminiStagePrompt(stage, task, previousOutputs, repositoryPath);
    } else {
      prompt = buildDevinStagePrompt(stage, task, previousOutputs, repositoryPath);
    }
    db.prepare(`
      INSERT INTO stage_executions (id, execution_id, stage_name, status, input_data, started_at)
      VALUES (?, ?, ?, 'running', ?, ?)
    `).run(stageId, executionId, stage.id, JSON.stringify({ prompt, task }), now());
    recordActivity({
      taskId: task.id,
      event_type: 'stage_started',
      message: `Stage '${stage.name}' started.`,
      details: JSON.stringify({ stage: stage.id }),
    });

    await streamLog(task.id, stage.id, 'system', `\x1b[1;34m>>> Starting stage: ${stage.name}\x1b[0m`);

    const stageLogId = stage.id;
    if (stage.agent === 'gemini') {
      result = await runGeminiStage({
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
            spawnSync('git', ['checkout', '-b', branchName], { cwd: repositoryPath });
            spawnSync('git', ['add', '.'], { cwd: repositoryPath });
            spawnSync('git', ['commit', '-m', `Agent update for task: ${task.title}`], { cwd: repositoryPath });
            const pushResult = spawnSync('git', ['push', '-u', 'origin', branchName], { cwd: repositoryPath, encoding: 'utf8' });
            
            if (pushResult.status === 0) {
              prNumber = branchName;
              prUrl = task.repository ? task.repository.replace('.git', '') + `/tree/${branchName}` : prUrl;
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
export function getPipelineDefinitions() {
  return listPipelines();
}

export { getPipeline } from './pipelines.js';

export function getAutoSelection(task) { return autoSelectPipelineAndAgent(task); }

export function getAgentDefinitions() {
  return listAgents();
}
