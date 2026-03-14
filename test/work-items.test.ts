import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadWorkItems } from "../src/runtime/work-items";

test("loadWorkItems parses valid work rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oldfish-work-items-"));
  const file = join(dir, "work-items.json");

  await writeFile(
    file,
    JSON.stringify([
      {
        workId: "task-1",
        title: "确认部署窗口",
        department: "总办",
        ownerInstanceId: "master-hq",
        stage: "dispatch",
        status: "ready",
        priority: "p0",
        summary: "确认今晚部署时间",
        latestAction: "等待总办确认",
        blockers: [],
      },
      { invalid: true },
    ]),
  );

  const items = await loadWorkItems(file);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "确认部署窗口");
  assert.equal(items[0]?.stage, "dispatch");
});

