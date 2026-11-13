import type { ResearchResult } from '../tracker.types';

function download(contents: string, type: string, filename: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsJson(result: ResearchResult) {
  download(JSON.stringify(result, null, 2), 'application/json', 'github-research-report.json');
}

export function exportAsMarkdown(result: ResearchResult) {
  const { report, repositories, plan, generatedAt, sourceUrl, sourceUrls } = result;
  const githubSources = sourceUrls?.length ? sourceUrls : sourceUrl ? [sourceUrl] : [];
  const lines = [
    '# GitHub Research report', '',
    `- **Mode:** ${plan.mode}`,
    `- **Generated:** ${new Date(generatedAt).toLocaleString()}`,
    `- **Repositories analyzed:** ${repositories.length}`,
    ...githubSources.map((url, index) => `- **GitHub source${githubSources.length > 1 ? ` ${index + 1}` : ''}:** ${url}`),
    '', '## Summary', '', report.executiveSummary, '',
  ];
  if (report.attentionSignals?.length) {
    lines.push('## Standout GitHub signals', '');
    for (const signal of report.attentionSignals) lines.push(`- **[${signal.repository}](${signal.url})**. ${signal.message}`);
    lines.push('');
  }
  if (report.repositoryClusters?.length) {
    lines.push('## Recurring repository name clusters', '');
    for (const cluster of report.repositoryClusters) lines.push(`- **${cluster.term}**. Found in ${cluster.count} repository names: ${cluster.repositories.join(', ')}. This does not establish a shared cause or wider adoption.`);
    lines.push('');
  }
  if (report.themes?.length) {
    lines.push('## Themes', '');
    for (const theme of report.themes) {
      lines.push(`### ${theme.title}`, '', theme.description, '');
      for (const evidence of theme.evidence ?? []) lines.push(`- **${evidence.repository}**. “${evidence.quote}”`);
      if (theme.evidence?.length) lines.push('');
    }
  }
  if (report.notableRepositories?.length) {
    lines.push('## Notable repositories', '');
    for (const item of report.notableRepositories) lines.push(`- **${item.repository}**. ${item.reason}`);
    lines.push('');
  }
  if (report.longitudinal?.signals?.length) {
    lines.push('## Historical comparison', '', report.longitudinal.summary, '');
    for (const item of report.longitudinal.signals) lines.push(`- **${item.signal}**. ${item.detail}`);
    lines.push('');
  }
  const repositoryColumns = [
    { label: 'Repository', align: '---', value: (repo: (typeof repositories)[number]) => `[${repo.owner}/${repo.name}](${repo.url})` },
    { label: 'Description', align: '---', value: (repo: (typeof repositories)[number]) => repo.description ?? '' },
    { label: 'Language', align: '---', value: (repo: (typeof repositories)[number]) => repo.language ?? '' },
    ...(repositories.some((repo) => repo.topics?.length) ? [
      { label: 'Topics', align: '---', value: (repo: (typeof repositories)[number]) => repo.topics?.join(', ') ?? '' },
    ] : []),
    ...(repositories.some((repo) => typeof repo.stars === 'number') ? [
      { label: 'Stars', align: '---:', value: (repo: (typeof repositories)[number]) => repo.stars ?? '' },
    ] : []),
    ...(plan.mode === 'trending' && repositories.some((repo) => typeof repo.periodStars === 'number') ? [
      { label: 'Period stars', align: '---:', value: (repo: (typeof repositories)[number]) => repo.periodStars ?? '' },
    ] : []),
    ...(repositories.some((repo) => typeof repo.forks === 'number') ? [
      { label: 'Forks', align: '---:', value: (repo: (typeof repositories)[number]) => repo.forks ?? '' },
    ] : []),
  ];

  lines.push(
    '## Repositories',
    '',
    `| ${repositoryColumns.map((column) => column.label).join(' | ')} |`,
    `| ${repositoryColumns.map((column) => column.align).join(' | ')} |`,
  );
  for (const repo of repositories) {
    lines.push(`| ${repositoryColumns.map((column) => String(column.value(repo)).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ')} |`);
  }
  download(lines.join('\n'), 'text/markdown', 'github-research-report.md');
}
