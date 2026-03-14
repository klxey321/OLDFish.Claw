# OLDFish.Claw

`OLDFish.Claw` 是为 `4 Edge + 1 Master` 架构重写的控制面板仓库。

它不再沿用官方 `OpenClaw Control Center` 的页面与项目结构，而是直接围绕你的实际组织方式重构：

- `1 台 Master`：总办主脑，负责摘要、派单、调度
- `4 台 Edge`：设计部、运营部、运维部、文案部
- Master 机器自身也运行 OpenClaw，因此既是主控，也是实际节点

## 特性

- 单仓、TypeScript、Node.js
- `Master / Edge` 双角色运行模式
- 机械黑客风格 UI
- 默认只读
- 支持本地令牌保护只读 API
- Master 汇总 4 台 Edge 的实例摘要
- 支持 `runtime/instances.json` 实例注册
- 支持 `runtime/local-state.json` 本机状态注入

## 目录

```text
src/
  config.ts
  index.ts
  server.ts
  types.ts
  runtime/
  services/
  ui/
runtime/
  instances.example.json
  local-state.example.json
deploy/
  master.service.example
  edge.service.example
docs/
  ARCHITECTURE.md
  DEPLOYMENT.md
test/
```

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev:master
```

Edge 模式：

```bash
npm run dev:edge
```

## 运行模式

### Master

Master 页面职责：

- 查看总办主脑本机状态
- 聚合四台 Edge 摘要
- 看节点在线、阻塞、会话、任务压力
- 给总办提供调度入口和摘要判断

### Edge

Edge 页面职责：

- 仅展示本机节点状态
- 对 Master 提供只读摘要接口
- 为部署调试提供健康检查和运行说明

## 关键文件

- `runtime/instances.example.json`
  四个 Edge 加一个 Master 的实例清单模板

- `runtime/local-state.example.json`
  单机状态注入模板，可用于先把面板跑起来

- `deploy/master.service.example`
  Master 的 systemd 模板

- `deploy/edge.service.example`
  Edge 的 systemd 模板

## API

- `GET /`
  当前角色页面

- `GET /healthz`
  健康检查

- `GET /api/instance-summary`
  本机实例摘要

- `GET /api/master-summary`
  仅 Master：聚合五节点摘要

- `GET /api/instances`
  仅 Master：实例注册清单

## 安全部署约束

- 默认只读
- 不直接跨机器挂载远端目录
- Edge 只对 Master 暴露只读摘要
- 推荐用内网、VPN 或 Tailscale
- 如果配置了 `LOCAL_API_TOKEN`，Master 拉 Edge 摘要时应带对应令牌

## 开发分支

当前全重写开发分支：

- `codex/rebuild-from-scratch`

