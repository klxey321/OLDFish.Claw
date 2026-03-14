import { readFile } from "node:fs/promises";
import type { AppConfig, ConnectionSnapshot, LocalStateFile } from "../types";

export async function loadLocalState(config: AppConfig): Promise<LocalStateFile> {
  const defaults = buildDefaultLocalState(config);
  try {
    const parsed = JSON.parse(await readFile(config.localStatePath, "utf8")) as unknown;
    const normalized = normalizeLocalState(parsed);
    return {
      ...defaults,
      ...normalized,
      connections: {
        ...defaults.connections,
        ...normalized.connections,
        notes: normalized.connections?.notes ?? defaults.connections?.notes ?? [],
      },
      notes: normalized.notes ?? defaults.notes,
    };
  } catch (error) {
    if (isFsNotFound(error)) return defaults;
    throw error;
  }
}

function buildDefaultLocalState(config: AppConfig): LocalStateFile {
  const connectionNotes: string[] = [];
  if (config.gatewayUrl) connectionNotes.push(`Gateway: ${config.gatewayUrl}`);
  if (config.openclawHome) connectionNotes.push(`OpenClaw Home: ${config.openclawHome}`);
  if (config.codexHome) connectionNotes.push(`Codex Home: ${config.codexHome}`);

  return {
    status: config.defaultStatus,
    sessionsActive: config.defaultSessionsActive,
    queueDepth: config.defaultQueueDepth,
    taskLoad: config.defaultTaskLoad,
    alerts: config.defaultAlerts,
    lastHeartbeatAt: new Date().toISOString(),
    connections: {
      gatewayConfigured: Boolean(config.gatewayUrl),
      gatewayReachable: config.defaultGatewayReachable,
      openclawReachable: config.defaultOpenclawReachable,
      notes: connectionNotes,
    },
    notes: [],
  };
}

function normalizeLocalState(input: unknown): LocalStateFile {
  const obj = asObject(input);
  if (!obj) return {};

  return {
    status: asHealthState(obj.status),
    sessionsActive: asNumber(obj.sessionsActive),
    queueDepth: asNumber(obj.queueDepth),
    taskLoad: asNumber(obj.taskLoad),
    alerts: Array.isArray(obj.alerts) ? obj.alerts.filter((item): item is string => typeof item === "string") : undefined,
    lastHeartbeatAt: asString(obj.lastHeartbeatAt),
    connections: normalizeConnections(obj.connections),
    notes: Array.isArray(obj.notes) ? obj.notes.filter((item): item is string => typeof item === "string") : undefined,
  };
}

function normalizeConnections(input: unknown): Partial<ConnectionSnapshot> | undefined {
  const obj = asObject(input);
  if (!obj) return undefined;
  return {
    gatewayConfigured: asBoolean(obj.gatewayConfigured),
    gatewayReachable: asBoolean(obj.gatewayReachable),
    openclawReachable: asBoolean(obj.openclawReachable),
    notes: Array.isArray(obj.notes) ? obj.notes.filter((item): item is string => typeof item === "string") : [],
  };
}

function isFsNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
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

function asHealthState(input: unknown): "online" | "degraded" | "offline" | "unknown" | undefined {
  return input === "online" || input === "degraded" || input === "offline" || input === "unknown" ? input : undefined;
}

