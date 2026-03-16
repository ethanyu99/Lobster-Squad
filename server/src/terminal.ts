import { Sandbox } from 'novita-sandbox';

const SANDBOX_KEEP_ALIVE_MS = 50 * 365 * 24 * 3600 * 1000;

interface TerminalSession {
  pid: number;
  sandbox: Awaited<ReturnType<typeof Sandbox.connect>>;
  instanceId: string;
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
): Promise<string> {
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey,
    timeoutMs: SANDBOX_KEEP_ALIVE_MS,
  });

  const handle = await sandbox.pty.create({
    cols,
    rows,
    onData: (data: Uint8Array) => {
      sendData(data);
    },
    cwd: '/home/user/.openclaw/workspace',
    envs: { TERM: 'xterm-256color' },
  });

  terminalSessions.set(sessionId, {
    pid: handle.pid,
    sandbox,
    instanceId,
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
  try {
    await session.sandbox.pty.kill(session.pid);
  } catch { /* ignore */ }
  terminalSessions.delete(sessionId);
}
