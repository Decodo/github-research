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
  if (report.themes?.length) {
    lines.push('## Themes', '');
    for (const theme of report.themes) lines.push(`### ${theme.title}`, '', theme.description, '');
  }
  if (report.longitudinal?.signals?.length) lines.push('## Historical comparison', '', report.longitudinal.summary, '');
  const repositoryColumns = [
    { label: 'Repository', align: '---', value: (repo: (typeof repositories)[number]) => `[${repo.owner}/${repo.name}](${repo.url})` },
    { label: 'Language', align: '---', value: (repo: (typeof repositories)[number]) => repo.language ?? '' },
    { label: 'Stars', align: '---:', value: (repo: (typeof repositories)[number]) => repo.stars ?? '' },
    ...(plan.mode === 'trending'
      ? [
          { label: 'Period stars', align: '---:', value: (repo: (typeof repositories)[number]) => repo.periodStars ?? '' },
          { label: 'Forks', align: '---:', value: (repo: (typeof repositories)[number]) => repo.forks ?? '' },
        ]
      : []),
  ];

  lines.push(
    '## Repositories',
    '',
    `| ${repositoryColumns.map((column) => column.label).join(' | ')} |`,
    `| ${repositoryColumns.map((column) => column.align).join(' | ')} |`,
  );
  for (const repo of repositories) {
    lines.push(`| ${repositoryColumns.map((column) => column.value(repo)).join(' | ')} |`);
  }
  download(lines.join('\n'), 'text/markdown', 'github-research-report.md');
}
