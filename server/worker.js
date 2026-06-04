import { claimQueuedTask, processTask } from './engine.js';

async function runWorker() {
  console.log('Worker loop started.');
  while (true) {
    try {
      const task = claimQueuedTask();
      if (task) {
        console.log(`Worker claimed task ${task.id}`);
        await processTask(task);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

runWorker();
