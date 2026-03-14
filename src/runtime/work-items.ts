import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WorkItem, WorkStage, WorkStatus } from "../types";

export async function loadWorkItems(path: string): Promise<WorkItem[]> {
  try {
    return normalizeItems(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    if (isFsNotFound(error)) {
      const fallbackPath = path.replace(/\.json$/i, ".example.json");
      try {
        return normalizeItems(JSON.parse(await readFile(fallbackPath, "utf8")) as unknown);
      } catch (innerError) {
        if (isFsNotFound(innerError)) return [];
        throw innerError;
      }
    }
    throw error;
  }
}

export async function writeWorkItems(path: string, items: WorkItem[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function stopWorkItem(path: string, workId: string, stoppedBy: string): Promise<WorkItem | undefined> {
  const items = await loadWorkItems(path);
  const nextItems = items.map((item) => {
    if (item.workId !== workId) return item;
    const nextStatus: WorkItem["status"] = item.status === "done" ? "done" : "blocked";
    return {
      ...item,
      status: nextStatus,
      latestAction: "总办已手动停止该任务，等待重新派发。",
      blockers: uniqueStrings(["总办手动停止", ...item.blockers]),
      stoppedAt: new Date().toISOString(),
      stoppedBy,
      updatedAt: new Date().toISOString(),
    };
  });
  const target = nextItems.find((item) => item.workId === workId);
  if (!target) return undefined;
  await writeWorkItems(path, nextItems);
  return target;
}

function normalizeItems(input: unknown): WorkItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(normalizeItem)
    .filter((item): item is WorkItem => item !== undefined)
    .sort((a, b) => {
      const priorityOrder = ["p0", "p1", "p2"];
      const priorityDiff = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.title.localeCompare(b.title, "zh-Hans-CN");
    });
}

function normalizeItem(input: unknown): WorkItem | undefined {
  const obj = asObject(input);
  if (!obj) return undefined;

  const workId = asString(obj.workId);
  const title = asString(obj.title);
  const department = asString(obj.department);
  const ownerInstanceId = asString(obj.ownerInstanceId);
  const stage = asStage(obj.stage);
  const status = asStatus(obj.status);
  const priority = asPriority(obj.priority);
  const summary = asString(obj.summary);
  const latestAction = asString(obj.latestAction);

  if (!workId || !title || !department || !ownerInstanceId || !stage || !status || !priority || !summary || !latestAction) {
    return undefined;
  }

  return {
    workId,
    title,
    department,
    ownerInstanceId,
    stage,
    status,
    priority,
    summary,
    latestAction,
    blockers: Array.isArray(obj.blockers) ? obj.blockers.filter((item): item is string => typeof item === "string") : [],
    dueAt: asString(obj.dueAt),
    acceptanceNote: asString(obj.acceptanceNote),
    crew: Array.isArray(obj.crew) ? obj.crew.filter((item): item is string => typeof item === "string") : [],
    sessionKeys: Array.isArray(obj.sessionKeys) ? obj.sessionKeys.filter((item): item is string => typeof item === "string") : [],
    updatedAt: asString(obj.updatedAt),
    stoppedAt: asString(obj.stoppedAt),
    stoppedBy: asString(obj.stoppedBy),
  };
}

function uniqueStrings(input: string[]): string[] {
  return [...new Set(input.filter(Boolean))];
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

function asStage(input: unknown): WorkStage | undefined {
  return input === "dispatch" || input === "execution" || input === "delivery" || input === "acceptance" ? input : undefined;
}

function asStatus(input: unknown): WorkStatus | undefined {
  return input === "ready" || input === "running" || input === "blocked" || input === "review" || input === "done"
    ? input
    : undefined;
}

function asPriority(input: unknown): "p0" | "p1" | "p2" | undefined {
  return input === "p0" || input === "p1" || input === "p2" ? input : undefined;
}
