import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search, Download, Trash2, Loader2, CheckCircle2, XCircle,
  Package, Code, Globe, Monitor, Database, Wrench, MessageSquare,
  Zap, HelpCircle, Image, Eye, ArrowLeft, Star, ExternalLink,
  AlertTriangle, KeyRound, ShieldAlert, Sparkles,
} from 'lucide-react';
import type { InstancePublic, SkillDefinition, SkillCategory } from '@shared/types';
import {
  fetchSkillRegistry, fetchInstanceSkills, installSkills, uninstallSkills,
  fetchSkillReadme, searchRemoteSkills, fetchRemoteSkillContent,
  installRemoteSkill, checkRemoteStatus, SkillsMPApiError,
} from '@/lib/api';
import type { RemoteSkill, SkillsMPErrorCode } from '@/lib/api';

interface SkillsManagerDialogProps {
  instance: InstancePublic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_ICONS: Record<SkillCategory, React.ReactNode> = {
  coding: <Code className="h-3.5 w-3.5" />,
  search: <Globe className="h-3.5 w-3.5" />,
  browser: <Monitor className="h-3.5 w-3.5" />,
  media: <Image className="h-3.5 w-3.5" />,
  devops: <Wrench className="h-3.5 w-3.5" />,
  data: <Database className="h-3.5 w-3.5" />,
  communication: <MessageSquare className="h-3.5 w-3.5" />,
  productivity: <Zap className="h-3.5 w-3.5" />,
  other: <HelpCircle className="h-3.5 w-3.5" />,
};

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  coding: 'Coding',
  search: 'Search',
  browser: 'Browser',
  media: 'Media',
  devops: 'DevOps',
  data: 'Data',
  communication: 'Comms',
  productivity: 'Productivity',
  other: 'Other',
};

const ALL_CATEGORIES: SkillCategory[] = ['coding', 'search', 'browser', 'media', 'devops', 'data', 'communication', 'productivity', 'other'];

function formatTimestamp(ts: string): string {
  const num = Number(ts);
  if (!num || isNaN(num)) return ts;
  return new Date(num * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type OperationState = Record<string, 'installing' | 'uninstalling' | 'success' | 'error'>;
type TabType = 'local' | 'explore';
type SearchMode = 'keyword' | 'ai';
type RemoteSortBy = 'relevance' | 'stars';

export function SkillsManagerDialog({ instance, open, onOpenChange }: SkillsManagerDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('local');

  // Local state
  const [registry, setRegistry] = useState<SkillDefinition[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [opState, setOpState] = useState<OperationState>({});

  // Preview state (shared)
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Explore state
  const [remoteQuery, setRemoteQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<RemoteSkill[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteSearched, setRemoteSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [remoteConfigured, setRemoteConfigured] = useState<boolean | null>(null);
  const [remoteError, setRemoteError] = useState<{ code: SkillsMPErrorCode; message: string } | null>(null);
  const [remoteSortBy, setRemoteSortBy] = useState<RemoteSortBy>('relevance');
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSandbox = !!instance.sandboxId;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [registryRes, installedRes] = await Promise.all([
        fetchSkillRegistry(),
        fetchInstanceSkills(instance.id),
      ]);
      setRegistry(registryRes.skills);
      setInstalledIds(new Set(installedRes.skills.map(s => s.id)));
    } catch (err) {
      console.error('Failed to load skills data:', err);
    } finally {
      setLoading(false);
    }
  }, [instance.id]);

  useEffect(() => {
    if (open) {
      loadData();
      setSearchQuery('');
      setSelectedCategory('all');
      setOpState({});
      setShowPreview(false);
      setActiveTab('local');
      setRemoteQuery('');
      setRemoteResults([]);
      setRemoteSearched(false);
      setRemoteError(null);
      setRemoteConfigured(null);
    }
  }, [open, loadData]);

  // Check SkillsMP configuration when switching to Explore tab
  useEffect(() => {
    if (activeTab === 'explore' && remoteConfigured === null) {
      checkRemoteStatus().then(s => setRemoteConfigured(s.configured)).catch(() => setRemoteConfigured(false));
    }
  }, [activeTab, remoteConfigured]);

  // ── Preview handlers ──

  const handleLocalPreview = async (skill: SkillDefinition) => {
    setPreviewTitle(skill.name);
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const content = await fetchSkillReadme(skill.id);
      setPreviewContent(content);
    } catch {
      setPreviewContent('Failed to load SKILL.md content.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRemotePreview = async (skill: RemoteSkill) => {
    if (!skill.githubUrl) return;
    setPreviewTitle(skill.name);
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const content = await fetchRemoteSkillContent(skill.githubUrl);
      setPreviewContent(content);
    } catch {
      setPreviewContent('Failed to load SKILL.md content from remote source.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Local install/uninstall ──

  const clearOpState = (id: string) => {
    setTimeout(() => {
      setOpState(prev => {
        const next = { ...prev };
        if (next[id] === 'success' || next[id] === 'error') delete next[id];
        return next;
      });
    }, 2000);
  };

  const handleInstall = async (skillId: string) => {
    setOpState(prev => ({ ...prev, [skillId]: 'installing' }));
    try {
      const result = await installSkills(instance.id, [skillId]);
      if (result.succeeded > 0) {
        setInstalledIds(prev => new Set([...prev, skillId]));
        setOpState(prev => ({ ...prev, [skillId]: 'success' }));
      } else {
        setOpState(prev => ({ ...prev, [skillId]: 'error' }));
      }
    } catch {
      setOpState(prev => ({ ...prev, [skillId]: 'error' }));
    }
    clearOpState(skillId);
  };

  const handleUninstall = async (skillId: string) => {
    setOpState(prev => ({ ...prev, [skillId]: 'uninstalling' }));
    try {
      const result = await uninstallSkills(instance.id, [skillId]);
      if (result.succeeded > 0) {
        setInstalledIds(prev => {
          const next = new Set(prev);
          next.delete(skillId);
          return next;
        });
        setOpState(prev => ({ ...prev, [skillId]: 'success' }));
      } else {
        setOpState(prev => ({ ...prev, [skillId]: 'error' }));
      }
    } catch {
      setOpState(prev => ({ ...prev, [skillId]: 'error' }));
    }
    clearOpState(skillId);
  };

  const handleInstallAll = async () => {
    const toInstall = filteredSkills.filter(s => !installedIds.has(s.id)).map(s => s.id);
    if (toInstall.length === 0) return;
    for (const id of toInstall) setOpState(prev => ({ ...prev, [id]: 'installing' }));
    try {
      const result = await installSkills(instance.id, toInstall);
      const succeeded = new Set(result.results.filter(r => r.success).map(r => r.skillId));
      setInstalledIds(prev => new Set([...prev, ...succeeded]));
      for (const id of toInstall) setOpState(prev => ({ ...prev, [id]: succeeded.has(id) ? 'success' : 'error' }));
    } catch {
      for (const id of toInstall) setOpState(prev => ({ ...prev, [id]: 'error' }));
    }
    setTimeout(() => {
      setOpState(prev => {
        const next = { ...prev };
        for (const id of toInstall) {
          if (next[id] === 'success' || next[id] === 'error') delete next[id];
        }
        return next;
      });
    }, 2000);
  };

  // ── Remote install ──

  const handleRemoteInstall = async (skill: RemoteSkill) => {
    setOpState(prev => ({ ...prev, [skill.slug]: 'installing' }));
    try {
      const result = await installRemoteSkill(instance.id, skill.slug, skill.name, skill.githubUrl);
      if (result.success) {
        setInstalledIds(prev => new Set([...prev, skill.slug]));
        setOpState(prev => ({ ...prev, [skill.slug]: 'success' }));
      } else {
        setOpState(prev => ({ ...prev, [skill.slug]: 'error' }));
      }
    } catch {
      setOpState(prev => ({ ...prev, [skill.slug]: 'error' }));
    }
    clearOpState(skill.slug);
  };

  // ── Remote search ──

  const handleRemoteSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setRemoteResults([]);
      setRemoteSearched(false);
      setRemoteError(null);
      return;
    }
    setRemoteLoading(true);
    setRemoteSearched(true);
    setRemoteError(null);
    try {
      const result = await searchRemoteSkills(q, searchMode);
      setRemoteResults(result.skills ?? []);
    } catch (err) {
      setRemoteResults([]);
      if (err instanceof SkillsMPApiError) {
        setRemoteError({ code: err.code, message: err.message });
      } else {
        setRemoteError({ code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Unknown error' });
      }
    } finally {
      setRemoteLoading(false);
    }
  }, [searchMode]);

  const onRemoteQueryChange = (val: string) => {
    setRemoteQuery(val);
    if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    if (val.trim().length >= 2) {
      remoteTimerRef.current = setTimeout(() => handleRemoteSearch(val), 600);
    } else {
      setRemoteResults([]);
      setRemoteSearched(false);
      setRemoteError(null);
    }
  };

  // ── Local filter ──

  const filteredSkills = registry.filter(skill => {
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const installedCount = registry.filter(s => installedIds.has(s.id)).length;
  const notInstalledInView = filteredSkills.filter(s => !installedIds.has(s.id)).length;
  const usedCategories = ALL_CATEGORIES.filter(cat => registry.some(s => s.category === cat));

  const sortedRemoteResults = remoteSortBy === 'stars'
    ? [...remoteResults].sort((a, b) => b.stars - a.stars)
    : remoteResults;

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Skills — {instance.name}
          </DialogTitle>
          {!isSandbox && (
            <Badge variant="destructive" className="text-xs w-fit mt-1">
              Sandbox instance required for Skills management
            </Badge>
          )}
        </DialogHeader>

        {!isSandbox ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Skills install/uninstall requires a Sandbox instance</p>
            <p className="text-xs mt-1">Non-sandbox instances cannot write files via SDK</p>
          </div>
        ) : showPreview ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => setShowPreview(false)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <span className="font-medium text-sm">{previewTitle}</span>
            </div>
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono bg-muted/30 rounded-lg p-4 border">{previewContent}</pre>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div className="flex border-b mb-2">
              <button
                className={`px-4 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'local'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('local')}
              >
                Local
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {installedCount}/{registry.length}
                </Badge>
              </button>
              <button
                className={`px-4 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'explore'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('explore')}
              >
                Explore
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">
                  SkillsMP
                </Badge>
              </button>
            </div>

            {activeTab === 'local' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search local skills..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  {notInstalledInView > 0 && (
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleInstallAll} disabled={Object.values(opState).some(s => s === 'installing' || s === 'uninstalling')}>
                      <Download className="h-3 w-3" />
                      Install All ({notInstalledInView})
                    </Button>
                  )}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant={selectedCategory === 'all' ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5 hover:bg-primary/10 transition-colors" onClick={() => setSelectedCategory('all')}>
                    All
                  </Badge>
                  {usedCategories.map(cat => (
                    <Badge key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} className="cursor-pointer text-xs px-2 py-0.5 gap-1 hover:bg-primary/10 transition-colors" onClick={() => setSelectedCategory(cat)}>
                      {CATEGORY_ICONS[cat]}
                      {CATEGORY_LABELS[cat]}
                    </Badge>
                  ))}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                    <div className="space-y-2 pb-2">
                      {filteredSkills.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">No matching skills found</div>
                      ) : (
                        filteredSkills.map(skill => (
                          <LocalSkillCard
                            key={skill.id}
                            skill={skill}
                            installed={installedIds.has(skill.id)}
                            opState={opState[skill.id]}
                            onInstall={() => handleInstall(skill.id)}
                            onUninstall={() => handleUninstall(skill.id)}
                            onPreview={() => handleLocalPreview(skill)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Search bar + mode toggle */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={searchMode === 'ai' ? 'Describe what you need...' : 'Search skills by keyword...'}
                      value={remoteQuery}
                      onChange={(e) => onRemoteQueryChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRemoteSearch(remoteQuery); }}
                      className="pl-8 h-8 text-sm"
                      disabled={remoteConfigured === false}
                    />
                  </div>
                  <div className="flex rounded-md border overflow-hidden shrink-0">
                    <button
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        searchMode === 'keyword'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setSearchMode('keyword')}
                      title="Keyword Search"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                    <button
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        searchMode === 'ai'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setSearchMode('ai')}
                      title="AI Semantic Search"
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {remoteSearched && remoteResults.length > 0 && !remoteError && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{remoteResults.length} results</span>
                    <div className="flex rounded-md border overflow-hidden shrink-0">
                      <button
                        className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          remoteSortBy === 'relevance'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setRemoteSortBy('relevance')}
                      >
                        Relevance
                      </button>
                      <button
                        className={`px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-0.5 ${
                          remoteSortBy === 'stars'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setRemoteSortBy('stars')}
                      >
                        <Star className="h-2.5 w-2.5" /> Stars
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                  {remoteConfigured === false ? (
                    <RemoteErrorPanel
                      icon={<KeyRound className="h-10 w-10 mb-3 text-amber-500" />}
                      title="API Key Not Configured"
                      description="Add SKILLSMP_API_KEY to your .env file to enable remote skill search."
                    />
                  ) : remoteLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {searchMode === 'ai' ? 'AI searching...' : 'Searching SkillsMP...'}
                      </span>
                    </div>
                  ) : remoteError ? (
                    <RemoteApiError error={remoteError} onRetry={() => handleRemoteSearch(remoteQuery)} />
                  ) : !remoteSearched ? (
                    <RemoteErrorPanel
                      icon={<Globe className="h-10 w-10 mb-3 opacity-30" />}
                      title="Explore the SKILL.md Ecosystem"
                      description={
                        searchMode === 'ai'
                          ? 'Describe what you need in natural language. AI will find the best matching skills.'
                          : 'Search 386,000+ open-source agent skills from GitHub by keyword.'
                      }
                    />
                  ) : remoteResults.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No results found for &ldquo;{remoteQuery}&rdquo;
                    </div>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {sortedRemoteResults.map(skill => (
                        <RemoteSkillCard
                          key={skill.slug}
                          skill={skill}
                          installed={installedIds.has(skill.slug)}
                          opState={opState[skill.slug]}
                          onInstall={() => handleRemoteInstall(skill)}
                          onPreview={() => handleRemotePreview(skill)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Error panels ──

function RemoteErrorPanel({
  icon, title, description, hint,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1 max-w-xs">{description}</p>
      {hint}
    </div>
  );
}

function RemoteApiError({
  error,
  onRetry,
}: {
  error: { code: SkillsMPErrorCode; message: string };
  onRetry: () => void;
}) {
  const configs: Record<string, { icon: React.ReactNode; title: string; desc: string; retryable: boolean }> = {
    INVALID_API_KEY: {
      icon: <ShieldAlert className="h-10 w-10 mb-3 text-red-500" />,
      title: 'Invalid API Key',
      desc: 'Your SKILLSMP_API_KEY is invalid or expired. Please check your .env configuration.',
      retryable: false,
    },
    MISSING_API_KEY: {
      icon: <KeyRound className="h-10 w-10 mb-3 text-amber-500" />,
      title: 'API Key Missing',
      desc: 'SKILLSMP_API_KEY is not set. Add it to your .env file to use remote search.',
      retryable: false,
    },
    NOT_CONFIGURED: {
      icon: <KeyRound className="h-10 w-10 mb-3 text-amber-500" />,
      title: 'API Key Not Configured',
      desc: 'Add SKILLSMP_API_KEY to your .env file to enable remote skill search.',
      retryable: false,
    },
    DAILY_QUOTA_EXCEEDED: {
      icon: <AlertTriangle className="h-10 w-10 mb-3 text-amber-500" />,
      title: 'Daily Quota Exceeded',
      desc: 'You have reached the daily search limit for SkillsMP API. Please try again tomorrow.',
      retryable: false,
    },
    NETWORK_ERROR: {
      icon: <Globe className="h-10 w-10 mb-3 text-muted-foreground/50" />,
      title: 'Network Error',
      desc: error.message || 'Failed to connect to SkillsMP. Check your network connection.',
      retryable: true,
    },
    INTERNAL_ERROR: {
      icon: <XCircle className="h-10 w-10 mb-3 text-red-400" />,
      title: 'Server Error',
      desc: 'SkillsMP is experiencing issues. Please try again later.',
      retryable: true,
    },
  };

  const config = configs[error.code] || configs.INTERNAL_ERROR;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      {config.icon}
      <p className="text-sm font-medium text-foreground">{config.title}</p>
      <p className="text-xs mt-1 max-w-xs">{config.desc}</p>
      {config.retryable && (
        <Button size="sm" variant="outline" className="mt-3 text-xs h-7 gap-1" onClick={onRetry}>
          Retry
        </Button>
      )}
      
    </div>
  );
}

// ── Local Skill Card ──

interface LocalSkillCardProps {
  skill: SkillDefinition;
  installed: boolean;
  opState?: string;
  onInstall: () => void;
  onUninstall: () => void;
  onPreview: () => void;
}

function LocalSkillCard({ skill, installed, opState, onInstall, onUninstall, onPreview }: LocalSkillCardProps) {
  const isOperating = opState === 'installing' || opState === 'uninstalling';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
      installed ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card hover:border-border'
    }`}>
      <div className="mt-0.5 p-1.5 rounded-md bg-muted/60 text-muted-foreground">
        {CATEGORY_ICONS[skill.category]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{skill.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
            {CATEGORY_ICONS[skill.category]}
            {CATEGORY_LABELS[skill.category]}
          </Badge>
          {installed && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Installed
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
        {skill.tags.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {skill.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 mt-0.5 flex items-center gap-1">
        {opState === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {opState === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
        {isOperating && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {!opState && (
          <>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10" onClick={onPreview} title="View SKILL.md">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {installed ? (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={onUninstall} title="Uninstall">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={onInstall} title="Install">
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Remote Skill Card ──

interface RemoteSkillCardProps {
  skill: RemoteSkill;
  installed: boolean;
  opState?: string;
  onInstall: () => void;
  onPreview: () => void;
}

function RemoteSkillCard({ skill, installed, opState, onInstall, onPreview }: RemoteSkillCardProps) {
  const isOperating = opState === 'installing';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
      installed ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card hover:border-border'
    }`}>
      <div className="mt-0.5 p-1.5 rounded-md bg-muted/60 text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{skill.name}</span>
          {skill.stars > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
              <Star className="h-2.5 w-2.5 fill-amber-500" />
              {skill.stars >= 1000 ? `${(skill.stars / 1000).toFixed(1)}k` : skill.stars}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">{skill.repo}</span>
          {installed && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Installed
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground/60">by {skill.author}</span>
          {skill.updatedAt && (
            <span className="text-[10px] text-muted-foreground/60">
              {formatTimestamp(skill.updatedAt)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 mt-0.5 flex items-center gap-1">
        {opState === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {opState === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
        {isOperating && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {!opState && (
          <>
            {skill.githubUrl && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10" onClick={onPreview} title="View SKILL.md">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            {skill.skillUrl && (
              <a href={skill.skillUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground" title="View on SkillsMP">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {!installed && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={onInstall} title="Install to sandbox">
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
