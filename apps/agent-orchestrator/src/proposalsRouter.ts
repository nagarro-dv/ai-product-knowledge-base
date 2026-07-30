import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, copyFile, readdir, readFile, rm, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import type { WorkspaceRepository } from './workspace/WorkspaceRepository.js';

/**
 * `/api/agent/proposals/*` — the staging → preview → apply lifecycle for
 * generated directions.
 *
 * Generation (see prompts.ts) writes each direction's modified files, plus a
 * `Preview.tsx` harness, under a per-run staging directory inside the web
 * app's own source tree so Vite can serve it live in dev:
 *
 *   apps/web/src/accelerator/.generated/{runId}/{directionId}/real/{repo-relative path}
 *   apps/web/src/accelerator/.generated/{runId}/{directionId}/Preview.tsx
 *
 * The model only writes the file(s) it actually changed — Preview.tsx's
 * transitive imports (e.g. sibling components it didn't touch) are NOT
 * staged by generation. `prepare` fills those in so the preview iframe's
 * dynamic import resolves; `promote` copies exactly the direction's declared
 * changes onto the real, connected repository; `discard` cleans up a run
 * that was never chosen.
 */
export class ProposalsRouter {
  private readonly generatedRoot: string;

  constructor(
    private readonly repoRoot: string,
    private readonly repository: WorkspaceRepository,
  ) {
    // Always the DS Starter Kit's own source tree — this is where Vite's dev
    // server root is, regardless of which external repo is connected for
    // writes (see WorkspaceRepository). Previews render this product's own
    // component library; `promote` is the step that targets the connected repo.
    this.generatedRoot = path.join(this.repoRoot, 'apps/web/src/accelerator/.generated');
  }

  /** Best-effort cleanup for staging directories left behind by abandoned runs. */
  async sweepStaleStagingDirs(maxAgeMs = 2 * 60 * 60 * 1000): Promise<void> {
    let entries;
    try {
      entries = await readdir(this.generatedRoot, { withFileTypes: true });
    } catch {
      return; // no .generated directory yet
    }
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(this.generatedRoot, entry.name);
      try {
        const info = await stat(dirPath);
        if (now - info.mtimeMs > maxAgeMs) {
          await rm(dirPath, { recursive: true, force: true });
        }
      } catch {
        // ignore — best effort
      }
    }
  }

  /** Returns true if the request was a proposals route (and has been answered). */
  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (!pathname.startsWith('/api/agent/proposals/')) return false;

    const prepareMatch = /^\/api\/agent\/proposals\/([^/]+)\/prepare$/.exec(pathname);
    const promoteMatch = /^\/api\/agent\/proposals\/([^/]+)\/promote$/.exec(pathname);
    const discardMatch = /^\/api\/agent\/proposals\/([^/]+)\/discard$/.exec(pathname);

    try {
      if (method === 'POST' && prepareMatch) {
        await this.fillSiblingGaps(decodeURIComponent(prepareMatch[1]));
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (method === 'POST' && promoteMatch) {
        const runId = decodeURIComponent(promoteMatch[1]);
        const body = await readJsonBody<{ directionId?: string; affectedFiles?: string[] }>(req);
        const directionId = body.directionId?.trim();
        const affectedFiles = Array.isArray(body.affectedFiles) ? body.affectedFiles : [];
        if (!directionId || affectedFiles.length === 0) {
          sendJson(res, 400, { error: 'Provide directionId and at least one affected file.' });
          return true;
        }
        const result = await this.promote(runId, directionId, affectedFiles);
        sendJson(res, 200, result);
        return true;
      }

      if (method === 'POST' && discardMatch) {
        const runId = decodeURIComponent(discardMatch[1]);
        await rm(path.join(this.generatedRoot, runId), { recursive: true, force: true }).catch(() => {});
        sendJson(res, 200, { ok: true });
        return true;
      }

      sendJson(res, 404, { error: 'Unknown proposals route.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected proposals error.';
      sendJson(res, 404, { error: message });
      return true;
    }
  }

  /**
   * Copies each of the direction's declared `affectedFiles` (repo-relative
   * paths) from its staged `real/` copy onto the connected repository, then
   * deletes the whole run's staging directory — the sibling files copied in
   * by `prepare` only ever existed to satisfy the preview's imports and must
   * never be written back.
   */
  private async promote(
    runId: string,
    directionId: string,
    affectedFiles: string[],
  ): Promise<{ promotedFiles: string[]; branch: string | null }> {
    for (const relPath of affectedFiles) {
      assertSafeRelativePath(relPath);
    }

    const directionFolder = await this.resolveDirectionFolder(runId, directionId);
    const { path: destRoot, branch } = await this.repository.prepareForWrite(runId, directionId);
    const stagedReal = path.join(this.generatedRoot, runId, directionFolder, 'real');

    const promotedFiles: string[] = [];
    for (const relPath of affectedFiles) {
      const src = path.join(stagedReal, relPath);
      const dest = path.join(destRoot, relPath);
      try {
        await stat(src);
      } catch {
        throw new Error(`Not found: staged file for '${relPath}' is missing — this run may have already been applied or discarded.`);
      }
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      promotedFiles.push(relPath);
    }

    await rm(path.join(this.generatedRoot, runId), { recursive: true, force: true }).catch(() => {});
    return { promotedFiles, branch };
  }

  /**
   * Staging folders are always named `direction-{letter}` (see the staging
   * convention in prompts.ts), but the direction's own self-reported `id` in
   * the model's "Directions JSON" output is a separate field the model fills
   * in from a schema example — a model that emits the bare letter (`"a"`)
   * instead of the full folder name (`"direction-a"`) would otherwise send a
   * directionId that doesn't match any real folder, and every affected file
   * would 404. Accept either form rather than depending entirely on the
   * model matching the convention exactly.
   */
  private async resolveDirectionFolder(runId: string, directionId: string): Promise<string> {
    const runDir = path.join(this.generatedRoot, runId);
    const candidates = [directionId, ...(directionId.startsWith('direction-') ? [] : [`direction-${directionId}`])];
    for (const candidate of candidates) {
      try {
        const info = await stat(path.join(runDir, candidate));
        if (info.isDirectory()) return candidate;
      } catch {
        // try next candidate
      }
    }
    throw new Error(`Not found: no staged direction matching '${directionId}' for this run — it may have already been applied or discarded.`);
  }

  /**
   * Scans every staged file in each direction of a run for relative imports
   * that don't resolve within the staging directory, and copies the missing
   * file in unmodified from the DS Starter Kit's own source tree. Repeats
   * until a full pass copies nothing new, since a newly-copied file can
   * itself import further siblings.
   */
  private async fillSiblingGaps(runId: string): Promise<void> {
    const runDir = path.join(this.generatedRoot, runId);
    let directionEntries;
    try {
      directionEntries = (await readdir(runDir, { withFileTypes: true })).filter((entry: Dirent) => entry.isDirectory());
    } catch {
      return; // nothing staged for this run
    }

    for (const direction of directionEntries) {
      const realRoot = path.join(runDir, direction.name, 'real');
      await this.fillDirectionSiblings(realRoot);
    }
  }

  private async fillDirectionSiblings(realRoot: string): Promise<void> {
    const MAX_PASSES = 8;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const files = await listFilesRecursive(realRoot).catch(() => [] as string[]);
      let copiedAny = false;

      for (const file of files) {
        if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
        const source = await readFile(file, 'utf8').catch(() => '');
        for (const spec of extractRelativeImportSpecifiers(source)) {
          const alreadyStaged = await resolveExisting(path.dirname(file), spec);
          if (alreadyStaged) continue;

          // Staging mirrors the repo layout under real/, so the same relative
          // spec, resolved from the staged file's repo-relative directory,
          // points at the real source file to copy in.
          const relDir = path.relative(realRoot, path.dirname(file));
          const targetRelSpec = path.normalize(path.join(relDir, spec));
          const copyFrom = await resolveExisting(this.repoRoot, targetRelSpec);
          if (!copyFrom) continue; // genuinely doesn't exist anywhere — leave for the preview to report

          const copyRelToRepo = path.relative(this.repoRoot, copyFrom);
          const dest = path.join(realRoot, copyRelToRepo);
          try {
            await stat(dest);
            continue; // already copied in an earlier pass
          } catch {
            // not yet staged — copy it in
          }
          await mkdir(path.dirname(dest), { recursive: true });
          await copyFile(copyFrom, dest);
          copiedAny = true;
        }
      }

      if (!copiedAny) return;
    }
  }
}

/** Rejects absolute paths and `..` traversal — affected/staged file paths must stay repo-relative. */
function assertSafeRelativePath(relPath: string): void {
  const normalized = path.normalize(relPath);
  if (path.isAbsolute(normalized) || normalized.split(path.sep).includes('..')) {
    throw new Error(`Invalid file path: '${relPath}'.`);
  }
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(full)));
    } else {
      results.push(full);
    }
  }
  return results;
}

const IMPORT_FROM_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["'](\.[^"']+)["']/g;

/** Relative import/export specifiers only (`./X`, `../X`) — package imports are left alone. */
function extractRelativeImportSpecifiers(source: string): string[] {
  const specs = new Set<string>();
  for (const match of source.matchAll(IMPORT_FROM_RE)) {
    specs.add(match[1]);
  }
  return [...specs];
}

const KNOWN_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);
const CANDIDATE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.css'];

/**
 * Resolves a relative import spec against a base directory, trying common
 * extensions. Returns the absolute path if found.
 *
 * `path.extname` is not a reliable "does this spec already have an
 * extension" check on its own: it treats the last dot in ANY filename
 * segment as an extension, so a genuinely extension-less spec like
 * `./typography.types` (a real source file, `typography.types.ts`) reports
 * `.types` — a real content dot, not a file extension. Only treat the spec
 * as already-complete when its trailing segment matches a KNOWN extension;
 * otherwise try appending each candidate extension, exactly as for a
 * spec with no dot at all.
 */
async function resolveExisting(baseDir: string, spec: string, overrideBase?: string): Promise<string | null> {
  const resolvedBase = path.resolve(overrideBase ?? baseDir, spec);
  const ext = path.extname(spec);
  const hasKnownExtension = KNOWN_EXTENSIONS.has(ext);
  const candidates = hasKnownExtension ? [resolvedBase] : CANDIDATE_EXTENSIONS.map((candidateExt) => `${resolvedBase}${candidateExt}`);
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}
