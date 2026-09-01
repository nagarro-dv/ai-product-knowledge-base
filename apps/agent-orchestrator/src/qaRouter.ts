import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

type QaFinding = {
  criterionId: string;
  status: 'pass' | 'fail' | 'warning' | 'not-applicable' | 'needs-review';
  verifiedBy: 'automated';
  evidence: string;
  detail: string;
};

const HEX_COLOR = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/;
const INLINE_STYLE = /\bstyle=\{\{|\bstyle="/;

/**
 * /api/agent/qa/static — the mechanically-checkable half of QA mode that
 * doesn't need a live DOM (see previewFrameEntry.tsx / QaPreviewFrame.tsx
 * for the ones that do). Reads the REAL files the QA job reported reading —
 * never a staged copy, so this reflects the repo as it actually is right
 * now — and greps them for the two static criteria in the baseline catalog:
 * hardcoded colour values instead of design-system tokens, and stray inline
 * style attributes.
 */
export class QaRouter {
  constructor(private readonly resolveCwd: () => Promise<string>) {}

  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (pathname !== '/api/agent/qa/static') return false;
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return true;
    }

    try {
      const body = await readJsonBody<{ files?: unknown; criteriaIds?: unknown }>(req);
      const files = Array.isArray(body.files) ? body.files.filter((v): v is string => typeof v === 'string') : [];
      const criteriaIds = new Set(
        Array.isArray(body.criteriaIds) ? body.criteriaIds.filter((v): v is string => typeof v === 'string') : [],
      );
      const runToken = criteriaIds.has('ds.token-usage');
      const runInline = criteriaIds.has('code.inline-style-leakage');
      if ((!runToken && !runInline) || files.length === 0) {
        sendJson(res, 200, { findings: [] });
        return true;
      }

      const cwd = path.resolve(await this.resolveCwd());
      const tokenHits: string[] = [];
      const inlineHits: string[] = [];

      for (const relPath of files) {
        const absPath = path.resolve(cwd, relPath);
        // Never read outside the resolved repo root, however the path arrived.
        if (!absPath.startsWith(cwd + path.sep) && absPath !== cwd) continue;
        let content: string;
        try {
          content = await readFile(absPath, 'utf8');
        } catch {
          continue;
        }
        content.split('\n').forEach((line, index) => {
          if (runToken && HEX_COLOR.test(line) && !line.includes('--ds-') && !line.trim().startsWith('//')) {
            tokenHits.push(`${relPath}:${index + 1}`);
          }
          if (runInline && INLINE_STYLE.test(line)) {
            inlineHits.push(`${relPath}:${index + 1}`);
          }
        });
      }

      const findings: QaFinding[] = [];
      if (runToken) {
        findings.push(
          tokenHits.length > 0
            ? {
                criterionId: 'ds.token-usage',
                status: 'fail',
                verifiedBy: 'automated',
                evidence: tokenHits.slice(0, 3).join(', '),
                detail: `${tokenHits.length} hardcoded colour value(s) found instead of design-system tokens.`,
              }
            : {
                criterionId: 'ds.token-usage',
                status: 'pass',
                verifiedBy: 'automated',
                evidence: '',
                detail: 'No hardcoded colour values found.',
              },
        );
      }
      if (runInline) {
        findings.push(
          inlineHits.length > 0
            ? {
                criterionId: 'code.inline-style-leakage',
                status: 'warning',
                verifiedBy: 'automated',
                evidence: inlineHits.slice(0, 3).join(', '),
                detail: `${inlineHits.length} inline style attribute(s) found.`,
              }
            : {
                criterionId: 'code.inline-style-leakage',
                status: 'pass',
                verifiedBy: 'automated',
                evidence: '',
                detail: 'No inline style attributes found.',
              },
        );
      }

      sendJson(res, 200, { findings });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid request.' });
    }
    return true;
  }
}
