import { readFile } from "node:fs/promises";
import type { InstanceConfig } from "../types";

export async function loadInstances(path: string): Promise<InstanceConfig[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeInstance)
      .filter((item): item is InstanceConfig => item !== undefined)
      .sort((a, b) => a.instanceName.localeCompare(b.instanceName, "zh-Hans-CN"));
  } catch (error) {
    if (isFsNotFound(error)) {
      const fallbackPath = path.replace(/\.json$/i, ".example.json");
      try {
        const parsed = JSON.parse(await readFile(fallbackPath, "utf8")) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map(normalizeInstance)
          .filter((item): item is InstanceConfig => item !== undefined)
          .sort((a, b) => a.instanceName.localeCompare(b.instanceName, "zh-Hans-CN"));
      } catch (innerError) {
        if (isFsNotFound(innerError)) return [];
        throw innerError;
      }
    }
    throw error;
  }
}

function normalizeInstance(input: unknown): InstanceConfig | undefined {
  const item = asObject(input);
  if (!item) return undefined;

  const instanceId = asString(item.instanceId);
  const instanceName = asString(item.instanceName);
  const role = asRole(item.role);
  const department = asString(item.department);
  const region = asString(item.region);
  const machineIp = asString(item.machineIp);
  const baseUrl = asString(item.baseUrl);
  const enabled = asBoolean(item.enabled);

  if (!instanceId || !instanceName || !role || !department || !region || !machineIp || !baseUrl || enabled === undefined) {
    return undefined;
  }

  return {
    instanceId,
    instanceName,
    role,
    department,
    region,
    machineIp,
    baseUrl,
    summaryUrl: asString(item.summaryUrl),
    gatewayUrl: asString(item.gatewayUrl),
    uiPort: asNumber(item.uiPort),
    a2aPort: asNumber(item.a2aPort),
    enabled,
    authTokenEnvKey: asString(item.authTokenEnvKey),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
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

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function asRole(input: unknown): "master" | "edge" | undefined {
  return input === "master" || input === "edge" ? input : undefined;
}
