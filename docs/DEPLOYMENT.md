# Deployment

## 1. 准备

每台机器需要：

- Node.js 22+
- npm
- OpenClaw
- 一份 `.env`

## 2. Master 部署

```bash
git clone <your-repo>
cd OLDFish.Claw
npm install
cp .env.example .env
```

Master 重点配置：

- `OLDFISH_ROLE=master`
- `INSTANCE_ID=master-hq`
- `PORT=4310`
- `INSTANCES_PATH=runtime/instances.json`
- `LOCAL_API_TOKEN=<master-local-token>`

## 3. Edge 部署

Edge 重点配置：

- `OLDFISH_ROLE=edge`
- `INSTANCE_ID=<edge-id>`
- `PORT=<edge-port>`
- `LOCAL_API_TOKEN=<edge-token>`
- `LOCAL_STATE_PATH=runtime/local-state.json`

## 4. 实例注册

复制：

```bash
cp runtime/instances.example.json runtime/instances.json
```

然后按真实 IP、URL、端口、令牌环境变量名填写。

## 5. systemd

参考：

- `deploy/master.service.example`
- `deploy/edge.service.example`

## 6. 反向代理

推荐：

- Master 前面加 `nginx` 或 `caddy`
- Edge 仅对 Master 所在网络开放

