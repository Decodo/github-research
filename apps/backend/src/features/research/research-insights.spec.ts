import type { RepositorySnapshot } from '../github/github.types';
import { findAttentionSignals, findRepositoryClusters, validateThemes } from './research-insights';

const repo = (repository: string, description: string, periodStars?: number): RepositorySnapshot => {
  const [owner, name] = repository.split('/');
  return {
    owner, name, url: `https://github.com/${repository}`,
    description, periodStars, observedAt: '2026-10-19T12:00:00Z',
  };
};

describe('grounded GitHub themes', () => {
  const threeD = repo('wesbos/3d-model-anything', 'Capture and reconstruct 3D models with iPhone LiDAR');
  const tv = repo('pengchujin/aerial-tv', 'An ad-free Android TV launcher for a clean home screen');
  const agent1 = repo('cloudflare/security-audit-skill', 'An AI agent skill for security audits');
  const agent2 = repo('another/agent-cli', 'Tools for AI agent coding workflows');

  it('rejects the unrelated 3D model and Android TV launcher pairing', () => {
    expect(validateThemes([{
      title: '3D Model Creation and Exploration',
      description: 'wesbos/3d-model-anything and pengchujin/aerial-tv expand 3D modeling.',
      evidence: [
        { repository: 'wesbos/3d-model-anything', quote: 'reconstruct 3D models' },
        { repository: 'pengchujin/aerial-tv', quote: 'Android TV launcher' },
      ],
    }], [threeD, tv])).toEqual([]);
  });

  it('requires quotes from the supplied repository metadata', () => {
    expect(validateThemes([{
      title: 'AI Agent Tools',
      description: 'cloudflare/security-audit-skill and another/agent-cli work with AI agents.',
      evidence: [
        { repository: 'cloudflare/security-audit-skill', quote: 'AI agent skill' },
        { repository: 'another/agent-cli', quote: 'invented marketing claims about agents' },
      ],
    }], [agent1, agent2])).toEqual([]);
  });

  it('accepts concrete two-repository agent tooling evidence', () => {
    expect(validateThemes([{
      title: 'AI Agent Tooling',
      description: 'cloudflare/security-audit-skill and another/agent-cli support AI agent workflows.',
      evidence: [
        { repository: 'cloudflare/security-audit-skill', quote: 'AI agent skill' },
        { repository: 'another/agent-cli', quote: 'AI agent coding workflows' },
      ],
    }], [agent1, agent2])).toHaveLength(1);
  });
});

describe('exceptional trending growth signals', () => {
  const latest = [
    repo('morluto/rea', 'Analyze browser behavior', 229_300),
    repo('storytold/artcraft', 'Creative authoring tool', 16_400),
    repo('boykopovar/AnyPS5', 'Device tooling', 14_200),
  ];
  const earlier = [{
    date: '2026-10-12T12:00:00Z',
    repositories: [
      repo('morluto/rea', 'Analyze browser behavior', 127_000),
      repo('storytold/artcraft', 'Creative authoring tool', 10_000),
    ],
  }];

  it('flags the October 12 to October 19 REA jump explicitly', () => {
    const signals = findAttentionSignals({ mode: 'trending', timeframe: 'weekly' }, latest, earlier);
    expect(signals).toHaveLength(1);
    expect(signals[0].repository).toBe('morluto/rea');
    expect(signals[0].message).toContain('127,000');
    expect(signals[0].message).toContain('229,300');
    expect(signals[0].message).toContain('+102,300');
    expect(signals[0].message).toContain('14.0×');
    expect(signals[0].message).toContain('do not measure new stars');
  });

  it('flags an outlier even when no historical snapshot exists', () => {
    const signals = findAttentionSignals({ mode: 'trending', timeframe: 'weekly' }, latest, []);
    expect(signals[0].repository).toBe('morluto/rea');
    expect(signals[0].message).toContain('14.0×');
  });

  it('does not infer period movement from emerging total stars', () => {
    expect(findAttentionSignals({ mode: 'emerging', timeframe: '7d' }, latest, earlier)).toEqual([]);
  });

  it('does not alert on modest fluctuations', () => {
    expect(findAttentionSignals({ mode: 'trending', timeframe: 'weekly' }, [
      repo('example/one', 'Example one', 900),
      repo('example/two', 'Example two', 800),
    ], [])).toEqual([]);
  });
});

describe('recurring named repository clusters', () => {
  const entries = [
    repo('ikow/php2shell-poc', 'PHP security PoC'),
    repo('9bie/php2shell-bypass-aslr-exp', 'PHP security exploit'),
    repo('openai/php2shell-checker', 'Check security issues'),
    repo('eness/php2shell-CVE-2026-109618-CVE-2026-109619-PoC', 'Security exploit PoC'),
    repo('assetnote/php2shell-scanner', 'PHP scanner'),
    repo('pengchujin/aerial-tv', 'Android TV launcher'),
    repo('wesbos/3d-model-anything', 'LiDAR 3D model application'),
  ];
  it('detects five related php2shell repository names without an LLM', () => {
    const clusters = findRepositoryClusters(entries);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].term).toBe('php2shell');
    expect(clusters[0].count).toBe(5);
    expect(clusters[0].repositories).toContain('assetnote/php2shell-scanner');
  });

  it('does not fabricate clusters from unrelated names', () => {
    expect(findRepositoryClusters(entries.slice(-2))).toEqual([]);
  });
});
