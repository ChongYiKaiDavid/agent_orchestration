import { createTask, claimQueuedTask, processTask, getTaskById, getTaskExecution, getStagesForExecution } from './server/engine.js';

async function runTestRepo() {
  console.log('--- Starting Repository Test Run ---');

  const title = 'Test Target Repository';
  const description = 'Test the framework with test-repo.git';
  const repository = 'https://github.com/ChongYiKaiDavid/test-repo.git';
  
  console.log(`1. Creating task for repository: ${repository}`);
  const task = createTask({
    title,
    description,
    pipeline: 'Plan → Code → Review',
    repository
  });
  console.log(`Task created with ID: ${task.id}, Status: ${task.status}`);

  console.log('2. Claiming queued task');
  let claimedTask = claimQueuedTask();
  // Claim until we get our task (in case there are stale ones)
  while (claimedTask && claimedTask.id !== task.id) {
     claimedTask = claimQueuedTask();
  }
  
  if (!claimedTask) {
    throw new Error('Failed to claim the task');
  }
  console.log(`Task claimed. New Status: ${claimedTask.status}`);

  console.log('3. Processing task (Cloning repo & running stages)');
  await processTask(claimedTask);

  const finalTask = getTaskById(task.id);
  console.log(`4. Task processing complete. Final Status: ${finalTask.status}`);

  const execution = getTaskExecution(task.id);
  if (execution) {
      const stages = getStagesForExecution(execution.id);
      console.log('\n5. Stage Results:');
      stages.forEach(s => {
         console.log(`- Stage: ${s.stage_name} | Status: ${s.status} | Verdict: ${s.verdict}`);
         console.log(`  Output: ${s.output_data?.trim()}`);
      });
  }

  if (finalTask.status === 'pr_created' || finalTask.status === 'completed') {
    console.log('\n✅ Test Flow completed successfully.');
  } else {
    console.log('\n❌ Test Flow failed.');
    process.exit(1);
  }
}

runTestRepo().catch(console.error);