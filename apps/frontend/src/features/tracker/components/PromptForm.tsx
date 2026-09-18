import { useState } from 'react';
import { Search, TrendingUp, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MonitorCadence, ResearchConfig, ResearchMode } from '../tracker.types';

export interface ResearchFormSubmission { config: ResearchConfig; schedule?: { name: string; cadence: MonitorCadence; intervalHours?: number } }
interface Props { onSubmit: (submission: ResearchFormSubmission) => void; isLoading: boolean; defaultSchedule?: boolean; }

export const PromptForm = ({ onSubmit, isLoading, defaultSchedule = false }: Props) => {
  const [mode, setMode] = useState<ResearchMode>('trending');
  const [keyword, setKeyword] = useState('');
  const [timeframe, setTimeframe] = useState('daily');
  const [language, setLanguage] = useState('');
  const [spokenLanguage, setSpokenLanguage] = useState('');
  const [minStars, setMinStars] = useState('10');
  const [minForks, setMinForks] = useState('');
  const [excludeForks, setExcludeForks] = useState(true);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [cadence, setCadence] = useState<MonitorCadence>('weekly');
  const [intervalHours, setIntervalHours] = useState('6');
  const [monitorName, setMonitorName] = useState('');

  const switchMode = (next: ResearchMode) => {
    setMode(next);
    setTimeframe(next === 'trending' ? 'daily' : next === 'emerging' ? '7d' : 'any');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'keyword' && !keyword.trim()) return;
    const n = (v: string) => v.trim() === '' ? undefined : Number(v);
    const config: ResearchConfig = {
      mode,
      timeframe: timeframe as ResearchConfig['timeframe'],
      language: language.trim() || undefined,
      ...(mode === 'trending' ? { spokenLanguage: spokenLanguage.trim() || undefined } : {}),
      ...(mode === 'keyword' ? { keyword: keyword.trim(), minStars: n(minStars) } : {}),
      ...(mode === 'emerging' ? { minStars: n(minStars), minForks: n(minForks), excludeForks } : {}),
    };
    onSubmit({ config, schedule: schedule ? { name: monitorName.trim() || (mode === 'keyword' ? keyword.trim() : `${mode} repositories`), cadence, intervalHours: cadence === 'custom-hours' ? Number(intervalHours) : undefined } : undefined });
  };

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-2 sm:grid-cols-3">
      {([
        ['trending', TrendingUp, 'Trending', 'What is popular now'],
        ['emerging', Sprout, 'Emerging', 'New repos taking off'],
        ['keyword', Search, 'Keyword', 'Track a topic or term'],
      ] as const).map(([value, Icon, title, description]) => (
        <button key={value} type="button" onClick={() => switchMode(value)} className={`rounded-md border p-3 text-left transition-colors ${mode === value ? 'border-[#3d444d] bg-accent' : 'border-border hover:bg-muted/60'}`}>
          <Icon className="mb-2 h-4 w-4" /><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </button>
      ))}
    </div>

    {mode === 'keyword' && <div className="space-y-1.5"><Label className="text-xs">Keyword</Label><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. MCP, RAG, browser agent" disabled={isLoading} /></div>}

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label className="text-xs">{mode === 'trending' ? 'Timeframe' : mode === 'emerging' ? 'Created within' : 'Recent repository window'}</Label>
        <Select key={`${mode}-${timeframe}`} value={timeframe} onValueChange={setTimeframe} disabled={isLoading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          {mode === 'trending' ? <><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></> : mode === 'emerging' ? <><SelectItem value="1d">Past day</SelectItem><SelectItem value="7d">Past 7 days</SelectItem><SelectItem value="30d">Past 30 days</SelectItem></> : <><SelectItem value="any">Any time</SelectItem><SelectItem value="7d">Past 7 days</SelectItem><SelectItem value="30d">Past 30 days</SelectItem><SelectItem value="90d">Past 90 days</SelectItem></>}
        </SelectContent></Select>
        {mode === 'keyword' && <p className="text-[11px] text-muted-foreground">Keeps the current keyword landscape and adds repositories created within this window. Forked repositories are excluded.</p>}
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Programming language</Label><Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Any" disabled={isLoading} /></div>
    </div>

    {mode === 'trending' && <div className="space-y-1.5"><Label className="text-xs">Spoken language</Label><Input value={spokenLanguage} onChange={(e) => setSpokenLanguage(e.target.value)} placeholder="Optional GitHub language code, e.g. en" disabled={isLoading} /><p className="text-[11px] text-muted-foreground">Uses GitHub Trending's spoken-language filter.</p></div>}

    {(mode === 'emerging' || mode === 'keyword') && <div className="space-y-1.5"><Label className="text-xs">Minimum stars</Label><Input type="number" min="0" value={minStars} onChange={(e) => setMinStars(e.target.value)} placeholder="No minimum" disabled={isLoading} /></div>}

    {mode === 'emerging' && <div className="space-y-3 rounded-md border border-border p-4">
      <div className="space-y-1.5"><Label className="text-xs">Minimum forks <span className="font-normal text-muted-foreground">(optional)</span></Label><Input type="number" min="0" value={minForks} onChange={(e) => setMinForks(e.target.value)} placeholder="No minimum" disabled={isLoading} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={excludeForks} onChange={(e) => setExcludeForks(e.target.checked)} disabled={isLoading} />Exclude forked repositories</label>
    </div>}

    <div className="space-y-3 rounded-md border border-border p-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} disabled={isLoading} />Save as recurring monitor</label>
      {schedule && <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><div className="space-y-1.5"><Label className="text-xs">Cadence</Label><Select value={cadence} onValueChange={(v) => setCadence(v as MonitorCadence)} disabled={isLoading}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="custom-hours">Every N hours</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{cadence === 'custom-hours' && <div className="space-y-1.5"><Label className="text-xs">Interval in hours</Label><Input type="number" min="1" max="720" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} disabled={isLoading} /></div>}<div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Monitor name</Label><Input value={monitorName} onChange={(e) => setMonitorName(e.target.value)} placeholder="Optional" disabled={isLoading} /></div></div>}
    </div>

    <Button type="submit" disabled={isLoading || (mode === 'keyword' && !keyword.trim())} className="w-full bg-[#238636] text-white hover:bg-[#2ea043]"><Search className="mr-2 h-4 w-4" />{isLoading ? 'Analyzing…' : `Analyze ${mode === 'keyword' ? 'keyword' : `${mode} repositories`}`}</Button>
  </form>;
};
