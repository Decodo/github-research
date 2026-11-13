import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebDataKeyStore } from './web-data-key.store';

describe('WebDataKeyStore', () => {
  const originalDirectory = process.env.GITHUB_RESEARCH_DATA_DIR;
  let directory: string;
  let store: WebDataKeyStore;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'github-research-key-'));
    process.env.GITHUB_RESEARCH_DATA_DIR = directory;
    store = new WebDataKeyStore();
  });

  afterEach(async () => {
    if (originalDirectory === undefined) delete process.env.GITHUB_RESEARCH_DATA_DIR;
    else process.env.GITHUB_RESEARCH_DATA_DIR = originalDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  it('returns null before a key has been saved', async () => {
    await expect(store.read()).resolves.toBeNull();
  });

  it('saves and replaces the key in a local file with restrictive permissions', async () => {
    await store.save('secret-1');
    expect(await store.read()).toBe('secret-1');
    await store.save('secret-2');
    expect(await readFile(join(directory, 'web-data-api-key'), 'utf8')).toBe('secret-2');
    if (process.platform !== 'win32') {
      const permissions = (await stat(join(directory, 'web-data-api-key'))).mode & 0o777;
      expect(permissions).toBe(0o600);
    }
  });

  it('clears the saved key without creating another credential', async () => {
    await store.save('secret');
    await store.clear();
    await expect(store.read()).resolves.toBeNull();
  });
});
