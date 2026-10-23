/*
 * Jira Product Discovery: sending initiatives to a Product Discovery space as
 * ideas, through the Jira Cloud REST API with an Atlassian API token (basic
 * auth against the *.atlassian.net site). Shared by the local agent server
 * (productDiscoveryRouter.ts) and the hosted site's serverless function
 * (netlify/functions/product-discovery.mts), so both behave the same.
 *
 * Ideas carry more than a title: the app sends field values by display name
 * ("Theme", "Impact", "Roadmap"…) and they're matched to the project's own
 * fields and options, read from Jira's create metadata — so nothing here is
 * tied to one site's custom field ids.
 *
 *   GET  /api/product-discovery/status  → { configured, site?, projectKey?, projectName?, fields?, error? }
 *   POST /api/product-discovery/ideas   { title, description, fields?: [{ name, value }] } → { key, url, set, skipped }
 */

export type JpdConfig = { site: string; email: string; token: string; projectKey: string };

/** A field on the project's idea create screen, as Jira describes it. */
export type IdeaField = { id: string; name: string; type: string; custom: string; allowed: string[] };

/** A field value the app wants set, by the field's display name ("Theme", "Impact"…). */
export type FieldValue = { name: string; value: string | number | string[] };

/** Turns an app value into what Jira's API takes for that field, or explains why it can't. */
function toJiraValue(field: IdeaField, value: FieldValue['value']): { value: unknown } | { skip: string } {
  const pick = (v: string) => field.allowed.find((option) => option.toLowerCase() === v.trim().toLowerCase());
  if (field.id === 'labels') {
    return { value: [value].flat().map((v) => String(v).trim().replace(/\s+/g, '-')).filter(Boolean) };
  }
  if (field.type === 'array' && field.allowed.length) {
    const options = [value].flat().map((v) => pick(String(v)));
    if (options.some((o) => !o)) return { skip: `not one of: ${field.allowed.join(', ')}` };
    return { value: options.map((o) => ({ value: o })) };
  }
  if (field.type === 'option') {
    const option = pick(String(value));
    return option ? { value: { value: option } } : { skip: `not one of: ${field.allowed.join(', ')}` };
  }
  if (field.type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? { value: n } : { skip: 'not a number' };
  }
  if (field.type === 'string') return { value: String(value).slice(0, 255) };
  return { skip: `can't be set (${field.custom || field.type})` };
}

export const PLACEHOLDER_TOKEN = 'paste-your-api-token-here';

/** An Atlassian Document Format node — the rich-text format Jira's v3 API takes for descriptions. */
export type AdfNode = { type: string; content?: AdfNode[]; text?: string; attrs?: Record<string, unknown> };

/**
 * Plain text → ADF: blank lines separate blocks, runs of "• " lines become a
 * bullet list, and other lines in a block are kept as line breaks.
 */
export function textToAdf(text: string): { type: 'doc'; version: 1; content: AdfNode[] } {
  const content: AdfNode[] = [];
  for (const block of text.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((line) => line.trim());
    let paragraph: string[] = [];
    let bullets: string[] = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      content.push({
        type: 'paragraph',
        content: paragraph.flatMap((line, i) => [
          ...(i > 0 ? [{ type: 'hardBreak' }] : []),
          { type: 'text', text: line },
        ]),
      });
      paragraph = [];
    };
    const flushBullets = () => {
      if (!bullets.length) return;
      content.push({
        type: 'bulletList',
        content: bullets.map((item) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
        })),
      });
      bullets = [];
    };
    for (const line of lines) {
      const bullet = /^\s*[•\-*]\s+(.*)$/.exec(line);
      if (bullet) {
        flushParagraph();
        bullets.push(bullet[1]!);
      } else {
        flushBullets();
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    flushBullets();
  }
  return { type: 'doc', version: 1, content };
}

/** A JSON reply: HTTP status and body. */
export type JpdReply = { status: number; body: unknown };

const reply = (status: number, body: unknown): JpdReply => ({ status, body });

/**
 * The four JPD_* settings, read through `read` (process.env, a .env file…).
 * Null until all four are set (and the token isn't the .env.example placeholder).
 */
export function jpdConfigFrom(read: (key: string) => string | undefined): JpdConfig | null {
  const get = (key: string) => (read(key) ?? '').trim();
  const config = {
    site: get('JPD_SITE').replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
    email: get('JPD_EMAIL'),
    token: get('JPD_API_TOKEN'),
    projectKey: get('JPD_PROJECT_KEY'),
  };
  if (!config.site || !config.email || !config.token || config.token === PLACEHOLDER_TOKEN || !config.projectKey) {
    return null;
  }
  return config;
}

/** Talks to one Product Discovery space. Keep one around: it caches the idea fields for a few minutes. */
export class ProductDiscoveryClient {
  /** The idea create screen's fields, cached for a few minutes. */
  private ideaMeta: { at: number; key: string; issueTypeId: string; fields: IdeaField[] } | null = null;

  private async jira(config: JpdConfig, path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`https://${config.site}/rest/api/3${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.email}:${config.token}`).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Which fields an idea in the project can be created with, and the values they allow. */
  private async ideaFields(config: JpdConfig): Promise<{ issueTypeId: string; fields: IdeaField[] }> {
    const key = `${config.site}/${config.projectKey}`;
    if (this.ideaMeta && this.ideaMeta.key === key && Date.now() - this.ideaMeta.at < 5 * 60_000) return this.ideaMeta;
    const project = encodeURIComponent(config.projectKey);
    const typesResponse = await this.jira(config, `/issue/createmeta/${project}/issuetypes`);
    if (!typesResponse.ok) throw new Error(`Couldn't read the project's idea fields (Jira answered ${typesResponse.status}).`);
    const types = (await typesResponse.json()) as { issueTypes?: { id: string; name: string }[] };
    const idea = types.issueTypes?.find((t) => /^idea$/i.test(t.name));
    if (!idea) throw new Error(`${config.projectKey} has no Idea work type — is it a Product Discovery space?`);
    const fieldsResponse = await this.jira(config, `/issue/createmeta/${project}/issuetypes/${idea.id}?maxResults=200`);
    if (!fieldsResponse.ok) throw new Error(`Couldn't read the project's idea fields (Jira answered ${fieldsResponse.status}).`);
    const meta = (await fieldsResponse.json()) as {
      fields?: { fieldId: string; name: string; schema?: { type?: string; custom?: string }; allowedValues?: { value?: string; name?: string }[] }[];
    };
    const fields = (meta.fields ?? []).map((f) => ({
      id: f.fieldId,
      name: f.name,
      type: f.schema?.type ?? '',
      custom: f.schema?.custom?.split(':').pop() ?? '',
      allowed: (f.allowedValues ?? []).flatMap((v) => v.value ?? v.name ?? []),
    }));
    this.ideaMeta = { at: Date.now(), key, issueTypeId: idea.id, fields };
    return this.ideaMeta;
  }

  /** Whether the space is reachable, and which fields its ideas have. */
  async status(config: JpdConfig | null): Promise<JpdReply> {
    if (!config) return reply(200, { configured: false });
    try {
      const response = await this.jira(config, `/project/${encodeURIComponent(config.projectKey)}`);
      if (!response.ok) {
        return reply(200, {
          configured: false,
          site: config.site,
          projectKey: config.projectKey,
          error:
            response.status === 401
              ? 'Jira rejected the email or API token.'
              : response.status === 404
                ? `No project ${config.projectKey} on ${config.site}, or no access to it.`
                : `Jira answered ${response.status}.`,
        });
      }
      const project = (await response.json()) as { name?: string };
      const { fields } = await this.ideaFields(config);
      return reply(200, {
        configured: true,
        site: config.site,
        projectKey: config.projectKey,
        projectName: project.name,
        // The fields ideas there have, so the app only offers what exists.
        fields: fields.map((f) => ({ name: f.name, allowed: f.allowed })),
      });
    } catch (error) {
      return reply(200, { configured: false, error: error instanceof Error ? error.message : 'Could not reach Jira.' });
    }
  }

  /** Creates an idea from an initiative's title, description and field values. */
  async createIdea(
    config: JpdConfig | null,
    input: { title?: string; description?: string; fields?: FieldValue[] },
  ): Promise<JpdReply> {
    if (!config) return reply(400, { error: 'Product Discovery is not set up — add the JPD_* settings.' });
    try {
      const body = input;
      const title = body.title?.trim();
      if (!title) {
        return reply(400, { error: 'An idea needs a title.' });
      }
      const { issueTypeId, fields: ideaFields } = await this.ideaFields(config);
      const base: Record<string, unknown> = {
        project: { key: config.projectKey },
        issuetype: { id: issueTypeId },
        summary: title.slice(0, 255),
        description: textToAdf(body.description ?? ''),
      };
      // Match the app's values to this project's fields by name; anything
      // that doesn't exist or doesn't fit is left out and reported back.
      const extra: Record<string, unknown> = {};
      const set: string[] = [];
      const skipped: { name: string; reason: string }[] = [];
      for (const { name, value } of body.fields ?? []) {
        const field = ideaFields.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
        if (!field) {
          skipped.push({ name, reason: 'no such field on ideas here' });
          continue;
        }
        const converted = toJiraValue(field, value);
        if ('skip' in converted) skipped.push({ name, reason: converted.skip });
        else {
          extra[field.id] = converted.value;
          set.push(field.name);
        }
      }
      const create = (fields: Record<string, unknown>) =>
        this.jira(config, '/issue', { method: 'POST', body: JSON.stringify({ fields }) });

      let response = await create({ ...base, ...extra });
      // If Jira refuses one of the extra fields, still create the idea, without them.
      if (!response.ok && response.status === 400 && set.length) {
        const detail = (await response.json().catch(() => null)) as { errors?: Record<string, string> } | null;
        for (const name of set.splice(0)) skipped.push({ name, reason: Object.values(detail?.errors ?? {}).join(' ') || 'refused by Jira' });
        response = await create(base);
      }
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { errorMessages?: string[]; errors?: Record<string, string> } | null;
        const message = [...(detail?.errorMessages ?? []), ...Object.values(detail?.errors ?? {})].join(' ') || `Jira answered ${response.status}.`;
        return reply(502, { error: message });
      }
      const created = (await response.json()) as { key: string };
      return reply(201, { key: created.key, url: `https://${config.site}/browse/${created.key}`, set, skipped });
    } catch (error) {
      return reply(502, { error: error instanceof Error ? error.message : 'Could not reach Jira.' });
    }
  }
}
