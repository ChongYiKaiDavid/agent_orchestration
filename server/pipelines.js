export const pipelines = [
  {
    id: 'code-only',
    name: 'Code Only',
    description: 'A single-stage pipeline that generates code from the task description.',
    stages: [
      {
        id: 'coding',
        name: 'Coding',
        agent: 'devin',
        summary: 'Generate an implementation diff from the task request.',
        outputFiles: ['implementation.diff.md'],
      },
    ],
  },
  {
    id: 'plan-code-review',
    name: 'Plan → Code → Review',
    description: 'Create a plan, implement the code, then review it.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'devin',
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
        agent: 'devin',
        summary: 'Review the implementation and produce a verdict.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
];

export function listPipelines() {
  return pipelines;
}

export function getPipeline(id) {
  return pipelines.find((pipeline) => pipeline.id === id) || null;
}
