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
} from './engine.js';
import { runDevinStage } from './agents/devin.js';

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

// NEW: Auto-select pipeline and agent for a task (preview)
router.post('/tasks/auto-select', express.json(), (req, res) => {
  const { title, description, repository } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }
  const selection = getAutoSelection({ title, description, repository });
  res.json(selection);
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
  if (!payload || !payload.title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }

  // Auto-select pipeline if not specified or set to 'auto'
  if (!payload.pipeline || payload.pipeline === 'auto') {
    payload.pipeline = 'auto';
  }

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

router.get('/pipelines', (req, res) => {
  res.json(getPipelineDefinitions());
});

router.get('/pipelines/:id', (req, res) => {
  const pipeline = getPipelineDefinitions().find((p) => p.id === req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline);
});

router.get('/agents', (req, res) => {
  res.json(getAgentDefinitions());
});

export default router;

