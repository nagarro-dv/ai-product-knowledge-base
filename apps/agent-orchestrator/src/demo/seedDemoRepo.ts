import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchIntegrationsConfig } from '../integrations/configStore.js';
import { DEMO_SEED_COMPONENT_PATHS } from './fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Where the demo's scratch "connected repository" lives. Gitignored, local
 * to this machine — never the real ds-starter-kit checkout (`repoRoot`),
 * so a demo run's "promote" step can never overwrite real project files.
 */
export const DEMO_REPO_PATH = path.join(packageRoot, '.demo-repo');

/**
 * Idempotently seeds the scratch demo repository with copies of the real
 * Credit Score and Button components (so QA's static checks have real
 * content to grep for either of the two wired demo scenarios — see
 * fixtures.ts's header comment), then points the workspace repository
 * connection at it. Called once at boot when DEMO_MODE is enabled, before
 * IntegrationsRouter.init() reads .integrations.json — see server.ts's
 * bootstrap().
 */
export async function seedDemoRepo(repoRoot: string): Promise<void> {
  for (const seedPath of DEMO_SEED_COMPONENT_PATHS) {
    const dest = path.join(DEMO_REPO_PATH, seedPath);
    await mkdir(path.dirname(dest), { recursive: true });
    try {
      await copyFile(path.join(repoRoot, seedPath), dest);
    } catch (error) {
      console.warn(`[demo] could not seed ${seedPath}: ${error instanceof Error ? error.message : error}`);
    }
  }
  await patchIntegrationsConfig({ repository: { kind: 'local', path: DEMO_REPO_PATH } });
}
