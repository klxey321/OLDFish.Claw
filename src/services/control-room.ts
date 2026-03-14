import type { AggregatedSummary, StaffView, WorkItem } from "../types";

export function buildStaffViews(summary: AggregatedSummary, workItems: WorkItem[]): StaffView[] {
  return summary.nodes.map((node) => {
    const assigned = workItems.filter((item) => item.ownerInstanceId === node.instanceId);
    const current = assigned.find((item) => item.status === "running" || item.status === "blocked" || item.status === "review") ?? assigned[0];
    const blocked = assigned.find((item) => item.status === "blocked");

    return {
      instanceId: node.instanceId,
      nodeName: node.instanceName,
      department: node.department,
      region: node.region,
      role: node.role,
      baseUrl: node.baseUrl,
      state: resolveStaffState(node.status, node.sessionsActive, current?.status),
      currentTask: current?.title,
      recentOutput: current?.latestAction ?? fallbackRecentOutput(node),
      blocker: blocked?.blockers[0] ?? node.alerts[0],
      expectedDelivery: current?.dueAt,
      acceptanceNote: current?.acceptanceNote,
      sourceStatus: node.status,
    };
  });
}

export function buildOverviewHighlights(summary: AggregatedSummary, workItems: WorkItem[]) {
  const urgent = workItems.filter((item) => item.priority === "p0" || item.status === "blocked").slice(0, 4);
  const blockedNodes = summary.nodes.filter((node) => node.status === "offline" || node.status === "degraded").slice(0, 4);
  return {
    urgent,
    blockedNodes,
  };
}

function resolveStaffState(
  status: AggregatedSummary["master"]["status"],
  sessionsActive: number,
  workStatus: WorkItem["status"] | undefined,
): StaffView["state"] {
  if (status === "offline") return "offline_maintenance";
  if (status === "degraded" || workStatus === "blocked") return "blocked_waiting";
  if (sessionsActive > 0 || workStatus === "running" || workStatus === "review") return "busy_running";
  return "online_ready";
}

function fallbackRecentOutput(node: AggregatedSummary["nodes"][number]): string {
  if (node.alerts.length > 0) return `最新信号：${node.alerts[0]}`;
  if (node.sessionsActive > 0) return `本机存在 ${node.sessionsActive} 个活跃会话。`;
  return "当前无活跃输出，处于待命状态。";
}

