import { fallbackPipelines } from './pipelines.js';
import fs from 'fs';
import path from 'path';

// Load agent configurations dynamically from server/agents directory
function loadAgentCapabilities() {
  const agentsDir = path.join(process.cwd(), 'server', 'agents');
  const capabilities = {};

  if (!fs.existsSync(agentsDir)) {
    console.warn('[auto-selector] Agents directory not found, using fallback capabilities');
    return getFallbackCapabilities();
  }

  try {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      capabilities[content.id] = content.capabilities || {};
    }
    console.log(`[auto-selector] Loaded ${Object.keys(capabilities).length} agent configurations`);
    return capabilities;
  } catch (error) {
    console.error('[auto-selector] Error loading agent configurations:', error);
    return getFallbackCapabilities();
  }
}

function getFallbackCapabilities() {
  // No hardcoded “real agents” list.
  // If the agents directory is missing/unreadable, return an empty capabilities map.
  // Callers should still be able to proceed (may need to fall back to explicit stage.agent).
  return {};
}


let AGENT_CAPABILITIES = loadAgentCapabilities();


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
  // Choose the best agent based on loaded capabilities.
  // If we have no capability data, return null so callers can rely on stage.agent.
  const agentIds = Object.keys(AGENT_CAPABILITIES || {});
  if (agentIds.length === 0) return null;

  // Simple scoring:
  // - match task type strengths
  // - match complexity preference
  // - fall back to bestFor keyword hits
  const typeToKeywords = {
    planning: ['planning', 'requirements', 'design', 'architecture', 'decompose', 'strategy', 'roadmap'],
    coding: ['coding', 'code', 'implement', 'build', 'refactor', 'fix', 'development'],
    review: ['review', 'check', 'audit', 'analyze', 'validate', 'test', 'verify'],
    docs: ['documentation', 'docs', 'readme', 'comment', 'guide', 'manual'],
  };

  const desired = typeToKeywords[taskType] || [];

  let best = null;
  let bestScore = -Infinity;

  for (const id of agentIds) {
    const caps = AGENT_CAPABILITIES[id] || {};
    const strengths = Array.isArray(caps.strengths) ? caps.strengths : [];
    const bestFor = Array.isArray(caps.bestFor) ? caps.bestFor : [];

    let score = 0;

    // Strength keyword match
    for (const kw of desired) {
      if (strengths.some(s => String(s).toLowerCase().includes(String(kw).toLowerCase()))) {
        score += 5;
      }
    }

    // Complexity alignment
    if (caps.complexity && String(caps.complexity).toLowerCase() === String(complexity).toLowerCase()) {
      score += 3;
    }

    // Best-for match (broad)
    if (bestFor.length) {
      score += bestFor.length > 0 ? 1 : 0;
    }

    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best;
}


function selectBestPipeline(taskType, complexity) {
  // Keep pipeline selection behavior as-is for now.
  // (Checklist item #1 is specifically about agent/provider hardcoding.)
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

  // Derive taskType primarily from stageId so we don't hardcode provider ids.
  let taskType;
  if (stageId === 'planning') taskType = 'planning';
  else if (stageId === 'coding') taskType = 'coding';
  else if (stageId === 'reviewing') taskType = 'review';
  else taskType = analyzeTaskType(title, description);

  // Use capability-based selection.
  return selectBestAgent(taskType, complexity);
}


function buildReasoningText(taskType, complexity, agent, pipeline) {
  const agents = {
    devin: 'Devin (best for complex coding)',
    copilot: 'GitHub Copilot (terminal-native coding and reasoning)',
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
