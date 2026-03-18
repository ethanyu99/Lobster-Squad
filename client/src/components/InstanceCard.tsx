import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trash2, RefreshCw, Edit2, Star, Settings, Share2,
  XCircle, FolderOpen, MessageSquare, Terminal, Upload,
  MoreHorizontal, Cloud, Clock, ExternalLink,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InstancePublic } from '@shared/types';
import { deleteInstance, checkHealth, updateInstance } from '@/lib/api';
import { toast } from 'sonner';
import { useWSStore } from '@/stores/wsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import { SessionDetailDialog } from '@/components/SessionDetailDialog';
import { SandboxConfigDialog } from '@/components/SandboxConfigDialog';
import { ShareDialog } from '@/components/ShareDialog';
import { FileBrowserDialog } from '@/components/FileBrowserDialog';
import { TerminalDialog } from '@/components/TerminalDialog';
import { FileUploadDialog } from '@/components/FileUploadDialog';

interface InstanceCardProps {
  instance: InstancePublic;
  onRefresh: () => void;
}

const statusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  online: {
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/5',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'Online',
  },
  busy: {
    dot: 'bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]',
    bg: 'bg-amber-500/10 dark:bg-amber-500/5',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Busy',
  },
  offline: {
    dot: 'bg-zinc-400 dark:bg-zinc-500',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/5',
    text: 'text-zinc-500 dark:text-zinc-400',
    label: 'Offline',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Overflow Menu ──
function OverflowMenu({ children, items }: { children: React.ReactNode; items: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(v => !v)}>{children}</div>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[172px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-100">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                item.destructive
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'text-foreground hover:bg-muted'
              }`}
              onClick={() => { item.onClick(); setOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export function InstanceCard({ instance, onRefresh }: InstanceCardProps) {
  const taskStream = useInstanceStore(s => s.taskStreams[instance.id]);
  const activeSession = useInstanceStore(s => s.activeSessions[instance.id]);
  const cancelTask = useWSStore(s => s.cancelTask);

  const [detailOpen, setDetailOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editName, setEditName] = useState(instance.name);
  const [editDesc, setEditDesc] = useState(instance.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  const st = statusConfig[instance.status] || statusConfig.offline;
  const isSandbox = !!instance.sandboxId;
  const webUiUrl = instance.endpoint && instance.token
    ? `${instance.endpoint.replace(/^ws/, 'http')}#token=${instance.token}`
    : null;

  const handleEditSave = async () => {
    if (!editName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await updateInstance(instance.id, { name: editName.trim(), description: editDesc.trim() });
      setEditOpen(false); onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update'); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    const msg = isSandbox ? `Delete "${instance.name}" and terminate sandbox?` : `Delete "${instance.name}"?`;
    if (!confirm(msg)) return;
    deleteInstance(instance.id)
      .then(() => { toast.success(`Instance "${instance.name}" deleted`); onRefresh(); })
      .catch(() => toast.error('Failed to delete instance'));
  };

  const menuItems = [
    { icon: <RefreshCw className="h-3.5 w-3.5" />, label: 'Health Check', onClick: () => { checkHealth(instance.id).then(onRefresh); } },
    { icon: <Share2 className="h-3.5 w-3.5" />, label: 'Share', onClick: () => setShareOpen(true) },
    { icon: <Edit2 className="h-3.5 w-3.5" />, label: 'Edit', onClick: () => { setEditName(instance.name); setEditDesc(instance.description || ''); setError(''); setEditOpen(true); } },
    { icon: <Settings className="h-3.5 w-3.5" />, label: 'Config', onClick: () => setConfigOpen(true) },
    ...(isSandbox ? [{ icon: <Upload className="h-3.5 w-3.5" />, label: 'Upload Files', onClick: () => setUploadOpen(true) }] : []),
    { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Delete', onClick: handleDelete, destructive: true },
  ];

  return (
    <>
      <Card
        className={`group overflow-hidden transition-all duration-200 bg-card border-border/60 hover:border-border dark:border-border/40 dark:hover:border-border/70 shadow-sm hover:shadow-md relative ${dragOver ? 'ring-2 ring-primary border-primary' : ''}`}
        onDragOver={isSandbox ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); } : undefined}
        onDragLeave={isSandbox ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); } : undefined}
        onDrop={isSandbox ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files.length > 0) { setDroppedFiles(Array.from(e.dataTransfer.files)); setUploadOpen(true); } } : undefined}
      >
        {/* ── Status accent bar ── */}
        <div className={`h-0.5 ${st.dot.split(' ')[0]}`} />

        {/* ── Header ── */}
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
              <h3 className="text-sm font-semibold text-foreground truncate">{instance.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isSandbox && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/5">
                  <Cloud className="h-2.5 w-2.5" />
                  Sandbox
                </span>
              )}
              {instance.role && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold ${
                  instance.role.isLead
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/5'
                    : 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/5'
                }`}>
                  {instance.role.isLead && <Star className="h-2.5 w-2.5" />}
                  {instance.role.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
            {isSandbox && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setTerminalOpen(true); }} title="Terminal">
                <Terminal className="h-3.5 w-3.5" />
              </Button>
            )}
            {isSandbox && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setFilesOpen(true); }} title="Files">
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            )}
            <OverflowMenu items={menuItems}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </OverflowMenu>
          </div>
        </div>

        {/* ── Web UI link ── */}
        {webUiUrl && (
          <div className="px-4 pb-2">
            <a
              href={webUiUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15 border border-primary/20 dark:border-primary/15 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              Open Web UI
            </a>
          </div>
        )}

        {/* ── Content ── */}
        <div className="px-4 pb-3.5 space-y-2.5">
          {/* Description */}
          {instance.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{instance.description}</p>
          )}

          {/* Role capabilities */}
          {instance.role && instance.role.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {instance.role.capabilities.map((cap, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono font-normal bg-muted/60 dark:bg-muted/30 text-muted-foreground border-0">
                  {cap}
                </Badge>
              ))}
            </div>
          )}

          {/* Active session (no task) */}
          {!instance.currentTask && activeSession && (
            <div className="flex items-center gap-2 py-2 px-2.5 rounded-md bg-violet-500/5 dark:bg-violet-500/5 border border-violet-500/10 dark:border-violet-500/10">
              <MessageSquare className="h-3 w-3 text-violet-500 dark:text-violet-400 shrink-0" />
              <span className="text-[11px] text-violet-700 dark:text-violet-300 truncate font-mono">
                {activeSession.topic || 'Active session'}
              </span>
            </div>
          )}

          {/* Current Task */}
          {instance.currentTask && (
            <div
              className="rounded-md border border-border/50 dark:border-border/30 overflow-hidden cursor-pointer hover:border-border dark:hover:border-border/50 transition-colors"
              onClick={(e) => { e.stopPropagation(); if (instance.currentTask?.id) setDetailOpen(true); }}
            >
              {/* Task header */}
              <div className={`flex items-center justify-between px-2.5 py-1.5 ${
                instance.currentTask.status === 'running' ? 'bg-amber-500/10 dark:bg-amber-500/5' :
                instance.currentTask.status === 'completed' ? 'bg-emerald-500/10 dark:bg-emerald-500/5' :
                'bg-red-500/10 dark:bg-red-500/5'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    instance.currentTask.status === 'running' ? 'bg-amber-500 animate-pulse' :
                    instance.currentTask.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${
                    instance.currentTask.status === 'running' ? 'text-amber-600 dark:text-amber-400' :
                    instance.currentTask.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {instance.currentTask.status}
                  </span>
                </div>
                {instance.currentTask.status === 'running' && (
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); cancelTask(instance.currentTask!.id); }}
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel
                  </button>
                )}
              </div>
              {/* Task content */}
              <div className="px-2.5 py-2 bg-card space-y-1">
                <p className="text-xs text-foreground font-mono leading-relaxed truncate" title={instance.currentTask.content}>
                  {instance.currentTask.content}
                </p>
                {instance.currentTask.summary && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {instance.currentTask.summary}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Live stream */}
          {taskStream && (
            <div className="rounded-md bg-[#0d1117] dark:bg-[#010409] border border-[#30363d] text-emerald-400 p-2.5 font-mono text-[11px] leading-relaxed max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words">{taskStream.slice(-500)}</pre>
            </div>
          )}

          {/* Empty state — idle instance */}
          {!instance.currentTask && !activeSession && (
            <div className="flex items-center gap-4 py-2 px-2.5 rounded-md bg-muted/30 dark:bg-muted/10 border border-border/30 dark:border-border/15 font-mono text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {timeAgo(instance.updatedAt || instance.createdAt)}
              </span>
              <span className="text-border/60">·</span>
              <span>Idle — ready for tasks</span>
            </div>
          )}
        </div>

        {/* Drag overlay */}
        {dragOver && isSandbox && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-primary pointer-events-none">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-mono font-medium text-primary">Drop to upload</p>
              <p className="text-[10px] text-muted-foreground font-mono">{instance.name}/workspace</p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Dialogs ── */}
      <SessionDetailDialog
        session={instance.currentTask?.sessionKey ? {
          sessionKey: instance.currentTask.sessionKey,
          ownerId: instance.currentTask.ownerId,
          instanceId: instance.id,
          instanceName: instance.name,
          createdAt: instance.currentTask.createdAt,
          updatedAt: instance.currentTask.updatedAt,
        } : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        taskStream={taskStream}
      />
      <SandboxConfigDialog instance={instance} open={configOpen} onOpenChange={setConfigOpen} />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Instance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">Name</Label>
                <span className="text-xs text-muted-foreground">{editName.length}/30</span>
              </div>
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Instance Name" maxLength={30} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <span className="text-xs text-muted-foreground">{editDesc.length}/200</span>
              </div>
              <Textarea id="description" value={editDesc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDesc(e.target.value)} placeholder="Optional description" rows={3} maxLength={200} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} shareType="instance" targetId={instance.id} targetName={instance.name} />
      <FileBrowserDialog instance={instance} open={filesOpen} onOpenChange={setFilesOpen} />
      <TerminalDialog instance={instance} open={terminalOpen} onOpenChange={setTerminalOpen} />
      <FileUploadDialog
        instanceId={instance.id}
        instanceName={instance.name}
        open={uploadOpen}
        onOpenChange={(v) => { setUploadOpen(v); if (!v) setDroppedFiles([]); }}
        initialFiles={droppedFiles}
      />
    </>
  );
}
