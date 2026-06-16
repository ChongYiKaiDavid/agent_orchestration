import db from '../server/db.js';
import { createTask } from '../server/engine.js';

const repository = process.env.TASK_REPOSITORY;
if (!repository) {
  console.error('Missing TASK_REPOSITORY env var. Example: TASK_REPOSITORY="https://...@bitbucket.org/.../repo.git"');
  process.exit(1);
}

// Pick a pipeline that matches your earlier test request.
const pipeline = process.env.TASK_PIPELINE || 'ollama-code-only';
const targetBranch = process.env.TASK_TARGET_BRANCH || null;

// If you want a fixed title/description you can set them too.
const title = process.env.TASK_TITLE || 'AI Orchestration: PR creation smoke test';
const description =
  process.env.TASK_DESCRIPTION ||
  'Make a small safe change and ensure the system creates a pull request on Bitbucket.';

console.log('[queue] Creating queued task...');
const task = createTask({
  title,
  description,
  pipeline,
  repository,
  targetBranch,
  priority: process.env.TASK_PRIORITY || 'medium',
});

console.log('[queue] Task created:', task.id, 'status:', task.status, 'pipeline:', task.pipeline_id);
console.log('[queue] Starting worker...');

// Start the worker in-process by importing it.
// Worker file contains an infinite loop.
import('../server/worker.js');
