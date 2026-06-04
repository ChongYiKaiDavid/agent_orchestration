import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import db from './db.js';
import { getPipeline as getPipelineDefinition, listPipelines } from './pipelines.js';
import { runDevinStage, buildStagePrompt } from './agents/devin.js';
import { listAgents } from './agents.js';

const workspaceRoot = path.resolve(process.cwd(), process.env.TEST_WORKSPACE_ROOT || 'server/workspaces');

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

export async function processTask(task) {
  const pipeline = getPipeline(task.pipeline_id);
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
  let repositoryPath = null;
  if (task.repository) {
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
  }

  const executionId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO executions (id, task_id, pipeline_id, status, started_at)
    VALUES (?, ?, ?, 'running', ?)
  `).run(executionId, task.id, pipeline.id, now());

  recordActivity({
    taskId: task.id,
    event_type: 'stage_started',
    message: `Task execution started for pipeline '${pipeline.name}'.`,
  });

  let previousOutputs = [];
  let finalVerdict = null;
  let failed = false;

  for (const stage of pipeline.stages) {
    const stageId = `${executionId}-${stage.id}`;
    const stageFolder = await ensureWorkspace(task.id, stage.id);
    const prompt = buildStagePrompt(stage, task, previousOutputs, repositoryPath);

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

    const result = await runDevinStage({ prompt, stageId: stage.id, workspace: stageFolder });
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
      const prId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pull_requests (id, execution_id, repo, pr_number, url, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(prId, executionId, task.repository || 'unknown', `PR-${Math.floor(Math.random() * 10000)}`, `https://example.com/${task.repository || 'repo'}/pull/${Math.floor(Math.random() * 10000)}`, 'open');

      db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('pr_created', now(), task.id);
      recordActivity({
        taskId: task.id,
        event_type: 'pipeline_complete',
        message: 'Task pipeline completed and pull request created.',
        details: JSON.stringify({ prCreated: true }),
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

export function getPipeline(id) {
  return getPipelineDefinition(id);
}

export function getAgentDefinitions() {
  return listAgents();
}
