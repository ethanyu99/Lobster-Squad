import type { SkillDefinition, SkillInstallResult } from '@shared/types';
import { apiFetch, ApiError } from './client';

export interface RemoteSkill {
  slug: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  stars: number;
  updatedAt: string;
  githubUrl: string;
  skillUrl: string;
}

export type SkillsMPErrorCode =
  | 'MISSING_API_KEY' | 'INVALID_API_KEY' | 'MISSING_QUERY'
  | 'DAILY_QUOTA_EXCEEDED' | 'INTERNAL_ERROR' | 'NOT_CONFIGURED' | 'NETWORK_ERROR';

export class SkillsMPApiError extends Error {
  code: SkillsMPErrorCode;
  status: number;
  constructor(code: SkillsMPErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchSkillRegistry(): Promise<{ skills: SkillDefinition[] }> {
  return apiFetch('/skills');
}

export async function searchSkillsApi(query: string): Promise<{ skills: SkillDefinition[] }> {
  return apiFetch(`/skills/search?q=${encodeURIComponent(query)}`);
}

export async function fetchInstanceSkills(instanceId: string): Promise<{ instanceId: string; skills: Array<SkillDefinition & { installedAt: string }> }> {
  return apiFetch(`/skills/instance/${instanceId}`);
}

export async function installSkills(instanceId: string, skillIds: string[]): Promise<{ total: number; succeeded: number; failed: number; results: SkillInstallResult[] }> {
  return apiFetch(`/skills/instance/${instanceId}/install`, { method: 'POST', body: JSON.stringify({ skillIds }) });
}

export async function uninstallSkills(instanceId: string, skillIds: string[]): Promise<{ total: number; succeeded: number; failed: number; results: SkillInstallResult[] }> {
  return apiFetch(`/skills/instance/${instanceId}/uninstall`, { method: 'POST', body: JSON.stringify({ skillIds }) });
}

export async function fetchSkillReadme(skillId: string): Promise<string> {
  return apiFetch(`/skills/${skillId}/readme`);
}

export async function checkRemoteStatus(): Promise<{ configured: boolean }> {
  try {
    return await apiFetch('/skills/remote/status');
  } catch {
    return { configured: false };
  }
}

export async function searchRemoteSkills(
  query: string,
  mode: 'keyword' | 'ai' = 'keyword',
): Promise<{ skills: RemoteSkill[]; total: number; query: string }> {
  try {
    return await apiFetch(`/skills/remote/search?q=${encodeURIComponent(query)}&mode=${mode}`);
  } catch (err) {
    if (err instanceof ApiError) {
      throw new SkillsMPApiError(
        (err.code as SkillsMPErrorCode) || 'INTERNAL_ERROR',
        err.message,
        err.status,
      );
    }
    throw err;
  }
}

export async function fetchRemoteSkillContent(githubUrl: string): Promise<string> {
  return apiFetch(`/skills/remote/content?url=${encodeURIComponent(githubUrl)}`);
}

export async function installRemoteSkill(
  instanceId: string,
  slug: string,
  name: string,
  githubUrl?: string,
  skillMd?: string,
): Promise<SkillInstallResult> {
  return apiFetch(`/skills/instance/${instanceId}/install-remote`, {
    method: 'POST',
    body: JSON.stringify({ slug, name, rawUrl: githubUrl, skillMd }),
  });
}
