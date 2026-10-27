import { DecodoService } from './decodo.service';
import type { SettingsService } from '../settings/settings.service';

describe('DecodoService', () => {
  const endpoint = 'https://data.decodo.com/v1/scrape';
  const apiKey = 'test-web-data-api-key';
  const githubUrl = 'https://github.com/trending';
  let service: DecodoService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    const settingsService = {
      getEffectiveConfig: jest.fn().mockResolvedValue({
        decodoAuthToken: apiKey,
        decodoScraperEndpoint: endpoint,
      }),
    } as unknown as SettingsService;
    service = new DecodoService(settingsService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the Web Data API endpoint with Bearer authorization and the existing scrape payload', async () => {
    const html = '<!DOCTYPE html><html><body>GitHub</body></html>';
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ results: [{ content: html }] }),
    } as Response);

    await expect(service.scrapeUrl(githubUrl)).resolves.toBe(html);
    expect(fetchSpy).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      signal: undefined,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-integration': 'oss-github-research',
      },
      body: JSON.stringify({
        target: 'universal',
        url: githubUrl,
        proxy_pool: 'premium',
        headless: 'html',
      }),
    });
  });

  it('rejects missing credentials before making a request', async () => {
    const settingsService = {
      getEffectiveConfig: jest.fn().mockResolvedValue({
        decodoAuthToken: '',
        decodoScraperEndpoint: endpoint,
      }),
    } as unknown as SettingsService;
    service = new DecodoService(settingsService);

    await expect(service.scrapeUrl(githubUrl)).rejects.toThrow('DECODO_AUTH_TOKEN must be configured.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
