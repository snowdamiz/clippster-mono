import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const TARGETS = {
  web: {
    cwd: '.',
    config: 'apps/web/fly.toml',
    dockerfile: 'apps/web/Dockerfile',
    ignorefile: 'apps/web/Dockerfile.dockerignore',
    tokenKey: 'FLY_WEB_TOKEN',
    label: 'web app',
    appName: 'clippster-web',
    extraArgs: ['--ha=false']
  },
  server: {
    cwd: 'server',
    tokenKey: 'FLY_SERVER_TOKEN',
    label: 'server',
    appName: 'clippster-server'
  },
  landing: {
    // Monorepo root so packages/app-tour is in the Docker build context
    cwd: '.',
    config: 'landing/fly.toml',
    dockerfile: 'landing/Dockerfile',
    ignorefile: 'landing/Dockerfile.dockerignore',
    tokenKey: 'FLY_LANDING_TOKEN',
    label: 'landing page',
    appName: 'clippster-landing'
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(REPO_ROOT, 'server', '.env');

function parseEnvFile(fileContent) {
  const values = new Map();

  for (const rawLine of fileContent.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) {
      continue;
    }

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    values.set(match[1], value);
  }

  return values;
}

function runDeploy({ cwd, tokenKey, label, appName, config, dockerfile, ignorefile, extraArgs = [] }) {
  const envValues = fs.existsSync(ENV_FILE) ? parseEnvFile(fs.readFileSync(ENV_FILE, 'utf8')) : new Map();
  const flyApiToken = process.env.FLY_USE_LOGIN === '1' ? null : process.env[tokenKey] || process.env.FLY_API_TOKEN || envValues.get(tokenKey);

  const targetCwd = path.join(REPO_ROOT, cwd);
  console.log(`Deploying ${label} to fly.io (${appName})...`);

  // Positional "." keeps build context at monorepo root when cwd is "."
  const args = ['deploy', '.', '--remote-only', ...extraArgs];
  if (config) {
    args.push('--config', config);
  }
  if (dockerfile) args.push('--dockerfile', dockerfile);
  if (ignorefile) args.push('--ignorefile', ignorefile);
  if (appName === 'clippster-web') {
    const revision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    args.push('--build-arg', `APP_REVISION=${revision}`);
  }

  const child = spawn('flyctl', args, {
    cwd: targetCwd,
    env: {
      ...process.env,
      ...(flyApiToken ? { FLY_API_TOKEN: flyApiToken } : {})
    },
    stdio: 'inherit'
  });

  child.on('error', (error) => {
    console.error(`Error: unable to run flyctl (${error.message})`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`flyctl deploy terminated by signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

function main() {
  const target = process.argv[2];
  if (!target || !(target in TARGETS)) {
    console.error('Usage: node scripts/deploy-fly.mjs <server|landing|web>');
    process.exit(1);
  }

  runDeploy(TARGETS[target]);
}

main();
