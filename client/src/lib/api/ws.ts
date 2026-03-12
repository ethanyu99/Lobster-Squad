import type { WSMessage } from '@shared/types';
import { getUserId, getAuthToken } from '../user';

export function createWebSocket(onMessage: (msg: WSMessage) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const userId = getUserId();
  const token = getAuthToken();
  let wsUrl = `${protocol}//${window.location.host}/ws?userId=${encodeURIComponent(userId)}`;
  if (token) {
    wsUrl += `&token=${encodeURIComponent(token)}`;
  }
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch {
      // Malformed WS frame
    }
  };

  return ws;
}

export function createShareWebSocket(shareToken: string, onMessage: (msg: WSMessage) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws?shareToken=${encodeURIComponent(shareToken)}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch {
      // Malformed WS frame
    }
  };

  return ws;
}
