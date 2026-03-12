import { apiFetch } from './client';

export interface GitConfigPayload {
  pat: string;
  username?: string;
  gitName?: string;
  gitEmail?: string;
  host?: string;
}

export interface GitConfigResult {
  success: boolean;
  steps: string[];
  verified: boolean;
  verifyMessage: string;
}

export interface GitStatusResult {
  hasCredentials: boolean;
  gitName: string;
  gitEmail: string;
}

export interface TeamGitConfigResult {
  total: number;
  succeeded: number;
  failed: number;
  results: {
    instanceId: string;
    instanceName: string;
    success: boolean;
    verified: boolean;
    verifyMessage: string;
    error?: string;
  }[];
}

export interface TeamRoleGitStatus {
  roleId: string;
  roleName: string;
  isLead: boolean;
  instanceId: string | null;
  instanceName: string | null;
  isSandbox: boolean;
  hasCredentials: boolean | null;
  gitName: string;
  gitEmail: string;
  reason: 'unbound' | 'not_found' | 'no_endpoint' | 'connection_failed' | null;
}

export interface TeamGitStatusResult {
  totalRoles: number;
  configurable: number;
  configured: number;
  roleStatuses: TeamRoleGitStatus[];
}

export interface SandboxFileListResult {
  path: string;
  files: import('@shared/types').SandboxFileEntry[];
}

export interface SandboxFileReadResult {
  path: string;
  content: string;
  size: number;
}

export async function configureSandboxGit(instanceId: string, data: GitConfigPayload): Promise<GitConfigResult> {
  return apiFetch(`/instances/${instanceId}/sandbox/configure/git`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getSandboxGitStatus(instanceId: string): Promise<GitStatusResult> {
  return apiFetch(`/instances/${instanceId}/sandbox/configure/git/status`);
}

export async function configureTeamGit(teamId: string, data: GitConfigPayload): Promise<TeamGitConfigResult> {
  return apiFetch(`/teams/${teamId}/configure/git`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getTeamGitStatus(teamId: string): Promise<TeamGitStatusResult> {
  return apiFetch(`/teams/${teamId}/configure/git/status`);
}

export async function listSandboxFiles(
  instanceId: string,
  dirPath?: string,
  opts?: { depth?: number; hidden?: boolean },
): Promise<SandboxFileListResult> {
  const params = new URLSearchParams();
  if (dirPath) params.set('path', dirPath);
  if (opts?.depth) params.set('depth', String(opts.depth));
  if (opts?.hidden) params.set('hidden', 'true');
  return apiFetch(`/instances/${instanceId}/sandbox/files?${params}`);
}

export async function readSandboxFile(instanceId: string, filePath: string): Promise<SandboxFileReadResult> {
  const params = new URLSearchParams({ path: filePath });
  return apiFetch(`/instances/${instanceId}/sandbox/files/read?${params}`);
}
