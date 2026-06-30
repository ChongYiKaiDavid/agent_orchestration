import { loadPipelines as loadYamlPipelines, getPipelineById } from './pipeline-loader.js';

// Fallback JavaScript pipeline definitions (used if YAML files are not found)
const fallbackPipelines = [
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
  {
    id: 'deepseek-code-only',
    name: 'DeepSeek Code Only',
    description: 'A single-stage pipeline using DeepSeek to generate code.',
    stages: [
      {
        id: 'coding',
        name: 'Coding',
        agent: 'deepseek',
        summary: 'Generate an implementation diff using DeepSeek.',
        outputFiles: ['implementation.diff.md'],
      },
    ],
  },
  {
    id: 'deepseek-plan-code-review',
    name: 'DeepSeek Plan → Code → Review',
    description: 'Multi-stage pipeline using DeepSeek for planning, coding, and review.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'deepseek',
        summary: 'Create a requirements and design plan using DeepSeek.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'deepseek',
        summary: 'Generate a code implementation based on the plan using DeepSeek.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'deepseek',
        summary: 'Review the implementation and produce a verdict using DeepSeek.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
  {
    id: 'hybrid-deepseek-devin',
    name: 'Hybrid: DeepSeek Plan → Devin Code → Review',
    description: 'Use DeepSeek for planning and review, Devin for coding.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'deepseek',
        summary: 'Create a requirements and design plan using DeepSeek.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'devin',
        summary: 'Generate a code implementation based on the plan using Devin.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'deepseek',
        summary: 'Review the implementation and produce a verdict using DeepSeek.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
];

// Cache for loaded pipelines
let cachedPipelines = null;
let loadedFromYaml = false;

export function invalidatePipelinesCache() {
  cachedPipelines = null;
  loadedFromYaml = false;
}

/**
 * Load pipelines from YAML files or fallback to JavaScript definitions
 */
async function initializePipelines() {
  if (cachedPipelines !== null) {
    return cachedPipelines;
  }

  const yamlPipelines = await loadYamlPipelines();
  if (yamlPipelines) {
    cachedPipelines = yamlPipelines;
    loadedFromYaml = true;
  } else {
    cachedPipelines = fallbackPipelines;
    loadedFromYaml = false;
  }
  return cachedPipelines;
}

/**
 * Get all pipelines (async initialization)
 */
export async function listPipelines() {
  return await initializePipelines();
}

/**
 * Get a specific pipeline by ID
 */
export async function getPipeline(id) {
  const pipelines = await initializePipelines();
  return pipelines.find((pipeline) => pipeline.id === id) || null;
}

/**
 * Synchronous version for backward compatibility (uses cached pipelines)
 */
export function listPipelinesSync() {
  if (cachedPipelines === null) {
    return fallbackPipelines;
  }
  return cachedPipelines;
}

/**
 * Synchronous getPipeline for backward compatibility
 */
export function getPipelineSync(id) {
  if (cachedPipelines === null) {
    return fallbackPipelines.find((pipeline) => pipeline.id === id) || null;
  }
  return cachedPipelines.find((pipeline) => pipeline.id === id) || null;
}

// Export the fallback pipelines for reference
export { fallbackPipelines };
