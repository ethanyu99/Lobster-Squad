import type { ExecutionRecord } from '@shared/types';
import { apiFetch } from './client';

export async function fetchExecutionsApi(): Promise<{ executions: ExecutionRecord[] }> {
  return apiFetch('/executions');
}

export async function fetchExecutionDetail(id: string): Promise<ExecutionRecord> {
  return apiFetch(`/executions/${id}`);
}

export async function deleteExecutionApi(id: string): Promise<void> {
  return apiFetch(`/executions/${id}`, { method: 'DELETE' });
}

export async function clearExecutionsApi(): Promise<void> {
  return apiFetch('/executions', { method: 'DELETE' });
}
