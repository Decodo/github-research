import { Check, Database, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ResearchProgressStage } from '../api/useTrackerApi';

const steps: Array<{ stage: ResearchProgressStage; icon: typeof Search; title: string; detail: string }> = [
  { stage: 'researching', icon: Search, title: 'Researching GitHub', detail: 'Fetching repository data through Decodo Web Scraping API' },
  { stage: 'structuring', icon: Database, title: 'Structuring repository data', detail: 'Parsing stars, languages, topics, forks, and activity signals' },
  { stage: 'analyzing', icon: Sparkles, title: 'Analyzing trends', detail: 'Generating themes and repository insights with the configured LLM' },
];

export function ResearchLoadingView({ stage }: { stage: ResearchProgressStage }) {
  const activeIndex = stage === 'saving' ? steps.length : Math.max(0, steps.findIndex((step) => step.stage === stage));
  return <div className="py-10">
    <div className="mx-auto max-w-xl text-center">
      <h2 className="mt-4 text-xl font-semibold">Building your GitHub research report</h2>
      <p className="mt-1 text-sm text-muted-foreground">This can take a moment while GitHub data is collected and analyzed.</p>
    </div>
    <Card className="mx-auto mt-8 max-w-xl"><CardContent className="py-2">
      {steps.map(({ stage: stepStage, icon: Icon, title, detail }, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return <div key={stepStage} className="flex gap-3 border-b border-border py-4 last:border-0">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-primary/10 text-primary' : complete ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-muted/50 text-muted-foreground'}`}>
            {complete ? <Check className="h-4 w-4" /> : active ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          </div>
          <div><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>{active && <p className="mt-1 text-[11px] text-primary">In progress</p>}{complete && <p className="mt-1 text-[11px] text-[var(--success)]">Complete</p>}</div>
        </div>;
      })}
    </CardContent></Card>
  </div>;
}
