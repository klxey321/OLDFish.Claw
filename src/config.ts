import { resolve } from "node:path";
import type { AppConfig, AppRole, HealthState } from "./types";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const role = readRole(env.OLDFISH_ROLE);
  const port = readInt(env.PORT, role === "master" ? 4310 : 4311);
  const host = readString(env.HOST, "0.0.0.0");
  const instanceId = readString(env.INSTANCE_ID, role === "master" ? "master-hq" : "edge-node");
  const nodeName = readString(env.NODE_NAME, role === "master" ? "总办主脑" : "边缘节点");
  const department = readString(env.DEPARTMENT, role === "master" ? "总办" : "未分配");
  const region = readString(env.REGION, "中国");
  const machineIp = readString(env.MACHINE_IP, "127.0.0.1");
  const baseUrl = readString(env.BASE_URL, `http://127.0.0.1:${port}`);

  return {
    role,
    host,
    port,
    appName: "OLDFish.Claw",
    instanceId,
    nodeName,
    department,
    region,
    machineIp,
    baseUrl,
    dashboardUrl: readOptionalString(env.OPENCLAW_DASHBOARD_URL),
    gatewayUrl: readOptionalString(env.GATEWAY_URL),
    openclawHome: readOptionalString(env.OPENCLAW_HOME),
    codexHome: readOptionalString(env.CODEX_HOME),
    subscriptionSnapshotPath: readOptionalString(env.OPENCLAW_SUBSCRIPTION_SNAPSHOT_PATH),
    instancesPath: resolve(readString(env.INSTANCES_PATH, "runtime/instances.json")),
    localStatePath: resolve(readString(env.LOCAL_STATE_PATH, "runtime/local-state.json")),
    workItemsPath: resolve(readString(env.WORK_ITEMS_PATH, "runtime/work-items.json")),
    localTokenAuthRequired: readBool(env.LOCAL_TOKEN_AUTH_REQUIRED, true),
    localApiToken: readString(env.LOCAL_API_TOKEN, ""),
    authRequired: readBool(env.AUTH_REQUIRED, false),
    loginUsername: readOptionalString(env.LOGIN_USERNAME),
    loginPassword: readOptionalString(env.LOGIN_PASSWORD),
    sessionSecret: readString(env.SESSION_SECRET, readString(env.LOCAL_API_TOKEN, `${instanceId}-session`)),
    sessionTtlHours: readInt(env.SESSION_TTL_HOURS, 12),
    fileEditEnabled: readBool(env.FILE_EDIT_ENABLED, true),
    taskControlEnabled: readBool(env.TASK_CONTROL_ENABLED, true),
    masterFetchTimeoutMs: readInt(env.MASTER_FETCH_TIMEOUT_MS, 3500),
    uiRefreshSeconds: readInt(env.UI_REFRESH_SECONDS, 15),
    dashboardCacheTtlMs: readInt(env.DASHBOARD_CACHE_TTL_MS, 6000),
    defaultStatus: readHealthState(env.EDGE_STATUS, "online"),
    defaultSessionsActive: readInt(env.ACTIVE_SESSIONS, 0),
    defaultQueueDepth: readInt(env.QUEUE_DEPTH, 0),
    defaultTaskLoad: readInt(env.TASK_LOAD, 0),
    defaultAlerts: readCsv(env.EDGE_ALERTS),
    defaultGatewayReachable: readBool(env.GATEWAY_REACHABLE, Boolean(env.GATEWAY_URL)),
    defaultOpenclawReachable: readBool(env.OPENCLAW_REACHABLE, true),
  };
}

function readRole(input: string | undefined): AppRole {
  if (input === "edge") return "edge";
  return "master";
}

function readHealthState(input: string | undefined, fallback: HealthState): HealthState {
  if (!input) return fallback;
  const value = input.trim().toLowerCase();
  if (value === "online" || value === "degraded" || value === "offline" || value === "unknown") return value;
  return fallback;
}

function readString(input: string | undefined, fallback: string): string {
  const value = input?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readOptionalString(input: string | undefined): string | undefined {
  const value = input?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readInt(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBool(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined) return fallback;
  const value = input.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readCsv(input: string | undefined): string[] {
  return (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
