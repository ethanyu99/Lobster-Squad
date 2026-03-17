import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Rocket, Terminal, Users, FolderOpen } from 'lucide-react';
import { AddInstanceDialog } from './AddInstanceDialog';

interface WelcomeGuideProps {
  onCreated: () => void;
}

export function WelcomeGuide({ onCreated }: WelcomeGuideProps) {
  return (
    <div className="col-span-full max-w-2xl mx-auto py-16 px-4">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Rocket className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to Lobster Squad! 🦞</h2>
        <p className="text-muted-foreground">
          Manage and orchestrate your AI coding instances in one place.
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-primary">1</span>
              Add your first instance
            </CardTitle>
            <CardDescription>
              Connect an OpenClaw instance or create a sandbox to get started.
              Instances are the runtime environments for your AI agents.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-dashed opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-muted rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
              Dispatch Tasks
            </CardTitle>
            <CardDescription>
              Send coding tasks to instances using the input box below and view output in real-time.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-dashed opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-muted rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
              Build Team Collaboration
            </CardTitle>
            <CardDescription>
              Create teams with multiple instances playing different roles (PM, Dev, QA) to collaborate on complex tasks.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="text-center">
        <AddInstanceDialog onCreated={onCreated} />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1">
          <Terminal className="h-4 w-4" />
          <span>Web Terminal</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <FolderOpen className="h-4 w-4" />
          <span>File Browser</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Users className="h-4 w-4" />
          <span>Multi-Instance</span>
        </div>
      </div>
    </div>
  );
}
