import { io } from 'socket.io-client';

const TASK_ID = 'test-room-' + Date.now();
const FLASK_URL = 'http://localhost:5002';

// Simulate browser socket - connects and joins task room
function createBrowserSocket() {
  const socket = io(FLASK_URL, { transports: ['websocket'], autoConnect: true });

  socket.on('connect', () => {
    console.log('[BROWSER] Connected, sid:', socket.id);
    console.log('[BROWSER] Joining task room:', TASK_ID);
    socket.emit('join-task', { taskId: TASK_ID });
  });

  socket.on('joined-task', ({ taskId }) => {
    console.log('[BROWSER] joined-task received for:', taskId);
  });

  socket.on('agent-log', (data) => {
    console.log('[BROWSER] agent-log received:', JSON.stringify(data).substring(0, 100));
  });

  socket.on('connect_error', (err) => {
    console.error('[BROWSER] connect_error:', err.message);
  });

  socket.on('disconnect', () => {
    console.log('[BROWSER] Disconnected');
  });

  socket.onAny((eventName, ...args) => {
    console.log('[BROWSER] SOCKET EVENT:', eventName);
  });

  return socket;
}

// Simulate worker socket - emits agent logs
function createWorkerSocket() {
  const socket = io(FLASK_URL, { transports: ['websocket'], autoConnect: true });

  socket.on('connect', () => {
    console.log('[WORKER] Connected, sid:', socket.id);
    console.log('[WORKER] Emitting agent-log to task:', TASK_ID);
    socket.emit('agent-log', {
      taskId: TASK_ID,
      stageId: 'test-stage',
      type: 'system',
      data: '\x1b[1;33m*** TEST FROM WORKER ***\x1b[0m\r\n',
      end: true,
    });
    console.log('[WORKER] Emitted, disconnecting in 2s');
    setTimeout(() => socket.disconnect(), 2000);
  });

  socket.on('connect_error', (err) => {
    console.error('[WORKER] connect_error:', err.message);
  });

  return socket;
}

// Run test
console.log('=== Starting Room Emit Test ===');
console.log('Task ID:', TASK_ID);
const browser = createBrowserSocket();
setTimeout(() => {
  const worker = createWorkerSocket();
  setTimeout(() => {
    console.log('=== Test Complete ===');
    browser.disconnect();
    process.exit(0);
  }, 5000);
}, 1000);
