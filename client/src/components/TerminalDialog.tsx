import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useWSStore } from '@/stores/wsStore';
import type { InstancePublic, WSMessage } from '@shared/types';

interface TerminalDialogProps {
  instance: InstancePublic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TerminalDialog({ instance, open, onOpenChange }: TerminalDialogProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');


  const send = useWSStore(s => s.send);
  const addTerminalHandler = useWSStore(s => s.addTerminalHandler);
  const removeTerminalHandler = useWSStore(s => s.removeTerminalHandler);

  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'terminal:opened' && msg.payload.instanceId === instance.id) {
      sessionIdRef.current = msg.payload.sessionId;
      setConnected(true);
      setError('');
    }
    if (msg.type === 'terminal:data' && msg.payload.sessionId === sessionIdRef.current) {
      const bytes = Uint8Array.from(atob(msg.payload.data), c => c.charCodeAt(0));
      xtermRef.current?.write(bytes);
    }
    if (msg.type === 'terminal:error' && msg.payload.instanceId === instance.id) {
      setError(msg.payload.error);
      setConnected(false);
    }
  }, [instance.id]);

  useEffect(() => {
    if (open) {
      addTerminalHandler(instance.id, handleWSMessage);
    } else {
      removeTerminalHandler(instance.id);
    }
    return () => { removeTerminalHandler(instance.id); };
  }, [open, instance.id, handleWSMessage, addTerminalHandler, removeTerminalHandler]);

  useEffect(() => {
    if (!open) {
      if (sessionIdRef.current) {
        send({ type: 'terminal:close', payload: { sessionId: sessionIdRef.current }, timestamp: new Date().toISOString() });
        sessionIdRef.current = null;
      }
      if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }
      if (fitAddonRef.current) { fitAddonRef.current = null; }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
      return;
    }

    const setupTimeout = setTimeout(() => {
      if (!termRef.current) return;

      const term = new Terminal({
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
        },
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(termRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.onData((data) => {
        if (!sessionIdRef.current) return;
        const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(data)));
        send({
          type: 'terminal:input',
          payload: { sessionId: sessionIdRef.current, data: encoded },
          timestamp: new Date().toISOString(),
        });
      });

      const ro = new ResizeObserver(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
            if (sessionIdRef.current && xtermRef.current) {
              send({
                type: 'terminal:resize',
                payload: { sessionId: sessionIdRef.current, cols: xtermRef.current.cols, rows: xtermRef.current.rows },
                timestamp: new Date().toISOString(),
              });
            }
          } catch { /* ignore */ }
        }
      });
      if (termRef.current) ro.observe(termRef.current);
      resizeObserverRef.current = ro;

      const { cols, rows } = term;
      send({
        type: 'terminal:open',
        payload: { instanceId: instance.id, cols, rows },
        timestamp: new Date().toISOString(),
      });

      term.focus();
    }, 100);

    return () => clearTimeout(setupTimeout);
  }, [open, instance.id, send]);



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">{instance.name} Terminal</DialogTitle>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden flex flex-col bg-[#0d1117] border-border/60 sm:max-w-4xl h-[600px]"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <TerminalIcon className="h-4 w-4 text-[#8b949e] shrink-0" />
            <span className="text-[13px] font-medium text-[#e6edf3] truncate">
              {instance.name}
            </span>
            <span className="text-[13px] text-[#8b949e]">—</span>
            <span className="text-[13px] text-[#8b949e]">Terminal</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none shrink-0 ${
                connected
                  ? 'bg-[#238636] text-white'
                  : 'bg-transparent border border-[#30363d] text-[#8b949e]'
              }`}
            >
              {connected ? 'Connected' : 'Connecting…'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-[#30363d] text-[#8b949e] shrink-0"
            onClick={() => onOpenChange(false)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive font-mono">
            Error: {error}
          </div>
        )}

        <div ref={termRef} className="flex-1 min-h-0 p-2" style={{ background: '#0d1117' }} />
      </DialogContent>
    </Dialog>
  );
}
