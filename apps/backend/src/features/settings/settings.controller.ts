import { Controller, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings
   * Returns current config status — key presence only, never actual key values.
   */
  @Get()
  async getStatus() {
    return this.settingsService.getStatus();
  }

  /**
   * PATCH /settings
   * Updates provider/model preferences and optionally the local Web Data API key.
   */
  @Patch()
  @HttpCode(HttpStatus.OK)
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
