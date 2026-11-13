import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DecodoService } from '../decodo/decodo.service';
import { GithubParserService } from '../github/github-parser.service';
import { GithubUrlService } from '../github/github-url.service';
import type { RepositorySnapshot, ResearchConfig } from '../github/github.types';
import { LlmService } from '../llm/llm.service';
import { QueriesService } from '../queries/queries.service';
import type { RunResearchDto } from './dto/run-research.dto';
import { findAttentionSignals, findRepositoryClusters, validateThemes, type HistorySnapshot } from './research-insights';

type HistoricalComparison = {
  facts: {
    previousSnapshotDate: string | null;
    comparisonWindow: string | null;
    isDiagnosticWindow: boolean;
    currentRepositoryCount: number;
    previousRepositoryCount: number;
    overlappingRepositoryCount: number;
    currentOnlyCount: number;
    previousOnlyCount: number;
    overlappingRepositories: Array<{
      repository: string;
      previousStars?: number;
      currentStars?: number;
      starDelta?: number;
      previousPeriodStars?: number;
      currentPeriodStars?: number;
      periodStarsDelta?: number;
    }>;
    currentOnlyRepositories: string[];
    previousOnlyRepositories: string[];
  } | null;
  report: {
    summary: string;
    signals: Array<{ signal: string; detail: string }>;
  };
};

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(private readonly decodo: DecodoService, private readonly urls: GithubUrlService, private readonly parser: GithubParserService, private readonly llm: LlmService, private readonly queries: QueriesService) {}

  async run(dto: RunResearchDto, context: { runType?: 'manual'|'scheduled'|'manual-monitor'; monitorId?: string; onProgress?: (stage: 'researching'|'structuring'|'analyzing'|'saving') => void } = {}) {
    const config: ResearchConfig = {
      ...dto,
      timeframe: dto.timeframe ?? (dto.mode === 'trending' ? 'daily' : dto.mode === 'emerging' ? '7d' : 'any'),
    } as ResearchConfig;
    const url = this.urls.build(config);
    context.onProgress?.('researching');
    const html = await this.decodo.scrapeUrl(url);
    context.onProgress?.('structuring');
    let repositories = dto.mode === 'trending' ? this.parser.parseTrending(html) : this.parser.parseSearch(html);
    const primarySearchCount = repositories.length;
    const sourceUrls = [url];
    const recentRepositoryUrls = new Set<string>();

    // Keyword research keeps the broad landscape while optionally adding newly created repos
    // from the selected window. This avoids treating "timeframe" as a creation-only filter.
    const recentUrl = this.urls.buildKeywordRecent(config);
    if (recentUrl) {
      context.onProgress?.('researching');
      sourceUrls.push(recentUrl);
      const recentHtml = await this.decodo.scrapeUrl(recentUrl);
      context.onProgress?.('structuring');
      const recent = this.parser.parseSearch(recentHtml);
      recent.forEach((repo) => recentRepositoryUrls.add(repo.url));
      const seen = new Set(repositories.map((repo) => repo.url));
      repositories = [...repositories, ...recent.filter((repo) => !seen.has(repo.url))];
    }

    // GitHub repository search embeds a limited first page. Fetch one additional
    // page when it is full, without turning each research run into a broad crawl.
    if (config.mode !== 'trending' && primarySearchCount >= 10) {
      const pageUrl = this.urls.withSearchPage(url, 2);
      try {
        context.onProgress?.('researching');
        const pageHtml = await this.decodo.scrapeUrl(pageUrl);
        context.onProgress?.('structuring');
        const additional = this.parser.parseSearch(pageHtml);
        const seen = new Set(repositories.map((repo) => repo.url.toLowerCase()));
        repositories.push(...additional.filter((repo) => !seen.has(repo.url.toLowerCase())));
        sourceUrls.push(pageUrl);
      } catch (error) {
        this.logger.warn(`GitHub search page 2 unavailable; using page 1: ${String(error)}`);
      }
    }

    if (!repositories.length) throw new NotFoundException('GitHub returned no repositories for this research configuration.');

    // Enrich a bounded set of highly ranked repositories with missing topics and
    // fork counts. Three concurrent Decodo calls at a time; failures are harmless.
    const enrichmentLimit = Math.max(0, Math.min(12, Number(process.env.GITHUB_METADATA_ENRICH_LIMIT ?? 6) || 0));
    const candidates = [...repositories]
      .filter((repo) => !repo.topics?.length || repo.forks === undefined || !repo.description)
      .sort((a, b) => (b.periodStars ?? b.stars ?? 0) - (a.periodStars ?? a.stars ?? 0))
      .slice(0, enrichmentLimit);
    const enriched = new Map<string, RepositorySnapshot>();

    for (let i = 0; i < candidates.length; i += 3) {
      await Promise.all(candidates.slice(i, i + 3).map(async (repo) => {
        try {
          const html = await this.decodo.scrapeUrl(repo.url);
          enriched.set(repo.url, this.parser.enrichFromRepositoryPage(repo, html));
        } catch (error) {
          this.logger.warn(`Could not enrich ${repo.owner}/${repo.name}: ${String(error)}`);
        }
      }));
    }
    repositories = repositories.map((repo) => enriched.get(repo.url) ?? repo);
    const prompt = this.label(config);
    const history = await this.queries.findRecentHistory(prompt, context.monitorId ?? dto.monitorId, 8, config);
    context.onProgress?.('analyzing');
    const report = await this.analyze(config, repositories, history.map((h: any) => ({ date: h.createdAt, repositories: h.repositories, report: h.report })), recentRepositoryUrls);
    const generatedAt = new Date().toISOString();
    context.onProgress?.('saving');
    const saved = await this.queries.create({ prompt, plan: config, repositories, report, monitorId: context.monitorId ?? dto.monitorId, runType: context.runType ?? 'manual' });
    return { id: String(saved._id), generatedAt, sourceUrl: url, sourceUrls, plan: config, repositories, report };
  }

  private label(config: ResearchConfig): string {
    if (config.mode === 'keyword') return `Keyword: ${config.keyword ?? ''}`;
    if (config.mode === 'emerging') return 'Emerging repositories';
    return 'Trending repositories';
  }

  private async analyze(config: ResearchConfig, current: RepositorySnapshot[], history: HistorySnapshot[], recentRepositoryUrls = new Set<string>()) {
    const withPeriodStars = current.filter((repo) => typeof repo.periodStars === 'number');
    const topPeriodMover = [...withPeriodStars].sort((a, b) => (b.periodStars ?? 0) - (a.periodStars ?? 0))[0];
    const languageCounts = current.reduce<Record<string, number>>((counts, repo) => {
      if (repo.language) counts[repo.language] = (counts[repo.language] ?? 0) + 1;
      return counts;
    }, {});
    const topLanguage = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0];
    const historicalComparison = this.buildHistoricalComparison(current, history);
    const deterministicFacts = {
      repositoryCount: current.length,
      topPeriodMover: topPeriodMover ? { repository: `${topPeriodMover.owner}/${topPeriodMover.name}`, periodStars: topPeriodMover.periodStars } : null,
      mostRepresentedLanguage: topLanguage ? { language: topLanguage[0], repositories: topLanguage[1] } : null,
      longitudinalComparison: historicalComparison.facts,
      attentionSignals: findAttentionSignals(config, current, history),
      repositoryClusters: findRepositoryClusters(current),
      keywordRecentSupplement: config.mode === 'keyword' && config.timeframe !== 'any' ? {
        window: config.timeframe,
        repositoryCount: recentRepositoryUrls.size,
        repositories: current.filter((repo) => recentRepositoryUrls.has(repo.url)).map((repo) => `${repo.owner}/${repo.name}`),
      } : null,
    };

    const response = await this.llm.complete({ responseFormat: 'json', messages: [{ role: 'user', content: `You are analyzing GitHub repository trends. Base every factual claim only on the supplied current repositories, deterministic facts, and previous snapshots.

Rules:
- Never contradict deterministicFacts. In Trending mode, never name a different top period-star mover. In Emerging mode, period-star movement is not available and must not be mentioned.
- Do not invent causes, catalysts, releases, CVEs, announcements, conferences, adoption, user intent, geographic reach, enterprise demand, or other external context that is not present in the supplied data.
- You may interpret observed patterns, but phrase interpretations proportionately (for example, "suggests" or "is consistent with") and keep them directly tied to supplied evidence.
- When repositories repeatedly mention an unfamiliar named concept, product, model, acronym, or entity, you may identify the observable cluster, but do not infer what that name refers to unless the supplied repository metadata establishes it. If its identity or meaning is unclear, say that the available metadata does not establish it.
- Do not describe a repository as "highest momentum", "accelerating", "breakout", or similar unless the supplied metrics or historical deltas directly support that wording.
- Historical overlap counts, set membership, metric deltas, comparisonWindow, and isDiagnosticWindow in deterministicFacts.longitudinalComparison are authoritative. Do not recalculate them from Previous runs. If you mention the comparison timing, use comparisonWindow exactly rather than converting it to decimal hours. If you cite a historical count or delta in executiveSummary, themes, or notableRepositories, use the deterministic value exactly.
- If deterministicFacts.longitudinalComparison.isDiagnosticWindow is true, the comparison is a diagnostic snapshot, not evidence of a durable trend. Report concrete changes but explicitly avoid strong trend conclusions.
- Write the executiveSummary as a short, specific briefing. Name the most important repositories and their actual metrics instead of generic statements about interest or demand. Lead with the measured attentionSignals if any are supplied. Explicitly mention a prominent repositoryClusters term when present and supported, without inventing reasons for the cluster. Do not mention missing history there.
- Return 0 to 3 genuinely distinct themes, only if supported by at least two current repositories each. Zero themes is acceptable. Never group unrelated repositories merely to meet a quota.
- For each theme, provide an evidence array of objects {repository, quote}. Every quote must be an EXACT verbatim substring (8+ characters) of that repository's supplied description or topic. The quote must contain a meaningful term from the theme title and justify its grouping. Two independent sources must genuinely describe the same topic. Do not use a generic interface feature to justify a specialized category like 3D reconstruction or mobile debloating.
- Each theme description must name its real supporting repositories and explain their common concrete functionality in 1 to 3 concise sentences.
- Themes must describe the current snapshot only. Repositories that appear only in Previous runs must not be used as evidence to establish a current theme. Each theme description must explicitly name at least two supporting repositories from Current repositories using their exact owner/name form.
- Use Previous runs only for longitudinal comparison and historical context about repositories that are also present in Current repositories. Do not use previous-only repositories to create current themes or notableRepositories.
- notableRepositories should contain at most 4 current repositories with evidence-based reasons, especially a statistical outlier. Fewer is fine. Do not speculate about why external attention occurred.
- In Emerging mode, focus on newly created repositories, current star counts, languages, topics, and clusters. Do not discuss a missing top period mover or other Trending-only metrics.
- In Keyword mode, the main search is a current relevance landscape. deterministicFacts.keywordRecentSupplement is authoritative for the optional recent-created-repository supplement. Never call a repository recent/new based only on observedAt. Only repositories listed in keywordRecentSupplement.repositories are known from this run to match the selected creation window. Do not describe the whole dataset as being from that timeframe.
- If there are no previous matching snapshots, make longitudinal.summary brief and return an empty longitudinal.signals array.
- Each longitudinal signal must be an object with string fields "signal" and "detail" and must state an observed comparison, not an invented explanation.

Return JSON with keys executiveSummary (string), themes (array of {title, description, evidence: array of {repository, quote}}), notableRepositories (array of {repository, reason}), and longitudinal (object with summary and signals array).

Research configuration:
${JSON.stringify(config)}

Deterministic facts (authoritative):
${JSON.stringify(deterministicFacts)}

Current repositories:
${JSON.stringify(current)}

Previous runs:
${JSON.stringify(history)}` }] });
    const parsed = this.llm.parseJsonResponse<Record<string, unknown>>(response.content);

    parsed.themes = validateThemes(parsed.themes, current);
    if (Array.isArray(parsed.notableRepositories)) {
      const known = new Set(current.map((repo) => `${repo.owner}/${repo.name}`.toLowerCase()));
      parsed.notableRepositories = parsed.notableRepositories.filter((raw) => {
        if (!raw || typeof raw !== 'object') return false;
        const item = raw as Record<string, unknown>;
        return typeof item.repository === 'string' && typeof item.reason === 'string' &&
          known.has(item.repository.toLowerCase());
      }).slice(0, 4);
    }
    parsed.attentionSignals = deterministicFacts.attentionSignals;
    parsed.repositoryClusters = deterministicFacts.repositoryClusters;
    parsed.longitudinal = historicalComparison.report;
    return parsed;
  }

  private buildHistoricalComparison(current: RepositorySnapshot[], history: HistorySnapshot[]): HistoricalComparison {
    const snapshotTime = (snapshot: HistorySnapshot) => {
      if (!snapshot.date) return 0;
      const date = snapshot.date instanceof Date ? snapshot.date : new Date(snapshot.date);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    const previous = [...history]
      .filter((snapshot) => Array.isArray(snapshot.repositories) && snapshot.repositories.length > 0)
      .sort((a, b) => snapshotTime(b) - snapshotTime(a))[0];
    if (!previous?.repositories?.length) {
      return {
        facts: null,
        report: {
          summary: 'No previous matching snapshot is available.',
          signals: [],
        },
      };
    }

    const previousRepositories = previous.repositories;
    const previousByUrl = new Map<string, RepositorySnapshot>(
      previousRepositories.map((repo) => [repo.url.toLowerCase(), repo] as const),
    );
    const currentByUrl = new Map<string, RepositorySnapshot>(
      current.map((repo) => [repo.url.toLowerCase(), repo] as const),
    );
    const label = (repo: RepositorySnapshot) => `${repo.owner}/${repo.name}`;

    const overlappingRepositories = current
      .filter((repo) => previousByUrl.has(repo.url.toLowerCase()))
      .map((repo) => {
        const prior = previousByUrl.get(repo.url.toLowerCase())!;
        const previousStars = typeof prior.stars === 'number' ? prior.stars : undefined;
        const currentStars = typeof repo.stars === 'number' ? repo.stars : undefined;
        const previousPeriodStars = typeof prior.periodStars === 'number' ? prior.periodStars : undefined;
        const currentPeriodStars = typeof repo.periodStars === 'number' ? repo.periodStars : undefined;

        return {
          repository: label(repo),
          previousStars,
          currentStars,
          starDelta:
            previousStars !== undefined && currentStars !== undefined
              ? currentStars - previousStars
              : undefined,
          previousPeriodStars,
          currentPeriodStars,
          periodStarsDelta:
            previousPeriodStars !== undefined && currentPeriodStars !== undefined
              ? currentPeriodStars - previousPeriodStars
              : undefined,
        };
      });

    const currentOnlyRepositories = current
      .filter((repo) => !previousByUrl.has(repo.url.toLowerCase()))
      .map(label);

    const previousOnlyRepositories = previousRepositories
      .filter((repo) => !currentByUrl.has(repo.url.toLowerCase()))
      .map(label);

    const previousDate =
      previous.date instanceof Date
        ? previous.date
        : previous.date
          ? new Date(previous.date)
          : null;
    const validPreviousDate =
      previousDate && !Number.isNaN(previousDate.getTime()) ? previousDate : null;
    const now = new Date();
    const hoursBetweenSnapshots = validPreviousDate
      ? (now.getTime() - validPreviousDate.getTime()) / 3_600_000
      : null;

    const previousDateLabel = validPreviousDate
      ? validPreviousDate.toISOString().slice(0, 10)
      : 'the previous run';
    const snapshotDistance =
      hoursBetweenSnapshots === null
        ? null
        : hoursBetweenSnapshots < 1
          ? `${Math.max(1, Math.round(hoursBetweenSnapshots * 60))} minutes`
          : hoursBetweenSnapshots < 48
            ? `${Math.round(hoursBetweenSnapshots)} hours`
            : `${(hoursBetweenSnapshots / 24).toFixed(1).replace(/\.0$/, '')} days`;

    const facts = {
      previousSnapshotDate: validPreviousDate ? validPreviousDate.toISOString() : null,
      comparisonWindow: snapshotDistance,
      isDiagnosticWindow: hoursBetweenSnapshots !== null && hoursBetweenSnapshots < 6,
      currentRepositoryCount: current.length,
      previousRepositoryCount: previousRepositories.length,
      overlappingRepositoryCount: overlappingRepositories.length,
      currentOnlyCount: currentOnlyRepositories.length,
      previousOnlyCount: previousOnlyRepositories.length,
      overlappingRepositories,
      currentOnlyRepositories,
      previousOnlyRepositories,
    };

    const timing =
      snapshotDistance === null
        ? ''
        : hoursBetweenSnapshots! < 6
          ? ` The snapshots are approximately ${snapshotDistance} apart, so this is a diagnostic comparison rather than evidence of a durable trend.`
          : ` The snapshots are approximately ${snapshotDistance} apart.`;

    const summary =
      `A previous snapshot from ${previousDateLabel} contains ${previousRepositories.length} repositories. ` +
      `${overlappingRepositories.length} of the ${current.length} current repositories also appeared there; ` +
      `${currentOnlyRepositories.length} are newly present in the current set and ` +
      `${previousOnlyRepositories.length} from the previous set are absent.` +
      timing;

    const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('en-US')}`;
    const signals = overlappingRepositories
      .filter((item) => item.starDelta !== undefined)
      .sort((a, b) => Math.abs(b.starDelta ?? 0) - Math.abs(a.starDelta ?? 0))
      .slice(0, 8)
      .map((item) => {
        const signal = `${item.repository} star count changed from ${item.previousStars!.toLocaleString('en-US')} to ${item.currentStars!.toLocaleString('en-US')}`;
        let detail = `Observed change of ${formatDelta(item.starDelta!)} stars between the previous and current snapshots.`;

        if (
          item.previousPeriodStars !== undefined &&
          item.currentPeriodStars !== undefined &&
          item.periodStarsDelta !== undefined
        ) {
          detail += ` Weekly period stars changed from ${item.previousPeriodStars.toLocaleString('en-US')} to ${item.currentPeriodStars.toLocaleString('en-US')} (${formatDelta(item.periodStarsDelta)}).`;
        }

        return { signal, detail };
      });

    if (currentOnlyRepositories.length) {
      signals.push({
        signal: `${currentOnlyRepositories.length} repositories are newly present in the current snapshot`,
        detail: `Current-only repositories: ${currentOnlyRepositories.join(', ')}.`,
      });
    }

    if (previousOnlyRepositories.length) {
      signals.push({
        signal: `${previousOnlyRepositories.length} repositories from the previous snapshot are absent from the current set`,
        detail: `Previous-only repositories: ${previousOnlyRepositories.join(', ')}.`,
      });
    }

    return { facts, report: { summary, signals } };
  }
}
