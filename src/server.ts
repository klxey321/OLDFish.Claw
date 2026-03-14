import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { buildLocalSummary } from "./services/local-summary";
import { buildMasterSummary } from "./services/master-summary";
import type { AppConfig } from "./types";
import { loadInstances } from "./runtime/instances";
import { renderEdgePage, renderMasterPage } from "./ui/render";

export function startServer(config: AppConfig) {
  const server = createServer(async (req, res) => {
    try {
      await routeRequest(req, res, config);
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "internal error",
      });
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(`[oldfish] ${config.role} listening`, {
      host: config.host,
      port: config.port,
      instanceId: config.instanceId,
      nodeName: config.nodeName,
    });
  });

  return server;
}

async function routeRequest(req: IncomingMessage, res: ServerResponse, config: AppConfig): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  if (method !== "GET") {
    writeJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/healthz") {
    writeJson(res, 200, {
      ok: true,
      role: config.role,
      instanceId: config.instanceId,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (!authorize(req, config)) {
      writeJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
  }

  if (url.pathname === "/api/instance-summary") {
    writeJson(res, 200, await buildLocalSummary(config));
    return;
  }

  if (url.pathname === "/api/master-summary") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    writeJson(res, 200, await buildMasterSummary(config));
    return;
  }

  if (url.pathname === "/api/instances") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const instances = await loadInstances(config.instancesPath);
    writeJson(res, 200, instances.map(({ authTokenEnvKey, ...rest }) => rest));
    return;
  }

  if (url.pathname === "/") {
    if (config.role === "master") {
      const summary = await buildMasterSummary(config);
      writeHtml(res, 200, renderMasterPage(summary, config));
      return;
    }

    const summary = await buildLocalSummary(config);
    writeHtml(res, 200, renderEdgePage(summary));
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

function authorize(req: IncomingMessage, config: AppConfig): boolean {
  if (!config.localTokenAuthRequired) return true;
  if (config.localApiToken === "") return true;

  const headerToken = req.headers["x-local-token"];
  if (typeof headerToken === "string" && headerToken.trim() === config.localApiToken) return true;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() === config.localApiToken;
  }

  return false;
}

function writeHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
  });
  res.end(html);
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload, null, 2));
}

