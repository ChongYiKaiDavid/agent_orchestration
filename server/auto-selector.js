import { pipelines } from './pipelines.js';

const AGENT_CAPABILITIES = {
  devin: {
    strengths: ['coding', 'refactoring', 'bug fixing', 'testing', 'debugging', 'implementation', 'code review', 'architecture'],
    complexity: 'high',
    speed: 'medium',
    bestFor: ['full implementation', 'complex refactoring', 'multi-file changes', 'detailed coding tasks'],
  },
  gemini: {
    strengths: ['planning', 'documentation', 'analysis', 'research', 'review', 'design', 'summarization', 'understanding'],
    complexity: 'medium',
    speed: 'fast',
    bestFor: ['quick planning', 'document generation', 'code analysis', 'research tasks', 'initial drafts'],
  },
};

const COMPLEXITY_PATTERNS = {
  high: /\b(complex|architecture|refactoring|migrate| redesign| overhaul|system-wide|distributed|microservice)\b/i,
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
  
  // Default based on description length
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
  
  return 'coding'; // Default to coding
}

function detectKeywords(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  const allKeywords = Object.values(AGENT_CAPABILITIES).flatMap(a => a.strengths);
  
  return allKeywords.filter(keyword => text.includes(keyword));
}

function selectBestAgent(taskType, complexity, keywords) {
  const text = `${taskType} ${complexity} ${keywords.join(' ')}`;
  
  // For planning tasks, prefer Gemini
  if (taskType === 'planning') {
    return 'gemini';
  }
  
  // For docs-only tasks, prefer Gemini
  if (taskType === 'docs') {
    return 'gemini';
  }
  
  // For high complexity coding, prefer Devin
  if (complexity === 'high' && taskType === 'coding') {
    return 'devin';
  }
  
  // For review tasks, prefer Gemini (faster)
  if (taskType === 'review') {
    return 'gemini';
  }
  
  // Default to Devin for coding tasks
  if (taskType === 'coding') {
    return 'devin';
  }
  
  // Fallback to Devin for complex tasks
  if (complexity === 'high') {
    return 'devin';
  }
  
  // Default to hybrid pipeline for balanced approach
  return 'hybrid';
}

function selectBestPipeline(taskType, complexity, preferredAgent) {
  // High complexity tasks need full pipeline
  if (complexity === 'high') {
    if (preferredAgent === 'gemini') {
      return 'gemini-plan-code-review';
    } else if (preferredAgent === 'devin') {
      return 'plan-code-review';
    }
    return 'plan-code-review';
  }
  
  // Planning-only tasks
  if (taskType === 'planning') {
    return preferredAgent === 'gemini' ? 'gemini-plan-code-review' : 'plan-code-review';
  }
  
  // Documentation tasks - single stage is fine
  if (taskType === 'docs') {
    return 'gemini-code-only';
  }
  
  // Review tasks
  if (taskType === 'review') {
    return 'gemini-code-only';
  }
  
  // Coding tasks - use hybrid for balanced approach
  if (taskType === 'coding') {
    if (complexity === 'low') {
      return preferredAgent === 'gemini' ? 'gemini-code-only' : 'code-only';
    }
    return 'hybrid-gemini-devin';
  }
  
  // Default to hybrid pipeline
  return 'hybrid-gemini-devin';
}

export function autoSelectPipelineAndAgent(task) {
  const title = task.title || '';
  const description = task.description || '';
  
  const complexity = analyzeTaskComplexity(title, description);
  const taskType = analyzeTaskType(title, description);
  const keywords = detectKeywords(title, description);
  const preferredAgent = selectBestAgent(taskType, complexity, keywords);
  const pipelineId = selectBestPipeline(taskType, complexity, preferredAgent);
  
  const pipeline = pipelines.find(p => p.id === pipelineId);
  
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

function buildReasoningText(taskType, complexity, agent, pipeline) {
  const agents = {
    devin: 'Devin (better for complex coding)',
    gemini: 'Gemini (faster for planning/reviews)',
    hybrid: 'Hybrid (Gemini plan + Devin code)',
  };
  
  const pipelines = {
    'plan-code-review': 'full 3-stage Devin pipeline',
    'code-only': 'single-stage Devin coding',
    'gemini-plan-code-review': 'full 3-stage Gemini pipeline',
    'gemini-code-only': 'single-stage Gemini',
    'hybrid-gemini-devin': 'hybrid pipeline (optimal)',
  };
  
  return `${agents[agent]} with ${pipelines[pipeline]} for ${complexity} complexity ${taskType} task.`;
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
