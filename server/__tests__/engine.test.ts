import fs from 'fs/promises';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.TEST_DB_FILE = ':memory:';
process.env.TEST_WORKSPACE_ROOT = 'server/test-workspaces';

vi.mock('../agents/devin.js', async () => {
  const actual = await vi.importActual('../agents/devin.js');
  return {
    ...actual,
    runDevinStage: vi.fn(async () => ({ exitCode: 0, output: 'VERDICT: GO', logs: 'success' })),
  };
});

const engine = await import('../engine.js');
const dbModule = await import('../db.js');

const workspaceRoot = path.resolve(process.cwd(), 'server', 'test-workspaces');

async function cleanupWorkspace() {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
}

describe('Engine logic', () => {
  beforeEach(async () => {
    dbModule.resetDatabase();
    await cleanupWorkspace();
  });

  afterAll(async () => {
    await cleanupWorkspace();
  });

  it('normalizes pipeline labels into pipeline ids', () => {
    expect(engine.normalizePipelineId('Code Only')).toBe('code-only');
    expect(engine.normalizePipelineId('Plan → Code → Review')).toBe('plan-code-review');
    expect(engine.normalizePipelineId('Release Ready')).toBe('plan-code-review');
    expect(engine.normalizePipelineId('code-only')).toBe('code-only');
  });

  it('validates git repository values correctly', () => {
    expect(engine.looksLikeGitRepo('https://github.com/user/repo.git')).toBe(true);
    expect(engine.looksLikeGitRepo('git@github.com:user/repo.git')).toBe(true);
    expect(engine.looksLikeGitRepo('not-a-repo')).toBe(false);
  });

  it('creates a queued task and records activity', () => {
    const task = engine.createTask({ title: 'Example Task', pipeline: 'Code Only' });

    expect(task.title).toBe('Example Task');
    expect(task.status).toBe('queued');
    expect(task.pipeline_id).toBe('code-only');
    expect(engine.getTaskById(task.id)?.id).toBe(task.id);
    expect(engine.listTasks()).toHaveLength(1);
    expect(engine.getEvents()).toHaveLength(1);
  });

  it('claims a queued task and transitions it to running', () => {
    const task = engine.createTask({ title: 'Claim Task' });
    const claimed = engine.claimQueuedTask();

    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(task.id);
    expect(engine.getTaskById(task.id)?.status).toBe('running');
  });

  it('processes a code-only task and creates a pull request', async () => {
    const task = engine.createTask({ title: 'Process Task', pipeline: 'Code Only' });
    const claimed = engine.claimQueuedTask();

    expect(claimed).not.toBeNull();
    await engine.processTask(claimed as any);

    const updated = engine.getTaskById(task.id);
    expect(updated?.status).toBe('pr_created');

    const execution = engine.getTaskExecution(task.id);
    expect(execution).not.toBeNull();

    const artifacts = engine.getArtifactsForExecution(execution!.id);
    expect(artifacts.length).toBeGreaterThan(0);
  });

  it('fails tasks with invalid repository values', async () => {
    const task = engine.createTask({ title: 'Bad Repo Task', repository: 'example.com/repo' });
    await engine.processTask(task);

    const updated = engine.getTaskById(task.id);
    expect(updated?.status).toBe('failed');
  });

  it('throws when cloneRepository is called without a repository', async () => {
    await expect(engine.cloneRepository('', null, path.join(workspaceRoot, 'repo'))).rejects.toThrow('No repository URL provided.');
  });
});
