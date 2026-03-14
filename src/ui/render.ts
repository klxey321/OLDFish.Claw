import type { AggregatedSummary, AppConfig, InstanceSummary } from "../types";

export function renderMasterPage(summary: AggregatedSummary, config: AppConfig): string {
  const nodeCards = summary.nodes
    .map(
      (node) => `<article class="card node-card tone-${escapeHtml(node.status)}">
        <div class="node-head">
          <div>
            <div class="eyebrow">${escapeHtml(node.department)} / ${escapeHtml(node.role.toUpperCase())}</div>
            <h3>${escapeHtml(node.instanceName)}</h3>
          </div>
          <span class="badge badge-${escapeHtml(node.status)}">${statusLabel(node.status)}</span>
        </div>
        <div class="grid metrics">
          <div><span>会话</span><strong>${node.sessionsActive}</strong></div>
          <div><span>队列</span><strong>${node.queueDepth}</strong></div>
          <div><span>负载</span><strong>${node.taskLoad}</strong></div>
        </div>
        <div class="meta">${escapeHtml(node.region)} · ${escapeHtml(node.machineIp)} · ${escapeHtml(node.baseUrl)}</div>
        <div class="meta">Gateway ${node.connections.gatewayReachable ? "online" : "down"} · OpenClaw ${node.connections.openclawReachable ? "online" : "down"}</div>
        ${renderAlerts(node)}
      </article>`,
    )
    .join("");

  const summaryStrip = `
    <section class="hero">
      <div>
        <div class="eyebrow">MASTER CONTROL</div>
        <h1>OLDFish.Claw</h1>
        <p>总办主脑视角，管理 4 台 Edge 节点并汇总本机状态。</p>
      </div>
      <div class="hero-grid">
        <div class="hero-stat"><span>节点总数</span><strong>${summary.totals.total}</strong></div>
        <div class="hero-stat"><span>在线</span><strong>${summary.totals.online}</strong></div>
        <div class="hero-stat"><span>告警</span><strong>${summary.totals.alerts}</strong></div>
        <div class="hero-stat"><span>任务压力</span><strong>${summary.totals.taskLoad}</strong></div>
      </div>
    </section>`;

  const dispatch = `
    <section class="panel-grid">
      <article class="card action-card">
        <div class="eyebrow">总办主脑</div>
        <h2>${escapeHtml(summary.master.instanceName)}</h2>
        <p>主控机已部署 OpenClaw，当前可同时承担摘要、派单和本机执行。</p>
        <ul class="list">
          <li>本机状态：${statusLabel(summary.master.status)}</li>
          <li>本机会话：${summary.master.sessionsActive}</li>
          <li>本机队列：${summary.master.queueDepth}</li>
          <li>刷新周期：${config.uiRefreshSeconds}s</li>
        </ul>
      </article>
      <article class="card action-card">
        <div class="eyebrow">调度建议</div>
        <h2>优先级排序</h2>
        <ul class="list">
          <li>先处理 <code>offline</code> 节点，再处理 <code>degraded</code> 节点。</li>
          <li>总办优先关注告警非空、队列高于 5、负载高于 10 的节点。</li>
          <li>深钻时直接打开对应 Edge 的 URL，不在 Master 上集中编辑远端文件。</li>
        </ul>
      </article>
    </section>`;

  return renderLayout("OLDFish.Claw Master", `${summaryStrip}${dispatch}<section class="section-head"><h2>五节点态势</h2></section><section class="card-grid">${nodeCards}</section>`);
}

export function renderEdgePage(summary: InstanceSummary): string {
  return renderLayout(
    `OLDFish.Claw Edge - ${summary.instanceName}`,
    `<section class="hero edge-hero">
      <div>
        <div class="eyebrow">EDGE NODE</div>
        <h1>${escapeHtml(summary.instanceName)}</h1>
        <p>${escapeHtml(summary.department)} 节点，向 Master 提供只读摘要。</p>
      </div>
      <div class="hero-grid">
        <div class="hero-stat"><span>状态</span><strong>${statusLabel(summary.status)}</strong></div>
        <div class="hero-stat"><span>会话</span><strong>${summary.sessionsActive}</strong></div>
        <div class="hero-stat"><span>队列</span><strong>${summary.queueDepth}</strong></div>
        <div class="hero-stat"><span>负载</span><strong>${summary.taskLoad}</strong></div>
      </div>
    </section>
    <section class="panel-grid">
      <article class="card action-card">
        <div class="eyebrow">连接</div>
        <h2>本机接线</h2>
        <ul class="list">
          <li>Gateway：${summary.connections.gatewayReachable ? "已连接" : "未连接"}</li>
          <li>OpenClaw：${summary.connections.openclawReachable ? "已连接" : "未连接"}</li>
          <li>本地地址：${escapeHtml(summary.baseUrl)}</li>
        </ul>
      </article>
      <article class="card action-card">
        <div class="eyebrow">接口</div>
        <h2>只读 API</h2>
        <ul class="list">
          <li><code>/healthz</code></li>
          <li><code>/api/instance-summary</code></li>
        </ul>
      </article>
    </section>
    <section class="card-grid">
      <article class="card node-card tone-${escapeHtml(summary.status)}">
        <div class="node-head">
          <div>
            <div class="eyebrow">${escapeHtml(summary.department)} / ${escapeHtml(summary.region)}</div>
            <h3>${escapeHtml(summary.instanceName)}</h3>
          </div>
          <span class="badge badge-${escapeHtml(summary.status)}">${statusLabel(summary.status)}</span>
        </div>
        <div class="grid metrics">
          <div><span>会话</span><strong>${summary.sessionsActive}</strong></div>
          <div><span>队列</span><strong>${summary.queueDepth}</strong></div>
          <div><span>负载</span><strong>${summary.taskLoad}</strong></div>
        </div>
        ${renderAlerts(summary)}
      </article>
    </section>`,
  );
}

function renderAlerts(node: InstanceSummary): string {
  if (node.alerts.length === 0) return `<div class="meta">当前无显式告警。</div>`;
  return `<ul class="alerts">${node.alerts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderLayout(title: string, body: string): string {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          --bg: #06080d;
          --panel: rgba(11, 16, 24, 0.9);
          --panel-strong: rgba(15, 21, 31, 0.98);
          --text: #e6edf7;
          --muted: #93a3b8;
          --line: rgba(73, 98, 130, 0.36);
          --green: #6aff9b;
          --cyan: #4df7ff;
          --orange: #ffb347;
          --red: #ff5c7a;
          --shadow: 0 28px 60px rgba(0, 0, 0, 0.45);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: var(--text);
          font: 14px/1.6 "SF Pro Display", "JetBrains Mono", "PingFang SC", sans-serif;
          background:
            radial-gradient(circle at 20% 10%, rgba(77, 247, 255, 0.12), transparent 24%),
            radial-gradient(circle at 85% 0%, rgba(106, 255, 155, 0.08), transparent 22%),
            linear-gradient(180deg, #04060a 0%, #070a11 100%);
          min-height: 100vh;
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(77, 247, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(77, 247, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          opacity: 0.18;
        }
        main {
          position: relative;
          max-width: 1480px;
          margin: 0 auto;
          padding: 28px;
        }
        .hero, .card {
          background: linear-gradient(180deg, rgba(11,16,24,0.96), rgba(9,13,20,0.92));
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          border-radius: 22px;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(360px, 1fr);
          gap: 20px;
          padding: 26px;
          margin-bottom: 22px;
        }
        .edge-hero { grid-template-columns: 1.4fr 1fr; }
        .hero h1 { margin: 0; font-size: 42px; letter-spacing: -0.04em; }
        .hero p { color: var(--muted); max-width: 720px; }
        .hero-grid, .grid.metrics, .panel-grid, .card-grid {
          display: grid;
          gap: 16px;
        }
        .hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 22px; }
        .card-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .hero-stat, .node-card, .action-card { position: relative; overflow: hidden; }
        .hero-stat {
          background: rgba(5, 11, 18, 0.88);
          border: 1px solid rgba(77, 247, 255, 0.18);
          border-radius: 18px;
          padding: 18px;
        }
        .hero-stat span, .metrics span, .eyebrow, .meta { color: var(--muted); }
        .hero-stat strong, .metrics strong {
          display: block;
          margin-top: 6px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }
        .eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }
        .section-head { margin: 8px 0 14px; }
        .section-head h2 { margin: 0; font-size: 26px; }
        .card { padding: 22px; }
        .node-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .node-head h3, .action-card h2 { margin: 4px 0 0; font-size: 26px; }
        .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 14px; }
        .metrics div {
          border: 1px solid rgba(77, 247, 255, 0.12);
          background: rgba(5, 11, 18, 0.84);
          border-radius: 16px;
          padding: 12px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-online { color: #02180b; background: var(--green); }
        .badge-degraded { color: #2b1500; background: var(--orange); }
        .badge-offline { color: #2a0710; background: var(--red); }
        .badge-unknown { color: #001d22; background: var(--cyan); }
        .alerts, .list {
          margin: 12px 0 0;
          padding-left: 18px;
        }
        .alerts li { color: #ffc7d1; }
        code {
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(77, 247, 255, 0.12);
          color: var(--cyan);
        }
        @media (max-width: 900px) {
          .hero, .panel-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <main>${body}</main>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(status: InstanceSummary["status"]): string {
  if (status === "online") return "ONLINE";
  if (status === "degraded") return "DEGRADED";
  if (status === "offline") return "OFFLINE";
  return "UNKNOWN";
}
