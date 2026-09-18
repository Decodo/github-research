import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CalendarClock, ExternalLink, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteMonitorMutation, useMonitorsQuery, useRunMonitorMutation, useUpdateMonitorMutation } from '@/features/monitors/api/useMonitorsApi';

export const Route=createFileRoute('/_layout/monitors')({component:MonitorsPage});
const cadenceLabel=(c:string,h?:number)=>c==='custom-hours'?`Every ${h??1} hours`:c[0].toUpperCase()+c.slice(1);
function MonitorsPage(){
  const {data:monitors,isLoading}=useMonitorsQuery();
  const update=useUpdateMonitorMutation(); const remove=useDeleteMonitorMutation(); const run=useRunMonitorMutation(); const navigate=useNavigate();
  return <div className="py-6 space-y-4"><div><h1 className="text-2xl font-semibold">Monitors</h1><p className="mt-1 text-sm text-muted-foreground">Recurring GitHub analyses with stored longitudinal history</p></div>
    {isLoading?<div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-28 w-full" />)}</div>:!monitors?.length?<Card><CardContent className="py-12 text-center"><CalendarClock className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="text-sm font-medium">No recurring monitors yet</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/tracker" search={{ createMonitor: true }}>Create a monitor</Link></Button></CardContent></Card>:<div className="space-y-3">{monitors.map(m=>{
      const running=Boolean(m.currentRunStartedAt)||(run.isPending&&run.variables===m._id);
      return <Card key={m._id}><CardContent className="py-4 space-y-3"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{m.name}</p><Badge variant={m.enabled?'secondary':'outline'}>{running?(m.enabled?'Running…':'Running · paused after this run'):(m.enabled?cadenceLabel(m.cadence,m.intervalHours):'Paused')}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{planLabel(m.plan)}</p></div><div className="flex gap-1"><Button variant="outline" size="sm" disabled={running} onClick={()=>run.mutate(m._id,{onSuccess:(result)=>void navigate({to:'/history/$id',params:{id:result.id}})})}>{running?<><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin"/>Running…</>:<><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>Run now</>}</Button><Button variant="ghost" size="sm" onClick={()=>update.mutate({id:m._id,enabled:!m.enabled})}>{m.enabled?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}</Button><Button variant="ghost" size="sm" onClick={()=>remove.mutate(m._id)}><Trash2 className="h-4 w-4"/></Button></div></div><div className="flex flex-wrap gap-x-5 text-xs text-muted-foreground">{m.enabled&&<span>Next run · {new Date(m.nextRunAt).toLocaleString()}</span>}{running&&<span>{m.enabled?'Research is running':'Current research will finish; future scheduled runs are paused'}</span>}{m.lastRunAt&&<span>Last run · {new Date(m.lastRunAt).toLocaleString()}</span>}{m.lastQueryId&&<Link to="/history/$id" params={{id:m.lastQueryId}} className="inline-flex items-center gap-1">Latest report <ExternalLink className="h-3 w-3"/></Link>}</div>{m.lastError&&<p className="text-xs text-destructive">Last run failed · {m.lastError}</p>}</CardContent></Card>})}</div>}
    <p className="text-xs text-muted-foreground">Automatic runs occur only while the backend process is running.</p></div>;
}
function planLabel(p:any){const bits=[p.mode];if(p.keyword)bits.push(`“${p.keyword}”`);if(p.timeframe)bits.push(p.timeframe);if(p.language)bits.push(p.language);if(p.minStars!==undefined)bits.push(`≥${p.minStars} stars`);return bits.join(' · ')}
