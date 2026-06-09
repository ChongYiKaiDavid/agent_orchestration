import { io } from 'socket.io-client';

const TASK_ID = 'test-room-' + Date.now();
const FLASK_URL = 'http://localhost:5002';

// Browser socket
const browser = io(FLASK_URL, { transports: ['websocket'] });

browser.on('connect', () => {
  console.log('[BROWSER] Connected, sid:', browser.id);
  console.log('[BROWSER] Emitting join-task for:', TASK_ID);
  browser.emit('join-task', { taskId: TASK_ID });
});

browser.on('joined-task', ({ taskId }) => {
  console.log('[BROWSER] joined-task received for:', taskId);
});

browser.on('agent-log', (data) => {
  console.log('[BROWSER] agent-log RECEIVED!');
  console.log('  taskId:', data.taskId);
  console.log('  data:', data.data);
});

browser.on('connect_error', (err) => {
  console.error('[BROWSER] connect_error:', err.message);
});

browser.on('disconnect', () => {
  console.log('[BROWSER] Disconnected');
});

browser.onAny((eventName, ...args) => {
  console.log('[BROWSER] *** SOCKET EVENT:', eventName, '***');
});

// Worker socket
setTimeout(() => {
  const worker = io(FLASK_URL, { transports: ['websocket'] });

  worker.on('connect', () => {
    console.log('[WORKER] Connected, sid:', worker.id);
    console.log('[WORKER] Emitting agent-log to task:', TASK_ID);
    worker.emit('agent-log', {
      taskId: TASK_ID,
      stageId: 'test-stage',
      type: 'system',
      data: '\x1b[1;33m*** TEST FROM WORKER ***\x1b[0m\r\n',
      end: true,
    });
    console.log('[WORKER] Emitted agent-log');
  });

  worker.on('connect_error', (err) => {
    console.error('[WORKER] connect_error:', err.message);
  });

  setTimeout(() => {
    console.log('=== Test Complete ===');
    worker.disconnect();
    browser.disconnect();
    process.exit(0);
  }, 3000);
}, 2000);
