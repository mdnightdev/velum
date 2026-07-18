import WebSocket from 'ws';
import crypto from 'crypto';

// Recreate admin login logic to get a token
const test = async () => {
  const wsUrl = `ws://localhost:3000/ws?userId=2&sessionId=test_sess`;
  console.log('Connecting to', wsUrl);
  const ws = new WebSocket(wsUrl);
  ws.on('open', () => console.log('Socket Live'));
  ws.on('close', (code, reason) => console.log('Socket Closed', code, reason.toString()));
  ws.on('message', (msg) => console.log('Message:', msg.toString()));
};
test();
