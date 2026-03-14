# OLDFish.Claw 架构说明

## 1. 总体结构

`OLDFish.Claw` 固定采用：

- `1 台 Master`
- `4 台 Edge`

对应关系：

- Master：总办主脑
- Edge：设计部、运营部、运维部、文案部

Master 机器本身也部署 OpenClaw，因此它既是主控，也是实际节点。

## 2. 角色职责

### Master

Master 的职责不是代替 Edge 做本机计算，而是：

1. 读取实例注册表
2. 拉取四台 Edge 的只读摘要
3. 汇总总办主脑本机状态
4. 输出总控视角页面

### Edge

Edge 的职责是：

1. 读取本机状态文件
2. 输出本机摘要
3. 向 Master 提供只读 API

## 3. 数据流

### Step 1

每台 Edge 读取本机：

- `.env`
- `runtime/local-state.json`

### Step 2

Edge 生成：

- `GET /api/instance-summary`

### Step 3

Master 读取：

- `runtime/instances.json`
- `runtime/work-items.json`

### Step 4

Master 对四台 Edge 发起：

- `GET /api/instance-summary`

### Step 5

Master 汇总为：

- `GET /api/master-summary`
- Master 首页总控视图

## 4. 当前代码模块

### `src/config.ts`

统一读取运行配置。

### `src/runtime/instances.ts`

实例清单读取与规范化。

### `src/runtime/local-state.ts`

本机状态文件读取。

### `src/runtime/work-items.ts`

任务链路清单读取。

### `src/services/local-summary.ts`

把本机状态转换成统一摘要。

### `src/services/master-summary.ts`

Master 汇总本机和四台 Edge 的摘要。

### `src/server.ts`

HTTP 路由层。

### `src/ui/render.ts`

当前的 Master / Edge 页面输出，包含：

- 总览
- 机器
- 员工
- 任务
- 设置

## 5. 安全边界

当前架构严格保持：

1. 默认只读。
2. 不远程改写其他节点文件。
3. 不远程改写 OpenClaw 配置。
4. Edge 只提供摘要，不提供高风险写接口。
5. 如果启用 `LOCAL_API_TOKEN`，摘要接口需带令牌。

## 6. 后续扩展方向

下一阶段会继续往这几个方向补：

1. 接入真实 OpenClaw 运行信号
2. 增加机器页、员工页、任务页、设置页
3. 增加更细的节点状态判定
4. 增加总办主脑调度视图
