import { createTask, claimQueuedTask, processTask, getTaskById } from './server/engine.js';
import db, { resetDatabase } from './server/db.js';

async function runE2E() {
  console.log('--- Starting E2E User Flow ---');
  resetDatabase();

  const title = 'E2E Test Task';
  const description = 'Say hello world';
  
  console.log(`1. Creating task: "${title}"`);
  const task = createTask({
    title,
    description,
    pipeline: 'Code Only'
  });
  console.log(`Task created with ID: ${task.id}, Status: ${task.status}`);

  console.log('2. Claiming queued task (Simulating Worker)');
  const claimedTask = claimQueuedTask();
  if (!claimedTask || claimedTask.id !== task.id) {
    throw new Error('Failed to claim the task');
  }
  console.log(`Task claimed. New Status: ${claimedTask.status}`);

  console.log('3. Processing task (Simulating Devin Agent execution)');
  await processTask(claimedTask);

  const finalTask = getTaskById(task.id);
  console.log(`4. Task processing complete. Final Status: ${finalTask.status}`);

  if (finalTask.status === 'pr_created' || finalTask.status === 'completed') {
    console.log('✅ E2E User Flow completed successfully.');
  } else {
    console.log('❌ E2E User Flow failed.');
    process.exit(1);
  }
}

runE2E().catch(console.error);
