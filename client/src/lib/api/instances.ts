import type { InstancePublic, InstanceStats, SandboxProgress, SandboxSSEEvent, TaskSummary } from '@shared/types';
import { apiFetch, API_BASE, authHeaders } from './client';

export async function fetchInstances(): Promise<{ instances: InstancePublic[]; stats: InstanceStats }> {
  return apiFetch('/instances');
}

export async function createInstance(data: { name: string; endpoint: string; description: string; token?: string }): Promise<InstancePublic> {
  return apiFetch('/instances', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateInstance(id: string, data: { name?: string; endpoint?: string; description?: string; token?: string }): Promise<InstancePublic> {
  return apiFetch(`/instances/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteInstance(id: string): Promise<void> {
  return apiFetch(`/instances/${id}`, { method: 'DELETE' });
}

export async function createSandboxInstance(
  data: { name: string; apiKey: string; gatewayToken?: string; description?: string },
  onProgress?: (progress: SandboxProgress) => void,
): Promise<InstancePublic> {
  // SSE streaming — cannot use apiFetch
  const res = await fetch(`${API_BASE}/instances/sandbox`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Failed to create sandbox' }));
    throw new Error(body.error || 'Failed to create sandbox');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      let event: SandboxSSEEvent;
      try { event = JSON.parse(raw); } catch { continue; }

      if (event.type === 'progress' && event.step && event.message) {
        onProgress?.({ step: event.step, message: event.message, detail: event.detail });
      } else if (event.type === 'complete' && event.instance) {
        return event.instance;
      } else if (event.type === 'error') {
        throw new Error(event.error || 'Sandbox creation failed');
      }
    }
  }

  throw new Error('SSE stream ended without completion event');
}

export async function checkHealth(id: string): Promise<{ status: string }> {
  return apiFetch(`/instances/${id}/health`, { method: 'POST' });
}

export async function fetchTasks(instanceId?: string): Promise<TaskSummary[]> {
  const path = instanceId ? `/tasks?instanceId=${instanceId}` : '/tasks';
  return apiFetch(path);
}

export async function uploadFiles(files: File[]): Promise<{ url: string; key: string }[]> {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  const data = await apiFetch<{ files: { url: string; key: string }[] }>('/upload', {
    method: 'POST',
    body: formData,
  });
  return data.files;
}
