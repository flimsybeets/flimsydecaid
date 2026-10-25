// One reconnect policy for every WebSocket.
//
// Decaid's telemetry sockets stay open while devices come and go, and
// re-attach across a machine power-cycle, so we only reconnect when the
// socket itself closes (usually Decaid restarting or Wi-Fi dropping).
// Reconnects use exponential backoff with jitter so a dozen sockets don't
// retry in lockstep and trip Decaid's per-client admission limit (HTTP 429).

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface ManagedSocketOptions<T> {
  url: string;
  onMessage: (data: T) => void;
  onStatus?: (status: SocketStatus) => void;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface ManagedSocket {
  send(data: unknown): boolean;
  close(): void;
}

export function backoffDelay(attempt: number, minMs = 500, maxMs = 15_000, random = Math.random): number {
  const ceiling = Math.min(maxMs, minMs * 2 ** attempt);
  // "Equal jitter": at least half the ceiling, plus a random share of the rest.
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export function openSocket<T>(opts: ManagedSocketOptions<T>): ManagedSocket {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closedByUs = false;

  const connect = () => {
    if (closedByUs) return;
    opts.onStatus?.('connecting');
    const socket = new WebSocket(opts.url);
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      opts.onStatus?.('open');
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let parsed: T;
      try { parsed = JSON.parse(event.data) as T; } catch { return; }
      opts.onMessage(parsed);
    };
    socket.onclose = () => {
      // Silence the old socket so a late event can't touch new state.
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      if (ws === socket) ws = null;
      opts.onStatus?.('closed');
      if (closedByUs) return;
      const delay = backoffDelay(attempt++, opts.minDelayMs, opts.maxDelayMs);
      timer = setTimeout(connect, delay);
    };
    socket.onerror = () => { /* onclose follows and handles retry */ };
  };

  connect();

  return {
    send(data) {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(data));
      return true;
    },
    close() {
      closedByUs = true;
      if (timer) clearTimeout(timer);
      ws?.close();
      ws = null;
    },
  };
}
