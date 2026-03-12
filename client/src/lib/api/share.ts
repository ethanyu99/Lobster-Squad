import type { ShareToken, ShareDuration, ShareViewData } from '@shared/types';
import { apiFetch } from './client';

export async function createShareLink(data: {
  shareType: 'team' | 'instance';
  targetId: string;
  duration: ShareDuration;
}): Promise<{ shareToken: ShareToken }> {
  return apiFetch('/share', { method: 'POST', body: JSON.stringify(data) });
}

export async function fetchShareTokens(): Promise<{ shareTokens: ShareToken[] }> {
  return apiFetch('/share');
}

export async function revokeShareToken(id: string): Promise<void> {
  return apiFetch(`/share/${id}`, { method: 'DELETE' });
}

export async function fetchShareView(token: string): Promise<ShareViewData> {
  return apiFetch(`/share/view/${token}`);
}
