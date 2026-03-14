export type AppRole = "master" | "edge";
export type HealthState = "online" | "degraded" | "offline" | "unknown";
export type SummarySource = "local" | "remote" | "synthetic";

export interface InstanceConfig {
  instanceId: string;
  instanceName: string;
  role: AppRole;
  department: string;
  region: string;
  machineIp: string;
  baseUrl: string;
  summaryUrl?: string;
  gatewayUrl?: string;
  uiPort?: number;
  a2aPort?: number;
  enabled: boolean;
  authTokenEnvKey?: string;
  tags?: string[];
}

export interface ConnectionSnapshot {
  gatewayConfigured: boolean;
  gatewayReachable: boolean;
  openclawReachable: boolean;
  notes: string[];
}

export interface LocalStateFile {
  status?: HealthState;
  sessionsActive?: number;
  queueDepth?: number;
  taskLoad?: number;
  alerts?: string[];
  lastHeartbeatAt?: string;
  connections?: Partial<ConnectionSnapshot>;
  notes?: string[];
}

export interface InstanceSummary {
  instanceId: string;
  instanceName: string;
  role: AppRole;
  department: string;
  region: string;
  machineIp: string;
  baseUrl: string;
  gatewayUrl?: string;
  uiPort?: number;
  a2aPort?: number;
  generatedAt: string;
  status: HealthState;
  sessionsActive: number;
  queueDepth: number;
  taskLoad: number;
  alerts: string[];
  lastHeartbeatAt: string;
  connections: ConnectionSnapshot;
  source: SummarySource;
  note?: string;
}

export interface AggregatedSummary {
  generatedAt: string;
  master: InstanceSummary;
  nodes: InstanceSummary[];
  totals: {
    total: number;
    online: number;
    degraded: number;
    offline: number;
    unknown: number;
    sessionsActive: number;
    queueDepth: number;
    taskLoad: number;
    alerts: number;
  };
}

export interface AppConfig {
  role: AppRole;
  host: string;
  port: number;
  appName: string;
  instanceId: string;
  nodeName: string;
  department: string;
  region: string;
  machineIp: string;
  baseUrl: string;
  gatewayUrl?: string;
  openclawHome?: string;
  codexHome?: string;
  instancesPath: string;
  localStatePath: string;
  localTokenAuthRequired: boolean;
  localApiToken: string;
  masterFetchTimeoutMs: number;
  uiRefreshSeconds: number;
  defaultStatus: HealthState;
  defaultSessionsActive: number;
  defaultQueueDepth: number;
  defaultTaskLoad: number;
  defaultAlerts: string[];
  defaultGatewayReachable: boolean;
  defaultOpenclawReachable: boolean;
}

