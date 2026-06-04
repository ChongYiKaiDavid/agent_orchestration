import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { processTask, claimQueuedTask } from './engine.js';

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

if (process.env.START_WORKER === '1') {
  setInterval(async () => {
    try {
      const task = claimQueuedTask();
      if (task) {
        console.log(`Worker claimed task ${task.id}`);
        await processTask(task);
      }
    } catch (error) {
      console.error('Worker loop error:', error);
    }
  }, 3000);
}
