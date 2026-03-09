import { useState, useRef, useCallback, useEffect } from 'react';
import type { WSMessage, TurnSummary } from '@shared/types';
import { fetchExecutionsApi } from '@/lib/api';
import type { ExecutionLog, ExecutionHistory } from './types';

interface UseExecutionsReturn {
  executionLogs: ExecutionLog[];
  executionStreams: Record<string, string>;
  executions: ExecutionHistory[];
  activeExecution: ExecutionHistory | null;
  clearExecutionLogs: () => void;
  refreshExecutions: () => Promise<void>;
  resetForNewDispatch: () => void;
  handleExecutionMessage: (msg: WSMessage, context: ExecutionMessageContext) => void;
}

interface ExecutionMessageContext {
  setTaskStreams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notify: (title: string, body: string) => void;
}

export function useExecutions(): UseExecutionsReturn {
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [executionStreams, setExecutionStreams] = useState<Record<string, string>>({});
  const [executions, setExecutions] = useState<ExecutionHistory[]>([]);
  const activeExecutionRef = useRef<ExecutionHistory | null>(null);

  const clearExecutionLogs = useCallback(() => setExecutionLogs([]), []);

  const loadExecutions = useCallback(async () => {
    try {
      const data = await fetchExecutionsApi();
      setExecutions(data.executions as unknown as ExecutionHistory[]);
    } catch (err) {
      console.warn('Failed to load executions:', err);
    }
  }, []);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  const resetForNewDispatch = useCallback(() => {
    setExecutionLogs([]);
    setExecutionStreams({});
    activeExecutionRef.current = null;
  }, []);

  const handleExecutionMessage = useCallback(
    (msg: WSMessage, ctx: ExecutionMessageContext) => {
      switch (msg.type) {
        case 'execution:started': {
          const execId = msg.payload.executionId;
          activeExecutionRef.current = {
            id: execId,
            teamId: msg.payload.teamId || msg.teamId || '',
            teamName: msg.payload.teamName || '',
            goal: msg.payload.goal || '',
            turns: [],
            edges: [],
            status: 'running',
            createdAt: msg.timestamp,
          };
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: execId,
              message: `Execution started: ${msg.payload.goal}`,
              type: 'execution:started',
              timestamp: msg.timestamp,
            },
          ]);
          break;
        }

        case 'execution:turn_start': {
          const turn = msg.payload.turn as TurnSummary;
          if (activeExecutionRef.current) {
            const existing = activeExecutionRef.current.turns.find(t => t.id === turn.id);
            if (!existing) {
              activeExecutionRef.current.turns.push({
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
              });
            }
          }
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: msg.payload.message || `Turn ${turn.seq}: ${turn.role} started`,
              type: 'execution:turn_start',
              timestamp: msg.timestamp,
              turnId: turn.id,
              role: turn.role,
            },
          ]);
          break;
        }

        case 'execution:turn_stream': {
          const { turnId, chunk } = msg.payload;
          setExecutionStreams(prev => ({
            ...prev,
            [turnId]: (prev[turnId] || '') + chunk,
          }));
          if (activeExecutionRef.current) {
            const turnRec = activeExecutionRef.current.turns.find(t => t.id === turnId);
            if (turnRec) turnRec.output += chunk;
          }
          if (msg.instanceId) {
            ctx.setTaskStreams(prev => ({
              ...prev,
              [msg.instanceId!]: (prev[msg.instanceId!] || '') + chunk,
            }));
          }
          break;
        }

        case 'execution:turn_complete': {
          const turn = msg.payload.turn as TurnSummary;
          if (activeExecutionRef.current) {
            const turnRec = activeExecutionRef.current.turns.find(t => t.id === turn.id);
            if (turnRec) {
              turnRec.status = 'completed';
              turnRec.completedAt = msg.timestamp;
              turnRec.durationMs = turn.durationMs;
              turnRec.actionType = turn.actionType;
              turnRec.actionSummary = turn.actionSummary;
            }
          }
          if (msg.instanceId) {
            ctx.setTaskStreams(prev => {
              const next = { ...prev };
              delete next[msg.instanceId!];
              return next;
            });
          }
          setExecutionStreams(prev => {
            const next = { ...prev };
            delete next[turn.id];
            return next;
          });
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: `Turn ${turn.seq}: ${turn.role} completed${msg.payload.action ? ` → ${msg.payload.action.summary}` : ''}`,
              type: 'execution:turn_complete',
              timestamp: msg.timestamp,
              turnId: turn.id,
              role: turn.role,
            },
          ]);
          break;
        }

        case 'execution:turn_failed': {
          const turn = msg.payload.turn as TurnSummary;
          if (activeExecutionRef.current) {
            const turnRec = activeExecutionRef.current.turns.find(t => t.id === turn.id);
            if (turnRec) {
              turnRec.status = 'failed';
              turnRec.completedAt = msg.timestamp;
              turnRec.output = msg.payload.error || '';
            }
          }
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: `Turn ${turn.seq}: ${turn.role} FAILED — ${msg.payload.error}`,
              type: 'execution:turn_failed',
              timestamp: msg.timestamp,
              turnId: turn.id,
              role: turn.role,
            },
          ]);
          break;
        }

        case 'execution:edge_created': {
          if (activeExecutionRef.current) {
            activeExecutionRef.current.edges.push({
              from: msg.payload.from,
              to: msg.payload.to,
              actionType: msg.payload.actionType,
            });
          }
          break;
        }

        case 'execution:warning': {
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId || '',
              message: `WARNING: ${msg.payload.message}`,
              type: 'execution:warning',
              timestamp: msg.timestamp,
            },
          ]);
          break;
        }

        case 'execution:completed': {
          if (activeExecutionRef.current) {
            const exec = activeExecutionRef.current;
            exec.status = msg.payload.status === 'failed' ? 'failed' : 'completed';
            exec.completedAt = msg.timestamp;
            exec.summary = msg.payload.summary;
            exec.graph = msg.payload.graph;
            exec.metrics = msg.payload.metrics;
            if (msg.payload.teamName) exec.teamName = msg.payload.teamName;
            if (msg.payload.goal) exec.goal = msg.payload.goal;
            setExecutions(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
            activeExecutionRef.current = null;
          }
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: `Execution completed: ${msg.payload.summary}`,
              type: 'execution:completed',
              timestamp: msg.timestamp,
            },
          ]);
          ctx.notify('Execution Completed', msg.payload.summary || 'Team execution finished');
          break;
        }

        case 'execution:timeout': {
          if (activeExecutionRef.current) {
            const exec = activeExecutionRef.current;
            exec.status = 'timeout';
            exec.completedAt = msg.timestamp;
            exec.graph = msg.payload.graph;
            exec.metrics = msg.payload.metrics;
            setExecutions(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
            activeExecutionRef.current = null;
          }
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: `Execution TIMEOUT: ${msg.payload.message}`,
              type: 'execution:timeout',
              timestamp: msg.timestamp,
            },
          ]);
          ctx.notify('Execution Timeout', msg.payload.message || 'Execution timed out');
          break;
        }

        case 'execution:cancelled': {
          if (activeExecutionRef.current) {
            const exec = activeExecutionRef.current;
            exec.status = 'cancelled';
            exec.completedAt = msg.timestamp;
            exec.summary = msg.payload.summary;
            exec.graph = msg.payload.graph;
            exec.metrics = msg.payload.metrics;
            setExecutions(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
            activeExecutionRef.current = null;
          }
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: msg.payload.executionId,
              message: `Execution cancelled: ${msg.payload.summary}`,
              type: 'execution:cancelled',
              timestamp: msg.timestamp,
            },
          ]);
          break;
        }

        case 'team:error': {
          setExecutionLogs(prev => [
            ...prev,
            {
              executionId: '',
              message: `Team error: ${msg.payload.error || msg.payload.message || 'Unknown error'}`,
              type: 'team:error',
              timestamp: msg.timestamp,
            },
          ]);
          break;
        }
      }
    },
    [],
  );

  return {
    executionLogs,
    executionStreams,
    executions,
    activeExecution: activeExecutionRef.current,
    clearExecutionLogs,
    refreshExecutions: loadExecutions,
    resetForNewDispatch,
    handleExecutionMessage,
  };
}
