import { Injectable, NotFoundException } from '@nestjs/common';
import { DecodoService } from '../decodo/decodo.service';
import { GithubParserService } from '../github/github-parser.service';
import { GithubUrlService } from '../github/github-url.service';
import type { RepositorySnapshot, ResearchConfig } from '../github/github.types';
import { LlmService } from '../llm/llm.service';
import { QueriesService } from '../queries/queries.service';
import type { RunResearchDto } from './dto/run-research.dto';

@Injectable()
export class ResearchService {
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
    if (!repositories.length) throw new NotFoundException('GitHub returned no repositories for this research configuration.');
    const prompt = this.label(config);
    const history = await this.queries.findRecentHistory(prompt, context.monitorId ?? dto.monitorId, 8);
    context.onProgress?.('analyzing');
    const report = await this.analyze(config, repositories, history.map((h: any) => ({ date: h.createdAt, repositories: h.repositories, report: h.report })), recentRepositoryUrls);
    context.onProgress?.('saving');
    const saved = await this.queries.create({ prompt, plan: config, repositories, report, monitorId: context.monitorId ?? dto.monitorId, runType: context.runType ?? 'manual' });
    return { id: String(saved._id), generatedAt: new Date().toISOString(), sourceUrl: url, sourceUrls, plan: config, repositories, report };
  }

  private label(config: ResearchConfig): string {
    if (config.mode === 'keyword') return `Keyword: ${config.keyword ?? ''}`;
    if (config.mode === 'emerging') return 'Emerging repositories';
    return 'Trending repositories';
  }

  private async analyze(config: ResearchConfig, current: RepositorySnapshot[], history: unknown[], recentRepositoryUrls = new Set<string>()) {
    const withPeriodStars = current.filter((repo) => typeof repo.periodStars === 'number');
    const topPeriodMover = [...withPeriodStars].sort((a, b) => (b.periodStars ?? 0) - (a.periodStars ?? 0))[0];
    const languageCounts = current.reduce<Record<string, number>>((counts, repo) => {
      if (repo.language) counts[repo.language] = (counts[repo.language] ?? 0) + 1;
      return counts;
    }, {});
    const topLanguage = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0];
    const deterministicFacts = {
      repositoryCount: current.length,
      topPeriodMover: topPeriodMover ? { repository: `${topPeriodMover.owner}/${topPeriodMover.name}`, periodStars: topPeriodMover.periodStars } : null,
      mostRepresentedLanguage: topLanguage ? { language: topLanguage[0], repositories: topLanguage[1] } : null,
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
- Compare historical snapshots only when they contain the same repository and metric. Calculate deltas carefully.
- Very short comparison windows (under 6 hours) are diagnostic snapshots, not evidence of a durable trend. Report concrete changes but explicitly avoid strong trend conclusions.
- Keep executiveSummary focused on current findings; do not mention missing history there.
- Return 3 to 5 genuinely distinct themes only when supported. A theme must normally be evidenced by at least two current repositories; do not turn a single repository into a trend or theme. Put an exceptional single repository under notableRepositories instead. Do not create filler themes to reach three. Keep each theme description concise (roughly 2 to 4 sentences).
- notableRepositories should contain at most 4 genuinely noteworthy repositories with evidence-based reasons. Fewer is fine. Do not speculate about why external attention occurred.
- In Emerging mode, focus on newly created repositories, current star counts, languages, topics, and clusters. Do not discuss a missing top period mover or other Trending-only metrics.
- In Keyword mode, the main search is a current relevance landscape. deterministicFacts.keywordRecentSupplement is authoritative for the optional recent-created-repository supplement. Never call a repository recent/new based only on observedAt. Only repositories listed in keywordRecentSupplement.repositories are known from this run to match the selected creation window. Do not describe the whole dataset as being from that timeframe.
- If there are no previous matching snapshots, make longitudinal.summary brief and return an empty longitudinal.signals array.
- Each longitudinal signal must be an object with string fields "signal" and "detail" and must state an observed comparison, not an invented explanation.

Return JSON with keys executiveSummary (string), themes (array of {title, description}), notableRepositories (array of {repository, reason}), and longitudinal (object with summary and signals array).

Research configuration:
${JSON.stringify(config)}

Deterministic facts (authoritative):
${JSON.stringify(deterministicFacts)}

Current repositories:
${JSON.stringify(current)}

Previous runs:
${JSON.stringify(history)}` }] });
    return this.llm.parseJsonResponse<Record<string, unknown>>(response.content);
  }
}
