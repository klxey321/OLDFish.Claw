# Architecture

## Topology

`OLDFish.Claw` 使用 `4 Edge + 1 Master` 结构：

- Master：总办主脑
- Edge：设计、运营、运维、文案

Master 负责：

- 展示总办主机本机状态
- 读取 `runtime/instances.json`
- 拉取四台 Edge 的只读摘要
- 聚合状态、队列、风险和压力

Edge 负责：

- 读取本机环境与 `runtime/local-state.json`
- 输出本机摘要
- 供 Master 拉取

## Data Flow

1. 每台 Edge 本机生成 `instance-summary`
2. Master 读取实例清单
3. Master 请求 Edge 的 `/api/instance-summary`
4. Master 聚合出总控视图

## Safety

- 默认为只读
- API 仅用于摘要读取
- 本地令牌为可选强化门
- 不提供远程写 OpenClaw 配置的能力

