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
    id: 'gemini-code-only',
    name: 'Gemini Code Only',
    description: 'A single-stage pipeline using Gemini CLI to generate code.',
    stages: [
      {
        id: 'coding',
        name: 'Coding',
        agent: 'gemini',
        summary: 'Generate an implementation diff using Gemini CLI.',
        outputFiles: ['implementation.diff.md'],
      },
    ],
  },
  {
    id: 'gemini-plan-code-review',
    name: 'Gemini Plan → Code → Review',
    description: 'Multi-stage pipeline using Gemini CLI: plan, implement, then review.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'gemini',
        summary: 'Create a requirements and design plan for the task using Gemini CLI.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'gemini',
        summary: 'Generate a code implementation based on the plan using Gemini CLI.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'gemini',
        summary: 'Review the implementation and produce a verdict using Gemini CLI.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
  {
    id: 'hybrid-gemini-devin',
    name: 'Hybrid: Gemini Plan → Devin Code → Review',
    description: 'Use Gemini for planning, Devin for coding, then review.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'gemini',
        summary: 'Create a requirements and design plan for the task using Gemini CLI.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'devin',
        summary: 'Generate a code implementation based on the plan using Devin CLI.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'gemini',
        summary: 'Review the implementation and produce a verdict using Gemini CLI.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
  {
    id: 'ollama-plan-code-review',
    name: 'Ollama Plan → Code → Review',
    description: 'A full 3-stage pipeline using Ollama (local) for planning, coding, and review.',
    stages: [
      {
        id: 'planning',
        name: 'Planning',
        agent: 'ollama',
        summary: 'Create a requirements and design plan for the task using Ollama.',
        outputFiles: ['planner.requirements.md', 'planner.design.md'],
      },
      {
        id: 'coding',
        name: 'Coding',
        agent: 'ollama',
        summary: 'Generate a code implementation based on the plan using Ollama.',
        outputFiles: ['implementation.diff.md'],
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'ollama',
        summary: 'Review the implementation and produce a verdict using Ollama.',
        outputFiles: ['reviewer.review.md'],
      },
    ],
  },
  {
    id: 'ollama-code-only',
    name: 'Ollama Code Only',
    description: 'A single-stage pipeline using Ollama to generate code.',
    stages: [
      {
        id: 'coding',
        name: 'Coding',
        agent: 'ollama',
        summary: 'Generate an implementation diff using Ollama.',
        outputFiles: ['implementation.diff.md'],
      },
    ],
  },
];

// Cache for loaded pipelines
let cachedPipelines = null;
let loadedFromYaml = false;

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
