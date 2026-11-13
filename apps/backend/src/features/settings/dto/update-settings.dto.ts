import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['claude', 'openai', 'gemini'])
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  webDataApiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearWebDataApiKey?: boolean;
}
