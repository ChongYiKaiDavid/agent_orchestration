import './loadEnv.js';
import { claimQueuedTask, processTask } from './engine.js';
import { recordHeartbeat, startOrphanRecoveryWatchdog } from './orphan-recovery.js';

async function runWorker() {
  console.log('Worker loop started.');
  
  // Start orphan recovery watchdog if enabled
  let watchdogInterval = null;
  if (process.env.ENABLE_ORPHAN_RECOVERY === 'true') {
    watchdogInterval = startOrphanRecoveryWatchdog();
    console.log('[worker] Orphan recovery watchdog enabled');
  }
  
  while (true) {
    try {
      // Record heartbeat
      recordHeartbeat();
      
      const task = claimQueuedTask();
      if (task) {
        console.log(`Worker claimed task ${task.id}`);
        // Delay before processing — gives you time to open the Task Details page
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          await processTask(task);
          console.log(`Worker finished task ${task.id}`);
        } catch (err) {
          console.error(`Worker failed task ${task.id}:`, err?.stack || err?.message || err);
        }
      } else {
        console.log('No queued task found, waiting...');
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

runWorker();
