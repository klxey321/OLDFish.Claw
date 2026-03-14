import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadInstances } from "../src/runtime/instances";

test("loadInstances parses valid entries and drops malformed rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oldfish-instances-"));
  const file = join(dir, "instances.json");
  await writeFile(
    file,
    JSON.stringify([
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
      {
        broken: true,
      },
    ]),
  );

  const items = await loadInstances(file);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.instanceId, "master-hq");
  assert.equal(items[0]?.role, "master");
});

