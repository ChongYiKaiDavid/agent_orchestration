import express from 'express';
import {
  createTask,
  getTaskById,
  listTasks,
  getTaskExecution,
  getStagesForExecution,
  getArtifactsForExecution,
  getEvents,
  getPipelineDefinitions,
  getPipeline,
  getAgentDefinitions,
  getPullRequestForExecution,
} from './engine.js';

const router = express.Router();

router.get('/tasks', (req, res) => {
  const tasks = listTasks();
  res.json(tasks);
});

router.post('/tasks', express.json(), (req, res) => {
  const payload = req.body;
  if (!payload || !payload.title) {
    return res.status(400).json({ error: 'Missing required field: title' });
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
  const pipeline = getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline);
});

router.get('/agents', (req, res) => {
  res.json(getAgentDefinitions());
});

export default router;
