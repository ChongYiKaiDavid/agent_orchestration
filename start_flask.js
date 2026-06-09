import { spawn } from 'child_process';
const p = spawn('/usr/local/bin/python3', ['-u', '-c', `
import os
os.chdir("/Users/jingyin/Downloads/agent_orchestration/server-flask")
from app import socketio, app
socketio.run(app, host="0.0.0.0", port=5002, allow_unsafe_werkzeug=True)
`], { stdio: ['ignore', 'pipe', 'pipe'] });

p.stdout.on('data', d => process.stdout.write(d));
p.stderr.on('data', d => process.stderr.write(d));
p.on('error', e => { console.error('Failed to start Flask:', e.message); process.exit(1); });
console.log('Flask wrapper started with PID', p.pid);