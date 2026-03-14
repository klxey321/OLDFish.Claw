import type { AggregatedSummary, AppConfig, InstanceConfig, InstanceSummary, StaffView, WorkItem } from "../types";

export type MasterSection = "overview" | "machines" | "staff" | "tasks" | "settings";

interface MasterRenderInput {
  section: MasterSection;
  summary: AggregatedSummary;
  config: AppConfig;
  staffViews: StaffView[];
  workItems: WorkItem[];
  instances: InstanceConfig[];
}

export function renderMasterPage(input: MasterRenderInput): string {
  const title = `OLDFish.Claw ${sectionLabel(input.section)}`;
  const body = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-card">
          <div class="brand-chip">MASTER CORE</div>
          <h1>OLDFish.Claw</h1>
          <p>总办主脑控制 4 台 Edge 节点，负责摘要、派单、调度和风险判断。</p>
          <div class="brand-meta">节点数 ${input.summary.totals.total} · 在线 ${input.summary.totals.online} · 刷新 ${input.config.uiRefreshSeconds}s</div>
        </div>
        <nav class="nav-list">
          ${renderNavLink("overview", input.section)}
          ${renderNavLink("machines", input.section)}
          ${renderNavLink("staff", input.section)}
          ${renderNavLink("tasks", input.section)}
          ${renderNavLink("settings", input.section)}
        </nav>
        <section class="side-panel">
          <div class="eyebrow">主脑状态</div>
          <div class="side-kpi">${statusLabel(input.summary.master.status)}</div>
          <div class="side-copy">本机会话 ${input.summary.master.sessionsActive} · 本机队列 ${input.summary.master.queueDepth}</div>
        </section>
      </aside>
      <main class="content">
        ${renderMasterHero(input)}
        ${renderSection(input)}
      </main>
    </div>`;

  return renderLayout(title, body);
}

export function renderEdgePage(summary: InstanceSummary): string {
  return renderLayout(
    `OLDFish.Claw Edge - ${summary.instanceName}`,
    `<div class="edge-shell">
      <section class="hero edge-hero">
        <div>
          <div class="brand-chip">EDGE NODE</div>
          <h1>${escapeHtml(summary.instanceName)}</h1>
          <p>${escapeHtml(summary.department)} 节点，向 Master 提供只读摘要。</p>
        </div>
        <div class="hero-grid">
          ${renderHeroStat("状态", statusLabel(summary.status))}
          ${renderHeroStat("会话", String(summary.sessionsActive))}
          ${renderHeroStat("队列", String(summary.queueDepth))}
          ${renderHeroStat("负载", String(summary.taskLoad))}
        </div>
      </section>
      <section class="panel-grid">
        <article class="panel">
          <div class="eyebrow">接线状态</div>
          <h2>本机连接</h2>
          <ul class="detail-list">
            <li>Gateway：${summary.connections.gatewayReachable ? "已连接" : "未连接"}</li>
            <li>OpenClaw：${summary.connections.openclawReachable ? "已连接" : "未连接"}</li>
            <li>地址：${escapeHtml(summary.baseUrl)}</li>
          </ul>
        </article>
        <article class="panel">
          <div class="eyebrow">只读接口</div>
          <h2>API</h2>
          <ul class="detail-list">
            <li><code>/healthz</code></li>
            <li><code>/api/instance-summary</code></li>
          </ul>
        </article>
      </section>
      <section class="card-grid">
        ${renderMachineCard(summary)}
      </section>
    </div>`,
  );
}

function renderSection(input: MasterRenderInput): string {
  if (input.section === "machines") return renderMachinesSection(input.summary.nodes);
  if (input.section === "staff") return renderStaffSection(input.staffViews);
  if (input.section === "tasks") return renderTasksSection(input.workItems, input.summary.nodes);
  if (input.section === "settings") return renderSettingsSection(input);
  return renderOverviewSection(input);
}

function renderOverviewSection(input: MasterRenderInput): string {
  const urgent = input.workItems.filter((item) => item.priority === "p0" || item.status === "blocked").slice(0, 4);
  const riskyNodes = input.summary.nodes.filter((node) => node.status !== "online").slice(0, 4);
  const activeStaff = input.staffViews.filter((item) => item.state === "busy_running").slice(0, 4);
  return `
    <section class="grid-three">
      <article class="panel">
        <div class="eyebrow">高优先级任务</div>
        <h2>待总办处理</h2>
        ${urgent.length > 0 ? `<div class="stack-list">${urgent.map(renderUrgentItem).join("")}</div>` : `<div class="empty-copy">当前没有 P0 或阻塞任务。</div>`}
      </article>
      <article class="panel">
        <div class="eyebrow">风险节点</div>
        <h2>需要干预</h2>
        ${riskyNodes.length > 0 ? `<div class="stack-list">${riskyNodes.map(renderRiskNode).join("")}</div>` : `<div class="empty-copy">所有节点当前都在线稳定。</div>`}
      </article>
      <article class="panel">
        <div class="eyebrow">活跃部门</div>
        <h2>正在推进</h2>
        ${activeStaff.length > 0 ? `<div class="stack-list">${activeStaff.map(renderStaffPulse).join("")}</div>` : `<div class="empty-copy">当前没有高活动节点。</div>`}
      </article>
    </section>
    <section class="section-head"><h2>五节点态势</h2></section>
    <section class="card-grid">
      ${input.summary.nodes.map(renderMachineCard).join("")}
    </section>`;
}

function renderMachinesSection(nodes: InstanceSummary[]): string {
  return `
    <section class="section-head"><h2>机器页</h2><div class="section-copy">4 台 Edge + 1 台 Master 的在线、负载、会话与告警状态。</div></section>
    <section class="card-grid">
      ${nodes.map(renderMachineCard).join("")}
    </section>`;
}

function renderStaffSection(staffViews: StaffView[]): string {
  const byDepartment = new Map<string, StaffView[]>();
  for (const item of staffViews) {
    const current = byDepartment.get(item.department) ?? [];
    current.push(item);
    byDepartment.set(item.department, current);
  }

  return `
    <section class="section-head"><h2>员工页</h2><div class="section-copy">按部门和节点查看当前状态、最新任务与阻塞原因。</div></section>
    ${[...byDepartment.entries()]
      .map(
        ([department, items]) => `<section class="department-shell">
          <div class="department-head">
            <div class="eyebrow">DEPARTMENT</div>
            <h2>${escapeHtml(department)}</h2>
          </div>
          <div class="card-grid">
            ${items.map(renderStaffCard).join("")}
          </div>
        </section>`,
      )
      .join("")}`;
}

function renderTasksSection(workItems: WorkItem[], nodes: InstanceSummary[]): string {
  const columns: Array<{ stage: WorkItem["stage"]; label: string }> = [
    { stage: "dispatch", label: "派单" },
    { stage: "execution", label: "执行" },
    { stage: "delivery", label: "交付" },
    { stage: "acceptance", label: "验收" },
  ];

  return `
    <section class="section-head"><h2>任务页</h2><div class="section-copy">以派单 → 执行 → 交付 → 验收的链路查看当前推进状态。</div></section>
    <section class="task-board">
      ${columns
        .map(({ stage, label }) => {
          const items = workItems.filter((item) => item.stage === stage);
          return `<article class="task-column">
            <header class="task-column-head">
              <h3>${label}</h3>
              <span>${items.length}</span>
            </header>
            <div class="task-column-body">
              ${items.length > 0 ? items.map((item) => renderTaskCard(item, nodes)).join("") : `<div class="empty-copy">当前没有任务。</div>`}
            </div>
          </article>`;
        })
        .join("")}
    </section>`;
}

function renderSettingsSection(input: MasterRenderInput): string {
  return `
    <section class="grid-two">
      <article class="panel">
        <div class="eyebrow">接线状态</div>
        <h2>当前配置</h2>
        <ul class="detail-list">
          <li>角色：${input.config.role}</li>
          <li>实例 ID：${escapeHtml(input.config.instanceId)}</li>
          <li>本机地址：${escapeHtml(input.config.baseUrl)}</li>
          <li>实例清单：${escapeHtml(input.config.instancesPath)}</li>
          <li>任务清单：${escapeHtml(input.config.workItemsPath)}</li>
          <li>令牌保护：${input.config.localTokenAuthRequired ? "开启" : "关闭"}</li>
        </ul>
      </article>
      <article class="panel">
        <div class="eyebrow">部署建议</div>
        <h2>Master 原则</h2>
        <ul class="detail-list">
          <li>Master 只聚合摘要，不跨机器挂载远端目录。</li>
          <li>Edge 仅向 Master 暴露只读摘要接口。</li>
          <li>真实部署建议走内网、VPN 或 Tailscale。</li>
          <li>高风险写接口保持关闭。</li>
        </ul>
      </article>
    </section>
    <section class="section-head"><h2>实例注册</h2></section>
    <section class="card-grid">
      ${input.instances.length > 0 ? input.instances.map(renderInstanceCard).join("") : `<article class="panel"><div class="empty-copy">还没有加载到 runtime/instances.json，当前仅显示本机 Master。</div></article>`}
    </section>`;
}

function renderMasterHero(input: MasterRenderInput): string {
  const badgeCounts = [
    renderHeroStat("节点", String(input.summary.totals.total)),
    renderHeroStat("在线", String(input.summary.totals.online)),
    renderHeroStat("告警", String(input.summary.totals.alerts)),
    renderHeroStat("任务压力", String(input.summary.totals.taskLoad)),
  ].join("");

  return `
    <section class="hero">
      <div>
        <div class="brand-chip">MASTER CONTROL</div>
        <h1>${sectionLabel(input.section)}</h1>
        <p>${sectionLead(input.section)}</p>
      </div>
      <div class="hero-grid">${badgeCounts}</div>
    </section>`;
}

function renderMachineCard(node: InstanceSummary): string {
  return `<article class="panel machine-card tone-${escapeHtml(node.status)}">
    <div class="machine-head">
      <div>
        <div class="eyebrow">${escapeHtml(node.department)} / ${escapeHtml(node.role.toUpperCase())}</div>
        <h3>${escapeHtml(node.instanceName)}</h3>
      </div>
      <span class="badge badge-${escapeHtml(node.status)}">${statusLabel(node.status)}</span>
    </div>
    <div class="metric-row">
      <div><span>会话</span><strong>${node.sessionsActive}</strong></div>
      <div><span>队列</span><strong>${node.queueDepth}</strong></div>
      <div><span>负载</span><strong>${node.taskLoad}</strong></div>
    </div>
    <div class="meta">${escapeHtml(node.region)} · ${escapeHtml(node.machineIp)}</div>
    <div class="meta">Gateway ${node.connections.gatewayReachable ? "online" : "down"} · OpenClaw ${node.connections.openclawReachable ? "online" : "down"}</div>
    ${node.alerts.length > 0 ? `<ul class="alerts">${node.alerts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<div class="meta">当前无显式告警。</div>`}
  </article>`;
}

function renderStaffCard(item: StaffView): string {
  return `<article class="panel staff-card state-${escapeHtml(item.state)}">
    <div class="machine-head">
      <div>
        <div class="eyebrow">${escapeHtml(item.department)} / ${escapeHtml(item.region)}</div>
        <h3>${escapeHtml(item.nodeName)}</h3>
      </div>
      <span class="badge badge-${escapeHtml(mapStaffStateBadge(item.state))}">${staffStateLabel(item.state)}</span>
    </div>
    <div class="meta">当前任务：${escapeHtml(item.currentTask ?? "待命中")}</div>
    <div class="copy-box">${escapeHtml(item.recentOutput)}</div>
    <ul class="detail-list">
      <li>阻塞：${escapeHtml(item.blocker ?? "无")}</li>
      <li>预计交付：${escapeHtml(item.expectedDelivery ?? "待定")}</li>
      <li>最近验收：${escapeHtml(item.acceptanceNote ?? "暂无")}</li>
    </ul>
  </article>`;
}

function renderTaskCard(item: WorkItem, nodes: InstanceSummary[]): string {
  const owner = nodes.find((node) => node.instanceId === item.ownerInstanceId);
  return `<article class="task-card task-${escapeHtml(item.status)}">
    <div class="task-top">
      <span class="badge badge-${escapeHtml(mapTaskStatusBadge(item.status))}">${taskStatusLabel(item.status)}</span>
      <span class="priority">${escapeHtml(item.priority.toUpperCase())}</span>
    </div>
    <h4>${escapeHtml(item.title)}</h4>
    <div class="meta">${escapeHtml(item.department)} · ${escapeHtml(owner?.instanceName ?? item.ownerInstanceId)}</div>
    <p>${escapeHtml(item.summary)}</p>
    <div class="copy-box">${escapeHtml(item.latestAction)}</div>
    <ul class="detail-list">
      <li>阻塞：${escapeHtml(item.blockers[0] ?? "无")}</li>
      <li>截止：${escapeHtml(item.dueAt ?? "待定")}</li>
      <li>验收：${escapeHtml(item.acceptanceNote ?? "暂无")}</li>
    </ul>
  </article>`;
}

function renderInstanceCard(instance: InstanceConfig): string {
  return `<article class="panel">
    <div class="machine-head">
      <div>
        <div class="eyebrow">${escapeHtml(instance.department)} / ${escapeHtml(instance.role.toUpperCase())}</div>
        <h3>${escapeHtml(instance.instanceName)}</h3>
      </div>
      <span class="badge badge-${instance.enabled ? "online" : "offline"}">${instance.enabled ? "ENABLED" : "DISABLED"}</span>
    </div>
    <ul class="detail-list">
      <li>地址：${escapeHtml(instance.baseUrl)}</li>
      <li>摘要：${escapeHtml(instance.summaryUrl ?? `${instance.baseUrl}/api/instance-summary`)}</li>
      <li>区域：${escapeHtml(instance.region)}</li>
      <li>机器：${escapeHtml(instance.machineIp)}</li>
    </ul>
  </article>`;
}

function renderNavLink(section: MasterSection, current: MasterSection): string {
  return `<a class="nav-link${section === current ? " active" : ""}" href="${section === "overview" ? "/" : `/${section}`}">
    <span>${sectionLabel(section)}</span>
    <small>${sectionHint(section)}</small>
  </a>`;
}

function renderUrgentItem(item: WorkItem): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(item.title)}</strong>
    <span>${escapeHtml(item.department)} · ${taskStatusLabel(item.status)} · ${escapeHtml(item.priority.toUpperCase())}</span>
  </div>`;
}

function renderRiskNode(node: InstanceSummary): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(node.instanceName)}</strong>
    <span>${statusLabel(node.status)} · ${escapeHtml(node.alerts[0] ?? "连接异常")}</span>
  </div>`;
}

function renderStaffPulse(item: StaffView): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(item.nodeName)}</strong>
    <span>${staffStateLabel(item.state)} · ${escapeHtml(item.currentTask ?? "待命")}</span>
  </div>`;
}

function renderHeroStat(label: string, value: string): string {
  return `<div class="hero-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
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
          --panel: rgba(10, 15, 24, 0.95);
          --panel-alt: rgba(6, 12, 20, 0.92);
          --line: rgba(74, 99, 131, 0.34);
          --text: #ecf2fb;
          --muted: #92a2b8;
          --green: #6aff9b;
          --cyan: #4df7ff;
          --orange: #ffb347;
          --red: #ff5c7a;
          --shadow: 0 28px 60px rgba(0, 0, 0, 0.42);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: var(--text);
          font: 14px/1.6 "SF Pro Display", "JetBrains Mono", "PingFang SC", sans-serif;
          background:
            radial-gradient(circle at 12% 0%, rgba(77,247,255,.14), transparent 24%),
            radial-gradient(circle at 100% 0%, rgba(106,255,155,.08), transparent 22%),
            linear-gradient(180deg, #03050a 0%, #070b12 100%);
          min-height: 100vh;
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(77,247,255,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(77,247,255,.04) 1px, transparent 1px);
          background-size: 34px 34px;
          pointer-events: none;
          opacity: 0.18;
        }
        a { color: inherit; text-decoration: none; }
        code {
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(77,247,255,.12);
          color: var(--cyan);
        }
        .shell {
          position: relative;
          max-width: 1680px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          grid-template-columns: 310px minmax(0, 1fr);
          gap: 20px;
        }
        .edge-shell {
          position: relative;
          max-width: 1480px;
          margin: 0 auto;
          padding: 24px;
        }
        .sidebar {
          position: sticky;
          top: 24px;
          align-self: start;
          display: grid;
          gap: 16px;
        }
        .brand-card, .side-panel, .panel, .hero, .task-column {
          background: linear-gradient(180deg, rgba(10,15,24,0.98), rgba(8,12,20,0.94));
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow);
        }
        .brand-card, .side-panel, .panel, .task-column { padding: 20px; }
        .brand-card h1, .hero h1 { margin: 8px 0 0; letter-spacing: -0.04em; }
        .brand-card h1 { font-size: 38px; }
        .brand-card p, .hero p, .section-copy, .brand-meta, .meta, .stack-item span, .nav-link small, .empty-copy {
          color: var(--muted);
        }
        .nav-list { display: grid; gap: 10px; }
        .nav-link {
          display: block;
          border: 1px solid rgba(77,247,255,.12);
          background: rgba(6,10,16,.78);
          border-radius: 18px;
          padding: 12px 14px;
          transition: transform .18s ease, border-color .18s ease;
        }
        .nav-link:hover { transform: translateY(-1px); border-color: rgba(77,247,255,.28); }
        .nav-link.active {
          border-color: rgba(77,247,255,.45);
          background: linear-gradient(180deg, rgba(10,20,31,.96), rgba(9,17,26,.92));
        }
        .nav-link span { display: block; font-size: 16px; font-weight: 700; }
        .nav-link small { display: block; margin-top: 4px; }
        .side-kpi { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; margin-top: 6px; }
        .content { display: grid; gap: 20px; }
        .brand-chip, .eyebrow {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid rgba(77,247,255,.22);
          color: var(--cyan);
          background: rgba(77,247,255,.08);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(360px, 1fr);
          gap: 20px;
          padding: 24px;
        }
        .hero h1 { font-size: 42px; }
        .hero-grid, .grid-two, .grid-three, .card-grid, .panel-grid, .metric-row, .task-board {
          display: grid;
          gap: 16px;
        }
        .hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .card-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
        .task-board { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; }
        .hero-stat, .stack-item, .copy-box, .task-card, .metric-row div {
          background: rgba(5,11,18,.82);
          border: 1px solid rgba(77,247,255,.13);
          border-radius: 18px;
        }
        .hero-stat { padding: 16px; }
        .hero-stat strong { display: block; margin-top: 6px; font-size: 30px; letter-spacing: -0.04em; }
        .section-head { display: flex; justify-content: space-between; align-items: end; gap: 12px; }
        .section-head h2, .panel h2, .task-column h3 { margin: 8px 0 0; font-size: 26px; letter-spacing: -0.03em; }
        .machine-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 14px; }
        .machine-head h3 { margin: 6px 0 0; font-size: 24px; }
        .metric-row { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 14px; }
        .metric-row div { padding: 12px; }
        .metric-row span, .hero-stat span { color: var(--muted); display: block; }
        .metric-row strong { display: block; margin-top: 4px; font-size: 24px; letter-spacing: -0.03em; }
        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .badge-online { background: var(--green); color: #03150a; }
        .badge-degraded { background: var(--orange); color: #271400; }
        .badge-offline { background: var(--red); color: #280710; }
        .badge-unknown { background: var(--cyan); color: #00181d; }
        .stack-list { display: grid; gap: 12px; margin-top: 14px; }
        .stack-item { padding: 14px; }
        .stack-item strong { display: block; margin-bottom: 4px; }
        .alerts, .detail-list { margin: 12px 0 0; padding-left: 18px; }
        .alerts li { color: #ffc7d1; }
        .copy-box {
          padding: 12px 14px;
          margin-top: 12px;
          color: #d7e2f0;
        }
        .department-shell { display: grid; gap: 14px; }
        .department-head h2 { margin: 4px 0 0; font-size: 28px; }
        .task-column-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .task-column-body { display: grid; gap: 12px; }
        .task-card { padding: 16px; }
        .task-card h4 { margin: 10px 0 8px; font-size: 20px; letter-spacing: -0.02em; }
        .task-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .priority { color: var(--muted); font-weight: 800; letter-spacing: .08em; font-size: 12px; }
        .task-ready { border-color: rgba(77,247,255,.16); }
        .task-running { border-color: rgba(106,255,155,.18); }
        .task-blocked { border-color: rgba(255,91,122,.24); }
        .task-review { border-color: rgba(255,179,71,.22); }
        .task-done { border-color: rgba(77,247,255,.16); }
        .empty-copy { padding: 14px; border: 1px dashed rgba(77,247,255,.16); border-radius: 16px; }
        @media (max-width: 1180px) {
          .shell { grid-template-columns: 1fr; }
          .sidebar { position: static; }
          .grid-three, .task-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .hero, .hero-grid, .grid-two, .grid-three, .panel-grid, .task-board { grid-template-columns: 1fr; }
          .card-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

function sectionLabel(section: MasterSection): string {
  if (section === "machines") return "机器页";
  if (section === "staff") return "员工页";
  if (section === "tasks") return "任务页";
  if (section === "settings") return "设置页";
  return "总览";
}

function sectionHint(section: MasterSection): string {
  if (section === "machines") return "节点、地址、负载、告警";
  if (section === "staff") return "组织树、状态、阻塞";
  if (section === "tasks") return "派单、执行、交付、验收";
  if (section === "settings") return "接线、令牌、实例清单";
  return "主脑摘要、风险、调度";
}

function sectionLead(section: MasterSection): string {
  if (section === "machines") return "查看 4 台 Edge 和总办本机的在线、会话、队列、连接状态。";
  if (section === "staff") return "按部门与节点查看当前任务、阻塞原因和预计交付。";
  if (section === "tasks") return "按派单、执行、交付、验收四阶段管理当前工作链路。";
  if (section === "settings") return "检查当前接线、实例清单和 Master 的安全约束。";
  return "总办主脑视角下的摘要页，用来判断先盯哪里、先派谁、先救哪台节点。";
}

function statusLabel(status: InstanceSummary["status"]): string {
  if (status === "online") return "ONLINE";
  if (status === "degraded") return "DEGRADED";
  if (status === "offline") return "OFFLINE";
  return "UNKNOWN";
}

function staffStateLabel(state: StaffView["state"]): string {
  if (state === "online_ready") return "在线可派";
  if (state === "busy_running") return "忙碌执行";
  if (state === "blocked_waiting") return "阻塞待解";
  return "离线维护";
}

function mapStaffStateBadge(state: StaffView["state"]): "online" | "degraded" | "offline" {
  if (state === "online_ready" || state === "busy_running") return "online";
  if (state === "blocked_waiting") return "degraded";
  return "offline";
}

function taskStatusLabel(status: WorkItem["status"]): string {
  if (status === "ready") return "READY";
  if (status === "running") return "RUNNING";
  if (status === "blocked") return "BLOCKED";
  if (status === "review") return "REVIEW";
  return "DONE";
}

function mapTaskStatusBadge(status: WorkItem["status"]): "online" | "degraded" | "offline" | "unknown" {
  if (status === "running" || status === "done") return "online";
  if (status === "review" || status === "ready") return "unknown";
  if (status === "blocked") return "offline";
  return "unknown";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

