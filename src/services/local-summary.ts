import type { AppConfig, InstanceSummary } from "../types";
import { loadLocalState } from "../runtime/local-state";

export async function buildLocalSummary(config: AppConfig): Promise<InstanceSummary> {
  const state = await loadLocalState(config);
  const gatewayConfigured = state.connections?.gatewayConfigured ?? Boolean(config.gatewayUrl);
  const gatewayReachable = state.connections?.gatewayReachable ?? false;
  const openclawReachable = state.connections?.openclawReachable ?? false;
  const alerts = state.alerts ?? [];
  const status = normalizeStatus(
    state.status,
    alerts.length,
    gatewayConfigured,
    gatewayReachable,
    openclawReachable,
  );

  return {
    instanceId: config.instanceId,
    instanceName: config.nodeName,
    role: config.role,
    department: config.department,
    region: config.region,
    machineIp: config.machineIp,
    baseUrl: config.baseUrl,
    gatewayUrl: config.gatewayUrl,
    uiPort: config.port,
    generatedAt: new Date().toISOString(),
    status,
    sessionsActive: state.sessionsActive ?? 0,
    queueDepth: state.queueDepth ?? 0,
    taskLoad: state.taskLoad ?? 0,
    alerts,
    lastHeartbeatAt: state.lastHeartbeatAt ?? new Date().toISOString(),
    connections: {
      gatewayConfigured,
      gatewayReachable,
      openclawReachable,
      notes: state.connections?.notes ?? state.notes ?? [],
    },
    source: "local",
    note: state.notes?.[0],
  };
}

function normalizeStatus(
  preferred: InstanceSummary["status"] | undefined,
  alertCount: number,
  gatewayConfigured: boolean,
  gatewayReachable: boolean,
  openclawReachable: boolean,
): InstanceSummary["status"] {
  if (preferred) return preferred;
  if (!openclawReachable) return "offline";
  if (gatewayConfigured && !gatewayReachable) return "degraded";
  if (alertCount > 0) return "degraded";
  return "online";
}

