#!/usr/bin/env node
/**
 * Starts PostgREST + AI stack for local `npm start`:
 *   db, api (3000), ai-vision, gateway (8000).
 * Without `gateway` on :8000, Vite logs ECONNREFUSED for /gateway/* (browser may show 500).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const composeArgs = [
  'compose',
  '-f',
  'docker-compose.yml',
  'up',
  '-d',
  'db',
  'api',
  'ai-vision',
  'gateway',
];

const backends = ['docker', 'podman'];
for (const cmd of backends) {
  const r = spawnSync(cmd, composeArgs, { stdio: 'inherit', cwd });
  if (r.error && r.error.code === 'ENOENT') continue;
  if (r.status === 0) {
    console.log(`
Started db, api, ai-vision, gateway. Wait until ai-vision is healthy, then:
  curl -sS http://127.0.0.1:8000/health
  npm start
`);
    process.exit(0);
  }
}

console.error(`
Could not start db, api, ai-vision, and gateway with Docker or Podman Compose.

Fix Docker (Ubuntu):  sudo systemctl start docker
Then from the frontend directory:  npm run dev:backend

If port 8000 is already in use on the host, stop the other process or set in .env:
  VIGILANT_GATEWAY_PROXY=http://127.0.0.1:<other-port>
and publish that port from the gateway service in docker-compose.yml.
`);
process.exit(1);
