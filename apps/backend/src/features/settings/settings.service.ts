import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '../../shared/config/config.service';
import { Settings, SettingsDocument } from './settings.schema';
import { WebDataKeyStore } from './web-data-key.store';

export interface EffectiveConfig {
  provider: string;
  model: string;
  decodoAuthToken: string;
  decodoScraperEndpoint: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  geminiApiKey: string;
}

export interface SettingsStatus {
  provider: string;
  model: string;
  decodoKeySet: boolean;
  decodoKeySource: 'interface' | 'environment' | 'none';
  anthropicKeySet: boolean;
  openaiKeySet: boolean;
  geminiKeySet: boolean;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
    private readonly configService: ConfigService,
    private readonly webDataKeyStore: WebDataKeyStore,
  ) {}

  async getEffectiveConfig(): Promise<EffectiveConfig> {
    let doc: SettingsDocument | null = null;
    try {
      doc = await this.settingsModel.findOne({ key: 'global' }).exec();
    } catch (err) {
      this.logger.warn(`Failed to read settings from DB: ${String(err)}`);
    }

    const envLlm = this.configService.llm;
    const envDecodo = this.configService.decodo;
    const localKey = await this.webDataKeyStore.read();

    return {
      // Provider and model: DB selection overrides env, env overrides default
      provider: doc?.provider || envLlm.provider || 'claude',
      model: doc?.model || envLlm.model || '',
      // UI-entered key takes precedence. Both sources remain server-side.
      decodoAuthToken: localKey || envDecodo.authToken || '',
      decodoScraperEndpoint: envDecodo.scraperEndpoint || 'https://data.decodo.com/v1/scrape',
      anthropicApiKey: envLlm.anthropicApiKey || '',
      openaiApiKey: envLlm.openaiApiKey || '',
      geminiApiKey: envLlm.geminiApiKey || '',
    };
  }

  async getStatus(): Promise<SettingsStatus> {
    const config = await this.getEffectiveConfig();
    const localKey = await this.webDataKeyStore.read();
    return {
      provider: config.provider,
      model: config.model,
      decodoKeySet: !!config.decodoAuthToken,
      decodoKeySource: localKey ? 'interface' : config.decodoAuthToken ? 'environment' : 'none',
      anthropicKeySet: !!config.anthropicApiKey,
      openaiKeySet: !!config.openaiApiKey,
      geminiKeySet: !!config.geminiApiKey,
    };
  }

  async update(input: {
    provider?: string;
    model?: string;
    webDataApiKey?: string;
    clearWebDataApiKey?: boolean;
  }): Promise<SettingsStatus> {
    if (input.webDataApiKey !== undefined && input.clearWebDataApiKey) {
      throw new BadRequestException('Cannot set and clear the Web Data API key in the same request.');
    }
    if (input.webDataApiKey !== undefined && !input.webDataApiKey.trim()) {
      throw new BadRequestException('Web Data API key cannot be blank. Use Clear saved key instead.');
    }
    const patch: Record<string, string> = {};
    if (input.provider) patch.provider = input.provider;
    // Clear model when provider changes so a stale model from another provider isn't used
    if (input.provider) patch.model = '';
    // Allow explicit model override (empty string resets to provider default)
    if (input.model !== undefined) patch.model = input.model.trim();

    if (Object.keys(patch).length) {
      this.logger.log('[Settings] Updating provider/model preferences');
      await this.settingsModel
        .findOneAndUpdate({ key: 'global' }, { $set: patch }, { upsert: true, new: true })
        .exec();
    }

    if (input.webDataApiKey !== undefined) {
      await this.webDataKeyStore.save(input.webDataApiKey.trim());
    } else if (input.clearWebDataApiKey) {
      await this.webDataKeyStore.clear();
    }

    return this.getStatus();
  }
}
