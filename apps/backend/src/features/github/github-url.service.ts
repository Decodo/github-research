import { Injectable } from '@nestjs/common';
import type { ResearchConfig } from './github.types';

@Injectable()
export class GithubUrlService {
  buildKeywordRecent(config: ResearchConfig): string | undefined {
    if (config.mode !== 'keyword' || !config.keyword?.trim() || !config.timeframe || config.timeframe === 'any') return undefined;
    const days = config.timeframe === '90d' ? 90 : config.timeframe === '30d' ? 30 : 7;
    const date = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const terms = [config.keyword.trim(), `created:>${date}`];
    if (config.minStars !== undefined) terms.push(`stars:>=${config.minStars}`);
    if (config.language) terms.push(`language:${JSON.stringify(config.language)}`);
    terms.push('fork:false');
    return `https://github.com/search?${new URLSearchParams({ q: terms.join(' '), type: 'repositories' }).toString()}`;
  }

  build(config: ResearchConfig): string {
    if (config.mode === 'trending') {
      const language = config.language ? `/${encodeURIComponent(config.language.toLowerCase())}` : '';
      const params = new URLSearchParams();
      params.set('since', config.timeframe === 'weekly' || config.timeframe === 'monthly' ? config.timeframe : 'daily');
      if (config.spokenLanguage) params.set('spoken_language_code', config.spokenLanguage);
      return `https://github.com/trending${language}?${params.toString()}`;
    }

    const terms: string[] = [];
    if (config.mode === 'keyword' && config.keyword?.trim()) terms.push(config.keyword.trim());
    if (config.mode === 'emerging') {
      const days = config.timeframe === '30d' ? 30 : config.timeframe === '1d' ? 1 : 7;
      const date = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      terms.push(`created:>${date}`);
    }
    if (config.minStars !== undefined) terms.push(`stars:>=${config.minStars}`);
    if (config.minForks !== undefined) terms.push(`forks:>=${config.minForks}`);
    if (config.language) terms.push(`language:${JSON.stringify(config.language)}`);
    if (config.excludeForks !== false) terms.push('fork:false');

    const params = new URLSearchParams({ q: terms.join(' '), type: 'repositories' });
    return `https://github.com/search?${params.toString()}`;
  }
}
