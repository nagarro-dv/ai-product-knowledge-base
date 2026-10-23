import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { ProductDiscoveryClient, jpdConfigFrom, type JpdReply } from './productDiscovery.js';

function sendJson(res: ServerResponse, { status, body }: JpdReply) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
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
 * `/api/product-discovery/*` on the local agent server — see
 * productDiscovery.ts for what it does.
 *
 * The JPD_* settings come from .env, re-read on every request, so pasting a
 * token takes effect without restarting. The token never leaves this server.
 */
export class ProductDiscoveryRouter {
  private readonly client = new ProductDiscoveryClient();

  constructor(private readonly envPaths: string[]) {}

  private async config() {
    const values: Record<string, string | undefined> = {};
    for (const file of this.envPaths) {
      try {
        const parsed = dotenv.parse(await readFile(file, 'utf8'));
        for (const [k, v] of Object.entries(parsed)) values[k] ??= v;
      } catch {
        // no file — fine
      }
    }
    return jpdConfigFrom((key) => values[key] ?? process.env[key]);
  }

  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (method === 'GET' && pathname === '/api/product-discovery/status') {
      sendJson(res, await this.client.status(await this.config()));
      return true;
    }
    if (method === 'POST' && pathname === '/api/product-discovery/ideas') {
      let input;
      try {
        input = await readJsonBody<{ title?: string; description?: string; fields?: { name: string; value: string | number | string[] }[] }>(req);
      } catch {
        sendJson(res, { status: 400, body: { error: 'Invalid JSON body.' } });
        return true;
      }
      sendJson(res, await this.client.createIdea(await this.config(), input));
      return true;
    }
    return false;
  }
}
