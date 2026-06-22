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

  const task = createTask({
    title: jiraTitle,
    description: jiraDescriptionBlock,
    pipeline: 'auto',
    priority: priority || 'medium',
    repository: repository || null,
    targetBranch: targetBranch || null,
    jira_ticket: key || null,
  });

  res.status(201).json(task);
});


router.post('/tasks/decompose', express.json(), async (req, res) => {
  const { epicDescription } = req.body;
  if (!epicDescription) {
    return res.status(400).json({ error: 'Missing required field: epicDescription' });
  }

  try {
    const workspaceId = crypto.randomUUID();
    const workspace = await ensureTaskWorkspace(workspaceId);
    
    const prompt = `
Task: Decompose Epic
Agent: Devin

Epic Description:
${epicDescription}

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
  res.json(pipelines);
});

router.get('/pipelines/:id', async (req, res) => {
  const pipelines = await getPipelineDefinitions();
  const pipeline = pipelines.find((p) => p.id === req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline);
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

export default router;
