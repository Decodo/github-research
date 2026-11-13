#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2];
if (action !== 'up' && action !== 'down') {
  console.error('Usage: bun db:up | bun db:down');
  process.exit(2);
}

const choices = [
  { label: 'Podman Compose', program: 'podman', prefix: ['compose'], engine: 'podman' },
  { label: 'Docker Compose', program: 'docker', prefix: ['compose'], engine: 'docker' },
  { label: 'podman-compose', program: 'podman-compose', prefix: [], engine: 'podman' },
  { label: 'docker-compose', program: 'docker-compose', prefix: [], engine: 'docker' },
];
const configured = (process.env.CONTAINER_RUNTIME || '').toLowerCase();
if (configured && !['docker', 'podman'].includes(configured)) {
  console.error('CONTAINER_RUNTIME must be docker or podman.');
  process.exit(2);
}

function works(program, args) {
  const result = spawnSync(program, args, { cwd: root, stdio: 'ignore' });
  return !result.error && result.status === 0;
}

const selected = choices.find((choice) =>
  (!configured || choice.engine === configured) &&
  choice.prefix.length > 0 &&
  works(choice.engine, ['info']) &&
  works(choice.program, [...choice.prefix, 'version']),
);

// podman-compose/docker-compose are separate executable names; use their
// native engine to check readiness rather than requiring the wrapper to have
// an 'info' subcommand.
const fallback = !selected && choices.find((choice) =>
  (!configured || choice.engine === configured) &&
  choice.prefix.length === 0 &&
  works(choice.engine, ['info']) &&
  works(choice.program, ['version']),
);

const compose = selected || fallback;
if (!compose) {
  console.error(`No running container engine with Compose support was found${configured ? ` for ${configured}` : ''}.`);
  console.error('Start Docker Desktop or the Podman machine, and install Compose support.');
  console.error('Podman Desktop: Settings → Resources → Compose → Setup.');
  process.exit(1);
}

console.log(`Using ${compose.label}`);
const args = [...compose.prefix, action, ...(action === 'up' ? ['-d'] : [])];
const result = spawnSync(compose.program, args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
