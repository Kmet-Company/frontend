#!/usr/bin/env node
/**
 * Starts Postgres + PostgREST for local `npm start` (proxy -> :3000).
 * Tries `docker compose`, then `podman compose` if Docker fails or is missing.
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
];

const backends = ['docker', 'podman'];
for (const cmd of backends) {
  const r = spawnSync(cmd, composeArgs, { stdio: 'inherit', cwd });
  if (r.error && r.error.code === 'ENOENT') continue;
  if (r.status === 0) process.exit(0);
  // Docker/Podman ran but compose failed — try the other backend if any left.
}

console.error(`
Could not start services "db" and "api" with Docker or Podman Compose.
(For AI gateway on port 8000 as well, use: npm run dev:backend)

Ubuntu docker.io (systemd): if dockerd said
  "no sockets found via socket activation"
then start the SOCKET first, then the daemon (order matters):

  sudo systemctl reset-failed docker.socket docker.service
  sudo systemctl enable --now docker.socket
  sudo systemctl start docker

If the daemon or docker.sock still fails:
  • Permission denied:  sudo usermod -aG docker "$USER"   # then re-login
  • Otherwise:            journalctl -xeu docker.service --no-pager -n 50

Docker Desktop (macOS / Windows): open Docker Desktop until it is running.

Podman alternative:
  sudo apt install podman podman-compose
  npm run dev:db-api

Without containers you must run PostgreSQL and PostgREST on port 3000
(see proxy.conf.js and docker-compose.yml).

Install guide: https://docs.docker.com/engine/install/
`);
process.exit(1);
