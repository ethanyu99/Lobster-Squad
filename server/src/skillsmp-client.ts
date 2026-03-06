/**
 * SkillsMP REST API client.
 *
 * Actual response format:
 *   { success: true, data: { skills: [...], pagination: {...} }, meta: {...} }
 *   { success: false, error: { code, message } }
 *
 * Auth: Bearer <SKILLSMP_API_KEY>
 */

const SKILLSMP_API = 'https://skillsmp.com/api/v1';

function getApiKey(): string | undefined {
  return process.env.SKILLSMP_API_KEY;
}

// ── Types matching the SkillsMP API actual response ──

interface RawSkillsMPSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  githubUrl: string;
  skillUrl: string;
  stars: number;
  updatedAt: string;
}

interface RawSkillsMPResponse {
  success: boolean;
  data?: {
    skills: RawSkillsMPSkill[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// ── Normalized types exposed to the rest of our app ──

export interface SkillsMPSkill {
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

export interface SkillsMPSearchResponse {
  skills: SkillsMPSkill[];
  total: number;
  query: string;
}

export type SkillsMPErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'MISSING_QUERY'
  | 'DAILY_QUOTA_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'NOT_CONFIGURED'
  | 'NETWORK_ERROR';

export interface SkillsMPError {
  code: SkillsMPErrorCode;
  message: string;
  status: number;
}

export type SkillsMPResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SkillsMPError };

// ── Internals ──

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractRepoFromGithubUrl(githubUrl: string): string {
  // https://github.com/owner/repo/tree/main/... → owner/repo
  const m = githubUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : '';
}

function normalizeSkill(raw: RawSkillsMPSkill): SkillsMPSkill {
  return {
    slug: raw.id,
    name: raw.name,
    description: raw.description,
    author: raw.author,
    repo: extractRepoFromGithubUrl(raw.githubUrl),
    stars: raw.stars,
    updatedAt: raw.updatedAt,
    githubUrl: raw.githubUrl,
    skillUrl: raw.skillUrl,
  };
}

function mapStatusToCode(status: number, bodyCode?: string): SkillsMPErrorCode {
  if (bodyCode) {
    const known: SkillsMPErrorCode[] = [
      'MISSING_API_KEY', 'INVALID_API_KEY', 'MISSING_QUERY',
      'DAILY_QUOTA_EXCEEDED', 'INTERNAL_ERROR',
    ];
    if (known.includes(bodyCode as SkillsMPErrorCode)) return bodyCode as SkillsMPErrorCode;
  }
  switch (status) {
    case 401: return 'INVALID_API_KEY';
    case 429: return 'DAILY_QUOTA_EXCEEDED';
    default: return 'INTERNAL_ERROR';
  }
}

// ── Public API ──

export async function searchSkillsMP(
  query: string,
  mode: 'keyword' | 'ai' = 'keyword',
): Promise<SkillsMPResult<SkillsMPSearchResponse>> {
  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      error: { code: 'NOT_CONFIGURED', message: 'SKILLSMP_API_KEY is not configured', status: 0 },
    };
  }

  const endpoint = mode === 'ai' ? '/skills/ai-search' : '/skills/search';
  const url = `${SKILLSMP_API}${endpoint}?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
      },
    });

    const body = await res.json() as RawSkillsMPResponse;

    if (!res.ok || !body.success) {
      const errCode = body.error?.code;
      const code = mapStatusToCode(res.status, errCode);
      return {
        ok: false,
        error: {
          code,
          message: body.error?.message || `SkillsMP API error: ${res.status}`,
          status: res.status,
        },
      };
    }

    const skills = (body.data?.skills ?? []).map(normalizeSkill);
    const total = body.data?.pagination?.total ?? skills.length;

    return {
      ok: true,
      data: { skills, total, query },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: isAbort ? 'Request timed out' : msg,
        status: 0,
      },
    };
  }
}

export function isSkillsMPConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Build the raw GitHub URL for a SKILL.md from a githubUrl.
 * e.g. https://github.com/owner/repo/tree/main/path → https://raw.githubusercontent.com/owner/repo/main/path/SKILL.md
 */
function githubUrlToRaw(githubUrl: string): string | null {
  const m = githubUrl.match(/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/(.*)/);
  if (!m) return null;
  const [, ownerRepo, branch, path] = m;
  return `https://raw.githubusercontent.com/${ownerRepo}/${branch}/${path}/SKILL.md`;
}

/**
 * Fetch raw SKILL.md content from a GitHub URL.
 */
export async function fetchRemoteSkillMd(githubUrl: string): Promise<string | null> {
  if (!githubUrl) return null;

  const rawUrl = githubUrlToRaw(githubUrl);
  if (!rawUrl) return null;

  try {
    const res = await fetchWithTimeout(rawUrl, {}, 10_000);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
