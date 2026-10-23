/*
 * The hosted site's Jira Product Discovery routes, as a Netlify Function —
 * the same /api/product-discovery/* the local agent server answers, so the
 * web app calls them the same way in both places. All the Jira logic lives
 * in apps/agent-orchestrator/src/productDiscovery.ts.
 *
 * Configured by JPD_SITE, JPD_EMAIL, JPD_API_TOKEN and JPD_PROJECT_KEY in the
 * Netlify site's environment variables. The token stays on Netlify; the
 * browser never sees it.
 */
import { ProductDiscoveryClient, jpdConfigFrom } from "../../apps/agent-orchestrator/src/productDiscovery";

// Kept across warm invocations, so the idea-field lookup is cached between requests.
const client = new ProductDiscoveryClient();

const json = ({ status, body }: { status: number; body: unknown }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async (request: Request): Promise<Response> => {
  const config = jpdConfigFrom((key) => process.env[key]);
  const { pathname } = new URL(request.url);

  if (request.method === "GET" && pathname === "/api/product-discovery/status") {
    return json(await client.status(config));
  }
  if (request.method === "POST" && pathname === "/api/product-discovery/ideas") {
    let input;
    try {
      input = await request.json();
    } catch {
      return json({ status: 400, body: { error: "Invalid JSON body." } });
    }
    return json(await client.createIdea(config, input));
  }
  return json({ status: 404, body: { error: "Not found." } });
};

export const config = {
  path: ["/api/product-discovery/status", "/api/product-discovery/ideas"],
};
