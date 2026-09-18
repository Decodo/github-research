import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from 'class-validator';
export class CreateMonitorDto {
  @IsString() @MinLength(2) name: string;
  @IsIn(['trending', 'emerging', 'keyword']) mode: 'trending'|'emerging'|'keyword';
  @ValidateIf((o) => o.mode === 'keyword') @IsString() keyword?: string;
  @IsOptional() @IsIn(['daily','weekly','monthly','1d','7d','30d','90d','any']) timeframe?: any;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() spokenLanguage?: string;
  @IsOptional() @IsInt() @Min(0) minStars?: number;
  @IsOptional() @IsInt() @Min(0) minForks?: number;
  @IsOptional() @IsBoolean() excludeForks?: boolean;
  @IsIn(['custom-hours','daily','weekly','monthly']) cadence: 'custom-hours'|'daily'|'weekly'|'monthly';
  @IsOptional() @IsInt() @Min(1) @Max(720) intervalHours?: number;
}
