import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Local supervisor for the agent-orchestrator process.
 *
 * A browser page cannot spawn or kill OS processes — that's a hard sandbox
 * boundary, not a design choice. So "the frontend restarts the backend"
 * actually means: a small always-on local process (this one) owns the real
 * child process, and the frontend asks *it* to restart, over HTTP, on a
 * fixed local port. This is the same pattern Docker Desktop's UI uses to
 * talk to its local daemon, or Vite's HMR client uses to talk to its dev
 * server — a localhost-only control plane, no different in kind from the
 * dev servers this repo already runs.
 *
 * Run via `npm run dev` (starts this + the web app) instead of running
 * `dev:agent` by hand. `dev:agent` still exists for direct/manual debugging.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const agentPackageDir = path.join(repoRoot, 'apps/agent-orchestrator');
const agentEntry = path.join(agentPackageDir, 'src/server.ts');
const tsxBin = path.join(repoRoot, 'node_modules/.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const port = Number.parseInt(process.env.LAUNCHER_PORT || '4321', 10);
const MAX_LOG_LINES = 300;
const READY_GRACE_MS = 1500;

type AgentState = 'starting' | 'running' | 'crashed' | 'stopped';

let child: ChildProcess | null = null;
let state: AgentState = 'stopped';
let startedAt: number | null = null;
let lastExitCode: number | null = null;
let lastExitSignal: string | null = null;
let logLines: string[] = [];

function pushLog(chunk: Buffer): void {
  const text = chunk.toString();
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    logLines.push(line);
  }
  if (logLines.length > MAX_LOG_LINES) logLines = logLines.slice(-MAX_LOG_LINES);
}

/**
 * Kills every process in `proc`'s group, not just `proc` itself.
 *
 * Spawning tsx directly (instead of going through `npm run serve`) avoids
 * one layer of wrapper-process indirection, but tsx's own `node_modules/.bin`
 * shim turned out to be a second one: on this machine it re-execs into a
 * fresh PID, so `spawn()`'s returned PID was the shim, not the process that
 * actually bound port 8787. Killing only that PID silently orphaned the real
 * server — it kept running and kept the port, so a "restart" looked
 * successful while actually leaving the crashed instance's replacement
 * unable to bind. `detached: true` below makes the spawned process its own
 * group leader; killing the *negative* PID sends the signal to the whole
 * group, which reaches the shim and whatever it re-exec'd into.
 */
function killProcessGroup(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGKILL');
  } catch {
    // Group already gone (process exited on its own) — nothing to clean up.
  }
}

function startAgent(): void {
  if (child) {
    child.removeAllListeners();
    killProcessGroup(child);
  }

  state = 'starting';
  startedAt = Date.now();
  lastExitCode = null;
  lastExitSignal = null;
  logLines = [];

  const proc = spawn(tsxBin, [agentEntry], {
    cwd: agentPackageDir,
    env: process.env,
    detached: true,
  });
  child = proc;

  proc.stdout?.on('data', pushLog);
  proc.stderr?.on('data', pushLog);

  // The agent server doesn't signal readiness back to us, and we don't want
  // to guess by parsing its stdout. This just clears the transient
  // "starting" flicker; the frontend confirms *real* readiness itself by
  // polling GET /api/agent/health directly.
  setTimeout(() => {
    if (child === proc && state === 'starting') state = 'running';
  }, READY_GRACE_MS);

  proc.on('exit', (code, signal) => {
    if (child !== proc) return; // superseded by a newer restart; ignore the old process's exit
    state = 'crashed';
    lastExitCode = code;
    lastExitSignal = signal;
    child = null;
  });

  proc.on('error', (err) => {
    if (child !== proc) return;
    pushLog(Buffer.from(`[launcher] failed to start: ${err.message}`));
    state = 'crashed';
    child = null;
  });
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function withCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

const server = createServer((req, res) => {
  withCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    sendJson(res, 200, {
      state,
      pid: child?.pid ?? null,
      startedAt,
      lastExitCode,
      lastExitSignal,
      logsTail: logLines.slice(-40),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/restart') {
    startAgent();
    sendJson(res, 202, { state });
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[launcher] listening on http://127.0.0.1:${port} — supervising the agent-orchestrator`);
  startAgent();
});

function shutdown(): void {
  if (child) killProcessGroup(child);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
