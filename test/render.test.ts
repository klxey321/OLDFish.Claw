import assert from "node:assert/strict";
import test from "node:test";
import type { AggregatedSummary, AppConfig, DashboardInsights, InstanceConfig, InstanceSummary, StaffView, WorkItem } from "../src/types";
import { renderEdgePage, renderMasterPage } from "../src/ui/render";

const summary: InstanceSummary = {
  instanceId: "master-hq",
  instanceName: "总办主脑",
  role: "master",
  department: "总办",
  region: "中国",
  machineIp: "10.0.0.10",
  baseUrl: "http://10.0.0.10:4310",
  gatewayUrl: "ws://127.0.0.1:18789",
  uiPort: 4310,
  generatedAt: "2026-03-14T12:00:00.000Z",
  status: "online",
  sessionsActive: 3,
  queueDepth: 2,
  taskLoad: 5,
  alerts: [],
  lastHeartbeatAt: "2026-03-14T12:00:00.000Z",
  connections: {
    gatewayConfigured: true,
    gatewayReachable: true,
    openclawReachable: true,
    notes: [],
  },
  source: "local",
};

test("renderEdgePage includes OLDFish.Claw branding", () => {
  const html = renderEdgePage(summary);
  assert(html.includes("OLDFish.Claw"));
  assert(html.includes("总办主脑"));
  assert(html.includes("/api/instance-summary"));
});

test("renderMasterPage renders node cards", () => {
  const dashboard: AggregatedSummary = {
    generatedAt: "2026-03-14T12:00:00.000Z",
    master: summary,
    nodes: [summary],
    totals: {
      total: 1,
      online: 1,
      degraded: 0,
      offline: 0,
      unknown: 0,
      sessionsActive: 3,
      queueDepth: 2,
      taskLoad: 5,
      alerts: 0,
    },
  };

  const config: AppConfig = {
    role: "master",
    host: "0.0.0.0",
    port: 4310,
    appName: "OLDFish.Claw",
    instanceId: "master-hq",
    nodeName: "总办主脑",
    department: "总办",
    region: "中国",
    machineIp: "10.0.0.10",
    baseUrl: "http://10.0.0.10:4310",
    gatewayUrl: "ws://127.0.0.1:18789",
    openclawHome: undefined,
    codexHome: undefined,
    subscriptionSnapshotPath: undefined,
    instancesPath: "/tmp/instances.json",
    localStatePath: "/tmp/local-state.json",
    workItemsPath: "/tmp/work-items.json",
    localTokenAuthRequired: true,
    localApiToken: "",
    authRequired: true,
    loginUsername: "klxey123",
    loginPassword: "Hao830403",
    sessionSecret: "test-secret",
    sessionTtlHours: 12,
    fileEditEnabled: true,
    taskControlEnabled: true,
    masterFetchTimeoutMs: 3000,
    uiRefreshSeconds: 15,
    dashboardCacheTtlMs: 6000,
    defaultStatus: "online",
    defaultSessionsActive: 0,
    defaultQueueDepth: 0,
    defaultTaskLoad: 0,
    defaultAlerts: [],
    defaultGatewayReachable: true,
    defaultOpenclawReachable: true,
  };
  const staffViews: StaffView[] = [
    {
      instanceId: "master-hq",
      nodeName: "总办主脑",
      department: "总办",
      region: "中国",
      role: "master",
      baseUrl: "http://10.0.0.10:4310",
      state: "busy_running",
      currentTask: "确认部署窗口",
      recentOutput: "正在审阅总控部署。",
      sourceStatus: "online",
      activeTasks: [],
      nextTask: undefined,
    },
  ];
  const workItems: WorkItem[] = [
    {
      workId: "dispatch-master-001",
      title: "确认部署窗口",
      department: "总办",
      ownerInstanceId: "master-hq",
      stage: "dispatch",
      status: "ready",
      priority: "p0",
      summary: "确认部署窗口",
      latestAction: "等待总办确认",
      blockers: [],
    },
  ];
  const instances: InstanceConfig[] = [
    {
      instanceId: "master-hq",
      instanceName: "总办主脑",
      role: "master",
      department: "总办",
      region: "中国",
      machineIp: "10.0.0.10",
      baseUrl: "http://10.0.0.10:4310",
      enabled: true,
    },
  ];
  const insights: DashboardInsights = {
    usage: {
      runtimeConnected: true,
      codexConnected: false,
      subscriptionConnected: false,
      currentStatus: "运行时已接通",
      providerLabel: "gpt-5.2-codex",
      windowLabel: "订阅窗口未连接",
      todayTokens: 18000,
      todayCost: 0.8,
      planLabel: "等待接入订阅快照",
      notes: [],
    },
    agents: [
      {
        agentId: "main",
        label: "Main",
        workspace: "/root/.openclaw/workspace",
        activeSessions: 1,
        activeTasks: 1,
        currentTask: "确认部署窗口",
        status: "active",
        channels: ["telegram"],
        notes: [],
      },
    ],
    schedules: {
      totalJobs: 1,
      enabledJobs: 1,
      nextRunAt: "2026-03-14T13:00:00.000Z",
      heartbeatEnabled: true,
      heartbeatEvery: "30m",
      heartbeatWindow: "08:00 - 23:00",
      heartbeatLastSeenAt: "2026-03-14T12:00:00.000Z",
      items: [
        {
          jobId: "heartbeat:main",
          name: "任务心跳",
          enabled: true,
          kind: "heartbeat",
          nextRunAt: "2026-03-14T12:30:00.000Z",
          lastRunAt: "2026-03-14T12:00:00.000Z",
          lastStatus: "ok",
        },
      ],
    },
    memory: {
      kind: "memory",
      connected: true,
      facets: [],
      files: [],
    },
    docs: {
      kind: "docs",
      connected: true,
      facets: [],
      files: [],
    },
  };
  const html = renderMasterPage({
    section: "overview",
    summary: dashboard,
    config,
    staffViews,
    workItems,
    instances,
    insights,
  });

  assert(html.includes("CONTROL ROOM"));
  assert(html.includes("五节点态势"));
  assert(html.includes("总办主脑"));
  assert(html.includes("待总办处理"));
});
