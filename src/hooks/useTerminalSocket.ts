import { useEffect, useState } from 'react';
import socketService from '../services/socket';

export const useTerminalSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('terminal-output', (data: string) => {
      setOutput(prev => [...prev, data]);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const sendCommand = (command: string) => {
    if (socketService.getSocket()) {
      socketService.getSocket()?.emit('terminal-command', command);
    }
  };

  return { isConnected, output, sendCommand };
};