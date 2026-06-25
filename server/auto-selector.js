import { fallbackPipelines } from './pipelines.js';

const AGENT_CAPABILITIES = {
  devin: {
    strengths: ['coding', 'refactoring', 'bug fixing', 'testing', 'debugging', 'implementation', 'code review', 'architecture'],
    complexity: 'high',
    speed: 'medium',
    bestFor: ['full implementation', 'complex refactoring', 'multi-file changes', 'detailed coding tasks'],
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

  // Force Ollama-only for testing purposes
  if (process.env.OLLAMA_ONLY === 'true') {
    return 'ollama';
  }

  // For planning tasks, prefer devin
  if (taskType === 'planning') {
    return 'devin';
  }

  // For docs-only tasks, prefer devin
  if (taskType === 'docs') {
    return 'devin';
  }

  // For high complexity coding, prefer Devin
  if (complexity === 'high' && taskType === 'coding') {
    return 'devin';
  }

  // For review tasks, prefer devin (faster)
  if (taskType === 'review') {
    return 'devin';
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
  // Ollama-only mode
  if (process.env.OLLAMA_ONLY === 'true') {
    // For Ollama-only mode, still use the standard pipelines but agent selection will pick ollama
    if (complexity === 'high' || taskType === 'planning' || taskType === 'review') {
      return 'plan-code-review';
    }
    if (taskType === 'coding') {
      if (complexity === 'low') return 'code-only';
      return 'plan-code-review';
    }
    return 'plan-code-review';
  }

  // High complexity tasks need full pipeline
  if (complexity === 'high') {
    return 'plan-code-review';
  }

  // Planning-only tasks
  if (taskType === 'planning') {
    return 'plan-code-review';
  }

  // Documentation tasks - single stage is fine
  if (taskType === 'docs') {
    return 'code-only';
  }

  // Review tasks
  if (taskType === 'review') {
    return 'code-only';
  }

  // Coding tasks
  if (taskType === 'coding') {
    if (complexity === 'low') {
      return 'code-only';
    }
    return 'plan-code-review';
  }

  // Default to full pipeline
  return 'plan-code-review';
}


export function autoSelectPipelineAndAgent(task) {
  const title = task.title || '';
  const description = task.description || '';
  
  const complexity = analyzeTaskComplexity(title, description);
  const taskType = analyzeTaskType(title, description);
  const keywords = detectKeywords(title, description);
  const preferredAgent = selectBestAgent(taskType, complexity, keywords);
  const pipelineId = selectBestPipeline(taskType, complexity, preferredAgent);
  
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
  
  // Force Ollama-only for testing purposes
  if (process.env.OLLAMA_ONLY === 'true') {
    return 'ollama';
  }
  
  const complexity = analyzeTaskComplexity(title, description);
  const taskType = analyzeTaskType(title, description);
  const keywords = detectKeywords(title, description);
  
  // Select agent based on stage and task characteristics
  if (stageId === 'planning') {
    // For planning, prefer Devin to avoid Gemini account issues.
    return 'devin';
  } else if (stageId === 'coding') {
    // For coding, prefer Devin for complex tasks, Gemini for simple ones
    if (complexity === 'high' || complexity === 'medium') {
      return 'devin';
    }
    return 'devin';
  } else if (stageId === 'reviewing') {
    // For reviewing, prefer Gemini for speed
    return 'devin';
  }
  
  // Default to Devin
  return 'devin';
}

function buildReasoningText(taskType, complexity, agent, pipeline) {
  const agents = {
    devin: 'Devin (better for complex coding)',
    ollama: 'Ollama (local AI)',
  };
  
  const pipelines = {
    'plan-code-review': 'full 3-stage pipeline (plan → code → review)',
    'code-only': 'single-stage coding pipeline',
  };
  
  return `${agents[agent] || 'Auto-selected agent'} with ${pipelines[pipeline] || pipeline} for ${complexity} complexity ${taskType} task.`;
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
