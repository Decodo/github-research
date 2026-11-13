import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Local, per-installation credential storage. The key is not stored in MongoDB,
 * committed to Git, or returned by the settings API. The backend is designed
 * to be accessed locally or behind authentication when self-hosted.
 */
@Injectable()
export class WebDataKeyStore {
  private get directory(): string {
    return resolve(process.env.GITHUB_RESEARCH_DATA_DIR || join(process.cwd(), '.local'));
  }

  private get keyFile(): string {
    return join(this.directory, 'web-data-api-key');
  }

  async read(): Promise<string | null> {
    try {
      const value = (await readFile(this.keyFile, 'utf8')).trim();
      return value || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(key: string): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporaryFile = `${this.keyFile}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporaryFile, key, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await rename(temporaryFile, this.keyFile);
      await chmod(this.keyFile, 0o600);
    } finally {
      await rm(temporaryFile, { force: true });
    }
  }

  async clear(): Promise<void> {
    await rm(this.keyFile, { force: true });
  }
}
