import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL, URLSearchParams } from "node:url";
import {
  buildDashboardInsights,
  buildOperationalInsights,
  loadWorkbenchFileDetail,
  loadWorkbenchSnapshot,
  saveWorkbenchFile,
} from "./runtime/openclaw-insights";
import {
  addConfiguredModel,
  loadModelCatalog,
  loadNativeChatAccess,
  setPrimaryModel,
} from "./runtime/openclaw-control";
import {
  clearSessionCookie,
  isAuthEnabled,
  isSecureRequest,
  readSession,
  requireApiAuth,
  requirePageAuth,
  setSessionCookie,
  verifyPassword,
} from "./runtime/auth";
import { buildLocalSummary } from "./services/local-summary";
import { buildMasterSummary } from "./services/master-summary";
import type {
  AppConfig,
  DashboardInsights,
  InstanceConfig,
  InstanceSummary,
  ModelCatalogSnapshot,
  NativeChatAccess,
  OperationalInsights,
  StaffView,
  WorkItem,
  WorkbenchKind,
  WorkbenchSnapshot,
} from "./types";
import { loadInstances } from "./runtime/instances";
import { loadWorkItems, stopWorkItem } from "./runtime/work-items";
import { buildStaffViews } from "./services/control-room";
import { renderEdgePage, renderLoginPage, renderMasterPage, type MasterSection } from "./ui/render";

interface MasterPageState {
  summary: Awaited<ReturnType<typeof buildMasterSummary>>;
  instances: InstanceConfig[];
  workItems: WorkItem[];
  staffViews: StaffView[];
  operationalInsights: OperationalInsights;
  modelCatalog: ModelCatalogSnapshot;
  nativeChatAccess: NativeChatAccess;
}

const masterPageCache = new Map<
  string,
  {
    expiresAt: number;
    value?: MasterPageState;
    promise?: Promise<MasterPageState>;
  }
>();

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
  const session = readSession(req, config);

  if (url.pathname === "/healthz") {
    writeJson(res, 200, {
      ok: true,
      role: config.role,
      instanceId: config.instanceId,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  if (url.pathname === "/login") {
    await routeLogin(req, res, config, url, session?.username);
    return;
  }

  if (url.pathname === "/logout") {
    if (method !== "GET" && method !== "POST") {
      writeJson(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    clearSessionCookie(res, isSecureRequest(req));
    redirect(res, "/login?notice=logged-out");
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (!requireApiAuth(req, config)) {
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

  if (!requirePageAuth(req, config)) {
    redirectToLogin(res, url);
    return;
  }

  if (config.role === "master" && isMasterSectionRoute(url.pathname)) {
    const pageState = await loadMasterPageState(config);
    const section = resolveMasterSection(url.pathname);
    const workbench = await loadWorkbenchForSection(config, section);
    const insights = mergeInsights(pageState.operationalInsights, workbench);
    const fileDetail =
      section === "memory" || section === "docs"
        ? await loadSelectedWorkbenchFile(config, section, url.searchParams.get("file"))
        : undefined;

      writeHtml(
      res,
      200,
      renderMasterPage({
        section,
        summary: pageState.summary,
        config,
        staffViews: pageState.staffViews,
        workItems: pageState.workItems,
        instances: pageState.instances,
        insights,
        selectedStaffId: url.searchParams.get("node") ?? undefined,
        selectedFile: fileDetail,
        notice: mapNotice(url.searchParams.get("notice")),
        sessionUsername: session?.username,
        modelCatalog: pageState.modelCatalog,
        nativeChatAccess: pageState.nativeChatAccess,
      }),
    );
    return;
  }

  if (url.pathname === "/") {
    const summary = await buildLocalSummary(config);
    writeHtml(res, 200, renderEdgePage(summary, session?.username));
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

async function routeLogin(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
  url: URL,
  currentUser: string | undefined,
): Promise<void> {
  const next = normalizeNext(url.searchParams.get("next"));
  if (currentUser) {
    redirect(res, next);
    return;
  }

  if (req.method === "GET") {
    writeHtml(
      res,
      200,
      renderLoginPage({
        appName: config.appName,
        next,
        loginEnabled: isAuthEnabled(config),
        notice: mapNotice(url.searchParams.get("notice")),
      }),
    );
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const form = await readFormBody(req);
  const username = (form.get("username") ?? "").toString().trim();
  const password = (form.get("password") ?? "").toString();
  const target = normalizeNext((form.get("next") ?? "").toString());

  if (!isAuthEnabled(config)) {
    writeHtml(
      res,
      200,
      renderLoginPage({
        appName: config.appName,
        next: target,
        loginEnabled: false,
        error: "当前环境未启用登录口令，请联系管理员补齐 AUTH_REQUIRED / LOGIN_USERNAME / LOGIN_PASSWORD。",
      }),
    );
    return;
  }

  if (!verifyPassword(username, password, config)) {
    writeHtml(
      res,
      401,
      renderLoginPage({
        appName: config.appName,
        next: target,
        loginEnabled: true,
        error: "用户名或密码错误。",
      }),
    );
    return;
  }

  setSessionCookie(res, config, username, isSecureRequest(req));
  redirect(res, target);
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
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.workItems);
    return;
  }

  if (url.pathname === "/api/master-summary") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.summary);
    return;
  }

  if (url.pathname === "/api/instances") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.instances.map(({ authTokenEnvKey, ...rest }) => rest));
    return;
  }

  if (url.pathname === "/api/staff") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.staffViews);
    return;
  }

  if (url.pathname === "/api/models") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.modelCatalog);
    return;
  }

  if (url.pathname === "/api/chat-access") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }
    const state = await loadMasterPageState(config);
    writeJson(res, 200, state.nativeChatAccess);
    return;
  }

  if (url.pathname === "/api/usage" || url.pathname === "/api/agents" || url.pathname === "/api/schedules") {
    const [localSummary, workItems] = await Promise.all([buildLocalSummary(config), loadWorkItems(config.workItemsPath)]);
    const insights = await buildOperationalInsights(config, workItems, localSummary);
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
    writeJson(res, 200, await loadWorkbenchSnapshot(config, kind));
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
    invalidateMasterPageCache(config);
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
    invalidateMasterPageCache(config);
    if (!detail) {
      writeJson(res, 404, { ok: false, error: "file_not_found_or_locked" });
      return;
    }

    writeJson(res, 200, { ok: true, detail });
    return;
  }

  if (url.pathname === "/api/models/primary") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }

    const payload = await readJsonBody(req);
    const modelRef = typeof payload?.modelRef === "string" ? payload.modelRef.trim() : "";
    if (!modelRef) {
      writeJson(res, 400, { ok: false, error: "missing_model_ref" });
      return;
    }

    try {
      const snapshot = await setPrimaryModel(config, modelRef);
      invalidateMasterPageCache(config);
      writeJson(res, 200, { ok: true, snapshot });
    } catch (error) {
      writeJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "model_update_failed",
      });
    }
    return;
  }

  if (url.pathname === "/api/models/add") {
    if (config.role !== "master") {
      writeJson(res, 404, { ok: false, error: "master_only" });
      return;
    }

    const payload = await readJsonBody(req);
    const providerKey = typeof payload?.providerKey === "string" ? payload.providerKey.trim() : "";
    const modelId = typeof payload?.modelId === "string" ? payload.modelId.trim() : "";
    if (!providerKey || !modelId) {
      writeJson(res, 400, { ok: false, error: "invalid_model_input" });
      return;
    }

    const contextWindow = asOptionalPositiveInt(payload?.contextWindow);
    const maxTokens = asOptionalPositiveInt(payload?.maxTokens);
    try {
      const snapshot = await addConfiguredModel(config, {
        providerKey,
        modelId,
        name: typeof payload?.name === "string" ? payload.name.trim() : undefined,
        api: typeof payload?.api === "string" ? payload.api.trim() : undefined,
        reasoning: Boolean(payload?.reasoning),
        contextWindow,
        maxTokens,
        setPrimary: Boolean(payload?.setPrimary),
      });

      invalidateMasterPageCache(config);
      writeJson(res, 200, { ok: true, snapshot });
    } catch (error) {
      writeJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "model_add_failed",
      });
    }
    return;
  }

  writeJson(res, 404, { ok: false, error: "not_found" });
}

async function loadMasterPageState(config: AppConfig): Promise<MasterPageState> {
  const cacheKey = `${config.instanceId}:master-page`;
  const cached = masterPageCache.get(cacheKey);
  if (cached?.value && cached.expiresAt > Date.now()) return cached.value;
  if (cached?.promise) return cached.promise;

  const promise = (async () => {
    const [summary, instances, workItems, modelCatalog, nativeChatAccess] = await Promise.all([
      buildMasterSummary(config),
      loadInstances(config.instancesPath),
      loadWorkItems(config.workItemsPath),
      loadModelCatalog(config),
      loadNativeChatAccess(config),
    ]);
    const staffViews = buildStaffViews(summary, workItems);
    const operationalInsights = await buildOperationalInsights(config, workItems, summary.master);
    return {
      summary,
      instances,
      workItems,
      staffViews,
      operationalInsights,
      modelCatalog,
      nativeChatAccess,
    } satisfies MasterPageState;
  })();

  masterPageCache.set(cacheKey, {
    expiresAt: Date.now() + config.dashboardCacheTtlMs,
    promise,
  });

  try {
    const value = await promise;
    masterPageCache.set(cacheKey, {
      expiresAt: Date.now() + config.dashboardCacheTtlMs,
      value,
    });
    return value;
  } catch (error) {
    masterPageCache.delete(cacheKey);
    throw error;
  }
}

function invalidateMasterPageCache(config: AppConfig): void {
  masterPageCache.delete(`${config.instanceId}:master-page`);
}

async function loadWorkbenchForSection(
  config: AppConfig,
  section: MasterSection,
): Promise<Pick<DashboardInsights, "memory" | "docs">> {
  if (section === "memory") {
    return {
      memory: await loadWorkbenchSnapshot(config, "memory"),
      docs: emptyWorkbenchSnapshot("docs"),
    };
  }
  if (section === "docs") {
    return {
      memory: emptyWorkbenchSnapshot("memory"),
      docs: await loadWorkbenchSnapshot(config, "docs"),
    };
  }
  return {
    memory: emptyWorkbenchSnapshot("memory"),
    docs: emptyWorkbenchSnapshot("docs"),
  };
}

function mergeInsights(
  operational: OperationalInsights,
  workbench: Pick<DashboardInsights, "memory" | "docs">,
): DashboardInsights {
  return {
    ...operational,
    ...workbench,
  };
}

function emptyWorkbenchSnapshot(kind: WorkbenchKind): WorkbenchSnapshot {
  return {
    kind,
    connected: false,
    facets: [],
    files: [],
  };
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
  if (input === "logged-out") return "你已退出登录。";
  return undefined;
}

function normalizeNext(input: string | null): string {
  if (!input || !input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

function redirectToLogin(res: ServerResponse, url: URL): void {
  const next = `${url.pathname}${url.search}`;
  const params = new URLSearchParams({ next });
  redirect(res, `/login?${params.toString()}`);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function asOptionalPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

async function readFormBody(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
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
    pathname === "/chat" ||
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
  if (pathname === "/chat") return "chat";
  if (pathname === "/usage") return "usage";
  if (pathname === "/machines") return "machines";
  if (pathname === "/staff") return "staff";
  if (pathname === "/memory") return "memory";
  if (pathname === "/docs") return "docs";
  if (pathname === "/tasks") return "tasks";
  if (pathname === "/settings") return "settings";
  return "overview";
}
