import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { InstancePublic, WSMessage } from '@shared/types';
import { fetchInstances, createWebSocket } from '@/lib/api';
import {
  addExchangeToSession,
  updateExchange,
  type SessionExchange,
  saveTeamExecution,
  getTeamExecutions,
  type TeamExecutionHistory,
} from '@/lib/storage';

interface PendingExchange {
  instanceId: string;
  instanceName: string;
  content: string;
  timestamp: string;
}

export function useInstanceManager() {
  const [instances, setInstances] = useState<InstancePublic[]>([]);
  const [taskStreams, setTaskStreams] = useState<Record<string, string>>({});

  const stats = useMemo(() => ({
    total: instances.length,
    online: instances.filter(i => i.status === 'online').length,
    busy: instances.filter(i => i.status === 'busy').length,
    offline: instances.filter(i => i.status === 'offline').length,
  }), [instances]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskContentRef = useRef<Record<string, string>>({});
  const pendingExchangesRef = useRef<Record<string, PendingExchange>>({});
  const instancesRef = useRef<InstancePublic[]>([]);

  // Keep instancesRef in sync for use inside callbacks without stale closure
  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  const loadInstances = useCallback(async () => {
    try {
      const data = await fetchInstances();
      setInstances(data.instances);
    } catch {
      // will retry on reconnect
    }
  }, []);

  const handleWSMessage = useCallback((msg: WSMessage) => {
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
        // Create session exchange entry when we get sessionKey from server
        const serverTaskId = msg.payload?.id || msg.taskId;
        if (msg.sessionKey && serverTaskId) {
          const pending = pendingExchangesRef.current[serverTaskId];
          if (pending) {
            const exchange: SessionExchange = {
              id: serverTaskId,
              input: pending.content,
              status: msg.payload?.status || 'pending',
              timestamp: pending.timestamp,
            };
            addExchangeToSession(msg.sessionKey, pending.instanceId, pending.instanceName, exchange);
            delete pendingExchangesRef.current[serverTaskId];
          } else if (msg.payload?.content && msg.payload.status === 'pending') {
            const inst = instancesRef.current.find(i => i.id === msg.instanceId);
            const exchange: SessionExchange = {
              id: serverTaskId,
              input: msg.payload.content,
              status: msg.payload.status,
              timestamp: msg.payload.createdAt || new Date().toISOString(),
            };
            addExchangeToSession(msg.sessionKey, msg.instanceId!, inst?.name || msg.instanceId!, exchange);
          }
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
          updateExchange(msg.taskId, { summary: msg.payload.summary });
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
        if (msg.taskId) {
          const output = taskContentRef.current[msg.taskId] || msg.payload.summary || '';
          updateExchange(msg.taskId, {
            status: 'completed',
            summary: msg.payload.summary,
            output,
            completedAt: new Date().toISOString(),
          });
          delete taskContentRef.current[msg.taskId];
        }
        setInstances(prev =>
          prev.map(inst =>
            inst.id === msg.instanceId
              ? { ...inst, status: 'online', currentTask: inst.currentTask ? { ...inst.currentTask, status: 'completed', summary: msg.payload.summary } : undefined }
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
        if (msg.taskId) {
          const output = taskContentRef.current[msg.taskId] || '';
          updateExchange(msg.taskId, {
            status: 'failed',
            summary: msg.payload.error,
            output: output || undefined,
            completedAt: new Date().toISOString(),
          });
          delete taskContentRef.current[msg.taskId];
        }
        setInstances(prev =>
          prev.map(inst =>
            inst.id === msg.instanceId
              ? { ...inst, status: 'online', currentTask: inst.currentTask ? { ...inst.currentTask, status: 'failed' } : undefined }
              : inst
          )
        );
        loadInstances();
        break;

      case 'team:step': {
        const phase = msg.payload.phase as string;
        setTeamLogs(prev => [
          ...prev,
          {
            teamId: msg.teamId || '',
            message: msg.payload.message || '',
            phase,
            timestamp: msg.timestamp,
          },
        ]);

        if (phase === 'planning') {
          const execId = crypto.randomUUID();
          activeTeamExecutionRef.current = {
            id: execId,
            teamId: msg.teamId || '',
            teamName: msg.payload.teamName || '',
            goal: msg.payload.goal || '',
            steps: [],
            status: 'running',
            createdAt: msg.timestamp,
          };
        } else if (phase === 'planned' && activeTeamExecutionRef.current) {
          activeTeamExecutionRef.current.plan = msg.payload.plan;
        } else if (phase === 'step_start' && activeTeamExecutionRef.current) {
          const existing = activeTeamExecutionRef.current.steps.find(s => s.step === msg.payload.step);
          if (!existing) {
            activeTeamExecutionRef.current.steps.push({
              step: msg.payload.step,
              role: msg.payload.role || '',
              task: msg.payload.task || '',
              instanceId: msg.payload.instanceId,
              output: '',
              status: 'running',
              startedAt: msg.timestamp,
            });
          }
        } else if (phase === 'step_done' && activeTeamExecutionRef.current) {
          const stepRecord = activeTeamExecutionRef.current.steps.find(s => s.step === msg.payload.step);
          if (stepRecord) {
            stepRecord.output = msg.payload.output || '';
            stepRecord.status = 'completed';
            stepRecord.completedAt = msg.timestamp;
            stepRecord.task = msg.payload.task || stepRecord.task;
          } else {
            activeTeamExecutionRef.current.steps.push({
              step: msg.payload.step,
              role: msg.payload.role || '',
              task: msg.payload.task || '',
              instanceId: msg.payload.instanceId,
              output: msg.payload.output || '',
              status: 'completed',
              completedAt: msg.timestamp,
            });
          }
        } else if (phase === 'step_error' && activeTeamExecutionRef.current) {
          const stepRecord = activeTeamExecutionRef.current.steps.find(s => s.step === msg.payload.step);
          if (stepRecord) {
            stepRecord.status = 'failed';
            stepRecord.completedAt = msg.timestamp;
          } else {
            activeTeamExecutionRef.current.steps.push({
              step: msg.payload.step,
              role: msg.payload.role || '',
              task: msg.payload.task,
              output: '',
              status: 'failed',
              completedAt: msg.timestamp,
            });
          }
        } else if (phase === 'step_skip' && activeTeamExecutionRef.current) {
          activeTeamExecutionRef.current.steps.push({
            step: msg.payload.step,
            role: msg.payload.role || '',
            task: msg.payload.task,
            output: '',
            status: 'skipped',
          });
        }
        break;
      }

      case 'team:complete': {
        setTeamLogs(prev => [
          ...prev,
          {
            teamId: msg.teamId || '',
            message: msg.payload.message || '',
            phase: 'team:complete',
            timestamp: msg.timestamp,
          },
        ]);

        if (activeTeamExecutionRef.current) {
          const exec = activeTeamExecutionRef.current;
          exec.status = 'completed';
          exec.completedAt = msg.timestamp;
          if (msg.payload.goal) exec.goal = msg.payload.goal;
          if (msg.payload.teamName) exec.teamName = msg.payload.teamName;

          if (msg.payload.results) {
            for (const r of msg.payload.results as Array<{ step: number; role: string; output: string }>) {
              const existing = exec.steps.find(s => s.step === r.step);
              if (existing) {
                if (r.output) existing.output = r.output;
              } else {
                exec.steps.push({
                  step: r.step,
                  role: r.role || '',
                  output: r.output || '',
                  status: 'completed',
                  completedAt: msg.timestamp,
                });
              }
            }
            exec.steps.sort((a, b) => a.step - b.step);
          }

          saveTeamExecution(exec);
          setTeamExecutions(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
          activeTeamExecutionRef.current = null;
        }
        break;
      }

      case 'team:error': {
        setTeamLogs(prev => [
          ...prev,
          {
            teamId: msg.teamId || '',
            message: msg.payload.error || msg.payload.message || '',
            phase: 'team:error',
            timestamp: msg.timestamp,
          },
        ]);

        if (activeTeamExecutionRef.current) {
          const exec = activeTeamExecutionRef.current;
          exec.status = 'failed';
          exec.completedAt = msg.timestamp;
          saveTeamExecution(exec);
          setTeamExecutions(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
          activeTeamExecutionRef.current = null;
        }
        break;
      }
    }
  }, [loadInstances]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = createWebSocket(handleWSMessage);

    ws.onopen = () => {
      setConnected(true);
      loadInstances();
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [handleWSMessage, loadInstances]);

  useEffect(() => {
    loadInstances();
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, loadInstances]);

  const [teamLogs, setTeamLogs] = useState<Array<{ teamId: string; message: string; phase: string; timestamp: string }>>([]);
  const activeTeamExecutionRef = useRef<TeamExecutionHistory | null>(null);
  const [teamExecutions, setTeamExecutions] = useState<TeamExecutionHistory[]>(() => getTeamExecutions());

  const clearTeamLogs = useCallback(() => setTeamLogs([]), []);

  const refreshTeamExecutions = useCallback(() => {
    setTeamExecutions(getTeamExecutions());
  }, []);

  const dispatchTeamTask = useCallback((teamId: string, content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'team:dispatch',
      payload: { teamId, content },
      timestamp: new Date().toISOString(),
    }));
  }, []);

  const dispatchTask = useCallback((instanceId: string, content: string, instanceName: string, newSession?: boolean, imageUrls?: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const taskId = self.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    taskContentRef.current[taskId] = '';

    const displayContent = imageUrls?.length
      ? `${content}${content ? '\n' : ''}[${imageUrls.length} image(s) attached]`
      : content;

    pendingExchangesRef.current[taskId] = { instanceId, instanceName, content: displayContent, timestamp: now };

    wsRef.current.send(JSON.stringify({
      type: 'task:dispatch',
      payload: { instanceId, content, taskId, newSession, imageUrls },
      timestamp: now,
    }));
  }, []);

  return {
    instances,
    stats,
    taskStreams,
    connected,
    dispatchTask,
    dispatchTeamTask,
    teamLogs,
    clearTeamLogs,
    teamExecutions,
    refreshTeamExecutions,
    refreshInstances: loadInstances,
  };
}
