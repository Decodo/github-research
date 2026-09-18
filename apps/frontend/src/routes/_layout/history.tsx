import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Search, Trash2 } from 'lucide-react';
import { useQueriesQuery, useDeleteQueryMutation } from '@/features/queries/api/useQueriesApi';
import type { StoredQuery } from '@/features/tracker/tracker.types';

export const Route = createFileRoute('/_layout/history')({ component: HistoryPage });

const timeframeLabel = (timeframe?: StoredQuery['plan']['timeframe']) => {
  const labels: Partial<Record<NonNullable<StoredQuery['plan']['timeframe']>, string>> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    '1d': '1d',
    '7d': '7d',
    '30d': '30d',
    '90d': '90d',
    any: 'Any time',
  };
  return timeframe ? labels[timeframe] : undefined;
};

function runDetails(query: StoredQuery) {
  const { plan } = query;
  const details: string[] = [];

  // Put the most useful run-defining configuration before the timestamp.
  details.push(plan.language?.trim() || 'Any language');

  const timeframe = timeframeLabel(plan.timeframe);
  if (timeframe) details.push(timeframe);

  if ((plan.mode === 'keyword' || plan.mode === 'emerging') && plan.minStars !== undefined) {
    details.push(`≥${plan.minStars} stars`);
  }
  if (plan.mode === 'emerging' && plan.minForks !== undefined) details.push(`≥${plan.minForks} forks`);
  if (plan.mode === 'trending' && plan.spokenLanguage) details.push(`Spoken: ${plan.spokenLanguage}`);

  return details;
}

function HistoryPage() {
  const { pathname } = useLocation();
  const { data, isLoading } = useQueriesQuery();
  const del = useDeleteQueryMutation();

  if (pathname !== '/history') return <Outlet />;
  if (isLoading) return <div className="py-6"><Skeleton className="h-20 w-full" /></div>;

  return <div className="py-6 space-y-4">
    <div>
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Past GitHub research reports</p>
    </div>
    {!data?.length ? <Card>
      <CardContent className="py-12 text-center">
        <Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
        <p className="text-sm">No research runs yet</p>
        <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/tracker">Go to Research</Link></Button>
      </CardContent>
    </Card> : <div className="space-y-2">
      {data.map(q => <Card key={q._id}>
        <CardContent className="flex items-center gap-4 py-3">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Link to="/history/$id" params={{ id: q._id }} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{q.prompt}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {runDetails(q).map(detail => <span key={detail}>{detail}</span>)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/80">{new Date(q.createdAt).toLocaleString()}</p>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => del.mutate(q._id)} aria-label="Delete history entry">
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>)}
    </div>}
  </div>;
}
