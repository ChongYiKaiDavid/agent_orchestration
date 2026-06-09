import { io } from 'socket.io-client';

const taskId = process.argv[2] || 'test-task-xyz';
const flaskUrl = 'http://localhost:5002';

const socket = io(flaskUrl, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('[test] Connected to Flask, emitting agent-log');
  socket.emit('agent-log', {
    taskId,
    stageId: 'test-stage',
    type: 'system',
    data: '\x1b[1;33m*** TEST MESSAGE FROM NODE.JS ***\x1b[0m\r\n',
    end: true,
  });
  console.log('[test] Emitted agent-log, disconnecting in 2s');
  setTimeout(() => socket.disconnect(), 2000);
});

socket.on('connect_error', (err) => {
  console.error('[test] Connect error:', err.message);
});

socket.on('disconnect', () => {
  console.log('[test] Disconnected');
});
