#!/usr/bin/env node
import io from 'socket.io-client';

const taskId = process.argv[2];
const flaskUrl = process.env.FLASK_SOCKET_URL || 'http://localhost:5002';

if (!taskId) {
  console.error('Usage: node cli-log-viewer.js <task-id>');
  process.exit(1);
}

console.log(`\n🔍 Connecting to agent logs for task: ${taskId}`);
console.log(`📡 Socket.IO Server: ${flaskUrl}`);
console.log(`\n─────────────────────────────────────────\n`);

const socket = io(flaskUrl, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO server');
  socket.emit('join-task', { taskId });
});

socket.on('connect_error', (err) => {
  console.error('❌ Failed to connect to Socket.IO:', err.message);
  console.error('   Make sure the Flask Socket.IO server is running:');
  console.error('   cd server-flask && python app.py');
  process.exit(1);
});

socket.on('joined-task', (data) => {
  console.log(`🎯 Joined task room: ${data.taskId}`);
});

socket.on('agent-log', (data) => {
  if (data.taskId === taskId) {
    const timestamp = new Date().toLocaleTimeString();
    // Handle different data structures from the worker
    const output = data.data || data.output || data.message || '';
    
    // Skip empty logs
    if (!output) return;
    
    // Color code based on content
    if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
      console.log(`\x1b[31m[${timestamp}] ${output}\x1b[0m`);
    } else if (output.toLowerCase().includes('warning') || output.toLowerCase().includes('warn')) {
      console.log(`\x1b[33m[${timestamp}] ${output}\x1b[0m`);
    } else if (output.toLowerCase().includes('success') || output.toLowerCase().includes('completed')) {
      console.log(`\x1b[32m[${timestamp}] ${output}\x1b[0m`);
    } else {
      console.log(`[${timestamp}] ${output}`);
    }
  }
});

socket.on('disconnect', () => {
  console.log('\n❌ Disconnected from Socket.IO server');
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping log viewer...');
  socket.disconnect();
  process.exit(0);
});
