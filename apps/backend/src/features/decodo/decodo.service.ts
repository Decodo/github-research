import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import type { DecodoScrapeResponse } from './decodo.types';

@Injectable()
export class DecodoService {
  private readonly logger = new Logger(DecodoService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async scrapeUrl(url: string, signal?: AbortSignal): Promise<string> {
    if (!url.startsWith('https://github.com/')) {
      throw new BadRequestException('GitHub Research only accepts github.com URLs.');
    }

    const config = await this.settingsService.getEffectiveConfig();
    if (!config.decodoAuthToken) {
      throw new BadRequestException('DECODO_AUTH_TOKEN must be configured.');
    }

    const response = await fetch(config.decodoScraperEndpoint, {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${config.decodoAuthToken}`,
      },
      body: JSON.stringify({
        target: 'universal',
        url,
        proxy_pool: 'premium',
        headless: 'html',
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ServiceUnavailableException(`Decodo Web Scraping API returned ${response.status}: ${text.slice(0, 300)}`);
    }

    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch { /* Some responses may be raw HTML. */ }
    const html = this.extractHtml(payload);
    if (!html) throw new ServiceUnavailableException('Decodo response did not contain HTML.');

    this.logger.log(`Scraped ${url} via Web Scraping API · ${html.length.toLocaleString()} chars`);
    return html;
  }

  private extractHtml(value: unknown): string | undefined {
    if (typeof value === 'string') return value.includes('<html') || value.includes('<!DOCTYPE') ? value : undefined;
    if (!value || typeof value !== 'object') return undefined;

    const object = value as Record<string, unknown>;
    for (const key of ['content', 'html', 'body', 'result', 'results', 'data']) {
      const candidate = object[key];
      if (typeof candidate === 'string' && (candidate.includes('<html') || candidate.includes('<!DOCTYPE'))) return candidate;
      const nested = this.extractHtml(candidate);
      if (nested) return nested;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.extractHtml(item);
        if (nested) return nested;
      }
    }
    return undefined;
  }
}
