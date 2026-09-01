import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyProjectStandardsState, type ProjectStandardsState } from '@ds-starter/standards';

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Persistence for the project's quality checklist — which criteria are
 * disabled, and any repo-derived criteria the user has accepted or is still
 * reviewing. Plain JSON file, gitignored, mirrors configStore.ts's pattern
 * for integration config. Single flat file: this product connects to one
 * repository at a time, so there's no per-project keying to do yet.
 */
const STORE_PATH = path.join(packageRoot, '.standards.json');

export async function readStandardsState(): Promise<ProjectStandardsState> {
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, 'utf8')) as Partial<ProjectStandardsState>;
    return {
      disabledIds: Array.isArray(raw.disabledIds) ? raw.disabledIds.filter((v): v is string => typeof v === 'string') : [],
      acceptedRepoCriteria: Array.isArray(raw.acceptedRepoCriteria) ? raw.acceptedRepoCriteria : [],
      proposedRepoCriteria: Array.isArray(raw.proposedRepoCriteria) ? raw.proposedRepoCriteria : [],
    };
  } catch {
    return emptyProjectStandardsState();
  }
}

export async function writeStandardsState(state: ProjectStandardsState): Promise<void> {
  await writeFile(STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
}
