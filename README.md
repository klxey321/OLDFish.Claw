# OLDFish.Claw

`OLDFish.Claw` 是我们自己的总控面板项目。

它服务的不是通用场景，而是我们当前已经确定的组织结构和调度模式：

- `1 台 Master`：总办主脑
- `4 台 Edge`：设计部、运营部、运维部、文案部

总办主脑负责看全局摘要、判断风险、安排任务，四个部门节点负责执行并回传本机状态。

---

## 项目目标

这个项目的目标很明确：

1. 把总办和四个部门节点统一放到一个控制面板里。
2. 让总办主脑能直接看出谁在线、谁忙、谁阻塞、谁需要处理。
3. 让四个 Edge 节点都能以只读方式汇报本机状态。
4. 形成一套适合我们自己部署和扩展的 `Master + Edge` 架构。

---

## 当前组织结构

当前节点命名固定为：

- `Master / 总办主脑`
- `Edge / 设计部 / 日本狐蒂云`
- `Edge / 运营部 / 美国狐蒂云`
- `Edge / 运维部 / 腾讯新加坡`
- `Edge / 文案部 / 腾讯北京`

Master 机器本身也运行 OpenClaw，所以它既是总控入口，也是实际工作节点。

---

## 项目定位

`OLDFish.Claw` 不是一套通用 SaaS 后台，也不是原项目的换皮版。

它是围绕我们自己的工作方式重写的：

- 总办主脑看摘要
- 总办主脑做调度
- 四个部门节点负责执行
- 面板整体风格走 `机械 + 黑客 + 控制台` 路线

---

## 当前已完成

当前仓库已经完成第一轮全重写，包含：

- 全新的 `Master + Edge` 项目骨架
- 新的暗色机械黑客风基础页面
- 新的实例注册方式
- 新的本机状态文件方式
- 新的任务清单模板方式
- Master 聚合摘要接口
- Edge 节点只读摘要接口
- 新的部署文档
- 新的品牌与视觉文档

---

## 当前页面方向

当前页面已经不再沿用旧项目视觉，方向统一为：

- 暗色高对比
- 冷峻机械感
- 控制台读数气质
- 适合总办主脑做调度判断

当前 Master 已具备这些页面：

- 总览页
- 用量页
- 机器页
- 员工页
- 记忆页
- 文档页
- 任务页
- 设置页

---

## 运行模式

### Master

Master 部署在总办机器，负责：

- 展示总办本机状态
- 汇总 4 台 Edge 摘要
- 输出总控视角页面
- 给总办主脑提供统一入口

### Edge

Edge 部署在部门节点机器，负责：

- 读取本机状态
- 输出本机只读摘要
- 提供给 Master 拉取

---

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
  work-items.example.json
deploy/
  master.service.example
  edge.service.example
docs/
  ARCHITECTURE.md
  DEPLOYMENT.md
  BRAND.md
test/
```

---

## 本地启动

安装依赖：

```bash
npm install
```

复制环境变量：

```bash
cp .env.example .env
```

启动 Master：

```bash
npm run dev:master
```

启动 Edge：

```bash
npm run dev:edge
```

---

## 核心文件

### `runtime/instances.example.json`

五节点实例模板，用于注册：

- 1 台 Master
- 4 台 Edge

### `runtime/local-state.example.json`

单节点本机状态模板，用于先把页面和接口跑起来。

### `runtime/work-items.example.json`

任务链路模板，用于在 Master 上展示派单、执行、交付、验收四阶段任务。

### `deploy/master.service.example`

总办主脑机器上的 systemd 模板。

### `deploy/edge.service.example`

部门节点机器上的 systemd 模板。

---

## 接口

### `GET /`

当前节点页面。

### `GET /healthz`

基础健康检查。

### `GET /api/instance-summary`

当前节点只读摘要。

### `GET /api/master-summary`

仅 Master：聚合 `4 Edge + 1 Master` 摘要。

### `GET /api/instances`

仅 Master：返回实例注册清单。

### `GET /api/work-items`

仅 Master：返回当前任务链路清单。

### `GET /api/staff`

仅 Master：返回当前节点员工视图。

### `GET /api/usage`

返回当前主脑用量、订阅与连接状态摘要。

### `GET /api/agents`

返回当前活跃智能体、活跃会话和当前工作摘要。

### `GET /api/schedules`

返回定时任务与心跳摘要。

### `GET /api/workbench?kind=memory|docs`

返回记忆 / 文档工作台文件列表。

### `GET /api/workbench-file?kind=memory|docs&file=<relative-path>`

返回指定记忆 / 文档文件内容。

### `POST /api/workbench-file`

带本地 token 时可将记忆 / 文档文件写回到 OpenClaw 实际工作目录。

### `POST /api/work-items/stop`

带本地 token 时可从总办主脑直接停止任务，并回写任务清单。

---

## 安全原则

- 默认只读
- 不跨机器挂载远端目录
- Edge 只向 Master 暴露只读摘要
- 推荐走内网、VPN 或 Tailscale
- 如果启用 `LOCAL_API_TOKEN`，摘要接口受本地令牌保护

---

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [部署说明](docs/DEPLOYMENT.md)
- [品牌与视觉说明](docs/BRAND.md)

---

## 当前开发分支

当前重写分支：

- `codex/rebuild-from-scratch`
