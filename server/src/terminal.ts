import { Sandbox } from 'novita-sandbox';

const SANDBOX_KEEP_ALIVE_MS = 50 * 365 * 24 * 3600 * 1000;
const HEARTBEAT_INTERVAL_MS = 15_000; // ping every 15s to detect stale connections

interface TerminalSession {
  pid: number;
  sandbox: Awaited<ReturnType<typeof Sandbox.connect>>;
  instanceId: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  onDisconnect?: () => void;
}

export const terminalSessions = new Map<string, TerminalSession>();

export async function createTerminal(
  sessionId: string,
  sandboxId: string,
  apiKey: string,
  instanceId: string,
  cols: number,
  rows: number,
  sendData: (data: Uint8Array) => void,
  onDisconnect?: () => void,
): Promise<string> {
  // Clean up any existing session with the same id
  if (terminalSessions.has(sessionId)) {
    await closeTerminal(sessionId);
  }

  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey,
    timeoutMs: SANDBOX_KEEP_ALIVE_MS,
  });

  // Ensure workspace dir exists, fallback to home
  const DEFAULT_CWD = '/home/user/.openclaw/workspace';
  const FALLBACK_CWD = '/home/user';
  let cwd = DEFAULT_CWD;
  try {
    await sandbox.commands.run(`mkdir -p "${DEFAULT_CWD}"`, { timeoutMs: 10_000 });
  } catch {
    cwd = FALLBACK_CWD;
  }

  const handle = await sandbox.pty.create({
    cols,
    rows,
    onData: (data: Uint8Array) => {
      sendData(data);
    },
    cwd,
    envs: { TERM: 'xterm-256color' },
  });

  // Heartbeat: periodically run a no-op command to verify the sandbox connection is alive.
  // If it fails, the PTY is stale — notify the client so it can reconnect.
  const heartbeatTimer = setInterval(async () => {
    const session = terminalSessions.get(sessionId);
    if (!session) {
      clearInterval(heartbeatTimer);
      return;
    }
    try {
      await session.sandbox.commands.run('true', { timeoutMs: 5_000 });
    } catch {
      console.warn(`[terminal] Heartbeat failed for session ${sessionId}, closing`);
      const cb = session.onDisconnect;
      await closeTerminal(sessionId);
      cb?.();
    }
  }, HEARTBEAT_INTERVAL_MS);

  terminalSessions.set(sessionId, {
    pid: handle.pid,
    sandbox,
    instanceId,
    heartbeatTimer,
    onDisconnect,
  });

  return sessionId;
}

export async function sendTerminalInput(sessionId: string, data: Uint8Array): Promise<void> {
  const session = terminalSessions.get(sessionId);
  if (!session) throw new Error('Terminal session not found');
  await session.sandbox.pty.sendInput(session.pid, data);
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  const session = terminalSessions.get(sessionId);
  if (!session) throw new Error('Terminal session not found');
  await session.sandbox.pty.resize(session.pid, { cols, rows });
}

export async function closeTerminal(sessionId: string): Promise<void> {
  const session = terminalSessions.get(sessionId);
  if (!session) return;
  if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
  try {
    await session.sandbox.pty.kill(session.pid);
  } catch { /* ignore */ }
  terminalSessions.delete(sessionId);
}
