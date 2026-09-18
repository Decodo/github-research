export type ResearchMode = 'trending' | 'emerging' | 'keyword';
export type ResearchTimeframe = 'daily' | 'weekly' | 'monthly' | '1d' | '7d' | '30d' | '90d' | 'any';
export type MonitorCadence = 'custom-hours' | 'daily' | 'weekly' | 'monthly';

export interface ResearchConfig {
  mode: ResearchMode;
  keyword?: string;
  timeframe?: ResearchTimeframe;
  language?: string;
  spokenLanguage?: string;
  minStars?: number;
  minForks?: number;
  excludeForks?: boolean;
  monitorId?: string;
}

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

export interface GithubReport {
  executiveSummary: string;
  themes: Array<{ title: string; description: string }>;
  notableRepositories: Array<{ repository: string; reason: string }>;
  longitudinal?: { summary: string; signals: Array<{ signal: string; detail: string }> };
}

export interface ResearchResult {
  id: string;
  generatedAt: string;
  sourceUrl: string;
  sourceUrls?: string[];
  plan: ResearchConfig;
  repositories: RepositorySnapshot[];
  report: GithubReport;
}

export interface StoredQuery {
  _id: string;
  prompt: string;
  plan: ResearchConfig;
  repositories: RepositorySnapshot[];
  report: GithubReport;
  monitorId?: string;
  runType?: 'manual' | 'scheduled' | 'manual-monitor';
  createdAt: string;
}

export interface SavedMonitor {
  _id: string;
  name: string;
  plan: ResearchConfig;
  cadence: MonitorCadence;
  intervalHours?: number;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  lastQueryId?: string;
  lastError?: string;
  currentRunStartedAt?: string;
  createdAt: string;
}
