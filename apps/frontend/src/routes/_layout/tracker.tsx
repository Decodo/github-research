import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PromptForm, type ResearchFormSubmission } from '@/features/tracker/components/PromptForm';
import { ReportView } from '@/features/tracker/components/ReportView';
import { ResearchLoadingView } from '@/features/tracker/components/ResearchLoadingView';
import { useResearchMutation, type ResearchProgressStage } from '@/features/tracker/api/useTrackerApi';
import { useCreateMonitorMutation } from '@/features/monitors/api/useMonitorsApi';
import type { ResearchResult } from '@/features/tracker/tracker.types';

export const Route = createFileRoute('/_layout/tracker')({
  validateSearch: (search: Record<string, unknown>): { createMonitor?: boolean } => {
    const createMonitor = search.createMonitor === true || search.createMonitor === 'true';
    return createMonitor ? { createMonitor: true } : {};
  },
  component: TrackerPage,
});
function message(error: unknown) { const e = error as any; return e?.response?.data?.message ?? e?.message ?? String(error); }
function TrackerPage() {
  const { createMonitor } = Route.useSearch();
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [progressStage, setProgressStage] = useState<ResearchProgressStage>('researching');
  const research = useResearchMutation(setProgressStage);
  const monitor = useCreateMonitorMutation();
  const isLoading = research.isPending || monitor.isPending;
  const submit = async ({ config, schedule }: ResearchFormSubmission) => {
    setProgressStage('researching');
    try {
      let monitorId: string | undefined;
      if (schedule) monitorId = (await monitor.mutateAsync({ ...config, ...schedule }))._id;
      const response = await research.mutateAsync({ ...config, monitorId });
      setResult(response);
    } catch { /* mutation state renders the error */ }
  };
  return <div className="py-6"><div className={`mx-auto space-y-6 ${result ? 'max-w-6xl' : 'max-w-4xl'}`}><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">GitHub Research</h1><p className="mt-1 text-sm text-muted-foreground">{result ? 'GitHub repository research report' : 'Research trending, emerging, or keyword-based repository activity'}</p></div>{result && <Button variant="ghost" size="sm" onClick={() => { setResult(null); research.reset(); }}><RotateCcw className="mr-2 h-4 w-4" />Start over</Button>}</div>{isLoading ? <ResearchLoadingView stage={progressStage} /> : <Card><CardHeader className="pb-4"><CardTitle className="text-base">{result ? 'Report' : 'Research GitHub'}</CardTitle></CardHeader><CardContent>{result ? <ReportView result={result} /> : <PromptForm onSubmit={submit} isLoading={false} defaultSchedule={createMonitor} />}{(research.isError || monitor.isError) && <p className="mt-4 text-sm text-destructive">{message(research.error ?? monitor.error)}</p>}</CardContent></Card>}{!result && <p className="text-center text-xs text-muted-foreground">Need to configure API keys? <Link to="/settings" className="underline underline-offset-2">Go to Settings</Link></p>}</div></div>;
}
