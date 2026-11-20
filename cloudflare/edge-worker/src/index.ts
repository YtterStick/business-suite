export interface Env {
  FILES_BUCKET: R2Bucket;
  RENDER_ORIGIN: string;
  CRON_SECRET?: string;
}

const SAFE_INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function isValidObjectKey(key: string): boolean {
  if (!key || key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
    return false;
  }
  return !key.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function buildContentDisposition(key: string, contentType: string): string {
  if (SAFE_INLINE_TYPES.has(contentType)) {
    return "inline";
  }
  const rawName = key.split("/").pop() || "download";
  const safeName = rawName.replace(/["\\\r\n]/g, "_").slice(0, 120) || "download";
  return `attachment; filename="${safeName}"`;
}

function isR2ObjectBody(obj: R2Object | R2ObjectBody): obj is R2ObjectBody {
  return "body" in obj && obj.body !== null;
}

async function pingRenderHealth(origin: string): Promise<void> {
  const res = await fetch(`${origin}/api/health`, {
    method: "GET",
    headers: { "User-Agent": "Tactiq-Edge-KeepAlive/1.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[tactiq-edge] Health ping failed: ${res.status} ${res.statusText}`);
  }
}

async function triggerDailyCleanup(origin: string, secret: string): Promise<void> {
  const res = await fetch(`${origin}/api/cron/cleanup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "User-Agent": "Tactiq-Edge-Cron/1.0",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[tactiq-edge] Daily cleanup failed: ${res.status} ${res.statusText}`);
  }
}

const worker: ExportedHandler<Env> = {
  async scheduled(controller, env, ctx) {
    const origin = env.RENDER_ORIGIN.replace(/\/+$/, "");
    const tasks: Array<Promise<void>> = [pingRenderHealth(origin)];

    if (controller.cron === "0 3 * * *" && env.CRON_SECRET?.trim()) {
      tasks.push(triggerDailyCleanup(origin, env.CRON_SECRET.trim()));
    }

    ctx.waitUntil(Promise.all(tasks));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/edge/health") {
      return Response.json(
        {
          ok: true,
          edge: "cloudflare-worker",
          timestamp: new Date().toISOString(),
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (!url.pathname.startsWith("/files/")) {
      return Response.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } },
      );
    }

    let key: string;
    try {
      key = decodeURIComponent(url.pathname.slice("/files/".length));
    } catch {
      return Response.json(
        { error: "Invalid file path" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!isValidObjectKey(key)) {
      return Response.json(
        { error: "Invalid file key" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cacheStorage = caches as unknown as { default?: Cache };
    const edgeCache = cacheStorage.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });

    if (edgeCache) {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        if (request.method === "HEAD") {
          return new Response(null, { status: cached.status, headers: cached.headers });
        }
        return cached;
      }
    }

    const r2Object =
      request.method === "HEAD"
        ? await env.FILES_BUCKET.head(key)
        : await env.FILES_BUCKET.get(key);

    if (!r2Object) {
      return Response.json(
        { error: "File not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === r2Object.httpEtag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: r2Object.httpEtag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const contentType = r2Object.httpMetadata?.contentType || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("ETag", r2Object.httpEtag);
    headers.set("Content-Length", String(r2Object.size));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", buildContentDisposition(key, contentType));

    if (request.method === "HEAD" || !isR2ObjectBody(r2Object)) {
      return new Response(null, { status: 200, headers });
    }

    const response = new Response(r2Object.body, { status: 200, headers });
    if (edgeCache) {
      ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
    }
    return response;
  },
};

export default worker;
