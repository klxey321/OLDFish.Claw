import assert from "node:assert/strict";
import test from "node:test";
import type { AggregatedSummary, AppConfig, InstanceConfig, InstanceSummary, StaffView, WorkItem } from "../src/types";
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
    instancesPath: "/tmp/instances.json",
    localStatePath: "/tmp/local-state.json",
    workItemsPath: "/tmp/work-items.json",
    localTokenAuthRequired: true,
    localApiToken: "",
    masterFetchTimeoutMs: 3000,
    uiRefreshSeconds: 15,
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
  const html = renderMasterPage({
    section: "overview",
    summary: dashboard,
    config,
    staffViews,
    workItems,
    instances,
  });

  assert(html.includes("MASTER CONTROL"));
  assert(html.includes("五节点态势"));
  assert(html.includes("总办主脑"));
  assert(html.includes("待总办处理"));
});
