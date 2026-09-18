import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { RepositorySnapshot } from './github.types';

const number = (value: string): number | undefined => {
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
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
      const starLink = root.find(`a[href$="/stargazers"]`).first();
      const forkLink = root.find(`a[href$="/forks"]`).first();
      const periodText = clean(root.find('span.d-inline-block.float-sm-right').text());
      return {
        owner,
        name,
        url: `https://github.com/${owner}/${name}`,
        description: clean(root.find('p').first().text()) || undefined,
        language: clean(root.find('[itemprop="programmingLanguage"]').text()) || undefined,
        stars: number(starLink.text()),
        forks: number(forkLink.text()),
        periodStars: number(periodText.match(/[\d,]+/)?.[0] ?? ''),
        observedAt,
      } satisfies RepositorySnapshot;
    }).get().filter((repo) => repo.owner && repo.name);
  }

  parseSearch(html: string): RepositorySnapshot[] {
    const $ = cheerio.load(html);
    const script = $('script[type="application/json"][data-target="react-app.embeddedData"]').first().text();
    if (!script) throw new ServiceUnavailableException('GitHub search response did not contain embedded repository data.');
    let payload: any;
    try { payload = JSON.parse(script); } catch { throw new ServiceUnavailableException('Could not parse GitHub embedded search data.'); }
    const route = payload?.payload?.blackbirdSearchRoute ?? payload?.blackbirdSearchRoute ?? payload?.payload;
    const results: any[] = route?.results ?? [];
    const observedAt = new Date().toISOString();
    return results.map((item) => {
      const repo = item.repo ?? item.repository ?? {};
      const owner = repo.owner_login ?? item.owner_login ?? String(item.hl_name ?? '').split('/')[0];
      const name = repo.name ?? String(item.hl_name ?? '').replace(/<[^>]+>/g, '').split('/').pop();
      return {
        owner,
        name,
        url: `https://github.com/${owner}/${name}`,
        description: clean(String(item.hl_trunc_description ?? '').replace(/<[^>]+>/g, '')) || undefined,
        language: item.language || undefined,
        topics: Array.isArray(item.topics) ? item.topics : [],
        // GitHub's Blackbird repository payload currently calls the stargazer count "followers".
        stars: typeof item.followers === 'number' ? item.followers : undefined,
        updatedAt: repo.updated_at || undefined,
        observedAt,
      } satisfies RepositorySnapshot;
    }).filter((repo) => repo.owner && repo.name);
  }
}
