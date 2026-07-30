import { patchIntegrationsConfig, readIntegrationsConfig } from '../configStore.js';

/**
 * Bridge to an existing Storybook (local dev server or hosted static build).
 *
 * A built Storybook exposes exactly one reliable machine-readable surface:
 * the story index — `/index.json` on Storybook 7/8 (v4/v5 index format) or
 * `/stories.json` on v6 (v3 format). It lists every story's id, title
 * (component path), name, importPath, and tags. It does NOT expose
 * props/argTypes statically — those exist only at runtime inside the preview
 * iframe or via opt-in docgen builds. We therefore index components from the
 * story list and hand the AI the `importPath`, which (for a Storybook built
 * from the repo the agent works in) points at the real source file — richer
 * context than any docgen output.
 *
 * All fetches happen server-side: static Storybook hosts rarely send CORS
 * headers, so the browser cannot read the index directly.
 */

export type StorybookComponent = {
  /** Stable slug derived from the title path. */
  id: string;
  /** Last segment of the title path, e.g. "Button". */
  title: string;
  /** Full title path as authored in stories, e.g. "Components/Button". */
  path: string;
  storyIds: string[];
  storyNames: string[];
  /** Repo-relative source path when the Storybook exposes it. */
  importPath?: string;
  tags: string[];
};

export type StorybookSummary = {
  id: 'storybook';
  label: 'Storybook';
  /** No admin/env configuration is required — connecting happens in-product. */
  configured: true;
  status: 'connected' | 'not-connected' | 'error';
  url?: string;
  componentCount?: number;
  /** Epoch ms of the last successful index. */
  lastIndexedAt?: number;
  error?: string;
  /**
   * A human name for the connected design system, IF the Storybook exposes
   * one. Opportunistic, never guaranteed: neither the story index nor any
   * other Storybook endpoint carries a project name — the only candidate is
   * the manager UI's `<title>`, and that is only non-generic when a team has
   * explicitly set `theme.brandTitle`. Verified against three real
   * instances (a local build, IBM's hosted Carbon Design System, and
   * Storybook's own Chromatic-hosted docs): two of three, including Carbon,
   * never customize it. So this is a bonus label, never the identifier of
   * record — `url` is what's guaranteed correct and must always be shown.
   */
  projectTitle?: string;
  /**
   * Storybook version, when detectable. Exact (e.g. "8.4.2") when the build
   * exposes `project.json`'s `storybookVersion` field; otherwise a coarse
   * generation label ("6", "7", "8 or newer") inferred from the story
   * index's own format version — still useful for "is this even a Storybook
   * we understand" without overclaiming precision we don't have.
   */
  versionLabel?: string;
};

type V3Index = {
  v?: number;
  stories: Record<
    string,
    { id: string; title: string; name: string; importPath?: string; tags?: string[]; parameters?: { docsOnly?: boolean } }
  >;
};

type V4Index = {
  v: number;
  entries: Record<
    string,
    { id: string; title: string; name: string; importPath?: string; type?: 'story' | 'docs'; tags?: string[] }
  >;
};

type IndexEntry = {
  id: string;
  title: string;
  name: string;
  importPath?: string;
  isDocs: boolean;
  tags: string[];
};

const FETCH_TIMEOUT_MS = 10_000;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'component'
  );
}

/**
 * Accepts bare hosts ("localhost:6006"), adds a scheme, strips a trailing
 * `/index.html` (Storybook's static-build entry file — the index lives at
 * the same base path), drops any trailing slash/query/hash, and preserves a
 * real subpath (e.g. "storybook.company.com/design-system"). Throws on
 * genuinely malformed input. Always reconstructs from a parsed `URL`, so the
 * result is a clean, canonical base regardless of what punctuation the user
 * pasted around it.
 */
export function normalizeStorybookUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter your Storybook URL first.');
  const looksLocal = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(trimmed);
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `${looksLocal ? 'http' : 'https'}://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`"${trimmed}" isn't a valid URL.`);
  }
  const path = parsed.pathname.replace(/\/?index\.html?$/i, '').replace(/\/+$/, '');
  return `${parsed.origin}${path}`;
}

/**
 * Why a probe failed, so callers can show a specific, honest reason instead
 * of one generic error. `network`/`timeout` mean nothing answered at all —
 * the URL itself may be fine. `http`/`not-json` mean something DID answer,
 * just not with a Storybook index — a real, valid, unrelated website reads
 * as this too (verified: example.com and bbc.co.uk both 404 text/html here).
 */
type ProbeFailureKind = 'network' | 'timeout' | 'http' | 'not-json';

class ProbeError extends Error {
  constructor(
    public kind: ProbeFailureKind,
    message: string,
  ) {
    super(message);
  }
}

async function probeJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ProbeError('timeout', 'Timed out waiting for a response.');
    }
    throw new ProbeError('network', err instanceof Error ? err.message : 'Network error.');
  }
  if (!response.ok) throw new ProbeError('http', `HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new ProbeError('not-json', 'Response was not JSON.');
  }
}

function parseIndex(raw: unknown): IndexEntry[] {
  if (raw && typeof raw === 'object' && 'entries' in raw) {
    const v4 = raw as V4Index;
    return Object.values(v4.entries).map((entry) => ({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      importPath: entry.importPath,
      isDocs: entry.type === 'docs',
      tags: entry.tags ?? [],
    }));
  }
  if (raw && typeof raw === 'object' && 'stories' in raw) {
    const v3 = raw as V3Index;
    return Object.values(v3.stories).map((entry) => ({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      importPath: entry.importPath,
      isDocs: Boolean(entry.parameters?.docsOnly),
      tags: entry.tags ?? [],
    }));
  }
  throw new Error('Response is not a Storybook story index.');
}

function groupIntoComponents(entries: IndexEntry[]): StorybookComponent[] {
  const byTitle = new Map<string, IndexEntry[]>();
  for (const entry of entries) {
    const list = byTitle.get(entry.title) ?? [];
    list.push(entry);
    byTitle.set(entry.title, list);
  }
  const components: StorybookComponent[] = [];
  for (const [titlePath, group] of byTitle) {
    const stories = group.filter((entry) => !entry.isDocs);
    const docs = group.filter((entry) => entry.isDocs);
    // Prefer real stories for preview/ordering; docs-only components still index.
    const ordered = [...stories, ...docs];
    const segments = titlePath.split('/');
    components.push({
      id: slugify(titlePath),
      title: segments[segments.length - 1] || titlePath,
      path: titlePath,
      storyIds: ordered.map((entry) => entry.id),
      storyNames: stories.map((entry) => entry.name),
      importPath: group.find((entry) => entry.importPath)?.importPath,
      tags: [...new Set(group.flatMap((entry) => entry.tags))],
    });
  }
  components.sort((a, b) => a.path.localeCompare(b.path));
  return components;
}

const HTML_TITLE_PATTERN = /<title>([^<]*)<\/title>/i;
// Storybook's own default brandTitle, verbatim or as the "{title} - Storybook"
// suffix pattern — both observed on real, unbranded instances (including
// IBM's Carbon Design System). Neither identifies a project; discard both.
const GENERIC_TITLE_PATTERN = /^storybook(\s*-\s*storybook)?$/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/**
 * Best-effort, non-blocking: fetches the manager UI's `<title>` and returns
 * it only when it's not Storybook's generic default. Any failure (network,
 * missing tag, timeout) resolves to undefined rather than throwing — a
 * missing name must never block or fail a connect/refresh.
 */
async function fetchProjectTitle(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    const html = await response.text();
    const match = HTML_TITLE_PATTERN.exec(html);
    const raw = match?.[1] ? decodeHtmlEntities(match[1]).trim() : '';
    if (!raw || GENERIC_TITLE_PATTERN.test(raw)) return undefined;
    // Strip a trailing " - Storybook" suffix when the prefix IS custom, e.g.
    // "@storybook/cli - Storybook" → "@storybook/cli".
    return raw.replace(/\s*-\s*storybook$/i, '').trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Best-effort, non-blocking: Storybook's dev/build telemetry endpoint
 * (verified present on all three real instances tested — local, Carbon,
 * Chromatic) exposes the exact installed version when available. Some
 * static builds may omit it; that's fine, `detectVersionLabel` falls back.
 */
async function fetchExactVersion(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${url}/project.json`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { storybookVersion?: unknown };
    return typeof data.storybookVersion === 'string' && data.storybookVersion.trim() ? data.storybookVersion : undefined;
  } catch {
    return undefined;
  }
}

/** See `StorybookSummary.versionLabel` for what "exact" vs "coarse" means here. */
function detectVersionLabel(indexVersion: number | undefined, exact: string | undefined): string | undefined {
  if (exact) return exact;
  if (indexVersion === 5) return '8 or newer';
  if (indexVersion === 4) return '7';
  if (indexVersion === 3) return '6';
  return undefined;
}

type StorybookIndexResult = { components: StorybookComponent[]; indexVersion: number | undefined };

/**
 * Fetches and parses the story index, throwing a message that names the
 * SPECIFIC failure rather than one generic error — the same URL fetch can
 * fail for meaningfully different reasons a user needs to act on
 * differently: nothing answered at all (network/timeout) vs. something
 * answered but it isn't a Storybook (a real, valid, unrelated website — the
 * 404s from example.com and bbc.co.uk both land here) vs. it answered with
 * JSON that isn't a story index shape we recognize (unsupported/future
 * format) vs. a valid, empty index.
 */
async function fetchStorybookIndex(url: string): Promise<StorybookIndexResult> {
  let indexError: ProbeError | undefined;
  let raw: unknown;
  try {
    raw = await probeJson(`${url}/index.json`);
  } catch (err) {
    indexError = err instanceof ProbeError ? err : new ProbeError('network', 'Unknown error.');
    try {
      raw = await probeJson(`${url}/stories.json`);
    } catch (storiesErr) {
      const storiesError = storiesErr instanceof ProbeError ? storiesErr : new ProbeError('network', 'Unknown error.');
      // Reachability trumps content-shape issues when picking which failure to explain.
      const primary = indexError.kind === 'network' || indexError.kind === 'timeout' ? indexError : storiesError;
      if (primary.kind === 'network' || primary.kind === 'timeout') {
        throw new Error(`We couldn't reach a server at ${url}. Check the address and try again.`);
      }
      throw new Error(
        `We reached ${url}, but couldn't find a Storybook there — it doesn't serve /index.json or /stories.json.`,
      );
    }
  }

  let entries: IndexEntry[];
  try {
    entries = parseIndex(raw);
  } catch {
    throw new Error(
      `We found something at ${url}, but it isn't a Storybook index format we recognize. It may be running an unsupported version.`,
    );
  }
  const components = groupIntoComponents(entries);
  if (components.length === 0) {
    throw new Error('The Storybook index was readable but contains no stories.');
  }
  const indexVersion = raw && typeof raw === 'object' && 'v' in raw ? (raw as { v?: number }).v : undefined;
  return { components, indexVersion };
}

export class StorybookIntegration {
  private url: string | null = null;
  private components: StorybookComponent[] = [];
  private lastIndexedAt: number | null = null;
  private lastError: string | null = null;
  private projectTitle: string | undefined = undefined;
  private versionLabel: string | undefined = undefined;

  /** Restores a previously connected Storybook at boot. Index failures degrade to an error status, never crash startup. */
  async initFromConfig(): Promise<void> {
    const config = await readIntegrationsConfig();
    const url = config.storybook?.url;
    if (!url) return;
    this.url = url;
    try {
      await this.index();
      console.log(`[integrations] storybook connected (${this.components.length} components from ${url})`);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not index the Storybook.';
      console.warn(`[integrations] storybook configured but not reachable: ${this.lastError}`);
    }
  }

  /** Validate-before-store: the URL is only persisted after a successful index. */
  async connect(rawUrl: string): Promise<StorybookSummary> {
    const url = normalizeStorybookUrl(rawUrl);
    // Independent fetches — a project-title/version miss must never fail the
    // connect that the component index succeeded at.
    const [{ components, indexVersion }, projectTitle, exactVersion] = await Promise.all([
      fetchStorybookIndex(url),
      fetchProjectTitle(url),
      fetchExactVersion(url),
    ]);
    this.url = url;
    this.components = components;
    this.projectTitle = projectTitle;
    this.versionLabel = detectVersionLabel(indexVersion, exactVersion);
    this.lastIndexedAt = Date.now();
    this.lastError = null;
    await patchIntegrationsConfig({ storybook: { url } });
    return this.summary();
  }

  async refresh(): Promise<StorybookSummary> {
    if (!this.url) throw new Error('Storybook is not connected.');
    try {
      const [{ components, indexVersion }, projectTitle, exactVersion] = await Promise.all([
        fetchStorybookIndex(this.url),
        fetchProjectTitle(this.url),
        fetchExactVersion(this.url),
      ]);
      this.components = components;
      this.projectTitle = projectTitle;
      this.versionLabel = detectVersionLabel(indexVersion, exactVersion);
      this.lastIndexedAt = Date.now();
      this.lastError = null;
    } catch (error) {
      // Keep serving the last good index; surface the failure in status.
      this.lastError = error instanceof Error ? error.message : 'Could not re-index the Storybook.';
      throw error;
    }
    return this.summary();
  }

  async disconnect(): Promise<void> {
    this.url = null;
    this.components = [];
    this.lastIndexedAt = null;
    this.lastError = null;
    this.projectTitle = undefined;
    this.versionLabel = undefined;
    await patchIntegrationsConfig({ storybook: undefined });
  }

  private async index(): Promise<void> {
    if (!this.url) return;
    const [{ components, indexVersion }, projectTitle, exactVersion] = await Promise.all([
      fetchStorybookIndex(this.url),
      fetchProjectTitle(this.url),
      fetchExactVersion(this.url),
    ]);
    this.components = components;
    this.projectTitle = projectTitle;
    this.versionLabel = detectVersionLabel(indexVersion, exactVersion);
    this.lastIndexedAt = Date.now();
    this.lastError = null;
  }

  summary(): StorybookSummary {
    if (!this.url) {
      return { id: 'storybook', label: 'Storybook', configured: true, status: 'not-connected' };
    }
    return {
      id: 'storybook',
      label: 'Storybook',
      configured: true,
      status: this.lastError ? 'error' : 'connected',
      url: this.url,
      componentCount: this.components.length,
      ...(this.lastIndexedAt && { lastIndexedAt: this.lastIndexedAt }),
      ...(this.lastError && { error: this.lastError }),
      ...(this.projectTitle && { projectTitle: this.projectTitle }),
      ...(this.versionLabel && { versionLabel: this.versionLabel }),
    };
  }

  searchComponents(query?: string): StorybookComponent[] {
    const q = query?.trim().toLowerCase() ?? '';
    if (!q) return this.components;
    return this.components.filter(
      (component) =>
        component.title.toLowerCase().includes(q) ||
        component.path.toLowerCase().includes(q) ||
        component.importPath?.toLowerCase().includes(q),
    );
  }
}
