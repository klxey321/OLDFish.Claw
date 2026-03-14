import type { AggregatedSummary, AppConfig, InstanceConfig, InstanceSummary } from "../types";
import { buildLocalSummary } from "./local-summary";
import { loadInstances } from "../runtime/instances";

export async function buildMasterSummary(config: AppConfig): Promise<AggregatedSummary> {
  const localSummary = await buildLocalSummary(config);
  const instances = await loadInstances(config.instancesPath);

  const nodes = await Promise.all(
    resolveEffectiveInstances(instances, localSummary).map(async (instance) =>
      instance.instanceId === localSummary.instanceId
        ? localSummary
        : fetchRemoteSummary(instance, config.masterFetchTimeoutMs),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    master: localSummary,
    nodes,
    totals: {
      total: nodes.length,
      online: nodes.filter((node) => node.status === "online").length,
      degraded: nodes.filter((node) => node.status === "degraded").length,
      offline: nodes.filter((node) => node.status === "offline").length,
      unknown: nodes.filter((node) => node.status === "unknown").length,
      sessionsActive: nodes.reduce((sum, node) => sum + node.sessionsActive, 0),
      queueDepth: nodes.reduce((sum, node) => sum + node.queueDepth, 0),
      taskLoad: nodes.reduce((sum, node) => sum + node.taskLoad, 0),
      alerts: nodes.reduce((sum, node) => sum + node.alerts.length, 0),
    },
  };
}

function resolveEffectiveInstances(instances: InstanceConfig[], localSummary: InstanceSummary): InstanceConfig[] {
  const enabled = instances.filter((item) => item.enabled);
  if (enabled.some((item) => item.instanceId === localSummary.instanceId)) return enabled;

  return [
    {
      instanceId: localSummary.instanceId,
      instanceName: localSummary.instanceName,
      role: localSummary.role,
      department: localSummary.department,
      region: localSummary.region,
      machineIp: localSummary.machineIp,
      baseUrl: localSummary.baseUrl,
      summaryUrl: `${localSummary.baseUrl}/api/instance-summary`,
      gatewayUrl: localSummary.gatewayUrl,
      uiPort: localSummary.uiPort,
      enabled: true,
      tags: ["master", "local"],
    },
    ...enabled,
  ];
}

async function fetchRemoteSummary(instance: InstanceConfig, timeoutMs: number): Promise<InstanceSummary> {
  const headers = new Headers();
  const token = instance.authTokenEnvKey ? process.env[instance.authTokenEnvKey] : undefined;
  if (token && token.trim().length > 0) headers.set("x-local-token", token.trim());

  try {
    const response = await fetch(instance.summaryUrl ?? `${instance.baseUrl}/api/instance-summary`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return synthesizeOfflineSummary(instance, `HTTP ${response.status}`);
    }

    const json = (await response.json()) as InstanceSummary;
    return {
      ...json,
      source: "remote",
    };
  } catch (error) {
    return synthesizeOfflineSummary(instance, error instanceof Error ? error.message : "remote fetch failed");
  }
}

function synthesizeOfflineSummary(instance: InstanceConfig, reason: string): InstanceSummary {
  return {
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    role: instance.role,
    department: instance.department,
    region: instance.region,
    machineIp: instance.machineIp,
    baseUrl: instance.baseUrl,
    gatewayUrl: instance.gatewayUrl,
    uiPort: instance.uiPort,
    a2aPort: instance.a2aPort,
    generatedAt: new Date().toISOString(),
    status: "offline",
    sessionsActive: 0,
    queueDepth: 0,
    taskLoad: 0,
    alerts: ["远程节点当前不可达"],
    lastHeartbeatAt: new Date().toISOString(),
    connections: {
      gatewayConfigured: Boolean(instance.gatewayUrl),
      gatewayReachable: false,
      openclawReachable: false,
      notes: [reason],
    },
    source: "synthetic",
    note: reason,
  };
}

