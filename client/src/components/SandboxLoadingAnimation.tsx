import { useEffect, useState } from 'react';

export function SandboxLoadingAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Simulate the sequence of terminal logs during creation
    const timers = [
      setTimeout(() => setStep(1), 1500), // Starting OpenClaw Gateway
      setTimeout(() => setStep(2), 3500), // Waiting for Gateway to start...
      setTimeout(() => setStep(3), 6000), // Gateway is ready
      setTimeout(() => setStep(4), 7500), // Starting device auto-approve daemon...
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const logs = [
    "[0] [sandbox] Allocating sandbox resources...",
    "[0] [sandbox] Writing configuration files...",
    "[0] [sandbox] Starting gateway on port 18789...",
    "[0] [sandbox] Waiting for gateway to start...",
    "[0] [sandbox] Starting auto-approve daemon...",
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full">
      <div className="relative w-full max-w-sm">
        <svg 
          viewBox="0 0 400 160" 
          className="w-full h-auto drop-shadow-md" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            </linearGradient>
            
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>

          {/* Terminal Window Background */}
          <rect x="0" y="0" width="400" height="160" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          
          {/* Terminal Header */}
          <rect x="0" y="0" width="400" height="28" rx="8" fill="hsl(var(--muted))" />
          <path d="M0 28 L400 28" stroke="hsl(var(--border))" strokeWidth="1" />
          <circle cx="16" cy="14" r="4" fill="#ef4444" />
          <circle cx="32" cy="14" r="4" fill="#f59e0b" />
          <circle cx="48" cy="14" r="4" fill="#22c55e" />
          <text x="200" y="18" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="monospace" textAnchor="middle" letterSpacing="0.5">
            sandbox-provisioning
          </text>

          {/* Abstract Nodes Animation (Developer Style) */}
          <g transform="translate(40, 50)" className="text-primary">
            {/* Connection Lines */}
            <path 
              d="M 24 24 L 100 24 L 140 44 L 280 44" 
              stroke="url(#glowGrad)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="100"
              strokeDashoffset="0"
              className="animate-[pulse-line_2s_linear_infinite]" 
            />
            <path 
              d="M 24 24 L 100 24 L 140 4 L 280 4" 
              stroke="url(#glowGrad)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="100"
              strokeDashoffset="50"
              className="animate-[pulse-line_2.5s_linear_infinite]" 
            />

            {/* Cloud/Sandbox Node */}
            <g className={`transition-opacity duration-500 ${step >= 0 ? 'opacity-100' : 'opacity-30'}`}>
              <rect x="0" y="8" width="32" height="32" rx="6" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" />
              <path d="M 16 16 L 16 26 M 12 20 L 20 20" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Gateway Node */}
            <g className={`transition-opacity duration-500 ${step >= 1 ? 'opacity-100' : 'opacity-30'}`}>
              <rect x="270" y="-8" width="24" height="24" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" />
              <circle cx="282" cy="4" r="3" fill="hsl(var(--primary))" className={step >= 2 ? "animate-pulse" : ""} />
            </g>

            {/* Daemon Node */}
            <g className={`transition-opacity duration-500 ${step >= 3 ? 'opacity-100' : 'opacity-30'}`}>
              <rect x="270" y="32" width="24" height="24" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" />
              <circle cx="282" cy="44" r="3" fill="hsl(var(--primary))" className={step >= 4 ? "animate-pulse" : ""} />
            </g>
          </g>

          {/* Terminal Logs */}
          <g transform="translate(20, 130)" fontFamily="monospace" fontSize="11" fill="hsl(var(--foreground))">
            {logs.slice(0, step + 1).map((log, i) => (
              <text 
                key={i} 
                x="0" 
                y={-(step - i) * 16} 
                opacity={1 - (step - i) * 0.3}
                className={i === step ? "animate-pulse" : ""}
              >
                <tspan fill="hsl(var(--primary))">~</tspan> {log}
              </text>
            ))}
            {/* Blinking Cursor */}
            <rect 
              x={logs[step].length * 6.6 + 16} 
              y="-9" 
              width="6" 
              height="12" 
              fill="hsl(var(--primary))" 
              className="animate-pulse" 
            />
          </g>
        </svg>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-line {
            0% { stroke-dashoffset: 200; }
            100% { stroke-dashoffset: 0; }
          }
        `}} />
      </div>
    </div>
  );
}
