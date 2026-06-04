import fs from 'fs/promises';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testWorkspace = path.resolve(process.cwd(), 'server', 'test-workspace-devin');

const { buildStagePrompt } = await import('../agents/devin.js');

describe('Devin agent helper', () => {
  beforeEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it('builds a stage prompt with repository path and previous artifacts', () => {
    const task = {
      title: 'Test Task',
      description: 'Feature description',
      repository: 'https://example.com/repo.git',
      target_branch: 'main',
    };
    const stage = { id: 'planning', name: 'Planning' };
    const prompt = buildStagePrompt(stage as any, task as any, ['planner.requirements.md'], testWorkspace);

    expect(prompt).toContain('Stage: Planning');
    expect(prompt).toContain('Repository path:');
    expect(prompt).toContain('Previous artifacts:');
    expect(prompt).toContain('VERDICT: GO');
  });


});
