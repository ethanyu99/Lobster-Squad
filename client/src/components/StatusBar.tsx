import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, ChevronDown, Loader2, User, Copy, Check } from 'lucide-react';
import type { InstancePublic, InstanceStats } from '@shared/types';
import { getUserId, getShortUserId } from '@/lib/user';

interface StatusBarProps {
  stats: InstanceStats;
  instances: InstancePublic[];
  connected: boolean;
  onHistoryClick: () => void;
}

function UserBadge() {
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const shortId = getShortUserId();
  const fullId = getUserId();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [fullId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDetail(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/50 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
        title="Your user identity"
      >
        <User className="h-3 w-3" />
        <span className="font-mono font-medium">{shortId}</span>
      </button>
      {showDetail && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-border bg-card p-3 shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Your Identity</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy ID
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-2 py-1.5 rounded border border-border/50 break-all select-all">
              {fullId}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed">
              Instances and sessions are isolated by this ID. Different browsers generate different IDs.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function StatusBar({ stats, instances, connected, onHistoryClick }: StatusBarProps) {
  const [expanded, setExpanded] = useState(false);

  const busyInstances = useMemo(
    () => instances.filter(i => i.status === 'busy' && i.currentTask),
    [instances],
  );

  return (
    <div className="border-b border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-20 shadow-sm">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Lobster Squad" className="w-6 h-6" />
            <h1 className="text-base font-bold tracking-tight text-foreground">Lobster Squad</h1>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground/80 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
            <span>
              Instances{' '}
              <span className="font-mono font-bold text-foreground ml-1">
                {stats.online + stats.busy}/{stats.total}
              </span>
            </span>
            <span className="text-border">|</span>
            {busyInstances.length > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                onClick={() => setExpanded(prev => !prev)}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Running: <span className="text-foreground font-bold">{stats.busy}</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Running: <span className="text-foreground">{stats.busy}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              Online: <span className="text-foreground">{stats.online}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-400" />
              Offline: <span className="text-foreground">{stats.offline}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UserBadge />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs font-semibold h-8 border-border/80 hover:bg-muted/60"
            onClick={onHistoryClick}
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Badge variant={connected ? 'default' : 'destructive'} className="text-[10px] uppercase tracking-wider font-bold h-6 px-2.5 shadow-sm">
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      {busyInstances.length > 0 && expanded && (
        <div className="border-t border-border/50 bg-emerald-50/40 dark:bg-emerald-950/10 px-6 py-2.5 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
          {busyInstances.map(inst => (
            <div key={inst.id} className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 shrink-0 min-w-[120px]">
                <Loader2 className="h-3 w-3 text-emerald-600 animate-spin" />
                <span className="font-semibold text-foreground truncate">{inst.name}</span>
              </div>
              <span className="text-border shrink-0">—</span>
              <span className="text-muted-foreground truncate flex-1" title={inst.currentTask!.content}>
                {inst.currentTask!.content}
              </span>
              {inst.currentTask!.summary && (
                <>
                  <span className="text-border shrink-0">|</span>
                  <span className="text-emerald-700 dark:text-emerald-400 truncate max-w-[300px] font-medium" title={inst.currentTask!.summary}>
                    {inst.currentTask!.summary}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
