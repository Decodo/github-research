import { GithubParserService } from './github-parser.service';
import type { RepositorySnapshot } from './github.types';

describe('GitHub metadata extraction', () => {
  const parser = new GithubParserService();

  it('preserves a trending count expressed with comma separators', () => {
    const repos = parser.parseTrending(`<html><body><article class="Box-row">
      <h2><a href="/morluto/rea">morluto/rea</a></h2>
      <p>Browser exploration tool</p>
      <a href="/morluto/rea/stargazers">243,000</a>
      <a href="/morluto/rea/forks">1,200</a>
      <span class="d-inline-block float-sm-right">229,300 stars this week</span>
    </article></body></html>`);
    expect(repos[0]).toMatchObject({
      owner: 'morluto', name: 'rea', stars: 243000, forks: 1200, periodStars: 229300,
    });
  });

  it('extracts search-page results and metadata without inventing absent fields', () => {
    const payload = JSON.stringify({
      payload: { blackbirdSearchRoute: { results: [{
        repo: { owner_login: 'example', name: 'project' },
        hl_trunc_description: 'A tool for AI agents',
        followers: 540,
      }] } },
    });
    const results = parser.parseSearch(`<html><head>
      <script type="application/json" data-target="react-app.embeddedData">${payload}</script>
    </head></html>`);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      owner: 'example', name: 'project', stars: 540, description: 'A tool for AI agents',
    });
    expect(results[0].forks).toBeUndefined();
  });

  it('enriches missing topics and forks without replacing the trending period metric', () => {
    const input: RepositorySnapshot = {
      owner: 'example', name: 'project', url: 'https://github.com/example/project',
      stars: 1000, periodStars: 120, observedAt: '2026-10-26T12:00:00Z',
    };
    const result = parser.enrichFromRepositoryPage(input, `<html><head>
      <meta property="og:description" content="GitHub - example/project: AI agent configuration skills" />
    </head><body>
      <a href="/topics/ai-agent">ai-agent</a>
      <a href="/topics/developer-tools">developer-tools</a>
      <span id="repo-network-counter" title="2.3k">2.3k</span>
      <span id="repo-stars-counter-star" title="5k">5k</span>
    </body></html>`);
    expect(result).toMatchObject({
      description: 'AI agent configuration skills',
      stars: 1000,
      forks: 2300,
      periodStars: 120,
      topics: ['ai-agent', 'developer-tools'],
    });
  });
  it('uses fork-link fallback, deduplicates topics, and expands truncated descriptions', () => {
    const input: RepositorySnapshot = {
      owner: 'example', name: 'project', url: 'https://github.com/example/project',
      description: 'Read a longer truncated project descript…',
      observedAt: '2026-10-26T12:00:00Z',
    };
    const result = parser.enrichFromRepositoryPage(input, `<html><head>
      <meta property="og:description" content="GitHub - example/project: Read a longer complete project description for AI-agent tooling" />
    </head><body>
      <a href="/topics/security">security</a>
      <a href="/topics/security">security</a>
      <a href="/example/project/forks" aria-label="1,234 forks">Fork</a>
    </body></html>`);
    expect(result.forks).toBe(1234);
    expect(result.topics).toEqual(['security']);
    expect(result.description).toBe('Read a longer complete project description for AI-agent tooling');
  });
});
