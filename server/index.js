import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { processTask, claimQueuedTask } from './engine.js';
import { startPRPolling } from './pr-poller.js';

const app = express();
const port = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('Agent Orchestration Engine is running.');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Backend server listening on http://127.0.0.1:${port}`);
});

// Start PR polling if enabled
if (process.env.ENABLE_PR_POLLING === 'true') {
  startPRPolling();
  console.log('[server] PR polling enabled');
}

if (process.env.START_WORKER === '1') {
  setInterval(async () => {
    try {
      const task = claimQueuedTask();
      if (task) {
        console.log(`Worker claimed task ${task.id}`);
        // fire-and-forget but protect from overlapping tasks
        await processTask(task);
      }
    } catch (error) {
      console.error('Worker loop error:', error);
    }
  }, 3000);
}

// Also run worker.js when START_WORKER=2 (legacy fallback)
if (process.env.START_WORKER === '2') {
  // intentionally no-op
}

