export type PipelineStageTemplate = {
  id: string;
  name: string;
  agent: string;
  summary: string;
  outputFiles?: string[];
};

export type PipelineTemplate = {
  id: string;
  name: string;
  description: string;
  git?: {
    create_branch?: boolean;
    from?: string;
    pattern?: string;
    commit_strategy?: string;
  };
  stages: PipelineStageTemplate[];
  on_complete?: Array<{ hook: string; config?: Record<string, any> }>;
  post_complete_status?: string;
  max_retries?: number;
};

export function buildClonedPlanCodeReviewTemplate(nextId: string): PipelineTemplate {
  return {
    id: nextId,
    name: `Stage Name`,
    description: 'Pipeline Description.',
    git: {
      create_branch: true,
      from: '{git.target_branch}',
      pattern: 'feature/{task_id}',
      commit_strategy: 'on_go',
    },
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'deepseek',
        summary: 'Create a requirements and design plan for the task.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'devin',
        summary: 'Generate a code implementation based on the plan.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'deepseek',
        summary: 'Review the implementation and produce a verdict.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
    on_complete: [
      { hook: 'git_push' },
      {
        hook: 'create_pr',
        config: {
          target_branch: '{git.target_branch}',
          title: '{task_id}: {task_title}',
        },
      },
    ],
    post_complete_status: 'pr_review',
    max_retries: 3,
  };
}
