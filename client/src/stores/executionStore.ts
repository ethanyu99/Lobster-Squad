import { create } from 'zustand';
import type { WSMessage, TurnSummary } from '@shared/types';
import { fetchExecutionsApi } from '@/lib/api';
import type { ExecutionLog, ExecutionHistory } from '@/hooks/types';
import { useInstanceStore } from './instanceStore';

interface ExecutionState {
  executionLogs: ExecutionLog[];
  executionStreams: Record<string, string>;
  executions: ExecutionHistory[];
  activeExecution: ExecutionHistory | null;

  clearExecutionLogs: () => void;
  loadExecutions: () => Promise<void>;
  resetForNewDispatch: () => void;
  handleWSMessage: (msg: WSMessage) => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executionLogs: [],
  executionStreams: {},
  executions: [],
  activeExecution: null,

  clearExecutionLogs: () => set({ executionLogs: [] }),

  loadExecutions: async () => {
    try {
      const data = await fetchExecutionsApi();
      set({ executions: data.executions as unknown as ExecutionHistory[] });
    } catch (err) {
      console.warn('Failed to load executions:', err);
    }
  },

  resetForNewDispatch: () =>
    set({ executionLogs: [], executionStreams: {}, activeExecution: null }),

  handleWSMessage: (msg) => {
    switch (msg.type) {
      case 'execution:started': {
        const execId = msg.payload.executionId;
        const newExec: ExecutionHistory = {
          id: execId,
          teamId: msg.payload.teamId || msg.teamId || '',
          teamName: msg.payload.teamName || '',
          goal: msg.payload.goal || '',
          turns: [],
          edges: [],
          status: 'running',
          createdAt: msg.timestamp,
        };
        set(prev => ({
          activeExecution: newExec,
          executionLogs: [
            ...prev.executionLogs,
            {
              executionId: execId,
              message: `Execution started: ${msg.payload.goal}`,
              type: 'execution:started',
              timestamp: msg.timestamp,
            },
          ],
        }));
        break;
      }

      case 'execution:turn_start': {
        const turn = msg.payload.turn as TurnSummary;
        set(prev => {
          const active = prev.activeExecution;
          if (active && !active.turns.some(t => t.id === turn.id)) {
            const updatedActive = {
              ...active,
              turns: [
                ...active.turns,
                {
                  id: turn.id,
                  seq: turn.seq,
                  role: turn.role,
                  instanceId: turn.instanceId,
                  task: turn.task,
                  output: '',
                  status: 'running',
                  depth: turn.depth,
                  parentTurnId: turn.parentTurnId,
                  startedAt: msg.timestamp,
                },
              ],
            };
            return {
              activeExecution: updatedActive,
              executionLogs: [
                ...prev.executionLogs,
                {
                  executionId: msg.payload.executionId,
                  message: msg.payload.message || `Turn ${turn.seq}: ${turn.role} started`,
                  type: 'execution:turn_start',
                  timestamp: msg.timestamp,
                  turnId: turn.id,
                  role: turn.role,
                },
              ],
            };
          }
          return {
            executionLogs: [
              ...prev.executionLogs,
              {
                executionId: msg.payload.executionId,
                message: msg.payload.message || `Turn ${turn.seq}: ${turn.role} started`,
                type: 'execution:turn_start',
                timestamp: msg.timestamp,
                turnId: turn.id,
                role: turn.role,
              },
            ],
          };
        });
        break;
      }

      case 'execution:turn_stream': {
        const { turnId, chunk } = msg.payload;
        set(prev => {
          const active = prev.activeExecution;
          if (active) {
            const updatedTurns = active.turns.map(t =>
              t.id === turnId ? { ...t, output: t.output + chunk } : t
            );
            return {
              activeExecution: { ...active, turns: updatedTurns },
              executionStreams: {
                ...prev.executionStreams,
                [turnId]: (prev.executionStreams[turnId] || '') + chunk,
              },
            };
          }
          return {
            executionStreams: {
              ...prev.executionStreams,
              [turnId]: (prev.executionStreams[turnId] || '') + chunk,
            },
          };
        });
        if (msg.instanceId) {
          useInstanceStore.setState(prev => ({
            taskStreams: {
              ...prev.taskStreams,
              [msg.instanceId!]: (prev.taskStreams[msg.instanceId!] || '') + chunk,
            },
          }));
        }
        break;
      }

      case 'execution:turn_complete': {
        const turn = msg.payload.turn as TurnSummary;
        set(prev => {
          const active = prev.activeExecution;
          const updatedActive = active
            ? {
                ...active,
                turns: active.turns.map(t =>
                  t.id === turn.id
                    ? {
                        ...t,
                        status: 'completed',
                        completedAt: msg.timestamp,
                        durationMs: turn.durationMs,
                        actionType: turn.actionType,
                        actionSummary: turn.actionSummary,
                      }
                    : t
                ),
              }
            : null;

          const streams = { ...prev.executionStreams };
          delete streams[turn.id];

          return {
            activeExecution: updatedActive,
            executionStreams: streams,
            executionLogs: [
              ...prev.executionLogs,
              {
                executionId: msg.payload.executionId,
                message: `Turn ${turn.seq}: ${turn.role} completed${msg.payload.action ? ` → ${msg.payload.action.summary}` : ''}`,
                type: 'execution:turn_complete',
                timestamp: msg.timestamp,
                turnId: turn.id,
                role: turn.role,
              },
            ],
          };
        });
        if (msg.instanceId) {
          useInstanceStore.setState(prev => {
            const streams = { ...prev.taskStreams };
            delete streams[msg.instanceId!];
            return { taskStreams: streams };
          });
        }
        break;
      }

      case 'execution:turn_failed': {
        const turn = msg.payload.turn as TurnSummary;
        set(prev => {
          const active = prev.activeExecution;
          const updatedActive = active
            ? {
                ...active,
                turns: active.turns.map(t =>
                  t.id === turn.id
                    ? { ...t, status: 'failed', completedAt: msg.timestamp, output: msg.payload.error || '' }
                    : t
                ),
              }
            : null;
          return {
            activeExecution: updatedActive,
            executionLogs: [
              ...prev.executionLogs,
              {
                executionId: msg.payload.executionId,
                message: `Turn ${turn.seq}: ${turn.role} FAILED — ${msg.payload.error}`,
                type: 'execution:turn_failed',
                timestamp: msg.timestamp,
                turnId: turn.id,
                role: turn.role,
              },
            ],
          };
        });
        break;
      }

      case 'execution:edge_created': {
        set(prev => {
          const active = prev.activeExecution;
          if (!active) return {};
          return {
            activeExecution: {
              ...active,
              edges: [
                ...active.edges,
                { from: msg.payload.from, to: msg.payload.to, actionType: msg.payload.actionType },
              ],
            },
          };
        });
        break;
      }

      case 'execution:warning': {
        set(prev => ({
          executionLogs: [
            ...prev.executionLogs,
            {
              executionId: msg.payload.executionId || '',
              message: `WARNING: ${msg.payload.message}`,
              type: 'execution:warning',
              timestamp: msg.timestamp,
            },
          ],
        }));
        break;
      }

      case 'execution:completed': {
        const notifyFn = useInstanceStore.getState()._notifyFn;
        set(prev => {
          const active = prev.activeExecution;
          if (active) {
            const finalized: ExecutionHistory = {
              ...active,
              status: msg.payload.status === 'failed' ? 'failed' : 'completed',
              completedAt: msg.timestamp,
              summary: msg.payload.summary,
              graph: msg.payload.graph,
              metrics: msg.payload.metrics,
              teamName: msg.payload.teamName || active.teamName,
              goal: msg.payload.goal || active.goal,
            };
            return {
              activeExecution: null,
              executions: [finalized, ...prev.executions.filter(e => e.id !== finalized.id)],
              executionLogs: [
                ...prev.executionLogs,
                {
                  executionId: msg.payload.executionId,
                  message: `Execution completed: ${msg.payload.summary}`,
                  type: 'execution:completed',
                  timestamp: msg.timestamp,
                },
              ],
            };
          }
          return {};
        });
        notifyFn?.('Execution Completed', msg.payload.summary || 'Team execution finished');
        break;
      }

      case 'execution:timeout': {
        const notifyFn = useInstanceStore.getState()._notifyFn;
        set(prev => {
          const active = prev.activeExecution;
          if (active) {
            const finalized: ExecutionHistory = {
              ...active,
              status: 'timeout',
              completedAt: msg.timestamp,
              graph: msg.payload.graph,
              metrics: msg.payload.metrics,
            };
            return {
              activeExecution: null,
              executions: [finalized, ...prev.executions.filter(e => e.id !== finalized.id)],
              executionLogs: [
                ...prev.executionLogs,
                {
                  executionId: msg.payload.executionId,
                  message: `Execution TIMEOUT: ${msg.payload.message}`,
                  type: 'execution:timeout',
                  timestamp: msg.timestamp,
                },
              ],
            };
          }
          return {};
        });
        notifyFn?.('Execution Timeout', msg.payload.message || 'Execution timed out');
        break;
      }

      case 'execution:cancelled': {
        set(prev => {
          const active = prev.activeExecution;
          if (active) {
            const finalized: ExecutionHistory = {
              ...active,
              status: 'cancelled',
              completedAt: msg.timestamp,
              summary: msg.payload.summary,
              graph: msg.payload.graph,
              metrics: msg.payload.metrics,
            };
            return {
              activeExecution: null,
              executions: [finalized, ...prev.executions.filter(e => e.id !== finalized.id)],
              executionLogs: [
                ...prev.executionLogs,
                {
                  executionId: msg.payload.executionId,
                  message: `Execution cancelled: ${msg.payload.summary}`,
                  type: 'execution:cancelled',
                  timestamp: msg.timestamp,
                },
              ],
            };
          }
          return {};
        });
        break;
      }

      case 'team:error': {
        set(prev => ({
          executionLogs: [
            ...prev.executionLogs,
            {
              executionId: '',
              message: `Team error: ${msg.payload.error || msg.payload.message || 'Unknown error'}`,
              type: 'team:error',
              timestamp: msg.timestamp,
            },
          ],
        }));
        break;
      }
    }
  },
}));
