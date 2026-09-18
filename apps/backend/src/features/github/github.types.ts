export type ResearchMode = 'trending' | 'emerging' | 'keyword';
export type TrendingPeriod = 'daily' | 'weekly' | 'monthly';

export interface RepositorySnapshot {
  owner: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  topics?: string[];
  stars?: number;
  forks?: number;
  periodStars?: number;
  updatedAt?: string;
  observedAt: string;
}

export interface ResearchConfig {
  mode: ResearchMode;
  keyword?: string;
  timeframe?: TrendingPeriod | '1d' | '7d' | '30d' | '90d' | 'any';
  language?: string;
  spokenLanguage?: string;
  minStars?: number;
  minForks?: number;
  excludeForks?: boolean;
}
