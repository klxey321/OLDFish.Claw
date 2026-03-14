# OLDFish.Claw 部署说明

## 1. 部署目标

目标拓扑：

- 总办主脑机器部署 `Master`
- 四个部门节点机器部署 `Edge`

五节点统一纳入：

- 总办
- 设计部
- 运营部
- 运维部
- 文案部

## 2. 基础要求

每台机器至少需要：

- Node.js 22+
- npm
- 一份 `.env`
- 能运行 `OLDFish.Claw`

如果后续接真实 OpenClaw 数据，还需要：

- 本机 OpenClaw 环境
- 本机 Gateway
- 对本机运行目录的读取权限

## 3. Master 部署

Master 建议部署在总办机器。

### 拉代码

```bash
git clone <your-repo>
cd OLDFish.Claw
npm install
cp .env.example .env
```

### Master 核心配置

```env
OLDFISH_ROLE=master
INSTANCE_ID=master-hq
NODE_NAME=总办主脑
DEPARTMENT=总办
PORT=4310
INSTANCES_PATH=runtime/instances.json
WORK_ITEMS_PATH=runtime/work-items.json
LOCAL_API_TOKEN=<master-token>
FILE_EDIT_ENABLED=true
TASK_CONTROL_ENABLED=true
OPENCLAW_HOME=/root/.openclaw
OPENCLAW_SUBSCRIPTION_SNAPSHOT_PATH=<optional-subscription-snapshot>
```

### 启动

```bash
npm run dev:master
```

生产模式：

```bash
npm run build
npm run start:master
```

## 4. Edge 部署

四台部门节点机器分别部署 `Edge`。

### Edge 核心配置

```env
OLDFISH_ROLE=edge
INSTANCE_ID=edge-design
NODE_NAME=日本狐蒂云
DEPARTMENT=设计部
PORT=4311
LOCAL_STATE_PATH=runtime/local-state.json
LOCAL_API_TOKEN=<edge-token>
OPENCLAW_HOME=/root/.openclaw
```

启动：

```bash
npm run dev:edge
```

生产模式：

```bash
npm run build
npm run start:edge
```

## 5. 实例注册

Master 需要一份实例注册表。

复制模板：

```bash
cp runtime/instances.example.json runtime/instances.json
cp runtime/work-items.example.json runtime/work-items.json
```

然后填写真实信息：

- `instanceId`
- `instanceName`
- `department`
- `machineIp`
- `baseUrl`
- `summaryUrl`
- `authTokenEnvKey`

任务文件中建议填写：

- `title`
- `department`
- `ownerInstanceId`
- `stage`
- `status`
- `priority`
- `latestAction`
- `crew`
- `sessionKeys`

## 6. 状态文件

每台节点可以先用状态文件跑起来。

复制模板：

```bash
cp runtime/local-state.example.json runtime/local-state.json
```

再把这些字段改成真实值：

- `status`
- `sessionsActive`
- `queueDepth`
- `taskLoad`
- `alerts`
- `lastHeartbeatAt`

## 7. 接口验收

### Edge 验收

```bash
curl http://127.0.0.1:<edge-port>/healthz
curl -H "x-local-token: <edge-token>" http://127.0.0.1:<edge-port>/api/instance-summary
```

### Master 验收

```bash
curl http://127.0.0.1:4310/healthz
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/master-summary
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/work-items
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/staff
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/usage
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/agents
curl -H "x-local-token: <master-token>" http://127.0.0.1:4310/api/schedules
```

## 8. 反向代理建议

推荐：

- Master 前面挂 `nginx` 或 `caddy`
- Edge 仅对 Master 所在网络开放
- 优先走内网、VPN 或 Tailscale
- 域名只有在 DNS 真实解析到主控机或前置反向代理时，才能签发 HTTPS 证书

不推荐：

- 让 Edge 直接暴露到公网
- 让 Master 去挂载 Edge 的远程目录
- 在第一版就开放高风险写接口

## 9. systemd

参考文件：

- `deploy/master.service.example`
- `deploy/edge.service.example`
