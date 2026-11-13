import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Model } from 'mongoose';
import type { ConfigService } from '../../shared/config/config.service';
import { SettingsService } from './settings.service';
import type { SettingsDocument } from './settings.schema';
import { WebDataKeyStore } from './web-data-key.store';

describe('SettingsService Web Data API key', () => {
  const oldDirectory = process.env.GITHUB_RESEARCH_DATA_DIR;
  let directory: string;
  let store: WebDataKeyStore;
  let service: SettingsService;
  const findOneAndUpdate = jest.fn();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'github-research-settings-'));
    process.env.GITHUB_RESEARCH_DATA_DIR = directory;
    store = new WebDataKeyStore();
    findOneAndUpdate.mockClear();
    const model = {
      findOne: () => ({ exec: async () => null }),
      findOneAndUpdate,
    } as unknown as Model<SettingsDocument>;
    const config = {
      llm: { provider: 'claude', model: '', anthropicApiKey: 'llm-secret', openaiApiKey: '', geminiApiKey: '' },
      decodo: { authToken: 'environment-key', scraperEndpoint: 'https://data.decodo.com/v1/scrape' },
    } as unknown as ConfigService;
    service = new SettingsService(model, config, store);
  });

  afterEach(async () => {
    if (oldDirectory === undefined) delete process.env.GITHUB_RESEARCH_DATA_DIR;
    else process.env.GITHUB_RESEARCH_DATA_DIR = oldDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  it('accepts an interface key, gives it precedence and never returns the value in status', async () => {
    const status = await service.update({ webDataApiKey: 'interface-secret' });
    expect(status.decodoKeySource).toBe('interface');
    expect(status.decodoKeySet).toBe(true);
    expect(JSON.stringify(status)).not.toContain('interface-secret');
    expect((await service.getEffectiveConfig()).decodoAuthToken).toBe('interface-secret');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('falls back to the environment key after the saved key is cleared', async () => {
    await service.update({ webDataApiKey: 'interface-secret' });
    const status = await service.update({ clearWebDataApiKey: true });
    expect(status.decodoKeySource).toBe('environment');
    expect((await service.getEffectiveConfig()).decodoAuthToken).toBe('environment-key');
  });

  it('rejects a blank key or simultaneous save and clear', async () => {
    await expect(service.update({ webDataApiKey: '   ' })).rejects.toThrow('cannot be blank');
    await expect(service.update({ webDataApiKey: 'secret', clearWebDataApiKey: true })).rejects.toThrow('same request');
  });
});
