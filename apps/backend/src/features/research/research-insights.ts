import type { RepositorySnapshot, ResearchConfig } from '../github/github.types';

export type HistorySnapshot = {
  date?: Date | string;
  repositories?: RepositorySnapshot[];
  report?: unknown;
};

export type AttentionSignal = {
  repository: string;
  url: string;
  message: string;
};

export type RepositoryCluster = {
  term: string;
  repositories: string[];
  count: number;
};

/**
 * Detect repeated, distinctive terms from repository names. Name-based
 * clusters can be described accurately even when the LLM misses them.
 * This intentionally does not infer a shared cause, popularity, or adoption.
 */
export function findRepositoryClusters(repositories: RepositorySnapshot[]): RepositoryCluster[] {
  const ignored = new Set([
    'awesome', 'plugin', 'plugins', 'library', 'framework', 'template',
    'starter', 'example', 'examples', 'coding', 'claude', 'agents', 'agent',
    'skills', 'skill', 'project', 'research', 'security', 'python', 'javascript',
    'typescript', 'github', 'android', 'desktop', 'server', 'client', 'release',
  ]);
  const found = new Map<string, string[]>();

  for (const repository of repositories) {
    const name = `${repository.owner}/${repository.name}`;
    const terms = new Set(repository.name.toLowerCase().split(/[^a-z0-9]+/g)
      .filter((term) => term.length >= 6 &&
        !ignored.has(term) &&
        (/\d/.test(term) || term.length >= 8)));
    for (const term of terms) {
      found.set(term, [...(found.get(term) ?? []), name]);
    }
  }

  return [...found.entries()]
    .filter(([, names]) => names.length >= 3)
    .map(([term, names]) => ({ term, repositories: names, count: names.length }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 2);
}

export type ThemeEvidence = {
  repository: string;
  quote: string;
};

export type SupportedTheme = {
  title: string;
  description: string;
  evidence: ThemeEvidence[];
};

const format = (value: number): string => value.toLocaleString('en-US');

const stopWords = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'using', 'based',
  'repository', 'repositories', 'project', 'projects', 'tool', 'tools',
  'tooling', 'application', 'applications', 'software', 'system', 'systems',
  'development', 'solution', 'solutions', 'technology', 'technologies',
  'capability', 'capabilities', 'platform', 'platforms', 'new', 'open',
]);

function words(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Require two real, distinct repositories, exact quotes from their supplied
 * descriptions/topics, and title-relevant terminology in each quote.
 * Reject unsupported clusters instead of keeping an attractive invented theme.
 */
export function validateThemes(input: unknown, repositories: RepositorySnapshot[]): SupportedTheme[] {
  if (!Array.isArray(input)) return [];
  const known = new Map(repositories.map((repo) => [
    `${repo.owner}/${repo.name}`.toLowerCase(), repo,
  ]));
  const accepted: SupportedTheme[] = [];

  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') continue;
    const theme = candidate as Record<string, unknown>;
    if (typeof theme.title !== 'string' || typeof theme.description !== 'string' ||
        !Array.isArray(theme.evidence)) continue;

    const description = theme.description;
    const anchors = new Set(words(theme.title));
    if (!anchors.size) continue;
    const unique = new Map<string, ThemeEvidence>();

    for (const raw of theme.evidence) {
      if (!raw || typeof raw !== 'object') continue;
      const evidence = raw as Record<string, unknown>;
      if (typeof evidence.repository !== 'string' || typeof evidence.quote !== 'string') continue;
      const name = evidence.repository.toLowerCase();
      const repo = known.get(name);
      const quote = evidence.quote.trim();
      if (!repo || quote.length < 8 || unique.has(name)) continue;

      const sources = [repo.description ?? '', ...(repo.topics ?? [])];
      if (!sources.some((source) => normalized(source).includes(normalized(quote)))) continue;
      if (!words(quote).some((token) => anchors.has(token))) continue;
      unique.set(name, { repository: `${repo.owner}/${repo.name}`, quote });
    }

    if (unique.size < 2) continue;
    const supports = [...unique.values()];
    // The description must name its actual supporting repositories explicitly.
    if (supports.filter(({ repository }) =>
      description.toLowerCase().includes(repository.toLowerCase())).length < 2) continue;

    accepted.push({
      title: theme.title,
      description,
      evidence: supports.slice(0, 5),
    });
    if (accepted.length === 3) break;
  }
  return accepted;
}

function snapshotDate(snapshot: HistorySnapshot): number {
  const parsed = snapshot.date instanceof Date ? snapshot.date : new Date(snapshot.date ?? '');
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

/**
 * Surface exceptional GitHub Trending figures independently of the LLM.
 * Period-star counts are rolling-window observations, not incremental gains
 * since the previous report.
 */
export function findAttentionSignals(
  config: ResearchConfig,
  current: RepositorySnapshot[],
  history: HistorySnapshot[],
): AttentionSignal[] {
  if (config.mode !== 'trending') return [];
  const ranked = current
    .filter((repo) => typeof repo.periodStars === 'number' && repo.periodStars >= 0)
    .sort((a, b) => (b.periodStars ?? 0) - (a.periodStars ?? 0));
  if (!ranked.length) return [];

  const previous = [...history]
    .filter((snapshot) => snapshot.repositories?.length && snapshotDate(snapshot) > 0)
    .sort((a, b) => snapshotDate(b) - snapshotDate(a))[0];
  const previousByUrl = new Map(
    (previous?.repositories ?? []).map((repo) => [repo.url.toLowerCase(), repo]),
  );
  const signals: AttentionSignal[] = [];

  for (const [index, repo] of ranked.entries()) {
    const currentStars = repo.periodStars!;
    const priorStars = previousByUrl.get(repo.url.toLowerCase())?.periodStars;
    const increase = typeof priorStars === 'number' && priorStars > 0
      ? currentStars - priorStars : 0;
    const largeIncrease = typeof priorStars === 'number' && priorStars >= 100 &&
      currentStars >= priorStars * 1.5 &&
      (increase >= 10_000 || (increase >= 2_000 && currentStars >= priorStars * 3));
    const runnerUp = index === 0 ? ranked[1]?.periodStars : undefined;
    const standout = index === 0 && typeof runnerUp === 'number' &&
      runnerUp > 0 && currentStars >= 5000 && currentStars >= runnerUp * 3;

    if (!largeIncrease && !standout) continue;
    const name = `${repo.owner}/${repo.name}`;
    const parts: string[] = [];

    if (largeIncrease && typeof priorStars === 'number') {
      const date = new Date(snapshotDate(previous!)).toISOString().slice(0, 10);
      parts.push(`GitHub's rolling ${config.timeframe ?? 'period'} star figure for ${name} rose from ${format(priorStars)} in the ${date} snapshot to ${format(currentStars)} now (+${format(increase)} in the reported ${config.timeframe ?? 'period'} metric)`);
    }
    if (standout && typeof runnerUp === 'number') {
      parts.push(`${name} leads the current ${config.timeframe ?? 'period'} trending snapshot with ${format(currentStars)} period stars, ${(currentStars / runnerUp).toFixed(1)}× the runner-up (${format(runnerUp)})`);
    }
    parts.push('These rolling-window figures do not measure new stars earned between snapshots.');
    signals.push({ repository: name, url: repo.url, message: parts.join('. ') });
    if (signals.length === 2) break;
  }
  return signals;
}
