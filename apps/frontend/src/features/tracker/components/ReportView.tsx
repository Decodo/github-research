import { Download, ExternalLink, GitFork, Star, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportAsJson, exportAsMarkdown } from '../utils/export';
import type { ResearchResult } from '../tracker.types';

function modeLabel(mode?: string) { return mode ? mode[0].toUpperCase() + mode.slice(1) : 'Research'; }

function trendingPeriodLabels(timeframe?: string) {
  switch (timeframe) {
    case 'daily': return { mover: 'Top daily mover', repoSuffix: 'today' };
    case 'weekly': return { mover: 'Top weekly mover', repoSuffix: 'this week' };
    case 'monthly': return { mover: 'Top monthly mover', repoSuffix: 'this month' };
    default: return { mover: 'Top period mover', repoSuffix: 'this period' };
  }
}

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Rust: '#dea584',
  Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Swift: '#F05138', Kotlin: '#A97BFF', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c',
  WebAssembly: '#04133b', Erlang: '#B83998', Zig: '#ec915c', PowerShell: '#012456',
};
function Language({ name }: { name: string }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: languageColors[name] ?? '#8b949e' }} />{name}</span>;
}

export function ReportView({ result }: { result: ResearchResult }) {
  const { report, repositories, plan, generatedAt, sourceUrl, sourceUrls } = result;
  const githubSources = sourceUrls?.length ? sourceUrls : sourceUrl ? [sourceUrl] : [];
  const topMover = [...repositories].filter(r => r.periodStars !== undefined).sort((a,b) => (b.periodStars ?? 0) - (a.periodStars ?? 0))[0];
  const highestStarred = [...repositories].filter(r => r.stars !== undefined).sort((a,b) => (b.stars ?? 0) - (a.stars ?? 0))[0];
  const languages = repositories.filter(r => r.language).reduce<Record<string, number>>((acc, r) => { acc[r.language!] = (acc[r.language!] ?? 0) + 1; return acc; }, {});
  const topLanguage = Object.entries(languages).sort((a,b) => b[1]-a[1])[0];
  const historicalSignals = report.longitudinal?.signals ?? [];
  const hasHistory = historicalSignals.length > 0;
  const periodLabels = trendingPeriodLabels(plan?.timeframe);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{modeLabel(plan?.mode)}</Badge><span>{repositories.length} repositories</span><span>·</span><span>{new Date(generatedAt).toLocaleString()}</span>{githubSources.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{githubSources.length > 1 ? `GitHub source ${index + 1}` : 'GitHub source'} <ExternalLink className="h-3 w-3" /></a>)}</div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => exportAsMarkdown(result)}><Download className="mr-2 h-3.5 w-3.5" />Markdown</Button><Button variant="outline" size="sm" onClick={() => exportAsJson(result)}><Download className="mr-2 h-3.5 w-3.5" />JSON</Button></div>
    </div>

    <Card><CardHeader className="pb-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Research summary</div></CardHeader><CardContent><p className="text-sm leading-6">{report.executiveSummary}</p></CardContent></Card>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="pt-5">{plan?.mode === 'trending' ? <><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4 text-primary" />{periodLabels.mover}</div><p className="mt-2 truncate text-sm font-semibold">{topMover ? `${topMover.owner}/${topMover.name}` : 'Not available'}</p>{topMover?.periodStars !== undefined && <p className="mt-1 text-lg font-semibold text-[var(--success)]">+{topMover.periodStars.toLocaleString()}</p>}</> : <><div className="flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-4 w-4 text-primary" />{plan?.mode === 'emerging' ? 'Highest-starred new repo' : 'Highest-starred repository'}</div><p className="mt-2 truncate text-sm font-semibold">{highestStarred ? `${highestStarred.owner}/${highestStarred.name}` : 'Not available'}</p>{highestStarred?.stars !== undefined && <p className="mt-1 text-lg font-semibold">{highestStarred.stars.toLocaleString()} stars</p>}</>}</CardContent></Card>
      <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-4 w-4 text-primary" />Repositories analyzed</div><p className="mt-2 text-2xl font-semibold">{repositories.length}</p></CardContent></Card>
      <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Most represented language</div><p className="mt-2 text-sm font-semibold">{topLanguage ? topLanguage[0] : 'Not available'}</p>{topLanguage && <p className="mt-1 text-xs text-muted-foreground">{topLanguage[1]} repositories</p>}</CardContent></Card>
    </div>

    {!!report.themes?.length && <div><div className="mb-3"><h3 className="text-base font-semibold">Key themes</h3><p className="text-xs text-muted-foreground">Patterns identified across the repositories in this run</p></div><div className="grid gap-3 md:grid-cols-2">{report.themes.map((theme, i) => <Card key={i}><CardContent className="pt-5"><div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--topic-bg)] text-xs font-semibold text-[var(--topic-fg)]">{i+1}</div><p className="text-sm font-semibold">{theme.title}</p><p className="mt-1.5 text-sm leading-5 text-muted-foreground">{theme.description}</p></CardContent></Card>)}</div></div>}

    {!!report.notableRepositories?.length && <div><div className="mb-3"><h3 className="text-base font-semibold">Notable repositories</h3><p className="text-xs text-muted-foreground">Repositories that stand out from this run's observed data</p></div><div className="grid gap-3 md:grid-cols-2">{report.notableRepositories.slice(0, 4).map((item) => <Card key={item.repository}><CardContent className="pt-5"><p className="text-sm font-semibold text-[var(--topic-fg)]">{item.repository}</p><p className="mt-1.5 text-sm leading-5 text-muted-foreground">{item.reason}</p></CardContent></Card>)}</div></div>}

    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Historical comparison</CardTitle></CardHeader><CardContent>{hasHistory ? <div className="space-y-3"><p className="text-sm leading-5 text-muted-foreground">{report.longitudinal!.summary}</p><div className="grid gap-2 md:grid-cols-2">{historicalSignals.map((item, index) => <div key={`${item.signal}-${index}`} className="rounded-md border border-border p-3"><p className="text-sm font-medium">{item.signal}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>)}</div></div> : <div><p className="text-sm font-medium">No matching previous snapshot yet</p><p className="mt-1 text-sm text-muted-foreground">Run this research again later to compare repository movement over time.</p></div>}</CardContent></Card>

    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Repositories <span className="font-normal text-muted-foreground">({repositories.length})</span></CardTitle></CardHeader><CardContent className="divide-y divide-border">{repositories.map((repo) => <div key={`${repo.owner}/${repo.name}`} className="py-3.5 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><a href={repo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--topic-fg)] hover:underline">{repo.owner}/{repo.name}<ExternalLink className="h-3 w-3" /></a>{repo.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{repo.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-2">{repo.language && <Language name={repo.language} />}{repo.topics?.slice(0, 4).map(topic => <Badge key={topic} variant="secondary" className="rounded-full border-0 bg-[var(--topic-bg)] px-2.5 font-medium text-[var(--topic-fg)] hover:bg-[var(--topic-bg)]">{topic}</Badge>)}</div></div><div className="shrink-0 space-y-1 text-right text-xs text-muted-foreground">{repo.periodStars !== undefined && <div className="font-semibold text-[var(--success)]">+{repo.periodStars.toLocaleString()} {periodLabels.repoSuffix}</div>}{repo.stars !== undefined && <div className="flex items-center justify-end gap-1"><Star className="h-3 w-3" />{repo.stars.toLocaleString()}</div>}{repo.forks !== undefined && <div className="flex items-center justify-end gap-1"><GitFork className="h-3 w-3" />{repo.forks.toLocaleString()}</div>}</div></div></div>)}</CardContent></Card>
  </div>;
}
