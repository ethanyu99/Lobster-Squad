import { describe, it, expect, vi } from 'vitest';

import {
  parseActionFromOutput,
  computeMetrics,
  buildExecutionGraph,
  toTurnSummary,
} from '../execution';

import type { Execution, Turn } from '../../../shared/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 'turn-1',
    executionId: 'exec-1',
    seq: 1,
    role: 'pm',
    instanceId: 'inst-1',
    parentTurnId: null,
    triggerAction: null,
    depth: 0,
    task: 'Do something useful',
    output: 'I did it.',
    action: null,
    status: 'completed',
    durationMs: 1000,
    tokenUsage: { prompt: 100, completion: 50 },
    ...overrides,
  };
}

function makeExecution(turns: Turn[], overrides: Partial<Execution> = {}): Execution {
  const now = new Date().toISOString();
  return {
    id: 'exec-1',
    teamId: 'team-1',
    ownerId: 'owner-1',
    goal: 'Build something great',
    status: 'completed',
    turns,
    metrics: {
      totalTurns: 0,
      totalDurationMs: 0,
      turnsByRole: {},
      maxDepthReached: 0,
      feedbackCycles: 0,
      avgTurnDurationMs: 0,
      tokenUsage: { prompt: 0, completion: 0 },
    },
    config: {
      maxTurns: 20,
      maxDepth: 5,
      turnTimeoutMs: 60000,
      maxRetriesPerRole: 3,
    },
    createdAt: now,
    completedAt: now,
    ...overrides,
  };
}

// ─── parseActionFromOutput ───────────────────────────────────────────────────

describe('parseActionFromOutput', () => {
  it('should parse a delegate action from a JSON code block', () => {
    const output = `I'll delegate this to the developer.

\`\`\`json
{
  "action": "delegate",
  "to": "developer",
  "task": "Implement the login form",
  "context": "full"
}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('delegate');
    if (action?.type === 'delegate') {
      expect(action.to).toBe('developer');
      expect(action.task).toContain('login form');
      expect(action.context).toBe('full');
    }
  });

  it('should parse a report action', () => {
    const output = `Done with the task.

\`\`\`json
{
  "action": "report",
  "summary": "Completed the login form implementation"
}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('report');
    if (action?.type === 'report') {
      expect(action.summary).toContain('login form');
    }
  });

  it('should parse a feedback action', () => {
    const output = `Need some changes.

\`\`\`json
{
  "action": "feedback",
  "to": "developer",
  "issue": "Please add validation to the form"
}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('feedback');
    if (action?.type === 'feedback') {
      expect(action.to).toBe('developer');
      expect(action.issue).toContain('validation');
    }
  });

  it('should parse a done action', () => {
    const output = `All tasks complete.

\`\`\`json
{
  "action": "done",
  "summary": "The project is finished and all requirements met."
}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('done');
    if (action?.type === 'done') {
      expect(action.summary).toContain('finished');
    }
  });

  it('should parse a multi_delegate action', () => {
    const output = `Splitting work across the team.

\`\`\`json
{
  "action": "multi_delegate",
  "tasks": [
    { "to": "frontend", "task": "Build the UI", "context": "full" },
    { "to": "backend", "task": "Build the API", "context": "summary" }
  ]
}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('multi_delegate');
    if (action?.type === 'multi_delegate') {
      expect(action.tasks).toHaveLength(2);
      expect(action.tasks[0].to).toBe('frontend');
      expect(action.tasks[1].to).toBe('backend');
    }
  });

  it('should return null for plain text with no action block', () => {
    const output = 'Just a regular response with no actions.';
    const action = parseActionFromOutput(output);
    expect(action).toBeNull();
  });

  it('should return null for a JSON block with an unknown action', () => {
    const output = `\`\`\`json\n{"action": "fly_to_moon", "destination": "moon"}\n\`\`\``;
    const action = parseActionFromOutput(output);
    expect(action).toBeNull();
  });

  it('should return null for a delegate action missing required fields', () => {
    // Missing "task"
    const output = `\`\`\`json\n{"action": "delegate", "to": "developer"}\n\`\`\``;
    const action = parseActionFromOutput(output);
    expect(action).toBeNull();
  });

  it('should return null for a malformed JSON block', () => {
    const output = `\`\`\`json\n{not valid json\`\`\``;
    const action = parseActionFromOutput(output);
    expect(action).toBeNull();
  });

  it('should pick the last json block when multiple are present', () => {
    // First block is a code example, second is the real action
    const output = `Here is an example:

\`\`\`json
{"action": "delegate", "to": "example", "task": "Example task", "context": "full"}
\`\`\`

Now the actual action:

\`\`\`json
{"action": "done", "summary": "All done!"}
\`\`\``;

    const action = parseActionFromOutput(output);
    expect(action?.type).toBe('done');
  });

  it('should fall back to extracting inline JSON when no code block is present', () => {
    const output = `Processing complete. {"action": "report", "summary": "Inline report complete."}`;
    const action = parseActionFromOutput(output);
    expect(action).toBeTruthy();
    expect(action?.type).toBe('report');
  });
});

// ─── computeMetrics ──────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  it('should compute basic metrics for two completed turns', () => {
    const t1 = makeTurn({ id: '1', seq: 1, role: 'pm', durationMs: 1000, depth: 0, tokenUsage: { prompt: 100, completion: 50 } });
    const t2 = makeTurn({ id: '2', seq: 2, role: 'dev', durationMs: 2000, depth: 1, tokenUsage: { prompt: 200, completion: 100 } });
    const exec = makeExecution([t1, t2], {
      createdAt: new Date(0).toISOString(),
      completedAt: new Date(3000).toISOString(),
    });

    const metrics = computeMetrics(exec);

    expect(metrics.totalTurns).toBe(2);
    expect(metrics.tokenUsage.prompt).toBe(300);
    expect(metrics.tokenUsage.completion).toBe(150);
    expect(metrics.avgTurnDurationMs).toBe(1500);
    expect(metrics.maxDepthReached).toBe(1);
    expect(metrics.feedbackCycles).toBe(0);
  });

  it('should exclude pending/running turns from counts', () => {
    const completed = makeTurn({ id: '1', status: 'completed', role: 'pm' });
    const pending = makeTurn({ id: '2', status: 'pending', role: 'dev', durationMs: 500 });
    const running = makeTurn({ id: '3', status: 'running', role: 'qa', durationMs: 500 });
    const exec = makeExecution([completed, pending, running]);

    const metrics = computeMetrics(exec);

    expect(metrics.totalTurns).toBe(1);
    expect(metrics.turnsByRole['pm']).toBe(1);
    expect(metrics.turnsByRole['dev']).toBeUndefined();
    expect(metrics.turnsByRole['qa']).toBeUndefined();
  });

  it('should count feedback cycles', () => {
    const t1 = makeTurn({ id: '1', status: 'completed', action: { type: 'feedback', to: 'dev', issue: 'Fix it' } });
    const t2 = makeTurn({ id: '2', status: 'completed', action: { type: 'feedback', to: 'qa', issue: 'Check again' } });
    const t3 = makeTurn({ id: '3', status: 'completed', action: { type: 'done', summary: 'All done' } });
    const exec = makeExecution([t1, t2, t3]);

    const metrics = computeMetrics(exec);

    expect(metrics.feedbackCycles).toBe(2);
  });

  it('should compute turnsByRole correctly', () => {
    const turns = [
      makeTurn({ id: '1', role: 'pm', status: 'completed' }),
      makeTurn({ id: '2', role: 'dev', status: 'completed' }),
      makeTurn({ id: '3', role: 'dev', status: 'completed' }),
      makeTurn({ id: '4', role: 'qa', status: 'completed' }),
    ];
    const exec = makeExecution(turns);

    const metrics = computeMetrics(exec);

    expect(metrics.turnsByRole['pm']).toBe(1);
    expect(metrics.turnsByRole['dev']).toBe(2);
    expect(metrics.turnsByRole['qa']).toBe(1);
  });

  it('should return zero token usage when turns have no tokenUsage', () => {
    const turn = makeTurn({ tokenUsage: undefined });
    const exec = makeExecution([turn]);

    const metrics = computeMetrics(exec);

    expect(metrics.tokenUsage.prompt).toBe(0);
    expect(metrics.tokenUsage.completion).toBe(0);
  });

  it('should return zero avgTurnDurationMs for empty turn list', () => {
    const exec = makeExecution([]);
    const metrics = computeMetrics(exec);
    expect(metrics.avgTurnDurationMs).toBe(0);
    expect(metrics.totalTurns).toBe(0);
  });
});

// ─── buildExecutionGraph ──────────────────────────────────────────────────────

describe('buildExecutionGraph', () => {
  it('should include completed and failed turns as nodes', () => {
    const t1 = makeTurn({ id: '1', status: 'completed', role: 'pm' });
    const t2 = makeTurn({ id: '2', status: 'failed', role: 'dev' });
    const t3 = makeTurn({ id: '3', status: 'pending', role: 'qa' });
    const exec = makeExecution([t1, t2, t3]);

    const graph = buildExecutionGraph(exec);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.map(n => n.id)).toContain('1');
    expect(graph.nodes.map(n => n.id)).toContain('2');
    expect(graph.nodes.map(n => n.id)).not.toContain('3');
  });

  it('should create edges for turns with a parentTurnId', () => {
    const parent = makeTurn({ id: 'p1', status: 'completed', parentTurnId: null });
    const child = makeTurn({
      id: 'c1',
      status: 'completed',
      parentTurnId: 'p1',
      triggerAction: { type: 'delegate', to: 'dev', task: 'Build it', context: 'full' },
    });
    const exec = makeExecution([parent, child]);

    const graph = buildExecutionGraph(exec);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe('p1');
    expect(graph.edges[0].to).toBe('c1');
    expect(graph.edges[0].actionType).toBe('delegate');
  });

  it('should produce no edges when no turn has a parent', () => {
    const turns = [
      makeTurn({ id: '1', status: 'completed', parentTurnId: null }),
      makeTurn({ id: '2', status: 'completed', parentTurnId: null }),
    ];
    const exec = makeExecution(turns);

    const graph = buildExecutionGraph(exec);

    expect(graph.edges).toHaveLength(0);
  });

  it('should truncate long task/output strings in nodes', () => {
    const longString = 'a'.repeat(500);
    const turn = makeTurn({ id: '1', status: 'completed', task: longString, output: longString });
    const exec = makeExecution([turn]);

    const graph = buildExecutionGraph(exec);

    expect(graph.nodes[0].task.length).toBeLessThanOrEqual(120);
    expect(graph.nodes[0].output.length).toBeLessThanOrEqual(200);
  });
});

// ─── toTurnSummary ────────────────────────────────────────────────────────────

describe('toTurnSummary', () => {
  it('should return basic turn fields', () => {
    const turn = makeTurn({ id: 'abc', seq: 5, role: 'pm', status: 'completed', depth: 2 });
    const summary = toTurnSummary(turn);

    expect(summary.id).toBe('abc');
    expect(summary.seq).toBe(5);
    expect(summary.role).toBe('pm');
    expect(summary.status).toBe('completed');
    expect(summary.depth).toBe(2);
  });

  it('should include actionType when action is present', () => {
    const turn = makeTurn({ action: { type: 'done', summary: 'Finished!' } });
    const summary = toTurnSummary(turn);

    expect(summary.actionType).toBe('done');
    expect(summary.actionSummary).toBeTruthy();
  });

  it('should have undefined actionType when no action', () => {
    const turn = makeTurn({ action: null });
    const summary = toTurnSummary(turn);

    expect(summary.actionType).toBeUndefined();
    expect(summary.actionSummary).toBeUndefined();
  });

  it('should truncate long task strings to 200 chars', () => {
    const longTask = 'x'.repeat(300);
    const turn = makeTurn({ task: longTask });
    const summary = toTurnSummary(turn);

    expect(summary.task.length).toBeLessThanOrEqual(200);
  });

  it('should preserve parentTurnId and instanceId', () => {
    const turn = makeTurn({ parentTurnId: 'parent-42', instanceId: 'inst-99' });
    const summary = toTurnSummary(turn);

    expect(summary.parentTurnId).toBe('parent-42');
    expect(summary.instanceId).toBe('inst-99');
  });
});
