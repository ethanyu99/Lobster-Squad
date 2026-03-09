import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { InstancePublic, WSMessage, ExecutionConfig } from '@shared/types';
import { fetchInstances } from '@/lib/api';
import { type TeamExecutionHistory, getTeamExecutions } from '@/lib/storage';
import { useWebSocket } from './useWebSocket';
import { useExecutions } from './useExecutions';
import type { PendingExchange } from './types';

export type { ExecutionHistory } from './types';

export function useInstanceManager() {
  const [instances, setInstances] = useState<InstancePublic[]>([]);
  const [taskStreams, setTaskStreams] = useState<Record<string, string>>({});

  const stats = useMemo(() => ({
    total: instances.length,
    online: instances.filter(i => i.status === 'online').length,
    busy: instances.filter(i => i.status === 'busy').length,
    offline: instances.filter(i => i.status === 'offline').length,
  }), [instances]);

  const taskContentRef = useRef<Record<string, string>>({});
  const pendingExchangesRef = useRef<Record<string, PendingExchange>>({});
  const notifyRef = useRef<((title: string, body: string) => void) | null>(null);

  const {
    executionLogs, executionStreams, executions, activeExecution,
    clearExecutionLogs, refreshExecutions, resetForNewDispatch,
    handleExecutionMessage,
  } = useExecutions();

  const loadInstances = useCallback(async () => {
    try {
      const data = await fetchInstances();
      setInstances(data.instances);
    } catch (err) {
      console.warn('Failed to load instances:', err);
    }
  }, []);

  // ── WebSocket message routing ──

  const handleWSMessage = useCallback((msg: WSMessage) => {
    // Execution-related messages are delegated to useExecutions
    if (msg.type.startsWith('execution:') || msg.type === 'team:error') {
      handleExecutionMessage(msg, {
        setTaskStreams,
        notify: (title, body) => notifyRef.current?.(title, body),
      });
      return;
    }

    switch (msg.type) {
      case 'instance:status':
        if (msg.payload.instances) {
          setInstances(msg.payload.instances);
        } else if (msg.payload.instanceId) {
          setInstances(prev =>
            prev.map(inst =>
              inst.id === msg.payload.instanceId
                ? { ...inst, status: msg.payload.status }
                : inst
            )
          );
        }
        break;

      case 'task:status': {
        const serverTaskId = msg.payload?.id || msg.taskId;
        if (serverTaskId) {
          delete pendingExchangesRef.current[serverTaskId];
        }

        if (msg.payload.status === 'running' || msg.payload.status === 'pending') {
          setInstances(prev =>
            prev.map(inst => {
              if (inst.id !== msg.instanceId) return inst;
              const isNewTask = !inst.currentTask || inst.currentTask.id !== msg.payload.id;
              return {
                ...inst,
                currentTask: isNewTask ? msg.payload : { ...inst.currentTask, ...msg.payload },
                status: 'busy',
              };
            })
          );
          if (msg.instanceId) {
            setTaskStreams(prev => {
              const next = { ...prev };
              delete next[msg.instanceId!];
              return next;
            });
          }
        }
        break;
      }

      case 'task:stream': {
        const chunk = msg.payload.chunk || '';
        setTaskStreams(prev => ({
          ...prev,
          [msg.instanceId!]: (prev[msg.instanceId!] || '') + chunk,
        }));
        if (msg.taskId) {
          taskContentRef.current[msg.taskId] = (taskContentRef.current[msg.taskId] || '') + chunk;
        }
        if (msg.taskId && msg.payload.summary) {
          setInstances(prev =>
            prev.map(inst =>
              inst.id === msg.instanceId && inst.currentTask
                ? { ...inst, currentTask: { ...inst.currentTask, summary: msg.payload.summary } }
                : inst
            )
          );
        }
        break;
      }

      case 'task:complete':
        if (msg.taskId) delete taskContentRef.current[msg.taskId];
        setInstances(prev =>
          prev.map(inst =>
            inst.id === msg.instanceId
              ? {
                  ...inst,
                  status: 'online',
                  currentTask: inst.currentTask
                    ? { ...inst.currentTask, status: 'completed', summary: msg.payload.summary }
                    : undefined,
                }
              : inst
          )
        );
        setTaskStreams(prev => {
          const next = { ...prev };
          delete next[msg.instanceId!];
          return next;
        });
        loadInstances();
        notifyRef.current?.('Task Completed', msg.payload.summary || 'A task has finished');
        break;

      case 'task:cancelled':
        if (msg.taskId) delete taskContentRef.current[msg.taskId];
        setInstances(prev =>
          prev.map(inst =>
            inst.id === msg.instanceId
              ? {
                  ...inst,
                  status: 'online',
                  currentTask: inst.currentTask
                    ? { ...inst.currentTask, status: 'cancelled' }
                    : undefined,
                }
              : inst
          )
        );
        setTaskStreams(prev => {
          const next = { ...prev };
          delete next[msg.instanceId!];
          return next;
        });
        loadInstances();
        break;

      case 'task:error':
        if (msg.taskId) delete taskContentRef.current[msg.taskId];
        setInstances(prev =>
          prev.map(inst =>
            inst.id === msg.instanceId
              ? {
                  ...inst,
                  status: 'online',
                  currentTask: inst.currentTask
                    ? { ...inst.currentTask, status: 'failed' }
                    : undefined,
                }
              : inst
          )
        );
        loadInstances();
        notifyRef.current?.('Task Failed', msg.payload.error || 'A task has failed');
        break;
    }
  }, [loadInstances, handleExecutionMessage]);

  const { connected, send } = useWebSocket(handleWSMessage);

  // Load instances on mount and when WS connects
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Reload instances when connection is re-established
  useEffect(() => {
    if (connected) loadInstances();
  }, [connected, loadInstances]);

  // ── Legacy team execution state (backward compat with history drawer) ──

  const [teamExecutions] = useState<TeamExecutionHistory[]>(() => getTeamExecutions());

  // ── Dispatch actions ──

  const dispatchTask = useCallback(
    (instanceId: string, content: string, instanceName: string, newSession?: boolean, imageUrls?: string[]) => {
      const taskId = self.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const now = new Date().toISOString();

      taskContentRef.current[taskId] = '';

      const displayContent = imageUrls?.length
        ? `${content}${content ? '\n' : ''}[${imageUrls.length} image(s) attached]`
        : content;

      pendingExchangesRef.current[taskId] = { instanceId, instanceName, content: displayContent, timestamp: now };

      send({
        type: 'task:dispatch',
        payload: { instanceId, content, taskId, newSession, imageUrls },
        timestamp: now,
      });
    },
    [send],
  );

  const dispatchTeamTask = useCallback(
    (teamId: string, content: string, newSession?: boolean, config?: Partial<ExecutionConfig>) => {
      if (newSession) resetForNewDispatch();

      send({
        type: 'team:dispatch',
        payload: { teamId, content, newSession: newSession || undefined, config: config || undefined },
        timestamp: new Date().toISOString(),
      });
    },
    [send, resetForNewDispatch],
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      send({
        type: 'task:cancel',
        payload: { taskId },
        timestamp: new Date().toISOString(),
      });
    },
    [send],
  );

  const cancelExecution = useCallback(
    (executionId: string) => {
      send({
        type: 'execution:cancel',
        payload: { executionId },
        timestamp: new Date().toISOString(),
      });
    },
    [send],
  );

  const setNotifyCallback = useCallback((fn: (title: string, body: string) => void) => {
    notifyRef.current = fn;
  }, []);

  return {
    instances,
    stats,
    taskStreams,
    connected,
    dispatchTask,
    dispatchTeamTask,
    cancelTask,
    cancelExecution,
    teamExecutions,
    refreshInstances: loadInstances,
    executionLogs,
    executionStreams,
    executions,
    activeExecution,
    clearExecutionLogs,
    refreshExecutions,
    setNotifyCallback,
  };
}
