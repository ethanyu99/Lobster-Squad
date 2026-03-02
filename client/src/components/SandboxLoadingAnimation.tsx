import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SandboxLoadingAnimation() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 w-full text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="font-medium text-foreground">
          Creating sandbox instance{dots}
        </p>
        <p className="text-sm">
          It will take a few minutes. Please wait.
        </p>
      </div>
    </div>
  );
}
