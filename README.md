# OLDFish.Claw

`OLDFish.Claw` 是一套面向 `总办主脑 + 四部门节点` 的控制面板项目。

当前组织结构固定为：

- `Master / 总办主脑`
- `Edge / 设计部 / 日本狐蒂云`
- `Edge / 运营部 / 美国狐蒂云`
- `Edge / 运维部 / 腾讯新加坡`
- `Edge / 文案部 / 腾讯北京`

这套项目不是通用控制台，而是围绕我们自己的调度方式重写：

- 总办主脑看摘要
- 总办主脑安排四个部门节点干活
- 四个部门节点各自汇报本机状态
- 面板整体风格走 `机械 + 黑客 + 控制台` 路线

## 项目定位

`OLDFish.Claw` 当前分成两个角色：

### Master

Master 部署在总办机器上，负责：

- 看总办本机状态
- 汇总四台 Edge 摘要
- 看节点在线、阻塞、任务压力、告警数量
- 作为总办主脑的统一入口

### Edge

Edge 部署在四个部门节点机器上，负责：

- 读取本机状态
- 输出本机只读摘要
- 为 Master 提供统一接口

## 当前已完成

当前仓库已经完成第一轮全重写，包含：

- 全新的 `Master + Edge` 项目骨架
- 新的暗色机械黑客风基础页面
- `runtime/instances.example.json` 实例注册模板
- `runtime/local-state.example.json` 本机状态模板
- Master 聚合摘要接口
- Edge 本机摘要接口
- 新的部署文档和 systemd 示例

## 页面方向

当前页面方向已经切到 `OLDFish.Claw` 自己的风格，不再沿用旧项目视觉：

- 暗色高对比
- 机械面板感
- 终端/控制台气质
- 适合总办主脑做调度判断

后续会继续补全：

- 总览页
- 机器页
- 员工页
- 任务页
- 设置页

## 仓库结构

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
  BRAND.md
test/
```

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev:master
```

如果你要启动部门节点模式：

```bash
npm run dev:edge
```

## 关键文件

### `runtime/instances.example.json`

五节点实例模板，包含：

- 1 台 Master
- 4 台 Edge

### `runtime/local-state.example.json`

单节点本机状态模板，用来先把页面和接口跑起来。

### `deploy/master.service.example`

总办主脑机器上的 systemd 模板。

### `deploy/edge.service.example`

部门节点机器上的 systemd 模板。

## API

### `GET /`

当前节点页面。

### `GET /healthz`

基础健康检查。

### `GET /api/instance-summary`

当前节点只读摘要。

### `GET /api/master-summary`

仅 Master：聚合 4 Edge + 1 Master 摘要。

### `GET /api/instances`

仅 Master：返回实例注册清单。

## 安全原则

- 默认只读
- 不跨机器挂载远端目录
- Edge 只暴露只读摘要给 Master
- 推荐走内网、VPN 或 Tailscale
- 如启用 `LOCAL_API_TOKEN`，则摘要接口受本地令牌保护

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [部署说明](docs/DEPLOYMENT.md)
- [品牌与视觉说明](docs/BRAND.md)

