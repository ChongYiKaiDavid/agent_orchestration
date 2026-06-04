import { describe, expect, it } from 'vitest';
import { listPipelines, getPipeline } from '../pipelines.js';

describe('Pipeline definitions', () => {
  it('returns the full pipeline list', () => {
    const pipelines = listPipelines();

    expect(pipelines).toHaveLength(2);
    expect(pipelines.map((pipeline) => pipeline.id)).toEqual(['code-only', 'plan-code-review']);
  });

  it('returns a pipeline by id', () => {
    const pipeline = getPipeline('plan-code-review');

    expect(pipeline).not.toBeNull();
    expect(pipeline?.name).toContain('Plan');
  });

  it('returns null for an unknown pipeline', () => {
    expect(getPipeline('does-not-exist')).toBeNull();
  });
});
