import { fallbackPipelines } from './pipelines.js';

const AGENT_CAPABILITIES = {
  devin: {
    strengths: ['coding', 'refactoring', 'bug fixing', 'testing', 'debugging', 'implementation', 'code review', 'architecture'],
    complexity: 'high',
    speed: 'medium',
    bestFor: ['full implementation', 'complex refactoring', 'multi-file changes', 'detailed coding tasks'],
  },
  deepseek: {
    strengths: ['code generation', 'planning', 'review', 'analysis', 'documentation'],
    complexity: 'medium',
    speed: 'fast',
    bestFor: ['planning', 'code review', 'low to medium complexity coding', 'documentation'],
  },
};

const COMPLEXITY_PATTERNS = {
  high: /\b(complex|architecture|refactoring|migrate|redesign|overhaul|system-wide|distributed|microservice)\b/i,
  medium: /\b(feature|implement|create|build|add|update|modify|refactor|optimize|fix)\b/i,
  low: /\b(documentation|typo|comment|readme|simple|minor|small|quick)\b/i,
};

const TYPE_PATTERNS = {
  planning: /\b(plan|design|architecture|spec|requirements|roadmap|strategy|decompose)\b/i,
  coding: /\b(code|implement|build|create|feature|refactor|fix|add|modify|update|develop)\b/i,
  review: /\b(review|check|audit|analyze|validate|test|verify)\b/i,
  docs: /\b(documentation|docs|readme|comment|guide|manual)\b/i,
};

function analyzeTaskComplexity(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();

  if (COMPLEXITY_PATTERNS.high.test(text)) return 'high';
  if (COMPLEXITY_PATTERNS.medium.test(text)) return 'medium';
  if (COMPLEXITY_PATTERNS.low.test(text)) return 'low';

  const descLength = (description || '').length;
  if (descLength > 500) return 'high';
  if (descLength > 100) return 'medium';
  return 'low';
}

function analyzeTaskType(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
    if (pattern.test(text)) return type;
  }
  return 'coding';
}

function detectKeywords(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  const allKeywords = Object.values(AGENT_CAPABILITIES).flatMap(a => a.strengths);
  return allKeywords.filter(keyword => text.includes(keyword));
}

function selectBestAgent(taskType, complexity) {
  // Planning and review — use DeepSeek (fast, good at analysis)
  if (taskType === 'planning' || taskType === 'review' || taskType === 'docs') {
    return 'deepseek';
  }

  // High complexity coding — use Devin
  if (complexity === 'high' && taskType === 'coding') {
    return 'devin';
  }

  // Low/medium complexity coding — use DeepSeek
  if (taskType === 'coding') {
    return complexity === 'low' ? 'deepseek' : 'devin';
  }

  return 'devin';
}

function selectBestPipeline(taskType, complexity) {
  if (complexity === 'high' || taskType === 'planning') return 'plan-code-review';
  if (taskType === 'docs' || taskType === 'review') return 'code-only';
  if (taskType === 'coding') return complexity === 'low' ? 'code-only' : 'plan-code-review';
  return 'plan-code-review';
}

export function autoSelectPipelineAndAgent(task) {
  const title = task.title || '';
  const description = task.description || '';

  const complexity = analyzeTaskComplexity(title, description);
  const taskType = analyzeTaskType(title, description);
  const keywords = detectKeywords(title, description);
  const preferredAgent = selectBestAgent(taskType, complexity);
  const pipelineId = selectBestPipeline(taskType, complexity);

  const pipeline = fallbackPipelines.find(p => p.id === pipelineId);

  return {
    pipelineId,
    pipeline,
    selectedAgent: preferredAgent,
    reasoning: {
      complexity,
      taskType,
      keywords,
      why: buildReasoningText(taskType, complexity, preferredAgent, pipelineId),
    },
  };
}

export function autoSelectAgentForStage(stageId, task) {
  const title = task.title || '';
  const description = task.description || '';

  const complexity = analyzeTaskComplexity(title, description);
  const taskType = analyzeTaskType(title, description);

  if (stageId === 'planning' || stageId === 'reviewing') {
    return 'deepseek';
  }

  if (stageId === 'coding') {
    return complexity === 'high' ? 'devin' : 'deepseek';
  }

  return 'devin';
}

function buildReasoningText(taskType, complexity, agent, pipeline) {
  const agents = {
    devin: 'Devin (best for complex coding)',
    deepseek: 'DeepSeek (fast, good for planning and review)',
  };

  const pipelines = {
    'plan-code-review': 'full 3-stage pipeline (plan → code → review)',
    'code-only': 'single-stage coding pipeline',
  };

  return `${agents[agent] || agent} with ${pipelines[pipeline] || pipeline} for ${complexity} complexity ${taskType} task.`;
}

export function listAgents() {
  return Object.entries(AGENT_CAPABILITIES).map(([id, caps]) => ({
    id,
    ...caps,
  }));
}

export function getAgentCapabilities(agentId) {
  return AGENT_CAPABILITIES[agentId] || null;
}
