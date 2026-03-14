export type AppRole = "master" | "edge";
export type HealthState = "online" | "degraded" | "offline" | "unknown";
export type SummarySource = "local" | "remote" | "synthetic";
export type WorkStage = "dispatch" | "execution" | "delivery" | "acceptance";
export type WorkStatus = "ready" | "running" | "blocked" | "review" | "done";
export type WorkbenchKind = "memory" | "docs";

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

export interface StaffView {
  instanceId: string;
  nodeName: string;
  department: string;
  region: string;
  role: AppRole;
  baseUrl: string;
  state: "online_ready" | "busy_running" | "blocked_waiting" | "offline_maintenance";
  currentTask?: string;
  recentOutput: string;
  blocker?: string;
  expectedDelivery?: string;
  acceptanceNote?: string;
  sourceStatus: HealthState;
  activeTasks: StaffTaskSummary[];
  nextTask?: StaffTaskSummary;
}

export interface WorkItem {
  workId: string;
  title: string;
  department: string;
  ownerInstanceId: string;
  stage: WorkStage;
  status: WorkStatus;
  priority: "p0" | "p1" | "p2";
  summary: string;
  latestAction: string;
  blockers: string[];
  dueAt?: string;
  acceptanceNote?: string;
  crew?: string[];
  sessionKeys?: string[];
  updatedAt?: string;
  stoppedAt?: string;
  stoppedBy?: string;
}

export interface StaffTaskSummary {
  workId: string;
  title: string;
  stage: WorkStage;
  status: WorkStatus;
  priority: WorkItem["priority"];
  latestAction: string;
  dueAt?: string;
}

export interface UsageSnapshot {
  runtimeConnected: boolean;
  codexConnected: boolean;
  subscriptionConnected: boolean;
  currentStatus: string;
  providerLabel: string;
  windowLabel: string;
  todayTokens?: number;
  todayCost?: number;
  planLabel?: string;
  remainingBudgetPercent?: number;
  notes: string[];
}

export interface AgentInsight {
  agentId: string;
  label: string;
  workspace?: string;
  activeSessions: number;
  activeTasks: number;
  currentTask?: string;
  status: "active" | "idle" | "warning";
  channels: string[];
  lastSeenAt?: string;
  notes: string[];
}

export interface ScheduleItem {
  jobId: string;
  name: string;
  enabled: boolean;
  kind: "cron" | "heartbeat";
  channel?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: string;
  error?: string;
}

export interface ScheduleSnapshot {
  totalJobs: number;
  enabledJobs: number;
  nextRunAt?: string;
  heartbeatEnabled: boolean;
  heartbeatEvery?: string;
  heartbeatWindow?: string;
  heartbeatLastSeenAt?: string;
  items: ScheduleItem[];
}

export interface WorkbenchFacet {
  key: string;
  label: string;
  count: number;
}

export interface WorkbenchFile {
  kind: WorkbenchKind;
  facet: string;
  title: string;
  category: string;
  absolutePath: string;
  relativePath: string;
  updatedAt?: string;
  sizeBytes: number;
  editable: boolean;
  preview: string;
}

export interface WorkbenchSnapshot {
  kind: WorkbenchKind;
  connected: boolean;
  rootPath?: string;
  note?: string;
  facets: WorkbenchFacet[];
  files: WorkbenchFile[];
}

export interface WorkbenchFileDetail {
  entry: WorkbenchFile;
  content: string;
}

export interface ModelProviderSummary {
  key: string;
  api?: string;
  baseUrl?: string;
  modelCount: number;
}

export interface ModelCatalogEntry {
  providerKey: string;
  id: string;
  name: string;
  api?: string;
  reasoning: boolean;
  contextWindow?: number;
  maxTokens?: number;
  isPrimary: boolean;
  isFallback: boolean;
}

export interface ModelCatalogSnapshot {
  connected: boolean;
  configPath?: string;
  primaryModel?: string;
  fallbackModels: string[];
  providers: ModelProviderSummary[];
  models: ModelCatalogEntry[];
  note?: string;
}

export interface NativeChatAccess {
  enabled: boolean;
  basePath: string;
  framePath: string;
  gatewayToken?: string;
  note?: string;
}

export interface DashboardInsights {
  usage: UsageSnapshot;
  agents: AgentInsight[];
  schedules: ScheduleSnapshot;
  memory: WorkbenchSnapshot;
  docs: WorkbenchSnapshot;
}

export interface OperationalInsights {
  usage: UsageSnapshot;
  agents: AgentInsight[];
  schedules: ScheduleSnapshot;
}

export interface AuthSession {
  username: string;
  expiresAt: number;
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
  subscriptionSnapshotPath?: string;
  instancesPath: string;
  localStatePath: string;
  workItemsPath: string;
  localTokenAuthRequired: boolean;
  localApiToken: string;
  authRequired: boolean;
  loginUsername?: string;
  loginPassword?: string;
  sessionSecret: string;
  sessionTtlHours: number;
  fileEditEnabled: boolean;
  taskControlEnabled: boolean;
  masterFetchTimeoutMs: number;
  uiRefreshSeconds: number;
  dashboardCacheTtlMs: number;
  defaultStatus: HealthState;
  defaultSessionsActive: number;
  defaultQueueDepth: number;
  defaultTaskLoad: number;
  defaultAlerts: string[];
  defaultGatewayReachable: boolean;
  defaultOpenclawReachable: boolean;
}
