import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config";

test("loadConfig keeps master defaults", () => {
  const config = loadConfig({});
  assert.equal(config.role, "master");
  assert.equal(config.port, 4310);
  assert.equal(config.instanceId, "master-hq");
  assert.equal(config.nodeName, "总办主脑");
  assert.equal(config.defaultStatus, "online");
});

test("loadConfig respects edge overrides", () => {
  const config = loadConfig({
    OLDFISH_ROLE: "edge",
    PORT: "4314",
    INSTANCE_ID: "edge-copy",
    NODE_NAME: "腾讯北京",
    EDGE_STATUS: "degraded",
    EDGE_ALERTS: "a,b",
  });

  assert.equal(config.role, "edge");
  assert.equal(config.port, 4314);
  assert.equal(config.instanceId, "edge-copy");
  assert.equal(config.nodeName, "腾讯北京");
  assert.equal(config.defaultStatus, "degraded");
  assert.deepEqual(config.defaultAlerts, ["a", "b"]);
});

