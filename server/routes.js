import express from 'express';
import crypto from 'crypto';
import path from 'path';
import {
  createTask,
  getTaskById,
  listTasks,
  getTaskExecution,
  getStagesForExecution,
  getArtifactsForExecution,
  getEvents,
  getPipelineDefinitions,
  getAgentDefinitions,
  getPullRequestForExecution,
  ensureTaskWorkspace,
  getAutoSelection,
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  detectTestFramework,
  getTestCommand,
  runTests,
} from './engine.js';
import db from './db.js';
import { workspaceRoot } from './engine.js';
import { runDevinStage } from './agents/devin.js';
import { getOrphanRecoveryStats, recoverOrphanedTasks } from './orphan-recovery.js';
import { getPRPollingStats, pollAllPRs, startPRPolling, stopPRPolling } from './pr-poller.js';

const router = express.Router();

import fs from 'fs';
import { persistPipelineEdit, getEffectivePipeline } from './pipeline-edit-store.js';

router.post('/agents', express.json(), (req, res) => {
  const skillData = req.body;
  if (!skillData?.id) return res.status(400).json({ error: 'Missing required field: id' });

  const filePath = path.join(process.cwd(), 'server', 'skills', `${skillData.id}.json`);
  if (fs.existsSync(filePath)) return res.status(409).json({ error: `Skill '${skillData.id}' already exists.` });

  try {
    fs.writeFileSync(filePath, JSON.stringify(skillData, null, 2), 'utf8');
    res.status(201).json({ success: true, message: `Skill '${skillData.id}' created.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/agents/:id', express.json(), (req, res) => {
  const { id } = req.params;
  const skillData = req.body;

  try {
    const filePath = path.join(process.cwd(), 'server', 'skills', `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(skillData, null, 2), 'utf8');
      res.json({ success: true, message: `Skill '${id}' updated successfully.` });
    } else {
      res.status(404).json({ error: `Skill '${id}' not found.` });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tasks', (req, res) => {
  const tasks = listTasks();
  res.json(tasks);
});

router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { deleteTask } = await import('./engine.js');
    const result = await deleteTask(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/tasks/:id/execution', (req, res) => {
  const execution = getTaskExecution(req.params.id);
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }
  res.json(execution);
});

router.get('/executions/:id/stages', (req, res) => {
  const stages = getStagesForExecution(req.params.id);
  res.json(stages);
});

router.get('/pull-requests', (req, res) => {
  const prs = db.prepare('SELECT * FROM pull_requests ORDER BY created_at DESC').all();
  res.json(prs);
});

router.get('/tasks/:id/pull-requests', (req, res) => {
  const execution = getTaskExecution(req.params.id);
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }
  const prs = db.prepare('SELECT * FROM pull_requests WHERE execution_id = ? ORDER BY created_at DESC').all(execution.id);
  res.json(prs);
});

// NEW: Auto-select pipeline and agent for a task (preview)
router.post('/tasks/auto-select', express.json(), (req, res) => {
  const { title, description, repository } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }
  const selection = getAutoSelection({ title, description, repository });
  res.json(selection);
});

// NEW: Jira Issue intake -> create an internal Task for the AI agent pipeline.
// Accepts Jira-like payload (summary/title + description + optional fields)
// and queues a task using pipeline='auto'.
router.post('/tasks/from-jira', express.json(), (req, res) => {
  const {
    // Jira core fields
    summary,
    title,
    description,
    assignee,
    status,
    priority,
    links,
    attachments,
    key,

    // Optional orchestration fields
    repository,
    targetBranch,
  } = req.body || {};

  const jiraTitle = summary || title;
  if (!jiraTitle) {
    return res.status(400).json({ error: 'Missing required field: summary (or title)' });
  }

  // Filter by allowed space keys (e.g. JIRA_SPACE_KEYS=MDP,KAN)
  const allowedKeys = process.env.JIRA_SPACE_KEYS
    ? process.env.JIRA_SPACE_KEYS.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
    : [];
  if (allowedKeys.length > 0 && key) {
    const spaceKey = key.split('-')[0].toUpperCase();
    if (!allowedKeys.includes(spaceKey)) {
      return res.status(403).json({ error: `Space key '${spaceKey}' is not allowed. Allowed: ${allowedKeys.join(', ')}` });
    }
  }

  // Auto-detect repository from JIRA_REPO_MAPPING if not provided
  let autoRepository = repository;
  if (!autoRepository && key) {
    try {
      const repoMapping = process.env.JIRA_REPO_MAPPING;
      if (repoMapping) {
        const mapping = JSON.parse(repoMapping);
        const projectKey = key.split('-')[0].toUpperCase();
        autoRepository = mapping[projectKey] || mapping[projectKey.toLowerCase()] || null;
        if (autoRepository) {
          console.log(`[from-jira] Auto-detected repository for project ${projectKey}: ${autoRepository}`);
        }
      }
    } catch (error) {
      console.error('[from-jira] Failed to parse JIRA_REPO_MAPPING:', error);
    }
  }

  const normalizedLinks = Array.isArray(links)
    ? links.filter(Boolean)
    : (typeof links === 'string' && links.trim() ? [links.trim()] : []);

  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.filter(Boolean)
    : (typeof attachments === 'string' && attachments.trim() ? [attachments.trim()] : []);

  const jiraDescriptionBlock = [
    description ? `Jira Description:\n${description}` : 'Jira Description:\n(No description provided)',
    assignee ? `Jira Assignee: ${assignee}` : null,
    status ? `Jira Status: ${status}` : null,
    priority ? `Jira Priority: ${priority}` : null,
    normalizedLinks.length ? `Jira Links:\n- ${normalizedLinks.join('\n- ')}` : null,
    normalizedAttachments.length ? `Jira Attachments (metadata/refs):\n- ${normalizedAttachments.join('\n- ')}` : null,
    '',
    'Instructions:',
    'Treat this Jira issue as the source of truth. Implement the required behavior and/or provide the exact code changes needed to satisfy the description.'
  ].filter(Boolean).join('\n\n');

  // Auto-generate branch name from Jira key if provided
  const autoBranch = key ? key.toLowerCase() : null;

  const task = createTask({
    title: jiraTitle,
    description: jiraDescriptionBlock,
    pipeline: 'auto',
    priority: priority || 'medium',
    repository: autoRepository || null,
    targetBranch: targetBranch || null,
    jira_ticket: key || null,
    // Store the auto-generated branch name for later use
    auto_branch: autoBranch,
  });

  res.status(201).json(task);
});


router.post('/tasks/decompose', express.json(), async (req, res) => {
  const { description, repository, targetBranch, jiraTicket } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Missing required field: description' });
  }

  try {
    const workspaceId = crypto.randomUUID();
    const workspace = await ensureTaskWorkspace(workspaceId);
    
    const prompt = `
Task: Decompose Epic
Agent: Devin

Epic Description:
${description}

Instructions:
You are an expert technical project manager. Your job is to decompose the above epic description into 2 to 5 smaller, manageable subtasks. 
Each subtask should have a clear title and a detailed description.

Output your response ONLY as a valid JSON array of objects. Do not include markdown code blocks or any other text.
Format example:
[
  { "title": "Subtask 1 title", "description": "Subtask 1 description" },
  { "title": "Subtask 2 title", "description": "Subtask 2 description" }
]
`;

    const result = await runDevinStage({ prompt, stageId: 'decompose', workspace });
    
    let subtasks = [];
    try {
      const jsonStart = result.output.indexOf('[');
      const jsonEnd = result.output.lastIndexOf(']') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = result.output.substring(jsonStart, jsonEnd);
        subtasks = JSON.parse(jsonString);
      } else {
        throw new Error("No JSON array found in output");
      }
    } catch (e) {
      console.error("Failed to parse Devin output as JSON:", result.output);
      subtasks = [{ title: "Decomposed task (fallback)", description: epicDescription }];
    }

    const createdTasks = [];
    for (const subtask of subtasks) {
      // Auto-select pipeline for each subtask
      const task = createTask({
        title: subtask.title || 'Untitled Subtask',
        description: subtask.description || '',
        pipeline: 'auto',
        priority: 'medium',
        // Preserve repo context if it was provided with the epic request
        repository: repository || null,
        targetBranch: targetBranch || null,
        jira_ticket: jiraTicket || null,
      });
      createdTasks.push(task);
    }


    res.json(createdTasks);
  } catch (err) {
    console.error('Error during decomposition:', err);
    res.status(500).json({ error: 'Internal server error during decomposition' });
  }
});

router.post('/tasks', express.json(), (req, res) => {
  const payload = req.body;
  console.log('[POST /tasks] Received payload:', JSON.stringify(payload, null, 2));
  if (!payload || !payload.title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }

  // Auto-select pipeline if not specified or set to 'auto'
  if (!payload.pipeline || payload.pipeline === 'auto') {
    payload.pipeline = 'auto';
  }

  // Handle jira_ticket field for commit message inclusion
  if (payload.key && !payload.jira_ticket) {
    payload.jira_ticket = payload.key;
  }
  // Handle jiraTicket field from frontend (camelCase to snake_case)
  if (payload.jiraTicket && !payload.jira_ticket) {
    payload.jira_ticket = payload.jiraTicket;
  }

  console.log('[POST /tasks] After processing, jira_ticket:', payload.jira_ticket);
  const task = createTask(payload);
  res.status(201).json(task);
});

router.get('/tasks/:id', (req, res) => {
  const task = getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

router.get('/tasks/:id/executions', (req, res) => {
  const task = getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const execution = getTaskExecution(task.id);
  const stageExecutions = execution ? getStagesForExecution(execution.id) : [];
  const artifacts = execution ? getArtifactsForExecution(execution.id) : [];
  const pullRequest = execution ? getPullRequestForExecution(execution.id) : null;

  res.json({ task, execution, stageExecutions, artifacts, pullRequest });
});

router.get('/events', (req, res) => {
  res.json(getEvents());
});

router.get('/pipelines', async (req, res) => {
  const pipelines = await getPipelineDefinitions();
  // Apply any persisted edits (overrides) so UI sees latest configuration.
  const effective = pipelines.map((p) => getEffectivePipeline(p));
  res.json(effective);
});

router.get('/pipelines/:id', async (req, res) => {
  const pipelines = await getPipelineDefinitions();
  const pipeline = pipelines.find((p) => p.id === req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(getEffectivePipeline(pipeline));
});

// Persist pipeline edits (stage agent etc.)
router.put('/pipelines/:id', express.json(), async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const { stages, name, description, writeToYaml } = req.body || {};

    if (!pipelineId) return res.status(400).json({ error: 'Missing pipeline id' });

    // Load effective pipeline to validate shape.
    const pipelines = await getPipelineDefinitions();
    const base = pipelines.find((p) => p.id === pipelineId);
    if (!base) return res.status(404).json({ error: 'Pipeline not found' });

    const effective = getEffectivePipeline(base);

    const updatedPipeline = {
      ...effective,
      ...(typeof name === 'string' ? { name } : null),
      ...(typeof description === 'string' ? { description } : null),
      ...(Array.isArray(stages) ? { stages } : null),
      id: pipelineId,
    };

    const result = persistPipelineEdit({
      pipelineId,
      updatedPipeline,
      writeToYaml: writeToYaml === true,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Run pipeline (creates a task and queues execution)
router.post('/pipelines/:id/run', express.json(), async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const { title, description, repository, targetBranch, priority, jiraTicket } = req.body || {};

    if (!title) return res.status(400).json({ error: 'Missing required field: title' });

    const task = createTask({
      title,
      description: description || null,
      pipeline: pipelineId,
      repository: repository || null,
      targetBranch: targetBranch || null,
      priority: priority || 'medium',
      jira_ticket: jiraTicket || null,
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/agents', (req, res) => {
  res.json(getAgentDefinitions());
});

// Orphan recovery endpoints
router.get('/admin/orphan-stats', (req, res) => {
  const stats = getOrphanRecoveryStats();
  res.json(stats);
});

router.post('/admin/recover-orphans', (req, res) => {
  const result = recoverOrphanedTasks();
  res.json(result);
});

// PR polling endpoints
router.get('/admin/pr-stats', (req, res) => {
  const stats = getPRPollingStats();
  res.json(stats);
});

router.post('/admin/poll-prs', (req, res) => {
  const result = pollAllPRs();
  res.json(result);
});

router.post('/admin/pr-polling/start', (req, res) => {
  const interval = startPRPolling();
  res.json({ success: true, message: 'PR polling started' });
});

router.post('/admin/pr-polling/stop', (req, res) => {
  stopPRPolling();
  res.json({ success: true, message: 'PR polling stopped' });
});

// Notifications endpoints
router.get('/notifications', (req, res) => {
  const { userId } = req.query;
  const notifications = getNotifications(userId);
  res.json(notifications);
});

router.get('/notifications/:id', (req, res) => {
  const notification = getNotificationById(req.params.id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  res.json(notification);
});

router.post('/notifications/:id/read', (req, res) => {
  markNotificationAsRead(req.params.id);
  res.json({ success: true });
});

router.post('/notifications/read-all', (req, res) => {
  const { userId } = req.body;
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id IS NULL').run(userId || null);
  res.json({ success: true });
});

// Test execution endpoints
router.post('/tasks/:id/run-tests', async (req, res) => {
  const { id } = req.params;
  try {
    const task = getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const repositoryPath = path.join(workspaceRoot, id);
    const results = await runTests(id, repositoryPath);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/tasks/:id/test-framework', (req, res) => {
  const { id } = req.params;
  try {
    const task = getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const repositoryPath = path.join(workspaceRoot, id);
    const framework = detectTestFramework(repositoryPath);
    const command = framework ? getTestCommand(framework) : null;
    
    res.json({ framework, command });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Convert Atlassian Document Format (ADF) node tree to plain text.
// Jira REST API v3 returns description as ADF; v2 returns a plain string.
function extractAdfText(adf) {
  if (!adf) return null;
  // Plain string (API v2 or already extracted)
  if (typeof adf === 'string') return adf.trim() || null;
  // Recursively walk ADF node tree
  function walk(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'mention') return node.attrs?.text || '';
    if (node.type === 'emoji') return node.attrs?.shortName || '';
    const children = Array.isArray(node.content) ? node.content.map(walk).join('') : '';
    // Add newlines after block-level nodes for readability
    const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem',
      'blockquote', 'codeBlock', 'rule', 'panel', 'table', 'tableRow', 'tableCell', 'tableHeader']);
    return blockTypes.has(node.type) ? children + '\n' : children;
  }
  const text = walk(adf).replace(/\n{3,}/g, '\n\n').trim();
  return text || null;
}

// Jira issues proxy — fetches open issues from the configured Jira project
router.get('/jira/issues', async (req, res) => {
  const baseUrl = (() => {
    const raw = process.env.JIRA_BASE_URL || '';
    try { return new URL(raw).origin; } catch { return raw.replace(/\/$/, ''); }
  })();
  const user = process.env.JIRA_USER;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !user || !token) {
    return res.status(503).json({ error: 'Jira credentials not configured. Set JIRA_BASE_URL, JIRA_USER, and JIRA_API_TOKEN.' });
  }

  const { statuses = 'new,indeterminate', maxResults = 50, project } = req.query;

  // Resolve allowed space keys: query param > JIRA_SPACE_KEYS env > none
  const allowedSpaceKeys = (() => {
    const src = project || process.env.JIRA_SPACE_KEYS || '';
    return src.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
  })();

  if (allowedSpaceKeys.length === 0) {
    return res.status(400).json({ error: 'No Jira space keys configured. Set JIRA_SPACE_KEYS in your .env file (e.g. JIRA_SPACE_KEYS=MDP,KAN).' });
  }

  // Build JQL filtered to allowed projects
  const statusList = String(statuses).split(',').map(s => `"${s.trim()}"`).join(',');
  const projectList = allowedSpaceKeys.map(k => `"${k}"`).join(',');
  const jql = `project in (${projectList}) AND statusCategory in (${statusList}) ORDER BY updated DESC`;

  const url = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,description,status,priority,assignee,key,issuetype`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Jira API error: ${text}` });
    }

    const data = await response.json();
    // Debug: log raw description field from first issue to diagnose extraction
    if (data.issues?.length > 0) {
      const sample = data.issues[0];
      console.log(`[jira/issues] first issue key=${sample.key} description field type=${typeof sample.fields.description}`, 
        sample.fields.description === null ? '(null)' : 
        typeof sample.fields.description === 'object' ? JSON.stringify(sample.fields.description).slice(0, 300) : 
        String(sample.fields.description).slice(0, 300));
    }
    const issues = (data.issues || []).map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      description: extractAdfText(issue.fields.description),
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      priority: issue.fields.priority?.name,
      assignee: issue.fields.assignee?.displayName || null,
      issueType: issue.fields.issuetype?.name,
      url: `${baseUrl}/browse/${issue.key}`,
    }));

    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Config routes — read/write .env.agent_orchestration
const ENV_FILE = path.resolve(process.cwd(), '.env.agent_orchestration');

const CONFIG_KEYS = [
  'PROJECT_NAME', 'DISPLAY_NAME',
  'GIT_ENABLED', 'TARGET_BRANCH', 'BRANCH_PATTERN',
  'CLI_EXECUTABLE', 'MODEL',
  'JIRA_SPACE_KEYS', 'JIRA_BASE_URL', 'JIRA_USER', 'JIRA_API_TOKEN', 'JIRA_REPO_MAPPING',
  'BITBUCKET_USERNAME', 'BITBUCKET_HTTPS_TOKEN', 'BITBUCKET_TOKEN', 'BITBUCKET_APP_PASSWORD',
  'GITHUB_TOKEN',
  'DEVIN_PATH', 'DEVIN_PERMISSION_MODE', 'DEVIN_MODEL',
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_TIMEOUT_MS',
  'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_TIMEOUT_MS',
  'FLASK_SOCKET_URL',
];

router.get('/config', (req, res) => {
  const config = {};
  for (const key of CONFIG_KEYS) {
    config[key] = process.env[key] || '';
  }
  res.json(config);
});

router.post('/config', express.json(), (req, res) => {
  const updates = req.body || {};

  // Read existing file to preserve comments and unknown keys
  let lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : [];

  const written = new Set();

  // Update existing lines
  lines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (CONFIG_KEYS.includes(key) && key in updates) {
      written.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  // Append any new keys not already in file
  for (const key of CONFIG_KEYS) {
    if (key in updates && !written.has(key)) {
      lines.push(`${key}=${updates[key]}`);
    }
  }

  fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');

  // Apply to live process.env immediately
  for (const [key, value] of Object.entries(updates)) {
    if (CONFIG_KEYS.includes(key)) process.env[key] = String(value);
  }

  res.json({ success: true });
});

export default router;
