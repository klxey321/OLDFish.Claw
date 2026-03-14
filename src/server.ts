import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { buildDashboardInsights, loadWorkbenchFileDetail, saveWorkbenchFile } from "./runtime/openclaw-insights";
import { buildLocalSummary } from "./services/local-summary";
import { buildMasterSummary } from "./services/master-summary";
import type { AppConfig, WorkbenchKind } from "./types";
import { loadInstances } from "./runtime/instances";
import { loadWorkItems, stopWorkItem } from "./runtime/work-items";
import { buildStaffViews } from "./services/control-room";
import { renderEdgePage, renderMasterPage, type MasterSection } from "./ui/render";

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

    if (method === "POST") {
      await routeApiPost(req, res, config, url);
      return;
    }

    if (method !== "GET") {
      writeJson(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    await routeApiGet(res, config, url);
    return;
  }

  if (method !== "GET") {
    writeJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  if (config.role === "master" && isMasterSectionRoute(url.pathname)) {
    const [summary, instances, workItems] = await Promise.all([
      buildMasterSummary(config),
      loadInstances(config.instancesPath),
      loadWorkItems(config.workItemsPath),
    ]);
    const staffViews = buildStaffViews(summary, workItems);
    const insights = await buildDashboardInsights(config, workItems, summary.master);
    const section = resolveMasterSection(url.pathname);
    const fileDetail =
      section === "memory" || section === "docs"
        ? await loadSelectedWorkbenchFile(config, section, url.searchParams.get("file"))
        : undefined;

    writeHtml(
      res,
      200,
      renderMasterPage({
        section,
        summary,
        config,
        staffViews,
        workItems,
        instances,
        insights,
        selectedStaffId: url.searchParams.get("node") ?? undefined,
        selectedFile: fileDetail,
        notice: mapNotice(url.searchParams.get("notice")),
      }),
    );
    return;
  }

  if (url.pathname === "/") {
    const summary = await buildLocalSummary(config);
    writeHtml(res, 200, renderEdgePage(summary));
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

async function routeApiGet(res: ServerResponse, config: AppConfig, url: URL): Promise<void> {
  if (url.pathname === "/api/instance-summary") {
    writeJson(res, 200, await buildLocalSummary(config));
    return;
  }

  if (url.pathname === "/api/work-items") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    writeJson(res, 200, await loadWorkItems(config.workItemsPath));
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

  if (url.pathname === "/api/staff") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const [summary, workItems] = await Promise.all([buildMasterSummary(config), loadWorkItems(config.workItemsPath)]);
    writeJson(res, 200, buildStaffViews(summary, workItems));
    return;
  }

  if (url.pathname === "/api/usage" || url.pathname === "/api/agents" || url.pathname === "/api/schedules") {
    const [localSummary, workItems] = await Promise.all([buildLocalSummary(config), loadWorkItems(config.workItemsPath)]);
    const insights = await buildDashboardInsights(config, workItems, localSummary);
    if (url.pathname === "/api/usage") writeJson(res, 200, insights.usage);
    if (url.pathname === "/api/agents") writeJson(res, 200, insights.agents);
    if (url.pathname === "/api/schedules") writeJson(res, 200, insights.schedules);
    return;
  }

  if (url.pathname === "/api/workbench") {
    const kind = normalizeWorkbenchKind(url.searchParams.get("kind") ?? undefined);
    if (!kind) {
      writeJson(res, 400, { ok: false, error: "invalid_kind" });
      return;
    }
    const [localSummary, workItems] = await Promise.all([buildLocalSummary(config), loadWorkItems(config.workItemsPath)]);
    const insights = await buildDashboardInsights(config, workItems, localSummary);
    writeJson(res, 200, kind === "memory" ? insights.memory : insights.docs);
    return;
  }

  if (url.pathname === "/api/workbench-file") {
    const kind = normalizeWorkbenchKind(url.searchParams.get("kind") ?? undefined);
    const relativePath = url.searchParams.get("file")?.trim();
    if (!kind || !relativePath) {
      writeJson(res, 400, { ok: false, error: "invalid_request" });
      return;
    }
    const detail = await loadWorkbenchFileDetail(config, kind, relativePath);
    if (!detail) {
      writeJson(res, 404, { ok: false, error: "file_not_found" });
      return;
    }
    writeJson(res, 200, detail);
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

async function routeApiPost(req: IncomingMessage, res: ServerResponse, config: AppConfig, url: URL): Promise<void> {
  if (url.pathname === "/api/work-items/stop") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    if (!config.taskControlEnabled) {
      writeJson(res, 403, { ok: false, error: "task_control_disabled" });
      return;
    }

    const payload = await readJsonBody(req);
    const workId = typeof payload?.workId === "string" ? payload.workId.trim() : "";
    if (!workId) {
      writeJson(res, 400, { ok: false, error: "missing_work_id" });
      return;
    }

    const item = await stopWorkItem(config.workItemsPath, workId, config.nodeName);
    if (!item) {
      writeJson(res, 404, { ok: false, error: "work_item_not_found" });
      return;
    }

    writeJson(res, 200, { ok: true, item });
    return;
  }

  if (url.pathname === "/api/workbench-file") {
    if (!config.fileEditEnabled) {
      writeJson(res, 403, { ok: false, error: "file_edit_disabled" });
      return;
    }

    const payload = await readJsonBody(req);
    const kind = normalizeWorkbenchKind(typeof payload?.kind === "string" ? payload.kind : undefined);
    const relativePath = typeof payload?.file === "string" ? payload.file.trim() : "";
    const content = typeof payload?.content === "string" ? payload.content : "";

    if (!kind || !relativePath) {
      writeJson(res, 400, { ok: false, error: "invalid_request" });
      return;
    }

    const detail = await saveWorkbenchFile(config, kind, relativePath, content);
    if (!detail) {
      writeJson(res, 404, { ok: false, error: "file_not_found_or_locked" });
      return;
    }

    writeJson(res, 200, { ok: true, detail });
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

async function loadSelectedWorkbenchFile(
  config: AppConfig,
  section: Extract<MasterSection, "memory" | "docs">,
  relativePath: string | null,
) {
  if (!relativePath) return undefined;
  return loadWorkbenchFileDetail(config, section, relativePath);
}

function normalizeWorkbenchKind(input: string | undefined): WorkbenchKind | undefined {
  return input === "memory" || input === "docs" ? input : undefined;
}

function mapNotice(input: string | null): string | undefined {
  if (input === "task-stopped") return "任务已停止，并回写到本地任务清单。";
  if (input === "file-saved") return "文件已保存到 OpenClaw 实际工作目录。";
  return undefined;
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

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
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

function isMasterSectionRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/overview" ||
    pathname === "/usage" ||
    pathname === "/machines" ||
    pathname === "/staff" ||
    pathname === "/memory" ||
    pathname === "/docs" ||
    pathname === "/tasks" ||
    pathname === "/settings"
  );
}

function resolveMasterSection(pathname: string): MasterSection {
  if (pathname === "/usage") return "usage";
  if (pathname === "/machines") return "machines";
  if (pathname === "/staff") return "staff";
  if (pathname === "/memory") return "memory";
  if (pathname === "/docs") return "docs";
  if (pathname === "/tasks") return "tasks";
  if (pathname === "/settings") return "settings";
  return "overview";
}
