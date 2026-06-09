// src/components/terminal/Terminal.tsx
import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './terminal.css';
import io, { Socket } from 'socket.io-client';

type TerminalMode = 'agent' | 'pty' | 'both';

interface TerminalProps {
  taskId?: string;
  mode?: TerminalMode;
}

export const Terminal: React.FC<TerminalProps> = ({ taskId, mode = 'agent' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = io('http://localhost:5002', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    // ── Agent log streaming ──────────────────────────────────────────────────
    if (mode === 'agent' || mode === 'both') {
      // Subscribe to task-specific log stream
      if (taskId) {
        socket.emit('join-task', { taskId });
      }

      socket.on('agent-log', (data: { taskId: string; stageId: string; type: string; data: string; end: boolean }) => {
        // data.data is already ANSI-escaped by the Flask server
        term.write(data.data);
        if (data.end) {
          term.write('\r\n');
        }
      });
    }

    // ── Interactive PTY shell ────────────────────────────────────────────────
    if (mode === 'pty' || mode === 'both') {
      socket.on('terminal-connected', ({ sessionId }: { sessionId: string }) => {
        term.writeln(`\x1b[1;32mPTY session: ${sessionId}\x1b[0m\r\n`);
      });

      socket.on('terminal-output', (data: string) => {
        term.write(data);
      });

      term.onData((userInput: string) => {
        socket.emit('terminal-command', userInput);
      });

      term.writeln(`\x1b[1;33mInteractive terminal mode — type commands below\x1b[0m\r\n`);
    }

    // Default header when no mode is specified
    if (mode === 'agent' && taskId) {
      term.writeln(`\x1b[1;36mAgent log stream for task: ${taskId}\x1b[0m`);
      term.writeln('\x1b[90mWaiting for agent output...\x1b[0m\r\n');
    } else if (mode === 'agent') {
      term.writeln('\x1b[90mNo taskId provided — connect via join-task to stream logs\x1b[0m\r\n');
    }

    term.focus();

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [taskId, mode]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
};

export default Terminal;