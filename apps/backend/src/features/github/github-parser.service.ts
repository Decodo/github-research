import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { RepositorySnapshot } from './github.types';

const number = (value: string): number | undefined => {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const match = cleaned.match(/([\d.]+)\s*([kmb])?\b/i);
  if (!match) return undefined;
  const base = Number(match[1]);
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[
    (match[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'
  ] ?? 1;
  const result = base * multiplier;
  return Number.isFinite(result) ? Math.round(result) : undefined;
};
const clean = (value: string): string => value.replace(/\s+/g, ' ').trim();

@Injectable()
export class GithubParserService {
  parseTrending(html: string): RepositorySnapshot[] {
    const $ = cheerio.load(html);
    const observedAt = new Date().toISOString();
    return $('article.Box-row').map((_, element) => {
      const root = $(element);
      const href = root.find('h2 a').attr('href') ?? '';
      const [owner, name] = href.replace(/^\//, '').split('/');
      const starLink = root.find('a[href$="/stargazers"]').first();
      const forkLink = root.find('a[href$="/forks"]').first();
      const periodText = clean(root.find('span.d-inline-block.float-sm-right').text());
      return {
        owner,
        name,
        url: `https://github.com/${owner}/${name}`,
        description: clean(root.find('p').first().text()) || undefined,
        language: clean(root.find('[itemprop="programmingLanguage"]').text()) || undefined,
        stars: number(starLink.text()),
        forks: number(forkLink.text()),
        periodStars: number(periodText),
        observedAt,
      } satisfies RepositorySnapshot;
    }).get().filter((repo) => repo.owner && repo.name);
  }

  parseSearch(html: string): RepositorySnapshot[] {
    const $ = cheerio.load(html);
    const script = $('script[type="application/json"][data-target="react-app.embeddedData"]').first().text();
    if (!script) throw new ServiceUnavailableException('GitHub search response did not contain embedded repository data.');
    let payload: unknown;
    try { payload = JSON.parse(script); } catch { throw new ServiceUnavailableException('Could not parse GitHub embedded search data.'); }
    const root = payload as Record<string, any>;
    const route = root?.payload?.blackbirdSearchRoute ?? root?.blackbirdSearchRoute ?? root?.payload;
    const results: unknown[] = Array.isArray(route?.results) ? route.results : [];
    const observedAt = new Date().toISOString();

    return results.map((raw) => {
      const item = raw as Record<string, any>;
      const repo = item.repo ?? item.repository ?? {};
      const htmlName = cheerio.load(`<div>${String(item.hl_name ?? '')}</div>`)('div').text();
      const owner = repo.owner_login ?? item.owner_login ?? htmlName.split('/')[0];
      const name = repo.name ?? htmlName.split('/').pop();
      const description = cheerio.load(`<div>${String(item.hl_trunc_description ?? '')}</div>`)('div').text();
      return {
        owner,
        name,
        url: `https://github.com/${owner}/${name}`,
        description: clean(description) || undefined,
        language: typeof item.language === 'string' ? item.language : undefined,
        topics: Array.isArray(item.topics) ? item.topics.filter((v: unknown): v is string => typeof v === 'string') : [],
        stars: typeof item.followers === 'number' ? item.followers : undefined,
        forks: typeof item.fork_count === 'number' ? item.fork_count : undefined,
        createdAt: repo.created_at || undefined,
        updatedAt: repo.updated_at || undefined,
        observedAt,
      } satisfies RepositorySnapshot;
    }).filter((repo) => repo.owner && repo.name);
  }

  /** Only fill metadata missing from search/trending; preserve authoritative trending period stars. */
  enrichFromRepositoryPage(snapshot: RepositorySnapshot, html: string): RepositorySnapshot {
    const $ = cheerio.load(html);
    const topics = [...new Set($('a[href^="/topics/"]').map((_, el) => {
      const href = $(el).attr('href') ?? '';
      return href.match(/^\/topics\/([a-zA-Z0-9_.-]+)\/?$/)?.[1] ?? '';
    }).get().filter(Boolean))].slice(0, 15);
    const descriptionMeta = $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ?? '';
    const description = descriptionMeta.includes(': ')
      ? descriptionMeta.slice(descriptionMeta.indexOf(': ') + 2)
      : descriptionMeta;
    const starCounter = $('#repo-stars-counter-star');
    const forkCounter = $('#repo-network-counter, [data-testid="repo-forks-counter"]').first();
    const forkCount = number(forkCounter.attr('title') ?? forkCounter.text()) ??
      $('a[href$="/forks"]').toArray()
        .map((el) => {
          const link = $(el);
          return number(link.attr('aria-label') ?? '') ?? number(link.text());
        })
        .find((value) => value !== undefined);
    const improvedDescription = clean(description);
    const currentDescription = snapshot.description ?? '';
    const needsFullDescription = /(?:…|\.\.\.)$/.test(currentDescription.trim());

    return {
      ...snapshot,
      description: (needsFullDescription && improvedDescription.length > currentDescription.length ? improvedDescription : currentDescription) || improvedDescription || undefined,
      topics: snapshot.topics?.length ? snapshot.topics : topics,
      stars: snapshot.stars ?? number(starCounter.attr('title') ?? starCounter.text()),
      forks: snapshot.forks ?? forkCount,
    };
  }
}
