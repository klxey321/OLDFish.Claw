import type {
  AggregatedSummary,
  AppConfig,
  DashboardInsights,
  InstanceConfig,
  InstanceSummary,
  ModelCatalogSnapshot,
  NativeChatAccess,
  StaffTaskSummary,
  StaffView,
  WorkItem,
  WorkbenchFileDetail,
  WorkbenchSnapshot,
} from "../types";

export type MasterSection =
  | "overview"
  | "chat"
  | "usage"
  | "machines"
  | "staff"
  | "memory"
  | "docs"
  | "tasks"
  | "settings";

interface MasterRenderInput {
  section: MasterSection;
  summary: AggregatedSummary;
  config: AppConfig;
  staffViews: StaffView[];
  workItems: WorkItem[];
  instances: InstanceConfig[];
  insights: DashboardInsights;
  modelCatalog: ModelCatalogSnapshot;
  nativeChatAccess: NativeChatAccess;
  selectedStaffId?: string;
  selectedFile?: WorkbenchFileDetail;
  notice?: string;
  sessionUsername?: string;
}

export function renderMasterPage(input: MasterRenderInput): string {
  const title = `OLDFish.Claw ${sectionLabel(input.section)}`;
  const body = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-panel">
          <div class="brand-row">
            <div class="brand-chip">MASTER BRAIN</div>
            ${input.sessionUsername ? `<a class="logout-link" href="/logout">退出</a>` : ""}
          </div>
          <h1>OLDFish.Claw</h1>
          <p>总办主脑负责 4 台 Edge 调度、审阅、派单与风险收口。</p>
          <div class="brand-meta">节点 ${input.summary.totals.total} · 在线 ${input.summary.totals.online} · 刷新 ${input.config.uiRefreshSeconds}s</div>
          ${input.sessionUsername ? `<div class="brand-user">已登录：${escapeHtml(input.sessionUsername)}</div>` : ""}
        </div>
        <nav class="nav-list">
          ${renderNavLink("overview", input.section)}
          ${renderNavLink("chat", input.section)}
          ${renderNavLink("usage", input.section)}
          ${renderNavLink("machines", input.section)}
          ${renderNavLink("staff", input.section)}
          ${renderNavLink("memory", input.section)}
          ${renderNavLink("docs", input.section)}
          ${renderNavLink("tasks", input.section)}
          ${renderNavLink("settings", input.section)}
        </nav>
      </aside>
      <main class="main-column">
        ${input.notice ? `<div class="notice-banner">${escapeHtml(input.notice)}</div>` : ""}
        ${renderHero(input)}
        ${renderSection(input)}
      </main>
      <aside class="rail">
        ${renderStatusRail(input)}
      </aside>
    </div>
    ${renderAppScript(input.config)}
  `;

  return renderLayout(title, body);
}

export function renderEdgePage(summary: InstanceSummary, sessionUsername?: string): string {
  return renderLayout(
    `OLDFish.Claw Edge - ${summary.instanceName}`,
    `<div class="edge-shell">
      <section class="hero edge-hero">
        <div>
          <div class="brand-row">
            <div class="brand-chip">EDGE NODE</div>
            ${sessionUsername ? `<a class="logout-link" href="/logout">退出</a>` : ""}
          </div>
          <h1>${escapeHtml(summary.instanceName)}</h1>
          <p>${escapeHtml(summary.department)} 节点向主脑汇报会话、任务、心跳与接线状态。</p>
          ${sessionUsername ? `<div class="brand-user">已登录：${escapeHtml(sessionUsername)}</div>` : ""}
        </div>
        <div class="hero-grid">
          ${renderHeroStat("状态", statusLabel(summary.status))}
          ${renderHeroStat("活跃会话", String(summary.sessionsActive))}
          ${renderHeroStat("队列", String(summary.queueDepth))}
          ${renderHeroStat("负载", String(summary.taskLoad))}
        </div>
      </section>
      <section class="grid-two">
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
          <h2>Edge API</h2>
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

export function renderLoginPage(input: {
  appName: string;
  next: string;
  loginEnabled: boolean;
  error?: string;
  notice?: string;
}): string {
  const body = `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="brand-chip">SECURE ACCESS</div>
        <h1>${escapeHtml(input.appName)}</h1>
        <p>总办主脑与节点页面已开启登录保护。先登录，再进入控制台与写操作。</p>
        ${input.notice ? `<div class="notice-banner auth-notice">${escapeHtml(input.notice)}</div>` : ""}
        ${input.error ? `<div class="auth-error">${escapeHtml(input.error)}</div>` : ""}
        ${
          input.loginEnabled
            ? `<form class="auth-form" method="post" action="/login">
                <input type="hidden" name="next" value="${escapeHtml(input.next)}" />
                <label>
                  <span>用户名</span>
                  <input name="username" type="text" autocomplete="username" required />
                </label>
                <label>
                  <span>密码</span>
                  <input name="password" type="password" autocomplete="current-password" required />
                </label>
                <button class="action-btn auth-submit" type="submit">进入主控</button>
              </form>`
            : `<div class="copy-box">当前环境还没有配置登录口令，请先在服务器环境变量里设置。</div>`
        }
      </section>
    </div>`;
  return renderLayout(`${input.appName} 登录`, body);
}

function renderSection(input: MasterRenderInput): string {
  if (input.section === "chat") return renderChatSection(input);
  if (input.section === "usage") return renderUsageSection(input);
  if (input.section === "machines") return renderMachinesSection(input.summary.nodes);
  if (input.section === "staff") return renderStaffSection(input);
  if (input.section === "memory") return renderWorkbenchSection("memory", input);
  if (input.section === "docs") return renderWorkbenchSection("docs", input);
  if (input.section === "tasks") return renderTasksSection(input);
  if (input.section === "settings") return renderSettingsSection(input);
  return renderOverviewSection(input);
}

function renderOverviewSection(input: MasterRenderInput): string {
  const urgent = input.workItems.filter((item) => item.priority === "p0" || item.status === "blocked").slice(0, 5);
  const activeStaff = input.staffViews.filter((item) => item.state === "busy_running" || item.state === "blocked_waiting").slice(0, 5);
  const riskyNodes = input.summary.nodes.filter((node) => node.status !== "online").slice(0, 4);
  const currentTasks = input.workItems.filter((item) => item.status === "running" || item.status === "review" || item.status === "blocked").slice(0, 6);

  return `
    <section class="grid-two">
      <article class="panel panel-large">
        <div class="eyebrow">全局态势</div>
        <h2>待总办处理</h2>
        ${urgent.length > 0 ? `<div class="stack-list">${urgent.map(renderUrgentItem).join("")}</div>` : `<div class="empty-copy">当前没有 P0 或阻塞任务。</div>`}
      </article>
      <article class="panel panel-large">
        <div class="eyebrow">控制脉冲</div>
        <h2>当前任务</h2>
        ${currentTasks.length > 0 ? `<div class="stack-list">${currentTasks.map((item) => renderTaskPulse(item, input.summary.nodes)).join("")}</div>` : `<div class="empty-copy">当前没有进行中的任务。</div>`}
      </article>
    </section>
    <section class="grid-three">
      <article class="panel">
        <div class="eyebrow">风险节点</div>
        <h2>需要干预</h2>
        ${riskyNodes.length > 0 ? `<div class="stack-list">${riskyNodes.map(renderRiskNode).join("")}</div>` : `<div class="empty-copy">所有节点当前在线稳定。</div>`}
      </article>
      <article class="panel">
        <div class="eyebrow">活跃部门</div>
        <h2>正在推进</h2>
        ${activeStaff.length > 0 ? `<div class="stack-list">${activeStaff.map(renderStaffPulse).join("")}</div>` : `<div class="empty-copy">当前没有需要特别关注的人员负载。</div>`}
      </article>
      <article class="panel">
        <div class="eyebrow">用量脉搏</div>
        <h2>今日摘要</h2>
        <ul class="detail-list">
          <li>运行时：${escapeHtml(input.insights.usage.currentStatus)}</li>
          <li>模型：${escapeHtml(input.insights.usage.providerLabel)}</li>
          <li>订阅：${escapeHtml(input.insights.usage.windowLabel)}</li>
          <li>今日估算：${formatUsageCost(input.insights.usage.todayCost, input.insights.usage.todayTokens)}</li>
        </ul>
      </article>
    </section>
    <section class="grid-two">
      ${renderModelControlPanel(input.modelCatalog)}
      ${renderChatQuickPanel(input.nativeChatAccess)}
    </section>
    <section class="section-head">
      <h2>五节点态势</h2>
      <div class="section-copy">总办主脑与四个部门节点的在线、连接、任务负载一眼看清。</div>
    </section>
    <section class="card-grid">
      ${input.summary.nodes.map(renderMachineCard).join("")}
    </section>
  `;
}

function renderUsageSection(input: MasterRenderInput): string {
  const usage = input.insights.usage;
  return `
    <section class="grid-three">
      <article class="panel">
        <div class="eyebrow">当前状态</div>
        <h2>运行时</h2>
        <div class="metric-wall">
          <div><span>Runtime</span><strong>${usage.runtimeConnected ? "已接通" : "未接通"}</strong></div>
          <div><span>Codex</span><strong>${usage.codexConnected ? "已接通" : "未接通"}</strong></div>
          <div><span>订阅</span><strong>${usage.subscriptionConnected ? "已接通" : "未接通"}</strong></div>
        </div>
      </article>
      <article class="panel">
        <div class="eyebrow">用量与订阅摘要</div>
        <h2>今日 AI 用量</h2>
        <div class="metric-wall">
          <div><span>模型</span><strong>${escapeHtml(usage.providerLabel)}</strong></div>
          <div><span>Token</span><strong>${usage.todayTokens ? formatInt(usage.todayTokens) : "未连接"}</strong></div>
          <div><span>费用</span><strong>${usage.todayCost !== undefined ? `$${usage.todayCost.toFixed(2)}` : "未连接"}</strong></div>
        </div>
      </article>
      <article class="panel">
        <div class="eyebrow">订阅窗口</div>
        <h2>${escapeHtml(usage.planLabel ?? "等待接线")}</h2>
        <div class="copy-box">${escapeHtml(usage.windowLabel)}</div>
        <div class="meta">剩余空间：${usage.remainingBudgetPercent !== undefined ? `${usage.remainingBudgetPercent}%` : "未连接"}</div>
      </article>
    </section>
    <section class="section-head"><h2>接线建议</h2><div class="section-copy">不伪造账单数据，缺什么就明确显示什么。</div></section>
    <section class="grid-two">
      <article class="panel panel-large">
        <div class="eyebrow">缺口说明</div>
        <h2>当前还差哪些来源</h2>
        ${usage.notes.length > 0 ? `<ul class="detail-list">${usage.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<div class="empty-copy">当前用量与订阅链路都已接通。</div>`}
      </article>
      <article class="panel panel-large">
        <div class="eyebrow">补线入口</div>
        <h2>建议先补</h2>
        <ul class="detail-list">
          <li>在设置页确认 <code>OPENCLAW_HOME</code>、<code>CODEX_HOME</code>、<code>OPENCLAW_SUBSCRIPTION_SNAPSHOT_PATH</code>。</li>
          <li>优先保证 OpenClaw runtime 与 Gateway 可读，再补 Codex 和账单快照。</li>
          <li>订阅未接通时不要伪造剩余额度，只显示未连接。</li>
        </ul>
      </article>
    </section>
  `;
}

function renderMachinesSection(nodes: InstanceSummary[]): string {
  return `
    <section class="section-head"><h2>机器页</h2><div class="section-copy">查看每台机器的连接、会话、负载、心跳和告警。</div></section>
    <section class="card-grid">
      ${nodes.map(renderMachineCard).join("")}
    </section>
  `;
}

function renderStaffSection(input: MasterRenderInput): string {
  const selected = input.staffViews.find((item) => item.instanceId === input.selectedStaffId) ?? input.staffViews[0];
  return `
    <section class="section-head"><h2>员工页</h2><div class="section-copy">点开员工可以看到他现在正在做什么、下一步是什么、卡在哪里。</div></section>
    <section class="grid-two">
      <div class="panel panel-large">
        <div class="stack-list">
          ${input.staffViews.map((item) => renderStaffListCard(item, item.instanceId === selected?.instanceId)).join("")}
        </div>
      </div>
      <div class="panel panel-large">
        ${selected ? renderStaffDetail(selected) : `<div class="empty-copy">当前没有可展示的员工节点。</div>`}
      </div>
    </section>
  `;
}

function renderWorkbenchSection(kind: "memory" | "docs", input: MasterRenderInput): string {
  const snapshot = kind === "memory" ? input.insights.memory : input.insights.docs;
  const label = kind === "memory" ? "记忆" : "文档";
  return `
    <section class="section-head">
      <h2>${label}工作台</h2>
      <div class="section-copy">${kind === "memory" ? "直接查看和编辑真实记忆文件与快照。" : "只保留最关键的共享文档与核心工作文档。"} </div>
    </section>
    <section class="grid-two workbench-grid">
      <div class="panel panel-large">
        ${renderWorkbenchList(snapshot, input.section, input.selectedFile)}
      </div>
      <div class="panel panel-large">
        ${renderWorkbenchEditor(kind, input)}
      </div>
    </section>
  `;
}

function renderTasksSection(input: MasterRenderInput): string {
  const columns: Array<{ stage: WorkItem["stage"]; label: string }> = [
    { stage: "dispatch", label: "派单" },
    { stage: "execution", label: "执行" },
    { stage: "delivery", label: "交付" },
    { stage: "acceptance", label: "验收" },
  ];

  return `
    <section class="section-head"><h2>任务页</h2><div class="section-copy">官库缺失的控制能力这里先补上，支持总办直接停止任务并查看责任节点。</div></section>
    <section class="task-board">
      ${columns
        .map(({ stage, label }) => {
          const items = input.workItems.filter((item) => item.stage === stage);
          return `<article class="task-column">
            <header class="task-column-head">
              <h3>${label}</h3>
              <span>${items.length}</span>
            </header>
            <div class="task-column-body">
              ${items.length > 0 ? items.map((item) => renderTaskCard(item, input.summary.nodes, input.config)).join("") : `<div class="empty-copy">当前没有任务。</div>`}
            </div>
          </article>`;
        })
        .join("")}
    </section>
  `;
}

function renderSettingsSection(input: MasterRenderInput): string {
  return `
    <section class="grid-two">
      <article class="panel panel-large">
        <div class="eyebrow">接线状态</div>
        <h2>当前配置</h2>
        <ul class="detail-list">
          <li>角色：${input.config.role}</li>
          <li>实例 ID：${escapeHtml(input.config.instanceId)}</li>
          <li>本机地址：${escapeHtml(input.config.baseUrl)}</li>
          <li>OpenClaw Home：${escapeHtml(input.config.openclawHome ?? "未设置")}</li>
          <li>Codex Home：${escapeHtml(input.config.codexHome ?? "未设置")}</li>
          <li>订阅快照：${escapeHtml(input.config.subscriptionSnapshotPath ?? "未设置")}</li>
          <li>任务控制：${input.config.taskControlEnabled ? "已开启" : "未开启"}</li>
          <li>文档写回：${input.config.fileEditEnabled ? "已开启" : "未开启"}</li>
        </ul>
      </article>
      <article class="panel panel-large">
        <div class="eyebrow">操作令牌</div>
        <h2>浏览器本地 Token</h2>
        <div class="copy-box">写操作需要本地 token。令牌只保存在当前浏览器的 localStorage，不回显到页面。</div>
        <label class="token-field">
          <span>输入本地 token</span>
          <input type="password" placeholder="粘贴 x-local-token / Bearer token" data-token-input />
        </label>
        <button class="action-btn" type="button" data-save-token>保存到浏览器</button>
        <div class="meta">保存后，停止任务和文档写回按钮会带上本地 token 请求 API。</div>
      </article>
    </section>
    <section class="grid-two">
      <article class="panel panel-large">
        <div class="eyebrow">部署建议</div>
        <h2>Master 原则</h2>
        <ul class="detail-list">
          <li>Master 只聚合摘要，不跨机器直接挂载远端目录。</li>
          <li>每台 Edge 只暴露只读摘要接口，写操作由总办侧控制。</li>
          <li>HTTPS 证书必须建立在域名已经解析到主控机或反向代理之上。</li>
        </ul>
      </article>
      <article class="panel panel-large">
        <div class="eyebrow">实例注册</div>
        <h2>五节点清单</h2>
        <div class="stack-list">
          ${input.instances.map(renderInstanceCard).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderChatSection(input: MasterRenderInput): string {
  const access = input.nativeChatAccess;
  const accessPayload = JSON.stringify(access);
  const displayPath = displayNativeChatPath(access.framePath);
  return `
    <section class="grid-two">
      <article class="panel panel-large">
        <div class="eyebrow">原生聊天</div>
        <h2>OpenClaw Chat 已同步</h2>
        <div class="copy-box">这里直接接入原生 Web UI，所以暂停任务、删除历史、Slash 命令和会话侧边栏都和现在的 OpenClaw 一致。</div>
        <ul class="detail-list">
          <li>入口：${access.enabled ? `<code>${escapeHtml(displayPath)}</code>` : "未接通"}</li>
          <li>能力：暂停运行、删除历史、切换会话、查看实时流。</li>
          <li>接线：通过总办主脑的 Gateway 反代路径，不单独暴露新的公网端口。</li>
        </ul>
        ${access.enabled ? `<div class="meta"><a href="${escapeHtml(access.framePath)}" target="_blank" rel="noreferrer">在新标签打开原生聊天</a></div>` : `<div class="empty-copy">${escapeHtml(access.note ?? "当前无法加载原生聊天页。")}</div>`}
      </article>
      ${renderModelControlPanel(input.modelCatalog, { compact: true })}
    </section>
    <section class="panel panel-large native-chat-panel">
      <div class="native-chat-head">
        <div>
          <div class="eyebrow">聊天工作台</div>
          <h2>暂停、删除、继续都走原生入口</h2>
        </div>
        <button class="action-btn" type="button" data-reload-native-chat${access.enabled ? "" : " disabled"}>重载聊天页</button>
      </div>
      ${
        access.enabled
          ? `<div class="native-chat-frame-wrap">
              <div class="native-chat-loading" data-native-chat-status>正在接入原生聊天页...</div>
              <iframe class="native-chat-frame" data-native-chat-frame title="OpenClaw Native Chat" loading="lazy"></iframe>
            </div>
            <script type="application/json" data-native-chat-access>${serializeJsonForHtml(accessPayload)}</script>`
          : `<div class="empty-copy">${escapeHtml(access.note ?? "原生聊天页暂不可用。")}</div>`
      }
    </section>
  `;
}

function renderModelControlPanel(
  catalog: ModelCatalogSnapshot,
  options: { compact?: boolean } = {},
): string {
  const modelCards = catalog.models.slice(0, options.compact ? 6 : 10);
  return `<article class="panel panel-large">
    <div class="eyebrow">模型控制台</div>
    <h2>查看、添加、切换 AI 模型</h2>
    ${
      catalog.connected
        ? `<div class="copy-box">当前主模型：${escapeHtml(catalog.primaryModel ?? "未设置")} · 回退：${escapeHtml(catalog.fallbackModels.join(", ") || "未配置")}</div>`
        : `<div class="empty-copy">${escapeHtml(catalog.note ?? "模型配置暂不可用。")}</div>`
    }
    ${
      catalog.connected
        ? `<div class="stack-list model-stack">${modelCards.map(renderModelCard).join("")}</div>
           <div class="meta">Provider：${catalog.providers.map((item) => `${item.key} (${item.modelCount})`).join(" · ") || "未发现"}。</div>
           <form class="model-form" data-add-model-form>
             <label>
               <span>Provider</span>
               <select name="providerKey">
                 ${catalog.providers.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.key)}</option>`).join("")}
               </select>
             </label>
             <label>
               <span>模型 ID</span>
               <input name="modelId" type="text" placeholder="gpt-5.2-mini" required />
             </label>
             <label>
               <span>显示名</span>
               <input name="name" type="text" placeholder="gpt-5.2-mini" />
             </label>
             <label>
               <span>API 类型</span>
               <input name="api" type="text" placeholder="openai-completions" />
             </label>
             <label>
               <span>上下文窗口</span>
               <input name="contextWindow" type="number" min="1" placeholder="200000" />
             </label>
             <label>
               <span>Max Tokens</span>
               <input name="maxTokens" type="number" min="1" placeholder="8192" />
             </label>
             <label class="toggle-field">
               <input name="reasoning" type="checkbox" />
               <span>开启 reasoning</span>
             </label>
             <label class="toggle-field">
               <input name="setPrimary" type="checkbox" />
               <span>添加后立即切为主模型</span>
             </label>
             <button class="action-btn" type="submit">添加并热重载</button>
           </form>`
        : ""
    }
  </article>`;
}

function renderChatQuickPanel(access: NativeChatAccess): string {
  return `<article class="panel panel-large">
    <div class="eyebrow">聊天入口</div>
    <h2>原生聊天工作台</h2>
    <div class="copy-box">你要的暂停、删历史、随时插手会话，直接走原生聊天页最稳，不会丢官方刚补上的能力。</div>
    <ul class="detail-list">
      <li>接入方式：总办域名下的内嵌代理路径。</li>
      <li>会话来源：当前主脑 OpenClaw 的真实 session store。</li>
      <li>跳转：菜单新增 <code>聊天</code> 页面。</li>
    </ul>
    ${
      access.enabled
        ? `<div class="chat-quick-actions">
             <a class="action-btn" href="/chat">进入聊天</a>
             <a class="action-btn" href="${escapeHtml(access.framePath)}" target="_blank" rel="noreferrer">原生新标签</a>
           </div>`
        : `<div class="empty-copy">${escapeHtml(access.note ?? "当前还未接通原生聊天入口。")}</div>`
    }
  </article>`;
}

function renderHero(input: MasterRenderInput): string {
  return `
    <section class="hero">
      <div>
        <div class="brand-chip">CONTROL ROOM</div>
        <h1>${sectionLabel(input.section)}</h1>
        <p>${sectionLead(input.section)}</p>
      </div>
      <div class="hero-grid">
        ${renderHeroStat("节点", String(input.summary.totals.total))}
        ${renderHeroStat("在线", String(input.summary.totals.online))}
        ${renderHeroStat("会话", String(input.summary.totals.sessionsActive))}
        ${renderHeroStat("告警", String(input.summary.totals.alerts))}
      </div>
    </section>
  `;
}

function renderStatusRail(input: MasterRenderInput): string {
  const usage = input.insights.usage;
  const activeAgents = input.insights.agents.slice(0, 6);
  const scheduleItems = input.insights.schedules.items.slice(0, 5);
  return `
    <section class="rail-panel">
      <div class="eyebrow">当前状态</div>
      <h2>主脑脉冲</h2>
      <div class="metric-wall">
        <div><span>Master</span><strong>${statusLabel(input.summary.master.status)}</strong></div>
        <div><span>队列</span><strong>${input.summary.totals.queueDepth}</strong></div>
        <div><span>负载</span><strong>${input.summary.totals.taskLoad}</strong></div>
      </div>
      <div class="meta">最近心跳：${escapeHtml(input.summary.master.lastHeartbeatAt)}</div>
    </section>
    <section class="rail-panel">
      <div class="eyebrow">用量与订阅摘要</div>
      <h2>${escapeHtml(usage.currentStatus)}</h2>
      <div class="meta">今日 AI 用量：${formatUsageCost(usage.todayCost, usage.todayTokens)}</div>
      <div class="meta">模型：${escapeHtml(usage.providerLabel)}</div>
      <div class="meta">订阅：${escapeHtml(usage.windowLabel)}</div>
    </section>
    <section class="rail-panel">
      <div class="eyebrow">当前活跃智能体</div>
      <h2>智能体与会话</h2>
      <ul class="story-list">${activeAgents.length > 0 ? activeAgents.map(renderAgentStory).join("") : `<li>暂无活跃智能体信号。</li>`}</ul>
    </section>
    <section class="rail-panel">
      <div class="eyebrow">定时与心跳</div>
      <h2>定时任务</h2>
      <div class="meta heartbeat-meta">
        <span>Heartbeat ${input.insights.schedules.heartbeatEnabled ? "已开启" : "未开启"}</span>
        <span>下次 ${escapeHtml(shortenText(input.insights.schedules.nextRunAt ?? "待计算", 26))}</span>
      </div>
      <ul class="story-list">${scheduleItems.length > 0 ? scheduleItems.map(renderScheduleStory).join("") : `<li>暂无定时任务。</li>`}</ul>
    </section>
  `;
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
    <div class="meta"><a href="${escapeHtml(node.baseUrl)}" target="_blank" rel="noreferrer">打开节点面板</a></div>
  </article>`;
}

function renderStaffListCard(item: StaffView, selected: boolean): string {
  return `<a class="staff-list-card${selected ? " active" : ""}" href="/staff?node=${encodeURIComponent(item.instanceId)}">
    <div>
      <div class="eyebrow">${escapeHtml(item.department)}</div>
      <strong>${escapeHtml(item.nodeName)}</strong>
    </div>
    <div class="staff-list-copy">
      <span>${staffStateLabel(item.state)}</span>
      <small>${escapeHtml(item.currentTask ?? item.nextTask?.title ?? "待命中")}</small>
    </div>
  </a>`;
}

function renderStaffDetail(item: StaffView): string {
  return `
    <div class="eyebrow">员工详情</div>
    <h2>${escapeHtml(item.nodeName)}</h2>
    <div class="copy-box">${escapeHtml(item.recentOutput)}</div>
    <ul class="detail-list">
      <li>当前状态：${staffStateLabel(item.state)}</li>
      <li>当前任务：${escapeHtml(item.currentTask ?? "待命中")}</li>
      <li>下一步：${escapeHtml(item.nextTask?.title ?? "暂无")}</li>
      <li>阻塞：${escapeHtml(item.blocker ?? "无")}</li>
      <li>预计交付：${escapeHtml(item.expectedDelivery ?? "待定")}</li>
      <li>最近验收：${escapeHtml(item.acceptanceNote ?? "暂无")}</li>
    </ul>
    <div class="section-head compact"><h2>正在做的事</h2></div>
    ${item.activeTasks.length > 0 ? `<div class="stack-list">${item.activeTasks.map(renderStaffTaskSummary).join("")}</div>` : `<div class="empty-copy">当前没有运行中的任务。</div>`}
  `;
}

function renderStaffTaskSummary(task: StaffTaskSummary): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(task.title)}</strong>
    <span>${taskStatusLabel(task.status)} · ${stageLabel(task.stage)} · ${escapeHtml(task.priority.toUpperCase())}</span>
    <small>${escapeHtml(task.latestAction)}</small>
  </div>`;
}

function renderWorkbenchList(snapshot: WorkbenchSnapshot, section: MasterSection, selectedFile?: WorkbenchFileDetail): string {
  return `
    <div class="eyebrow">${section === "memory" ? "记忆状态" : "文档状态"}</div>
    <h2>${snapshot.connected ? "已连接" : "未连接"}</h2>
    ${snapshot.note ? `<div class="copy-box">${escapeHtml(snapshot.note)}</div>` : ""}
    <div class="facet-row">${snapshot.facets.map((item) => `<span class="facet-pill">${escapeHtml(item.label)} ${item.count}</span>`).join("")}</div>
    ${
      snapshot.files.length > 0
        ? `<div class="stack-list">${snapshot.files
            .map((item) => renderWorkbenchFileLink(section, item.relativePath, item.title, item.category, selectedFile?.entry.relativePath === item.relativePath))
            .join("")}</div>`
        : `<div class="empty-copy">当前没有发现可展示的文件。</div>`
    }
  `;
}

function renderWorkbenchFileLink(
  section: MasterSection,
  relativePath: string,
  title: string,
  category: string,
  selected: boolean,
): string {
  return `<a class="workbench-link${selected ? " active" : ""}" href="/${section}?file=${encodeURIComponent(relativePath)}">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(category)}</span>
  </a>`;
}

function renderWorkbenchEditor(kind: "memory" | "docs", input: MasterRenderInput): string {
  const detail = input.selectedFile;
  if (!detail) {
    return `<div class="eyebrow">${kind === "memory" ? "记忆文件工作台" : "文档工作台"}</div><h2>选择文件</h2><div class="empty-copy">从左侧文件列表中选择一个文件查看内容。</div>`;
  }

  return `
    <div class="eyebrow">${kind === "memory" ? "记忆文件工作台" : "文档工作台"}</div>
    <h2>${escapeHtml(detail.entry.title)}</h2>
    <div class="meta">${escapeHtml(detail.entry.relativePath)} · ${escapeHtml(detail.entry.updatedAt ?? "未知时间")}</div>
    <textarea class="editor" data-workbench-editor>${escapeHtml(detail.content)}</textarea>
    <div class="editor-actions">
      <button class="action-btn" type="button" data-save-file data-kind="${kind}" data-file="${escapeHtml(detail.entry.relativePath)}"${!input.config.fileEditEnabled || !detail.entry.editable ? " disabled" : ""}>保存写回</button>
      <span class="meta">${input.config.fileEditEnabled && detail.entry.editable ? "保存会直接写回 OpenClaw 实际文件。" : "当前文件不可写或已关闭写回能力。"}</span>
    </div>
  `;
}

function renderTaskCard(item: WorkItem, nodes: InstanceSummary[], config: AppConfig): string {
  const owner = nodes.find((node) => node.instanceId === item.ownerInstanceId);
  const crew = item.crew?.length ? item.crew.join(", ") : "未指定智能体";
  const canStop = config.taskControlEnabled && item.status !== "done";

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
      <li>智能体：${escapeHtml(crew)}</li>
      <li>阻塞：${escapeHtml(item.blockers[0] ?? "无")}</li>
      <li>截止：${escapeHtml(item.dueAt ?? "待定")}</li>
      <li>验收：${escapeHtml(item.acceptanceNote ?? "暂无")}</li>
    </ul>
    <div class="task-actions">
      <button class="action-btn action-danger" type="button" data-stop-work-id="${escapeHtml(item.workId)}"${canStop ? "" : " disabled"}>停止任务</button>
      ${item.stoppedAt ? `<span class="meta">已于 ${escapeHtml(item.stoppedAt)} 停止</span>` : ""}
    </div>
  </article>`;
}

function renderInstanceCard(instance: InstanceConfig): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(instance.instanceName)}</strong>
    <span>${escapeHtml(instance.department)} · ${escapeHtml(instance.baseUrl)}</span>
  </div>`;
}

function renderModelCard(model: ModelCatalogSnapshot["models"][number]): string {
  return `<div class="model-card">
    <div class="machine-head">
      <div>
        <div class="eyebrow">${escapeHtml(model.providerKey)}</div>
        <h3>${escapeHtml(model.name)}</h3>
      </div>
      <div class="badge-row">
        ${model.isPrimary ? `<span class="badge badge-running">主模型</span>` : ""}
        ${model.isFallback ? `<span class="badge badge-review">回退</span>` : ""}
      </div>
    </div>
    <ul class="detail-list">
      <li>ID：<code>${escapeHtml(model.id)}</code></li>
      <li>API：${escapeHtml(model.api ?? "未标注")}</li>
      <li>Reasoning：${model.reasoning ? "开启" : "关闭"}</li>
      <li>上下文：${model.contextWindow ? formatInt(model.contextWindow) : "未标注"}</li>
    </ul>
    <div class="chat-quick-actions">
      <button class="action-btn" type="button" data-set-primary-model="${escapeHtml(model.id)}"${model.isPrimary ? " disabled" : ""}>设为主模型</button>
      <span class="meta">切换后自动热重载 Gateway。</span>
    </div>
  </div>`;
}

function renderAgentStory(item: DashboardInsights["agents"][number]): string {
  return `<li>
    <strong>${escapeHtml(item.label)}</strong>
    <span>${item.status === "active" ? "活跃" : item.status === "warning" ? "告警" : "待命"} · 会话 ${item.activeSessions} · 任务 ${item.activeTasks}</span>
    <small>${escapeHtml(shortenText(item.currentTask ?? item.notes[0] ?? "当前无活跃任务", 74))}</small>
  </li>`;
}

function renderScheduleStory(item: DashboardInsights["schedules"]["items"][number]): string {
  return `<li>
    <strong>${escapeHtml(item.name)}</strong>
    <span>${item.kind === "heartbeat" ? "心跳" : "Cron"} · ${item.enabled ? "启用" : "关闭"} · ${escapeHtml(shortenText(item.nextRunAt ?? "暂无下次时间", 26))}</span>
    <small>${escapeHtml(shortenText(item.error ?? item.lastStatus ?? "暂无执行结果", 94))}</small>
  </li>`;
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
    <small>${escapeHtml(item.latestAction)}</small>
  </div>`;
}

function renderRiskNode(node: InstanceSummary): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(node.instanceName)}</strong>
    <span>${statusLabel(node.status)} · ${escapeHtml(node.alerts[0] ?? "连接异常")}</span>
  </div>`;
}

function renderTaskPulse(item: WorkItem, nodes: InstanceSummary[]): string {
  const owner = nodes.find((node) => node.instanceId === item.ownerInstanceId);
  return `<div class="stack-item">
    <strong>${escapeHtml(item.title)}</strong>
    <span>${escapeHtml(owner?.instanceName ?? item.ownerInstanceId)} · ${taskStatusLabel(item.status)}</span>
    <small>${escapeHtml(item.latestAction)}</small>
  </div>`;
}

function renderStaffPulse(item: StaffView): string {
  return `<div class="stack-item">
    <strong>${escapeHtml(item.nodeName)}</strong>
    <span>${staffStateLabel(item.state)} · ${escapeHtml(item.currentTask ?? item.nextTask?.title ?? "待命")}</span>
  </div>`;
}

function renderHeroStat(label: string, value: string): string {
  return `<div class="hero-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderAppScript(config: AppConfig): string {
  return `<script>
    (() => {
      const storageKey = "oldfish.localToken";
      const prefetched = new Set();
      const tokenInput = document.querySelector("[data-token-input]");
      if (tokenInput) tokenInput.value = window.localStorage.getItem(storageKey) || "";

      const prefetch = (href) => {
        if (!href || prefetched.has(href) || href.startsWith("/logout")) return;
        prefetched.add(href);
        fetch(href, {
          credentials: "same-origin",
          headers: { "x-oldfish-prefetch": "1" },
        }).catch(() => prefetched.delete(href));
      };

      document.querySelectorAll('a[href^="/"]').forEach((link) => {
        link.addEventListener("click", (event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          document.body.classList.add("is-leaving");
        });
        link.addEventListener("mouseenter", () => {
          const href = link.getAttribute("href");
          prefetch(href);
        }, { once: true });
        link.addEventListener("focus", () => prefetch(link.getAttribute("href")), { once: true });
      });

      const warmLinks = () => {
        document.querySelectorAll('.nav-link[href], .machine-card a[href], .staff-list-card[href]').forEach((link, index) => {
          if (index < 8) prefetch(link.getAttribute("href"));
        });
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(warmLinks, { timeout: 1200 });
      } else {
        window.setTimeout(warmLinks, 300);
      }

      document.querySelector("[data-save-token]")?.addEventListener("click", () => {
        const value = tokenInput?.value?.trim() || "";
        window.localStorage.setItem(storageKey, value);
        window.alert(value ? "本地 token 已保存到浏览器。" : "本地 token 已清空。");
      });

      const getToken = () => window.localStorage.getItem(storageKey) || "";
      const headers = () => {
        const token = getToken();
        return {
          "content-type": "application/json",
          ...(token ? { "x-local-token": token } : {}),
        };
      };
      const postJson = async (url, payload) => {
        const response = await fetch(url, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(text || "request_failed");
        return text ? JSON.parse(text) : {};
      };

      document.querySelectorAll("[data-stop-work-id]").forEach((button) => {
        button.addEventListener("click", async () => {
          const workId = button.getAttribute("data-stop-work-id");
          if (!workId) return;
          if (!window.confirm("确认停止这个任务？")) return;
          try {
            await postJson("/api/work-items/stop", { workId });
            window.location.href = "/tasks?notice=task-stopped";
          } catch (error) {
            window.alert("停止任务失败：" + (error instanceof Error ? error.message : String(error)));
          }
        });
      });

      document.querySelectorAll("[data-set-primary-model]").forEach((button) => {
        button.addEventListener("click", async () => {
          const modelRef = button.getAttribute("data-set-primary-model");
          if (!modelRef) return;
          if (!window.confirm("确认把默认模型切到 " + modelRef + "？这会热重载 Gateway。")) return;
          try {
            button.setAttribute("disabled", "disabled");
            await postJson("/api/models/primary", { modelRef });
            window.location.reload();
          } catch (error) {
            button.removeAttribute("disabled");
            window.alert("切换模型失败：" + (error instanceof Error ? error.message : String(error)));
          }
        });
      });

      document.querySelector("[data-add-model-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitter = form.querySelector('button[type="submit"]');
        const formData = new window.FormData(form);
        const payload = {
          providerKey: String(formData.get("providerKey") || "").trim(),
          modelId: String(formData.get("modelId") || "").trim(),
          name: String(formData.get("name") || "").trim(),
          api: String(formData.get("api") || "").trim(),
          contextWindow: String(formData.get("contextWindow") || "").trim(),
          maxTokens: String(formData.get("maxTokens") || "").trim(),
          reasoning: formData.get("reasoning") === "on",
          setPrimary: formData.get("setPrimary") === "on",
        };
        if (!payload.providerKey || !payload.modelId) {
          window.alert("Provider 和模型 ID 不能为空。");
          return;
        }
        try {
          submitter?.setAttribute("disabled", "disabled");
          await postJson("/api/models/add", payload);
          window.location.reload();
        } catch (error) {
          submitter?.removeAttribute("disabled");
          window.alert("添加模型失败：" + (error instanceof Error ? error.message : String(error)));
        }
      });

      document.querySelector("[data-save-file]")?.addEventListener("click", async (event) => {
        const target = event.currentTarget;
        const file = target.getAttribute("data-file");
        const kind = target.getAttribute("data-kind");
        const editor = document.querySelector("[data-workbench-editor]");
        if (!file || !kind || !editor) return;
        try {
          await postJson("/api/workbench-file", {
            kind,
            file,
            content: editor.value,
          });
          window.location.href = "/" + kind + "?file=" + encodeURIComponent(file) + "&notice=file-saved";
        } catch (error) {
          window.alert("保存失败：" + (error instanceof Error ? error.message : String(error)));
        }
      });

      const nativeChatScript = document.querySelector("[data-native-chat-access]");
      const nativeChatFrame = document.querySelector("[data-native-chat-frame]");
      const nativeChatStatus = document.querySelector("[data-native-chat-status]");
      const setNativeChatStatus = (message) => {
        if (nativeChatStatus) nativeChatStatus.textContent = message;
      };
      const mountNativeChat = () => {
        if (!nativeChatScript || !nativeChatFrame) return;
        try {
          const access = JSON.parse(nativeChatScript.textContent || "{}");
          if (!access.enabled || !access.framePath) {
            setNativeChatStatus(access.note || "原生聊天入口未接通。");
            return;
          }
          if (access.framePath.startsWith("http://") || access.framePath.startsWith("https://")) {
            setNativeChatStatus("正在加载原生聊天面板...");
            nativeChatFrame.src = access.framePath;
            return;
          }
          if (!access.gatewayToken || !access.basePath) {
            setNativeChatStatus(access.note || "原生聊天入口未接通。");
            return;
          }
          const scheme = window.location.protocol === "https:" ? "wss" : "ws";
          const gatewayUrl = scheme + "://" + window.location.host + access.basePath;
          const sessionKey = "openclaw.control.token.v1:" + gatewayUrl;
          window.sessionStorage.removeItem("openclaw.control.token.v1");
          window.sessionStorage.setItem(sessionKey, access.gatewayToken);
          setNativeChatStatus("正在加载原生聊天面板...");
          nativeChatFrame.src = access.framePath;
        } catch (error) {
          setNativeChatStatus("原生聊天接入失败：" + (error instanceof Error ? error.message : String(error)));
        }
      };

      if (nativeChatFrame) {
        nativeChatFrame.addEventListener("load", () => {
          setNativeChatStatus("原生聊天面板已接入。");
        });
        mountNativeChat();
      }

      document.querySelector("[data-reload-native-chat]")?.addEventListener("click", () => {
        if (nativeChatFrame) nativeChatFrame.src = "about:blank";
        window.setTimeout(mountNativeChat, 120);
      });
    })();
  </script>`;
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
          --bg: #03070b;
          --bg-soft: #091117;
          --panel: rgba(7, 15, 20, 0.92);
          --panel-strong: rgba(9, 20, 27, 0.96);
          --panel-border: rgba(96, 237, 211, 0.16);
          --text: #f1f7f7;
          --muted: #8ea5af;
          --accent: #7ef7d4;
          --accent-cold: #63dcff;
          --accent-warm: #ffb165;
          --danger: #ff5b6e;
          --ok: #56f39a;
          --warn: #ffd05c;
          --shadow: 0 18px 60px rgba(0, 0, 0, 0.38);
          --radius: 24px;
          --mono: "IBM Plex Mono", "SFMono-Regular", "Menlo", monospace;
          --sans: "Space Grotesk", "Noto Sans SC", system-ui, sans-serif;
        }

        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; min-height: 100%; }
        body {
          position: relative;
          overflow-x: hidden;
          background:
            radial-gradient(circle at 12% 12%, rgba(126, 247, 212, 0.13), transparent 22%),
            radial-gradient(circle at 88% 14%, rgba(99, 220, 255, 0.12), transparent 18%),
            radial-gradient(circle at 20% 86%, rgba(255, 177, 101, 0.08), transparent 18%),
            linear-gradient(145deg, #010203, #04070b 34%, #061018 68%, #020407 100%);
          color: var(--text);
          font-family: var(--sans);
        }

        body::before,
        body::after {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: -1;
        }

        body::before {
          background:
            linear-gradient(rgba(126, 247, 212, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126, 247, 212, 0.07) 1px, transparent 1px),
            repeating-linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.03) 0px,
              rgba(255, 255, 255, 0.03) 1px,
              transparent 1px,
              transparent 4px
            ),
            linear-gradient(90deg, transparent 0%, rgba(99, 220, 255, 0.06) 48%, transparent 52%);
          background-size: 150px 150px, 150px 150px, 100% 4px, 100% 100%;
          mask-image: radial-gradient(circle at center, black 45%, transparent 95%);
          opacity: 0.5;
        }

        body::after {
          background:
            radial-gradient(circle at 15% 18%, rgba(126, 247, 212, 0.18), transparent 12%),
            radial-gradient(circle at 82% 75%, rgba(99, 220, 255, 0.18), transparent 12%),
            linear-gradient(120deg, transparent 0%, rgba(126, 247, 212, 0.05) 42%, transparent 72%),
            repeating-linear-gradient(135deg, rgba(126, 247, 212, 0.04) 0px, rgba(126, 247, 212, 0.04) 2px, transparent 2px, transparent 12px);
          animation: driftGlow 18s linear infinite;
          opacity: 0.8;
        }

        a { color: inherit; text-decoration: none; }
        code { font-family: var(--mono); }
        button, input, textarea { font: inherit; }

        .app-shell, .edge-shell, .auth-shell {
          width: min(1760px, calc(100vw - 32px));
          margin: 16px auto;
          display: grid;
          gap: 16px;
        }

        .app-shell { grid-template-columns: 360px minmax(0, 1fr) 360px; align-items: start; }
        .edge-shell { grid-template-columns: 1fr; }
        .auth-shell { min-height: calc(100vh - 32px); place-items: center; }

        .sidebar, .rail, .main-column, .panel, .rail-panel, .brand-panel, .hero, .notice-banner, .auth-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--panel-border);
          background:
            linear-gradient(180deg, rgba(10, 18, 25, 0.96), rgba(6, 11, 18, 0.94)),
            radial-gradient(circle at top, rgba(126, 247, 212, 0.08), transparent 40%);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(22px);
        }

        .sidebar::before, .rail::before, .main-column::before, .panel::before, .rail-panel::before, .brand-panel::before, .hero::before, .auth-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1px solid rgba(99, 220, 255, 0.06);
          mask: linear-gradient(135deg, transparent 10%, black 20%, black 80%, transparent 90%);
          pointer-events: none;
        }

        .sidebar, .rail { position: sticky; top: 16px; border-radius: 32px; padding: 20px; }
        .main-column { border-radius: 32px; padding: 22px; animation: panelEnter .28s ease; }
        .notice-banner { border-radius: 20px; padding: 12px 16px; margin-bottom: 14px; color: var(--accent); }
        .brand-panel { border-radius: 26px; padding: 20px; margin-bottom: 14px; }
        .auth-card { width: min(560px, 100%); border-radius: 36px; padding: 32px; }
        .brand-panel h1, .hero h1 {
          margin: 6px 0 10px;
          font-size: clamp(26px, 3.2vw, 42px);
          line-height: 0.98;
          letter-spacing: 0.03em;
          overflow-wrap: anywhere;
        }
        .brand-panel h1 {
          font-size: clamp(24px, 2.5vw, 34px);
          letter-spacing: 0.01em;
          word-break: break-word;
        }
        .brand-panel p, .hero p, .section-copy, .copy-box, .meta, .empty-copy { color: var(--muted); line-height: 1.7; }
        .brand-meta, .meta, .eyebrow, .nav-link small, .facet-pill, .priority, .story-list small, .stack-item small { font-family: var(--mono); }
        .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .brand-user { margin-top: 10px; color: var(--muted); font-family: var(--mono); font-size: 12px; }
        .logout-link {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.03);
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
        }
        .eyebrow, .brand-chip {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(121, 240, 255, 0.08);
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 11px;
        }

        .nav-list { display: grid; gap: 8px; }
        .nav-link {
          display: grid;
          gap: 6px;
          padding: 14px 16px;
          border-radius: 22px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.025);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .nav-link:hover, .nav-link.active {
          border-color: rgba(121, 240, 255, 0.28);
          background: rgba(121, 240, 255, 0.08);
          transform: translateX(4px);
        }

        .hero { border-radius: 34px; padding: 24px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; margin-bottom: 18px; }
        .hero-grid, .grid-three, .grid-two, .card-grid, .metric-row, .metric-wall, .task-board { display: grid; gap: 16px; }
        .hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; }
        .hero-stat, .metric-wall > div, .metric-row > div {
          padding: 14px;
          border-radius: 22px;
          border: 1px solid rgba(121, 240, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
        }
        .hero-stat span, .metric-wall span, .metric-row span { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
        .hero-stat strong, .metric-wall strong, .metric-row strong { display: block; margin-top: 8px; font-size: 20px; }

        .grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 16px; }
        .grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 16px; }
        .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .panel, .rail-panel { border-radius: 28px; padding: 20px; }
        .panel-large { min-height: 100%; }
        .section-head { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin: 18px 0 12px; }
        .section-head.compact { margin-top: 20px; }
        .section-head h2, .panel h2, .rail-panel h2, .task-column-head h3 { margin: 0; }
        .stack-list { display: grid; gap: 12px; }
        .stack-item, .workbench-link, .staff-list-card {
          display: grid;
          gap: 6px;
          padding: 15px;
          border-radius: 22px;
          border: 1px solid rgba(121, 240, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .workbench-link.active, .staff-list-card.active { border-color: rgba(255, 167, 88, 0.34); background: rgba(255, 167, 88, 0.08); }
        .workbench-link:hover, .staff-list-card:hover { transform: translateY(-2px); border-color: rgba(121, 240, 255, 0.22); }
        .copy-box {
          margin: 12px 0;
          padding: 14px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .detail-list, .alerts, .story-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
        .detail-list li, .alerts li, .story-list li, .stack-item span, .stack-item small, .staff-list-copy small {
          color: var(--muted);
          line-height: 1.7;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .facet-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 14px; }
        .facet-pill { padding: 8px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); color: var(--muted); font-size: 12px; }

        .machine-head, .task-top, .task-actions, .editor-actions { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
        .machine-head h3, .task-card h4 { margin: 6px 0 0; }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-family: var(--mono);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .badge-online, .badge-ok { background: rgba(86, 243, 154, 0.12); color: var(--ok); }
        .badge-degraded, .badge-warn, .badge-review { background: rgba(255, 208, 92, 0.14); color: var(--warn); }
        .badge-offline, .badge-danger, .badge-blocked { background: rgba(255, 91, 110, 0.14); color: var(--danger); }
        .badge-running, .badge-info, .badge-ready { background: rgba(121, 240, 255, 0.14); color: var(--accent); }
        .priority { color: var(--accent-warm); }
        .task-board { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .task-column { border-radius: 28px; border: 1px solid var(--panel-border); background: rgba(8, 20, 24, 0.85); padding: 16px; }
        .task-column-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .task-column-body { display: grid; gap: 12px; }
        .task-card {
          border-radius: 24px;
          border: 1px solid rgba(121, 240, 255, 0.12);
          background: rgba(255, 255, 255, 0.02);
          padding: 16px;
        }
        .task-card p { color: var(--muted); line-height: 1.7; }

        .action-btn {
          appearance: none;
          border: 1px solid rgba(121, 240, 255, 0.24);
          background: rgba(121, 240, 255, 0.08);
          color: var(--text);
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
        }
        .action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .action-danger { border-color: rgba(255, 91, 110, 0.24); background: rgba(255, 91, 110, 0.1); }
        .token-field { display: grid; gap: 8px; margin: 12px 0; color: var(--muted); }
        .token-field input, .editor, .auth-form input, .model-form input, .model-form select {
          width: 100%;
          border-radius: 20px;
          border: 1px solid rgba(121, 240, 255, 0.16);
          background: rgba(4, 10, 12, 0.92);
          color: var(--text);
          padding: 14px 16px;
        }
        .editor { min-height: 420px; resize: vertical; font-family: var(--mono); line-height: 1.7; }
        .auth-form { display: grid; gap: 14px; margin-top: 20px; }
        .auth-form label { display: grid; gap: 8px; color: var(--muted); }
        .auth-submit { margin-top: 8px; width: 100%; justify-content: center; }
        .auth-error {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 18px;
          color: #ffd7de;
          background: rgba(255, 91, 110, 0.12);
          border: 1px solid rgba(255, 91, 110, 0.18);
        }
        .auth-notice { margin-top: 16px; margin-bottom: 0; }

        .workbench-grid { align-items: start; }
        .staff-list-copy { display: grid; gap: 4px; text-align: right; color: var(--muted); }
        .story-list li { padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); overflow-wrap: anywhere; }
        .story-list li:last-child { border-bottom: 0; padding-bottom: 0; }
        .heartbeat-meta {
          display: grid;
          gap: 4px;
          grid-template-columns: minmax(0, 1fr);
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .badge-row, .chat-quick-actions, .native-chat-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .model-card {
          padding: 16px;
          border-radius: 24px;
          border: 1px solid rgba(121, 240, 255, 0.12);
          background: rgba(255, 255, 255, 0.025);
        }
        .model-stack { margin: 14px 0; }
        .model-form {
          margin-top: 16px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .model-form label {
          display: grid;
          gap: 8px;
          color: var(--muted);
        }
        .toggle-field {
          grid-template-columns: 18px minmax(0, 1fr);
          align-items: center;
          align-content: center;
          min-height: 52px;
        }
        .toggle-field input {
          width: 18px;
          height: 18px;
          margin: 0;
          padding: 0;
        }
        .native-chat-panel { padding-bottom: 24px; }
        .native-chat-head { justify-content: space-between; margin-bottom: 14px; }
        .native-chat-frame-wrap {
          position: relative;
          min-height: 940px;
          border-radius: 26px;
          overflow: hidden;
          border: 1px solid rgba(121, 240, 255, 0.12);
          background: rgba(2, 5, 8, 0.88);
        }
        .native-chat-loading {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(4, 10, 12, 0.88);
          border: 1px solid rgba(121, 240, 255, 0.18);
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
        }
        .native-chat-frame {
          display: block;
          width: 100%;
          min-height: 940px;
          border: 0;
          background: #02060b;
        }

        body.is-leaving .app-shell,
        body.is-leaving .edge-shell {
          opacity: 0.65;
          transform: scale(0.994);
          transition: opacity 160ms ease, transform 160ms ease;
        }

        @keyframes driftGlow {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(2%, -1%, 0) scale(1.02); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes panelEnter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1320px) {
          .app-shell { grid-template-columns: 300px minmax(0, 1fr); }
          .rail { grid-column: 1 / -1; position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .rail-panel { min-height: 100%; }
        }

        @media (max-width: 980px) {
          .app-shell, .hero, .grid-two, .grid-three, .card-grid, .task-board { grid-template-columns: 1fr; }
          .sidebar, .main-column, .rail { position: static; }
          .rail { display: grid; gap: 16px; }
          .staff-list-copy { text-align: left; }
          .model-form { grid-template-columns: 1fr; }
          .native-chat-frame-wrap, .native-chat-frame { min-height: 760px; }
        }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

function sectionLabel(section: MasterSection): string {
  if (section === "chat") return "聊天";
  if (section === "usage") return "用量";
  if (section === "machines") return "机器";
  if (section === "staff") return "员工";
  if (section === "memory") return "记忆";
  if (section === "docs") return "文档";
  if (section === "tasks") return "任务";
  if (section === "settings") return "设置";
  return "总览";
}

function sectionHint(section: MasterSection): string {
  if (section === "chat") return "原生聊天面板";
  if (section === "usage") return "用量与订阅";
  if (section === "machines") return "节点与连接";
  if (section === "staff") return "人员与当前工作";
  if (section === "memory") return "真实记忆文件";
  if (section === "docs") return "共享工作文档";
  if (section === "tasks") return "任务与停止控制";
  if (section === "settings") return "接线与令牌";
  return "总办必看";
}

function sectionLead(section: MasterSection): string {
  if (section === "chat") return "直接复用 OpenClaw 原生聊天 UI，把暂停、删历史、会话侧栏和原生交互一起带回来。";
  if (section === "usage") return "保留官方的用量、订阅和数据连接判断，不再用简化版代替。";
  if (section === "machines") return "把 Master 与四台 Edge 的连接、负载、告警、在线态势放回一个视图。";
  if (section === "staff") return "点到员工就能看到他现在在做什么、下一步是什么、是否被卡住。";
  if (section === "memory") return "记忆工作台直接对准真实文件与快照，支持写回。";
  if (section === "docs") return "文档工作台只保留真正影响运行的共享文档和核心工作文档。";
  if (section === "tasks") return "任务页补上总办控制动作，先支持手动停止和责任节点定位。";
  if (section === "settings") return "把接线状态、控制能力和本地 token 入口统一收在设置页。";
  return "总办主脑看摘要、派单、盯风险，同时保留官方关键功能位。";
}

function statusLabel(status: InstanceSummary["status"]): string {
  if (status === "online") return "在线";
  if (status === "degraded") return "降级";
  if (status === "offline") return "离线";
  return "未知";
}

function staffStateLabel(state: StaffView["state"]): string {
  if (state === "busy_running") return "忙碌中";
  if (state === "blocked_waiting") return "阻塞中";
  if (state === "offline_maintenance") return "离线维护";
  return "待命中";
}

function mapStaffStateBadge(state: StaffView["state"]): "online" | "degraded" | "offline" {
  if (state === "busy_running") return "online";
  if (state === "blocked_waiting") return "degraded";
  if (state === "offline_maintenance") return "offline";
  return "online";
}

function taskStatusLabel(status: WorkItem["status"]): string {
  if (status === "ready") return "待执行";
  if (status === "running") return "执行中";
  if (status === "blocked") return "阻塞";
  if (status === "review") return "待复核";
  return "已完成";
}

function stageLabel(stage: WorkItem["stage"]): string {
  if (stage === "dispatch") return "派单";
  if (stage === "execution") return "执行";
  if (stage === "delivery") return "交付";
  return "验收";
}

function mapTaskStatusBadge(status: WorkItem["status"]): string {
  if (status === "running") return "running";
  if (status === "blocked") return "blocked";
  if (status === "review") return "review";
  if (status === "done") return "ok";
  return "ready";
}

function formatUsageCost(cost: number | undefined, tokens: number | undefined): string {
  if (cost === undefined || tokens === undefined) return "未连接";
  return `${formatInt(tokens)} tokens / $${cost.toFixed(2)}`;
}

function shortenText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function formatInt(value: number): string {
  return value.toLocaleString("zh-CN");
}

function displayNativeChatPath(value: string): string {
  return value.split("#")[0] || value;
}

function serializeJsonForHtml(value: string): string {
  return value.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
