import type { IncomingMessage, ServerResponse } from 'node:http';
import { BASELINE_CRITERIA, resolveCriteria } from '@ds-starter/standards';
import { readStandardsState, writeStandardsState } from './standards/standardsStore.js';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * /api/standards — the project's quality checklist. Ships the baseline
 * catalog by default (see packages/standards) plus whatever repo-derived
 * criteria have been accepted, with live enabled flags resolved against the
 * persisted disabled-id list. A locked criterion can never be disabled here,
 * even if a client sends its id — enforced server-side, not just in the UI.
 */
export class StandardsRouter {
  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (pathname !== '/api/standards') return false;

    if (method === 'GET') {
      const state = await readStandardsState();
      sendJson(res, 200, { criteria: resolveCriteria(state), proposedRepoCriteria: state.proposedRepoCriteria });
      return true;
    }

    if (method === 'PUT') {
      try {
        const body = await readJsonBody<{ disabledIds?: unknown }>(req);
        const requested = Array.isArray(body.disabledIds)
          ? body.disabledIds.filter((v): v is string => typeof v === 'string')
          : [];
        const state = await readStandardsState();
        const lockedIds = new Set(
          [...BASELINE_CRITERIA, ...state.acceptedRepoCriteria].filter((c) => c.locked).map((c) => c.id),
        );
        const next = { ...state, disabledIds: requested.filter((id) => !lockedIds.has(id)) };
        await writeStandardsState(next);
        sendJson(res, 200, { criteria: resolveCriteria(next), proposedRepoCriteria: next.proposedRepoCriteria });
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid request.' });
      }
      return true;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
    return true;
  }
}
