import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
export class RunResearchDto {
  @IsIn(['trending', 'emerging', 'keyword']) mode: 'trending' | 'emerging' | 'keyword';
  @ValidateIf((o) => o.mode === 'keyword') @IsString() keyword?: string;
  @IsOptional() @IsIn(['daily', 'weekly', 'monthly', '1d', '7d', '30d', '90d', 'any']) timeframe?: any;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() spokenLanguage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) minStars?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) minForks?: number;
  @IsOptional() @IsBoolean() excludeForks?: boolean;
  @IsOptional() @IsString() monitorId?: string;
}
