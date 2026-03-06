import { Sandbox } from 'novita-sandbox';
import { getSkillById } from './skill-registry';
import { saveInstanceSkill, deleteInstanceSkill } from './persistence';
import type { SkillInstallResult, SkillDefinition } from '../../shared/types';

const SANDBOX_KEEP_ALIVE_MS = 50 * 365 * 24 * 3600 * 1000;
const SKILLS_BASE_PATH = '/home/user/.openclaw/skills';

async function connectSandbox(sandboxId: string, apiKey: string) {
  return Sandbox.connect(sandboxId, {
    apiKey,
    timeoutMs: SANDBOX_KEEP_ALIVE_MS,
  });
}

export async function installSkillToSandbox(
  sandboxId: string,
  apiKey: string,
  instanceId: string,
  skillId: string,
): Promise<SkillInstallResult> {
  const skill = getSkillById(skillId);
  if (!skill) {
    return { skillId, instanceId, success: false, error: `Skill "${skillId}" not found in registry` };
  }

  try {
    const sandbox = await connectSandbox(sandboxId, apiKey);

    const skillDir = `${SKILLS_BASE_PATH}/${skill.name}`;
    await sandbox.commands.run(`mkdir -p ${skillDir}`, { timeoutMs: 10_000 });
    await sandbox.files.write(`${skillDir}/SKILL.md`, skill.skillMd);

    if (skill.extraFiles) {
      for (const [relativePath, content] of Object.entries(skill.extraFiles)) {
        const fullPath = `${skillDir}/${relativePath}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        await sandbox.commands.run(`mkdir -p ${dir}`, { timeoutMs: 10_000 });
        await sandbox.files.write(fullPath, content);
      }
    }

    await saveInstanceSkill(instanceId, skillId);
    console.log(`[skills] Installed "${skill.name}" to instance ${instanceId}`);
    return { skillId, instanceId, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[skills] Failed to install "${skillId}" to instance ${instanceId}:`, msg);
    return { skillId, instanceId, success: false, error: msg };
  }
}

export async function uninstallSkillFromSandbox(
  sandboxId: string,
  apiKey: string,
  instanceId: string,
  skillId: string,
): Promise<SkillInstallResult> {
  const skill = getSkillById(skillId);
  if (!skill) {
    return { skillId, instanceId, success: false, error: `Skill "${skillId}" not found in registry` };
  }

  try {
    const sandbox = await connectSandbox(sandboxId, apiKey);

    const skillDir = `${SKILLS_BASE_PATH}/${skill.name}`;
    await sandbox.commands.run(`rm -rf ${skillDir}`, { timeoutMs: 10_000 });

    await deleteInstanceSkill(instanceId, skillId);
    console.log(`[skills] Uninstalled "${skill.name}" from instance ${instanceId}`);
    return { skillId, instanceId, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[skills] Failed to uninstall "${skillId}" from instance ${instanceId}:`, msg);
    return { skillId, instanceId, success: false, error: msg };
  }
}

export async function batchInstallSkills(
  sandboxId: string,
  apiKey: string,
  instanceId: string,
  skillIds: string[],
): Promise<SkillInstallResult[]> {
  const results: SkillInstallResult[] = [];
  for (const skillId of skillIds) {
    const result = await installSkillToSandbox(sandboxId, apiKey, instanceId, skillId);
    results.push(result);
  }
  return results;
}

export async function batchUninstallSkills(
  sandboxId: string,
  apiKey: string,
  instanceId: string,
  skillIds: string[],
): Promise<SkillInstallResult[]> {
  const results: SkillInstallResult[] = [];
  for (const skillId of skillIds) {
    const result = await uninstallSkillFromSandbox(sandboxId, apiKey, instanceId, skillId);
    results.push(result);
  }
  return results;
}

/**
 * Probe which skills are actually present in the sandbox filesystem.
 * Compares against the registry to return the list of found skill IDs.
 */
export async function probeInstalledSkills(
  sandboxId: string,
  apiKey: string,
): Promise<string[]> {
  try {
    const sandbox = await connectSandbox(sandboxId, apiKey);
    const result = await sandbox.commands.run(
      `ls -1 ${SKILLS_BASE_PATH}/ 2>/dev/null || echo ""`,
      { timeoutMs: 10_000 },
    );
    const dirs = (result.stdout || '').trim().split('\n').filter(Boolean);
    return dirs;
  } catch {
    return [];
  }
}
