import type { TeamPublic, TeamTemplate, ClawRole } from '@shared/types';
import { apiFetch } from './client';

export async function fetchTeams(): Promise<{ teams: TeamPublic[] }> {
  return apiFetch('/teams');
}

export async function fetchTeamTemplates(): Promise<{ templates: TeamTemplate[] }> {
  return apiFetch('/teams/templates');
}

export async function fetchTeam(id: string): Promise<TeamPublic> {
  return apiFetch(`/teams/${id}`);
}

export async function createTeam(data: {
  name: string;
  description?: string;
  templateId?: string;
  roles?: Omit<ClawRole, 'id'>[];
}): Promise<TeamPublic> {
  return apiFetch('/teams', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTeam(id: string, data: { name?: string; description?: string }): Promise<TeamPublic> {
  return apiFetch(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTeam(id: string): Promise<void> {
  return apiFetch(`/teams/${id}`, { method: 'DELETE' });
}

export async function addRoleToTeam(teamId: string, role: Omit<ClawRole, 'id'>): Promise<TeamPublic> {
  return apiFetch(`/teams/${teamId}/roles`, { method: 'POST', body: JSON.stringify(role) });
}

export async function updateRole(teamId: string, roleId: string, data: Partial<Omit<ClawRole, 'id'>>): Promise<TeamPublic> {
  return apiFetch(`/teams/${teamId}/roles/${roleId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteRole(teamId: string, roleId: string): Promise<TeamPublic> {
  return apiFetch(`/teams/${teamId}/roles/${roleId}`, { method: 'DELETE' });
}

export async function bindInstanceToRole(teamId: string, instanceId: string, roleId: string): Promise<TeamPublic> {
  return apiFetch(`/teams/${teamId}/bind`, { method: 'POST', body: JSON.stringify({ instanceId, roleId }) });
}

export async function unbindInstance(teamId: string, instanceId: string): Promise<TeamPublic> {
  return apiFetch(`/teams/${teamId}/unbind`, { method: 'POST', body: JSON.stringify({ instanceId }) });
}
