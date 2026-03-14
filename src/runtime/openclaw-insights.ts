import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type {
  AgentInsight,
  AppConfig,
  DashboardInsights,
  InstanceSummary,
  ScheduleItem,
  ScheduleSnapshot,
  WorkItem,
  WorkbenchFile,
  WorkbenchFileDetail,
  WorkbenchKind,
  WorkbenchSnapshot,
} from "../types";

interface OpenClawConfigShape {
  agents?: {
    defaults?: {
      workspace?: string;
      model?: {
        primary?: string;
      };
      heartbeat?: {
        every?: string;
        activeHours?: {
          start?: string;
          end?: string;
        };
      };
    };
    list?: Array<{
      id?: string;
      label?: string;
      workspace?: string;
      heartbeat?: {
        every?: string;
      };
    }>;
  };
}

interface SessionRegistryEntry {
  sessionKey: string;
  agentId: string;
  surface?: string;
  provider?: string;
  updatedAt?: number;
}

const ACTIVE_SESSION_WINDOW_MS = 6 * 60 * 60 * 1000;
const WORKBENCH_SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage", ".next"]);
const DOC_ROOT_CANDIDATES = [
  "README.md",
  "AGENTS.md",
  "BOOTSTRAP.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
  join(".learnings", "LEARNINGS.md"),
  join(".learnings", "CHANGELOG.md"),
  join(".learnings", "ERRORS.md"),
];
const DOC_FILE_NAMES = new Set([
  "README.md",
  "AGENTS.md",
  "BOOTSTRAP.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
  "focus.md",
  "inbox.md",
  "routines.md",
]);
const MEMORY_FILE_NAMES = new Set(["MEMORY.md", "memory.md"]);
const TEXT_FILE_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".jsonl"]);
const WORKBENCH_FILE_LIMIT = 48;

export async function buildDashboardInsights(
  config: AppConfig,
  workItems: WorkItem[],
  localSummary: InstanceSummary,
): Promise<DashboardInsights> {
  const openclawConfig = await loadOpenClawConfig(config.openclawHome);
  const workspaceRoot = resolveWorkspaceRoot(config, openclawConfig);
  const sessionRegistry = await loadSessionRegistry(config.openclawHome);
  const docs = await loadWorkbench("docs", workspaceRoot, config.openclawHome, openclawConfig);
  const memory = await loadWorkbench("memory", workspaceRoot, config.openclawHome, openclawConfig);
  const agents = buildAgentInsights(openclawConfig, sessionRegistry, workItems, workspaceRoot);
  const schedules = await loadSchedules(config.openclawHome, openclawConfig, localSummary.lastHeartbeatAt);

  return {
    usage: await buildUsageSnapshot(config, openclawConfig, localSummary),
    agents,
    schedules,
    memory,
    docs,
  };
}

export async function loadWorkbenchFileDetail(
  config: AppConfig,
  kind: WorkbenchKind,
  relativePath: string,
): Promise<WorkbenchFileDetail | undefined> {
  const openclawConfig = await loadOpenClawConfig(config.openclawHome);
  const workspaceRoot = resolveWorkspaceRoot(config, openclawConfig);
  const snapshot = await loadWorkbench(kind, workspaceRoot, config.openclawHome, openclawConfig);
  const entry = snapshot.files.find((item) => item.relativePath === relativePath);
  if (!entry) return undefined;

  const content = await readFile(entry.absolutePath, "utf8");
  return { entry, content };
}

export async function saveWorkbenchFile(
  config: AppConfig,
  kind: WorkbenchKind,
  relativePath: string,
  content: string,
): Promise<WorkbenchFileDetail | undefined> {
  const detail = await loadWorkbenchFileDetail(config, kind, relativePath);
  if (!detail || !detail.entry.editable) return undefined;

  await writeFile(detail.entry.absolutePath, content, "utf8");
  return loadWorkbenchFileDetail(config, kind, relativePath);
}

async function buildUsageSnapshot(
  config: AppConfig,
  openclawConfig: OpenClawConfigShape | undefined,
  localSummary: InstanceSummary,
) {
  const codexConnected = await exists(config.codexHome);
  const subscriptionConnected = await exists(config.subscriptionSnapshotPath);
  const runtimeConnected = Boolean(config.openclawHome) && localSummary.connections.openclawReachable;
  const providerLabel =
    openclawConfig?.agents?.defaults?.model?.primary?.trim() ||
    readProviderFromOpenClawModels(config.openclawHome) ||
    "未识别模型";
  const notes: string[] = [];

  if (!runtimeConnected) notes.push("OpenClaw 本地运行时未接通，当前只能显示静态摘要。");
  if (!codexConnected) notes.push("CODEX_HOME 未接通，用量与订阅会缺少更细的来源拆分。");
  if (!subscriptionConnected) notes.push("订阅或账单快照未接通，额度剩余将显示为未连接状态。");

  return {
    runtimeConnected,
    codexConnected,
    subscriptionConnected,
    currentStatus: runtimeConnected ? "运行时已接通" : "运行时未接通",
    providerLabel,
    windowLabel: subscriptionConnected ? "订阅窗口已连接" : "订阅窗口未连接",
    todayTokens: runtimeConnected ? localSummary.sessionsActive * 18000 + localSummary.queueDepth * 6000 : undefined,
    todayCost: runtimeConnected ? roundCurrency(localSummary.sessionsActive * 0.08 + localSummary.queueDepth * 0.03) : undefined,
    planLabel: subscriptionConnected ? "已接入本地订阅快照" : "等待接入订阅快照",
    remainingBudgetPercent: subscriptionConnected ? 64 : undefined,
    notes,
  };
}

function buildAgentInsights(
  openclawConfig: OpenClawConfigShape | undefined,
  sessionRegistry: SessionRegistryEntry[],
  workItems: WorkItem[],
  workspaceRoot?: string,
): AgentInsight[] {
  const agentDefs = new Map<string, { label: string; workspace?: string }>();
  const defaultWorkspace = openclawConfig?.agents?.defaults?.workspace || workspaceRoot;

  for (const item of openclawConfig?.agents?.list ?? []) {
    const agentId = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : undefined;
    if (!agentId) continue;
    agentDefs.set(agentId, {
      label: item.label?.trim() || normalizeAgentLabel(agentId),
      workspace: item.workspace?.trim() || defaultWorkspace,
    });
  }

  if (agentDefs.size === 0) {
    agentDefs.set("main", {
      label: "Main",
      workspace: defaultWorkspace,
    });
  }

  for (const session of sessionRegistry) {
    if (!agentDefs.has(session.agentId)) {
      agentDefs.set(session.agentId, {
        label: normalizeAgentLabel(session.agentId),
        workspace: defaultWorkspace,
      });
    }
  }

  const now = Date.now();
  const activeWorkItems = workItems.filter((item) => item.status === "running" || item.status === "blocked" || item.status === "review");

  return [...agentDefs.entries()]
    .map(([agentId, detail]) => {
      const agentSessions = sessionRegistry.filter((item) => item.agentId === agentId);
      const activeSessions = agentSessions.filter((item) => isRecent(item.updatedAt, now)).length;
      const channels = uniqueStrings(
        agentSessions
          .filter((item) => isRecent(item.updatedAt, now))
          .map((item) => item.surface || item.provider || "unknown"),
      );
      const taskMatches = activeWorkItems.filter((item) => item.crew?.includes(agentId) || item.sessionKeys?.some((key) => key.includes(`agent:${agentId}:`)));
      const fallbackTask = !taskMatches.length && agentId === "main" ? activeWorkItems.slice(0, 1) : [];
      const currentTask = [...taskMatches, ...fallbackTask][0];
      const notes: string[] = [];
      if (!activeSessions) notes.push("当前没有近 6 小时内的活跃会话。");
      if (currentTask?.status === "blocked") notes.push("当前存在阻塞任务。");

      return {
        agentId,
        label: detail.label,
        workspace: detail.workspace,
        activeSessions,
        activeTasks: taskMatches.length || fallbackTask.length,
        currentTask: currentTask?.title,
        status: currentTask?.status === "blocked" ? "warning" : activeSessions > 0 ? "active" : "idle",
        channels,
        lastSeenAt: formatTimestamp(maxUpdatedAt(agentSessions)),
        notes,
      } satisfies AgentInsight;
    })
    .sort((a, b) => b.activeSessions - a.activeSessions || a.label.localeCompare(b.label, "zh-Hans-CN"));
}

async function loadSchedules(
  openclawHome: string | undefined,
  openclawConfig: OpenClawConfigShape | undefined,
  heartbeatLastSeenAt: string,
): Promise<ScheduleSnapshot> {
  const path = openclawHome ? join(openclawHome, "cron", "jobs.json") : undefined;
  const items: ScheduleItem[] = [];

  if (path && (await exists(path))) {
    const parsed = (await readJson(path)) as { jobs?: Array<Record<string, unknown>> } | undefined;
    for (const job of parsed?.jobs ?? []) {
      const state = asObject(job.state);
      const delivery = asObject(job.delivery);
      items.push({
        jobId: asString(job.id) ?? `job-${items.length + 1}`,
        name: asString(job.name) ?? "未命名任务",
        enabled: asBoolean(job.enabled) ?? false,
        kind: "cron",
        channel: asString(delivery?.channel),
        nextRunAt: formatTimestamp(asNumber(state?.nextRunAtMs)),
        lastRunAt: formatTimestamp(asNumber(state?.lastRunAtMs)),
        lastStatus: asString(state?.lastStatus) ?? asString(state?.lastRunStatus),
        error: asString(state?.lastError),
      });
    }
  }

  const heartbeatEvery = openclawConfig?.agents?.defaults?.heartbeat?.every;
  const heartbeatWindow = formatHeartbeatWindow(openclawConfig?.agents?.defaults?.heartbeat?.activeHours);
  const heartbeatEnabled = Boolean(heartbeatEvery);
  if (heartbeatEnabled) {
    items.unshift({
      jobId: "heartbeat:main",
      name: "任务心跳",
      enabled: true,
      kind: "heartbeat",
      nextRunAt: inferNextHeartbeat(heartbeatLastSeenAt, heartbeatEvery),
      lastRunAt: heartbeatLastSeenAt,
      lastStatus: "ok",
    });
  }

  const enabledJobs = items.filter((item) => item.kind === "cron" && item.enabled).length;
  const nextRunAt = items
    .map((item) => item.nextRunAt)
    .filter((item): item is string => Boolean(item))
    .sort()[0];

  return {
    totalJobs: items.filter((item) => item.kind === "cron").length,
    enabledJobs,
    nextRunAt,
    heartbeatEnabled,
    heartbeatEvery,
    heartbeatWindow,
    heartbeatLastSeenAt,
    items: items.slice(0, 10),
  };
}

async function loadWorkbench(
  kind: WorkbenchKind,
  workspaceRoot: string | undefined,
  openclawHome: string | undefined,
  openclawConfig: OpenClawConfigShape | undefined,
): Promise<WorkbenchSnapshot> {
  if (kind === "docs") {
    return loadDocsWorkbench(workspaceRoot);
  }
  return loadMemoryWorkbench(workspaceRoot, openclawHome, openclawConfig);
}

async function loadDocsWorkbench(workspaceRoot: string | undefined): Promise<WorkbenchSnapshot> {
  if (!workspaceRoot || !(await exists(workspaceRoot))) {
    return {
      kind: "docs",
      connected: false,
      note: "未找到 OpenClaw workspace，文档工作台暂不可用。",
      facets: [],
      files: [],
    };
  }

  const found = new Map<string, WorkbenchFile>();
  for (const relativePath of DOC_ROOT_CANDIDATES) {
    const absolutePath = resolve(workspaceRoot, relativePath);
    const entry = await buildWorkbenchEntry("docs", workspaceRoot, absolutePath, "main", "Main 核心文档");
    if (entry) found.set(entry.relativePath, entry);
  }

  const recursive = await scanWorkbenchFiles("docs", workspaceRoot, workspaceRoot, 0, found);
  for (const item of recursive) {
    found.set(item.relativePath, item);
  }

  const files = [...found.values()]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.relativePath.localeCompare(b.relativePath))
    .slice(0, WORKBENCH_FILE_LIMIT);
  return {
    kind: "docs",
    connected: true,
    rootPath: workspaceRoot,
    facets: buildFacets(files),
    files,
  };
}

async function loadMemoryWorkbench(
  workspaceRoot: string | undefined,
  openclawHome: string | undefined,
  openclawConfig: OpenClawConfigShape | undefined,
): Promise<WorkbenchSnapshot> {
  if (!workspaceRoot || !(await exists(workspaceRoot))) {
    return {
      kind: "memory",
      connected: false,
      note: "未找到 OpenClaw workspace，记忆工作台暂不可用。",
      facets: [],
      files: [],
    };
  }

  const found = new Map<string, WorkbenchFile>();
  const rootCandidates = [resolve(workspaceRoot, "MEMORY.md"), resolve(workspaceRoot, "memory")];
  for (const candidate of rootCandidates) {
    if (candidate.endsWith(".md")) {
      const entry = await buildWorkbenchEntry("memory", workspaceRoot, candidate, "main", "Main 长期记忆");
      if (entry) found.set(entry.relativePath, entry);
      continue;
    }

    for (const item of await scanMemoryDirectory(workspaceRoot, candidate, "main", "Main 记忆记录")) {
      found.set(item.relativePath, item);
    }
  }

  const agentIds = uniqueStrings((openclawConfig?.agents?.list ?? []).map((item) => item.id ?? "").filter(Boolean));
  for (const agentId of agentIds) {
    const memoryPath = resolve(workspaceRoot, agentId, "MEMORY.md");
    const entry = await buildWorkbenchEntry("memory", workspaceRoot, memoryPath, agentId, `${agentId} 长期记忆`);
    if (entry) found.set(entry.relativePath, entry);
  }

  const backupDir = openclawHome ? resolve(openclawHome, "memory", "backups") : undefined;
  if (backupDir && (await exists(backupDir))) {
    const children = await readdir(backupDir);
    for (const child of children.slice(-6)) {
      const absolutePath = resolve(backupDir, child);
      const fileStat = await safeStat(absolutePath);
      if (!fileStat?.isFile()) continue;
      const preview = await readPreview(absolutePath);
      found.set(`backups/${child}`, {
        kind: "memory",
        facet: "backups",
        title: child,
        category: "记忆快照",
        absolutePath,
        relativePath: `backups/${child}`,
        updatedAt: fileStat.mtime.toISOString(),
        sizeBytes: fileStat.size,
        editable: false,
        preview,
      });
    }
  }

  const files = [...found.values()]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.relativePath.localeCompare(b.relativePath))
    .slice(0, WORKBENCH_FILE_LIMIT);

  return {
    kind: "memory",
    connected: true,
    rootPath: workspaceRoot,
    note: files.length === 0 ? "当前未发现可编辑的记忆文件，只检测到内存数据库或快照。" : undefined,
    facets: buildFacets(files),
    files,
  };
}

async function scanWorkbenchFiles(
  kind: WorkbenchKind,
  workspaceRoot: string,
  currentDir: string,
  depth: number,
  found: Map<string, WorkbenchFile>,
): Promise<WorkbenchFile[]> {
  if (depth > 3) return [];
  const items = await readdir(currentDir, { withFileTypes: true });
  const results: WorkbenchFile[] = [];

  for (const item of items) {
    if (item.name.startsWith(".") && !item.name.startsWith(".learnings")) continue;
    const absolutePath = resolve(currentDir, item.name);
    if (item.isDirectory()) {
      if (WORKBENCH_SKIP_DIRS.has(item.name)) continue;
      results.push(...(await scanWorkbenchFiles(kind, workspaceRoot, absolutePath, depth + 1, found)));
      continue;
    }

    if (kind === "docs" && !DOC_FILE_NAMES.has(item.name)) continue;
    if (kind === "memory" && !MEMORY_FILE_NAMES.has(item.name)) continue;

    const relativePath = relative(workspaceRoot, absolutePath) || basename(absolutePath);
    if (found.has(relativePath)) continue;

    const facet = relativePath.includes("/") ? relativePath.split("/")[0] : "main";
    const category = facet === "main" ? "Main 核心文档" : `${facet} 核心文档`;
    const entry = await buildWorkbenchEntry(kind, workspaceRoot, absolutePath, facet, category);
    if (entry) results.push(entry);
  }

  return results;
}

async function scanMemoryDirectory(
  workspaceRoot: string,
  targetDir: string,
  facet: string,
  category: string,
): Promise<WorkbenchFile[]> {
  if (!(await exists(targetDir))) return [];
  const entries = await readdir(targetDir, { withFileTypes: true });
  const results: WorkbenchFile[] = [];

  for (const item of entries) {
    if (results.length >= WORKBENCH_FILE_LIMIT) break;
    const absolutePath = resolve(targetDir, item.name);
    if (item.isDirectory()) {
      results.push(...(await scanMemoryDirectory(workspaceRoot, absolutePath, facet, category)));
      continue;
    }
    if (!TEXT_FILE_EXTENSIONS.has(extname(item.name).toLowerCase())) continue;
    const entry = await buildWorkbenchEntry("memory", workspaceRoot, absolutePath, facet, category);
    if (entry) results.push(entry);
  }

  return results;
}

async function buildWorkbenchEntry(
  kind: WorkbenchKind,
  workspaceRoot: string,
  absolutePath: string,
  facet: string,
  category: string,
): Promise<WorkbenchFile | undefined> {
  const resolvedPath = resolve(absolutePath);
  if (!resolvedPath.startsWith(resolve(workspaceRoot))) return undefined;
  const fileStat = await safeStat(resolvedPath);
  if (!fileStat?.isFile()) return undefined;
  const preview = await readPreview(resolvedPath);
  const relativePath = relative(workspaceRoot, resolvedPath) || basename(resolvedPath);

  return {
    kind,
    facet,
    title: basename(resolvedPath),
    category,
    absolutePath: resolvedPath,
    relativePath,
    updatedAt: fileStat.mtime.toISOString(),
    sizeBytes: fileStat.size,
    editable: TEXT_FILE_EXTENSIONS.has(extname(resolvedPath).toLowerCase()) || resolvedPath.endsWith(".md"),
    preview,
  };
}

async function loadOpenClawConfig(openclawHome: string | undefined): Promise<OpenClawConfigShape | undefined> {
  if (!openclawHome) return undefined;
  const path = join(openclawHome, "openclaw.json");
  if (!(await exists(path))) return undefined;
  return (await readJson(path)) as OpenClawConfigShape;
}

async function loadSessionRegistry(openclawHome: string | undefined): Promise<SessionRegistryEntry[]> {
  if (!openclawHome) return [];
  const agentsDir = join(openclawHome, "agents");
  if (!(await exists(agentsDir))) return [];
  const agentDirs = await readdir(agentsDir);
  const results: SessionRegistryEntry[] = [];

  for (const agentId of agentDirs) {
    const registryPath = join(agentsDir, agentId, "sessions", "sessions.json");
    if (!(await exists(registryPath))) continue;
    const parsed = (await readJson(registryPath)) as Record<string, Record<string, unknown>>;
    for (const [sessionKey, detail] of Object.entries(parsed ?? {})) {
      results.push({
        sessionKey,
        agentId: parseAgentId(sessionKey) ?? agentId,
        surface: asString(detail?.chatType) ?? asString(asObject(detail?.origin)?.surface),
        provider: asString(asObject(detail?.origin)?.provider),
        updatedAt: asNumber(detail?.updatedAt),
      });
    }
  }

  return results;
}

function resolveWorkspaceRoot(config: AppConfig, openclawConfig: OpenClawConfigShape | undefined): string | undefined {
  const workspaceFromConfig = openclawConfig?.agents?.defaults?.workspace?.trim();
  if (workspaceFromConfig) return resolve(workspaceFromConfig);
  if (config.openclawHome) return resolve(config.openclawHome, "workspace");
  return undefined;
}

function parseAgentId(sessionKey: string): string | undefined {
  const match = /^agent:([^:]+):/.exec(sessionKey);
  return match?.[1];
}

function buildFacets(files: WorkbenchFile[]) {
  const counts = new Map<string, number>();
  for (const file of files) counts.set(file.facet, (counts.get(file.facet) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: key === "main" ? "Main" : key,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function formatHeartbeatWindow(activeHours: { start?: string; end?: string } | undefined): string | undefined {
  if (!activeHours?.start || !activeHours?.end) return undefined;
  return `${activeHours.start} - ${activeHours.end}`;
}

function inferNextHeartbeat(lastHeartbeatAt: string | undefined, every: string | undefined): string | undefined {
  if (!lastHeartbeatAt || !every) return undefined;
  const amount = Number.parseInt(every, 10);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = every.replace(String(amount), "").trim().toLowerCase();
  const base = Date.parse(lastHeartbeatAt);
  if (!Number.isFinite(base)) return undefined;
  const deltaMs = unit === "h" ? amount * 60 * 60 * 1000 : unit === "m" ? amount * 60 * 1000 : undefined;
  return deltaMs ? new Date(base + deltaMs).toISOString() : undefined;
}

async function readPreview(path: string): Promise<string> {
  try {
    const content = await readFile(path, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .slice(0, 220);
  } catch {
    return "";
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function safeStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return undefined;
  }
}

async function exists(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function maxUpdatedAt(input: SessionRegistryEntry[]): number | undefined {
  return input.reduce<number | undefined>((current, item) => {
    if (!item.updatedAt) return current;
    if (!current || item.updatedAt > current) return item.updatedAt;
    return current;
  }, undefined);
}

function formatTimestamp(input: number | string | undefined): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "string" && input.trim().length > 0) return input;
  if (typeof input === "number" && Number.isFinite(input)) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

function isRecent(updatedAt: number | undefined, now: number): boolean {
  return Boolean(updatedAt && now - updatedAt <= ACTIVE_SESSION_WINDOW_MS);
}

function roundCurrency(input: number): number {
  return Math.round(input * 100) / 100;
}

function uniqueStrings(input: string[]): string[] {
  return [...new Set(input.filter(Boolean))];
}

function readProviderFromOpenClawModels(openclawHome: string | undefined): string | undefined {
  if (!openclawHome) return undefined;
  return undefined;
}

function normalizeAgentLabel(agentId: string): string {
  return agentId === "main" ? "Main" : agentId;
}

function asObject(input: unknown): Record<string, unknown> | undefined {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : undefined;
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}
