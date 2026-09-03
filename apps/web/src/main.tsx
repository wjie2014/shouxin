import React, { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts/core";
import { BarChart, FunnelChart, LineChart, PieChart } from "echarts/charts";
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import "./style.css";
import "./style-extra.css";
import "./style-polish.css";
echarts.use([
  BarChart,
  FunnelChart,
  LineChart,
  PieChart,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
]);
const API = import.meta.env.VITE_API_URL || "/api";
const statusLabel: any = {
  draft: "草稿",
  pending_review_l1: "审核中（一级审核）",
  pending_review_l2: "审核中（二级审核）",
  pending_review_l3: "审核中（三级审核）",
  rejected_l1: "已驳回（一级）",
  rejected_l2: "已驳回（二级）",
  rejected_l3: "已驳回（三级）",
  published: "已发布",
  updating: "更新中",
  retired: "已退役",
  SEARCH: "搜索",
  HIT: "命中",
  VIEW: "查看",
  DOWNLOAD: "下载",
  feedback: "评价反馈",
};
const dateTime = (v: any) =>
  v ? String(v).replace("T", " ").slice(0, 19) : "-";
const rowValue = (row: any, key: string) =>
  row?.[key] ?? row?.[key.toUpperCase()] ?? row?.[key.toLowerCase()];
function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = sessionStorage.getItem(key); return saved == null ? initial : JSON.parse(saved); }
    catch { return initial; }
  });
  useEffect(() => { sessionStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}
const waitingTime = (v: any) => {
  if (!v) return "-";
  const elapsedHours = Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 3600000));
  if (elapsedHours < 1) return "不足1小时";
  if (elapsedHours < 24) return `${elapsedHours}小时`;
  return `${Math.floor(elapsedHours / 24)}天${elapsedHours % 24}小时`;
};
const safeHtml = (v: any) =>
  String(v || "")
    .replace(/<\/?(script|iframe|object|embed|style)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
const fieldLabel: any = {
  id: "标识",
  username: "账号",
  real_name: "姓名",
  role_names: "角色",
  unit_name: "单位",
  role_codes: "角色编码",
  email: "邮箱",
  mobile: "手机",
  enabled: "启用",
  built_in: "内置",
  must_change_password: "需改密",
  created_at: "创建时间",
  updated_at: "更新时间",
  role_code: "角色编码",
  role_name: "角色名称",
  description: "描述",
  config_key: "参数名",
  config_value: "参数值",
  config_type: "参数类型",
  config_group: "参数分组",
  operation_type: "操作类型",
  operation_content: "操作内容",
  target_type: "目标类型",
  target_id: "目标标识",
  client_ip: "客户端IP",
  domain_name: "业务域",
  pass_rule: "通过规则",
  flow_version: "流程版本",
  scheme_code: "方案编码",
  scheme_name: "方案名称",
};
async function api(path: string, opt: RequestInit = {}, token = "") {
  const headers: any = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(API + path, { ...opt, headers });
  const responseText = await r.text();
  let payload: any = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }
  if (!r.ok) {
    throw Error(
      (payload && typeof payload === "object" && payload.message) ||
        r.statusText ||
        "请求失败",
    );
  }
  return payload;
}
function ConfirmDialog({
  title = "请确认",
  message,
  confirmText = "确认",
  danger = false,
  onConfirm,
  onCancel,
}: any) {
  return (
    <div className="modal">
      <div className="modal-card confirm-card">
        <div className="confirm-heading">
          <div className={`confirm-icon ${danger ? "danger-icon" : ""}`}>
            {danger ? "!" : "?"}
          </div>
          <h3>{title}</h3>
        </div>
        <p>{message}</p>
        <div className="modal-actions">
          <button
            className={danger ? "danger-solid" : "primary"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
function Pagination({ page, pageSize, total, onPage, onPageSize }: any) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>共 {total} 条</span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        上一页
      </button>
      <span>
        第 {page} / {pages} 页
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        下一页
      </button>
      {onPageSize && (
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value));
            onPage(1);
          }}
        >
          <option value="10">10条/页</option>
          <option value="20">20条/页</option>
          <option value="50">50条/页</option>
        </select>
      )}
    </div>
  );
}
function Login({ done }: { done: (t: string, u: any) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const login = () =>
    api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
      .then((x) => done(x.accessToken, x.user))
      .catch((e) => setError(e.message));
  return (
    <div className="login">
      <div className="login-aside">
        <div className="login-aside-top">
          <div className="brand">
            QA<span>·</span>Flow
          </div>
        </div>
        <div className="login-aside-mid">
          <h2>知识问答对管理系统</h2>
          <p>企业级知识资产治理平台，覆盖问答对全生命周期的采集、审核、发布与检索。</p>
          <ul className="login-features">
            <li>
              <span className="lf-icon">▤</span>
              <div>
                <strong>结构化知识治理</strong>
                <small>按业务域分级管理，沉淀可复用的问答资产</small>
              </div>
            </li>
            <li>
              <span className="lf-icon">✓</span>
              <div>
                <strong>多级审核流转</strong>
                <small>标准化审批链路，保障知识内容质量与合规</small>
              </div>
            </li>
            <li>
              <span className="lf-icon">⌂</span>
              <div>
                <strong>数据驾驶舱</strong>
                <small>实时统计与趋势分析，量化知识运营成效</small>
              </div>
            </li>
          </ul>
        </div>
        <div className="login-aside-foot">
          © 2026 QA·Flow 知识资产治理平台 · 企业版
        </div>
      </div>

      <div className="login-main">
        <div className="login-card">
          <div className="login-card-head">
            <h1>欢迎登录</h1>
            <p>请输入您的账号信息以进入管理控制台</p>
          </div>

          <label className="login-field">
            <span>账号</span>
            <div className="login-input">
              <span className="li-icon">◔</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </div>
          </label>

          <label className="login-field">
            <span>密码</span>
            <div className="login-input">
              <span className="li-icon">⚿</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>
          </label>

          {error && <div className="error">{error}</div>}

          <button className="login-submit" onClick={login}>
            登录系统
          </button>

          <div className="login-hint">
            如遇账号问题，请联系系统管理员开通权限
          </div>
        </div>
      </div>
    </div>
  );
}
const navSections = [
  { title: "工作台", items: [["dashboard", "工作台", "⌂"]] },
  {
    title: "问答对管理",
    items: [
      ["pairs", "问答对列表", "▤"],
      ["create", "新建问答对", "＋"],
    ],
  },
  {
    title: "审核管理",
    items: [
      ["reviews", "待审核列表", "✓"],
      ["history", "审核历史", "↺"],
    ],
  },
  {
    title: "配置管理",
    items: [
      ["fields", "字段方案", "◫"],
      ["domains", "目录体系", "▦"],
      ["flows", "审核流程", "⇢"],
    ],
  },
  {
    title: "统计分析",
    items: [
      ["custom", "自定义分析", "⌁"],
    ],
  },
  {
    title: "系统管理",
    items: [
      ["users", "用户管理", "♙"],
      ["roles", "角色管理", "♚"],
      ["logs", "操作日志", "≡"],
      ["params", "系统参数", "⚙"],
    ],
  },
];
const titles: any = {
  dashboard: "工作台",
  pairs: "问答对列表",
  create: "新建问答对",
  reviews: "待审核列表",
  history: "审核历史",
  fields: "字段方案",
  domains: "目录体系",
  flows: "审核流程",
  custom: "自定义分析",
  users: "用户管理",
  roles: "角色管理",
  logs: "操作日志",
  params: "系统参数",
};
const permissionByTab: Record<string, string> = {
  dashboard: "dashboard", pairs: "pairs:list", create: "pairs:create", reviews: "review:decision", history: "review:history",
  fields: "config:fields", domains: "config:domains", flows: "config:flows", custom: "analysis:custom",
  users: "system:users", roles: "system:roles", logs: "system:logs", params: "system:params",
};
function App() {
  const normalizeTab = (value: string) => value === "stats" ? "dashboard" : value;
  const [token, setToken] = useState(localStorage.getItem("qa_token") || ""),
    [user, setUser] = useState<any>(),
    [systemHealthy, setSystemHealthy] = useState<boolean | null>(null),
    [reviewSummary, setReviewSummary] = useState<any>({ total: 0, byLevel: {} }),
    [tab, setTab] = useState(normalizeTab(localStorage.getItem("qa_tab") || "dashboard")),
    [sidebarCollapsed, setSidebarCollapsed] = useState(
      localStorage.getItem("qa_sidebar_collapsed") === "1",
    ),
    [openTabs, setOpenTabs] = useState<string[]>(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("qa_tabs") || '["dashboard"]');
        return Array.from(new Set((Array.isArray(stored) ? stored : ["dashboard"]).map(normalizeTab)));
      } catch {
        return ["dashboard"];
      }
    });
  useEffect(() => {
    localStorage.setItem("qa_tab", tab);
    localStorage.setItem("qa_tabs", JSON.stringify(openTabs));
  }, [tab, openTabs]);
  useEffect(() => {
    localStorage.setItem("qa_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);
  const selectTab = (k: string) => {
    const target = normalizeTab(k);
    setTab(target);
    setOpenTabs((a) => (a.includes(target) ? a : [...a, target]));
  };
  const closeTab = (k: string) => {
    if (k === "dashboard") return;
    Object.keys(sessionStorage).filter((key) => key.startsWith(`qa_state_${k}_`)).forEach((key) => sessionStorage.removeItem(key));
    setOpenTabs((a) => {
      const n = a.filter((x) => x !== k);
      setTab(n[n.length - 1] || "dashboard");
      return n;
    });
  };
  useEffect(() => {
    if (token)
      api("/auth/me", {}, token)
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("qa_token");
          setToken("");
        });
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const check = () => fetch(API.replace(/\/api$/, "") + "/actuator/health")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => setSystemHealthy(result?.status === "UP"))
      .catch(() => setSystemHealthy(false));
    check();
    const timer = window.setInterval(check, 60000);
    return () => window.clearInterval(timer);
  }, [token]);
  const loadReviewSummary = () => {
    if (!token) return;
    api("/reviews/my-summary", {}, token)
      .then((summary) =>
        setReviewSummary({
          total: Number(summary?.total || 0),
          byLevel: summary?.byLevel || {},
          oldestAssignedAt: summary?.oldestAssignedAt,
        }),
      )
      .catch(() => setReviewSummary({ total: 0, byLevel: {} }));
  };
  useEffect(() => {
    if (!token || !user) return;
    loadReviewSummary();
    const timer = window.setInterval(loadReviewSummary, 60000);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") loadReviewSummary();
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [token, user?.id]);
  useEffect(() => {
    if (!user?.permissions?.length) return;
    const required = permissionByTab[tab];
    if (required && !user.permissions.includes(required)) setTab("dashboard");
  }, [tab, user?.id, user?.permissions]);
  if (!token || !user)
    return (
      <Login
        done={(t, u) => {
          localStorage.setItem("qa_token", t);
          setToken(t);
          setUser(u);
        }}
      />
    );
  const logout = () => {
    api("/auth/logout", { method: "POST" }, token).catch(() => {});
    localStorage.removeItem("qa_token");
    setToken("");
  };
  const permissions: string[] = user.permissions || [];
  const canOpen = (key: string) =>
    !permissions.length || permissions.includes(permissionByTab[key] || key);
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(([key]) => canOpen(key)),
    }))
    .filter((section) => section.items.length);
  const renderContent = (key: string) =>
    key === "dashboard" ? (
      <Dashboard
        token={token}
        reviewSummary={reviewSummary}
        openReviews={() => selectTab("reviews")}
        navigate={selectTab}
      />
    ) : key === "pairs" ? (
      <Pairs token={token} />
    ) : key === "create" ? (
      <CreatePair
        token={token}
        user={user}
        close={() => selectTab("pairs")}
        saved={() => selectTab("pairs")}
      />
    ) : key === "reviews" ? (
      <Reviews
        token={token}
        summary={reviewSummary}
        onChanged={loadReviewSummary}
      />
    ) : key === "history" ? (
      <ReviewHistory token={token} />
    ) : key === "domains" ? (
      <Domains token={token} />
    ) : key === "custom" ? (
      <CustomStats token={token} />
    ) : key === "flows" ? (
      <FlowConfig token={token} />
    ) : key === "fields" ? (
      <FieldSchemeUI token={token} />
    ) : ["users", "roles", "logs", "params"].includes(key) ? (
      <Admin token={token} initialTab={key} />
    ) : (
      <Dashboard token={token} />
    );
  return (
    <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside>
        <div className="brand">
          <span className="brand-full">知识问答对管理系统</span>
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
          title={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
        <nav>
          {visibleSections.map((s) => (
            <div className="nav-section" key={s.title}>
              <div className="nav-title">{s.title}</div>
              {s.items.map(([k, n, i]) => (
                <button
                  className={tab === k ? "active" : ""}
                  onClick={() => selectTab(k)}
                  key={k}
                >
                  <b>{i}</b>
                  <span className="nav-item-label">{n}</span>
                  {k === "reviews" && reviewSummary.total > 0 && (
                    <span className="nav-badge" title={`${reviewSummary.total} 条待审批`}>
                      {reviewSummary.total > 99 ? "99+" : reviewSummary.total}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main>
        <header className="app-header">
          <div className="header-main">
            <div className="header-title">
              <span className="eyebrow">知识资产治理</span>
              <h2>{titles[tab] || "工作台"}</h2>
            </div>
            <div className="header-actions">
              {reviewSummary.total > 0 && (
                <button className="review-reminder" onClick={() => selectTab("reviews")}>
                  <span className="review-reminder-icon">✓</span>
                  <span>
                    <b>待我审批 {reviewSummary.total} 条</b>
                    <small>
                      {[1, 2, 3]
                        .filter((level) => Number(reviewSummary.byLevel?.[level] || 0) > 0)
                        .map(
                          (level) =>
                            `${level}级 ${reviewSummary.byLevel[level]} 条`,
                        )
                        .join(" · ")}
                    </small>
                  </span>
                </button>
              )}
              <span className={`status-dot ${systemHealthy === false ? "status-error" : ""}`} title="服务与数据库健康状态">{systemHealthy === null ? "检测中" : systemHealthy ? "系统正常" : "系统异常"}</span>
              <div className="header-user-card" title={`当前账号：${user.username || "-"}`}>
                <span className="header-user-avatar" aria-hidden="true">{String(user.realName || user.username || "用").slice(0,1)}</span>
                <span className="header-user-copy"><b>{user.realName || user.username}</b><small>{user.username || "当前用户"}</small></span>
              </div>
              <button className="header-logout" onClick={logout} title="安全退出当前账号"><span aria-hidden="true">↪</span>退出登录</button>
            </div>
          </div>
          <div className="tab-strip" role="tablist" aria-label="已打开页面">
            {openTabs.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? "tab-current" : ""}
                onClick={() => setTab(k)}
              >
                <span className="tab-label">{titles[k]}</span>
                {k !== "dashboard" && (
                  <span
                    className="tab-close"
                    role="button"
                    aria-label={`关闭${titles[k]}页签`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(k);
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>
        {reviewSummary.total > 0 && tab === "dashboard" && (
          <button className="review-work-banner" onClick={() => selectTab("reviews")}>
            <span className="review-work-banner-icon">!</span>
            <span>
              <b>您有 {reviewSummary.total} 条内容等待审批</b>
              <small>
                最早待办分配于 {dateTime(reviewSummary.oldestAssignedAt)}，请及时处理
              </small>
            </span>
            <em>立即处理 →</em>
          </button>
        )}
        <div className="tab-workspace">
          {openTabs.filter(canOpen).map((key) => (
            <div key={key} className="tab-page" hidden={key !== tab}>
              {renderContent(key)}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
function Dashboard({
  token,
  reviewSummary,
  openReviews,
  navigate,
}: {
  token: string;
  reviewSummary?: any;
  openReviews?: () => void;
  navigate?: (tab: string) => void;
}) {
  const [d, setD] = useState<any>(),
    [trend, setTrend] = useState<any[]>([]);
  useEffect(() => {
    api("/statistics/dashboard", {}, token)
      .then(setD)
      .catch(() =>
        setD({
          total: 0,
          published: 0,
          pendingReview: 0,
          draft: 0,
          retired: 0,
          thisMonthNew: 0,
          statusDistribution: [],
          domainDistribution: [],
          avgReviewHours: 0,
        }),
      );
  }, [token]);
  useEffect(() => {
    api("/statistics/trend?days=30", {}, token)
      .then((x: any) => setTrend(x.items || []))
      .catch(() => setTrend([]));
  }, [token]);
  if (!d) return <div className="loading">加载统计数据…</div>;
  const statusName: any = {
    draft: "草稿",
    published: "已发布",
    updating: "更新中",
    retired: "已退役",
    pending_review_l1: "审核中（一级审核）",
    pending_review_l2: "审核中（二级审核）",
    pending_review_l3: "审核中（三级审核）",
    rejected_l1: "已驳回（一级）",
    rejected_l2: "已驳回（二级）",
    rejected_l3: "已驳回（三级）",
  };
  const statusItems = (d.statusDistribution || []).map((x: any) => ({
    name: statusName[x.STATUS || x.status] || x.STATUS || x.status,
    value: Number(x.COUNT || x.count || 0),
  }));
  const statusTotal = Math.max(
    1,
    statusItems.reduce((s: number, x: any) => s + x.value, 0),
  );
  const statusColors = [
    "#2563eb",
    "#38bdf8",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#10b981",
  ];
  const statusGradient = statusItems
    .reduce((parts: string[], x: any, i: number) => {
      const start =
        (statusItems.slice(0, i).reduce((s: number, y: any) => s + y.value, 0) /
          statusTotal) *
        100;
      return parts.concat(
        `${statusColors[i % statusColors.length]} ${start}% ${start + (x.value / statusTotal) * 100}%`,
      );
    }, [])
    .join(", ");
  const trendValues = trend.map((x: any) => Number(x.COUNT || x.count || 0));
  const maxTrend = Math.max(1, ...trendValues);
  const domainItems = (d.domainDistribution || []).map((x: any) => ({
    name: x.DOMAIN_NAME || x.domain_name,
    value: Number(x.COUNT || x.count || 0),
  }));
  const maxDomain = Math.max(1, ...domainItems.map((x: any) => x.value));
  const cards = [
    ["问答对总量", d.total, "blue", "条"],
    ["已发布", d.published, "green", "条"],
    ["审核中", d.pendingReview, "orange", "条"],
    ["草稿", d.draft, "purple", "条"],
    ["已退役", d.retired, "red", "条"],
    ["平均审核时长", d.avgReviewHours || 0, "teal", "小时"],
  ];
  const statusOption = {
    tooltip: { trigger: "item", formatter: "{b}<br/>{c} 条（{d}%）" },
    legend: { orient: "vertical", right: 12, top: "center", itemWidth: 10, itemHeight: 10 },
    color: statusColors,
    series: [{ type: "pie", radius: ["52%", "76%"], center: ["31%", "52%"], avoidLabelOverlap: true, label: { show: true, formatter: "{b}\n{c}条", color: "#4E5969" }, emphasis: { scale: true, scaleSize: 8, itemStyle: { shadowBlur: 18, shadowColor: "rgba(46,111,177,.25)" } }, data: statusItems }],
  };
  const trendOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "line" }, formatter: (items:any[]) => `${items?.[0]?.axisValue || ""}<br/>新增：${items?.[0]?.value || 0} 条` },
    grid: { left: 44, right: 24, top: 36, bottom: 44, outerBounds: { left: 4, right: 4, top: 4, bottom: 4 }, outerBoundsContain: "axisLabel" },
    xAxis: { type: "category", boundaryGap: false, data: trend.map((x:any)=>String(x.DAY || x.day || "").slice(5)), axisLabel: { interval: 4, rotate: 28 } },
    yAxis: { type: "value", min: 0, max: Math.max(1, Math.ceil(maxTrend * 1.2)), minInterval: 1 },
    series: [{ name: "新增数量", type: "line", smooth: true, symbol: "circle", symbolSize: 7, showSymbol: true, label: { show: true, formatter: "{c}", position: "top" }, lineStyle: { width: 3, color: "#2E6FB1" }, itemStyle: { color: "#2E6FB1", borderColor: "#fff", borderWidth: 2 }, areaStyle: { color: "rgba(46,111,177,.14)" }, data: trendValues }],
  };
  return (
    <>
      <section className="cards">
        {cards.map((c) => (
          <div className={`card card-${c[2]}`} key={c[0]}>
            <span>{c[0]}</span>
            <strong>{c[1]}</strong>
            <small>{c[3]}</small>
          </div>
        ))}
      </section>
      <section className="dashboard-work-panel">
        <div className="dashboard-work-heading">
          <div><h3>我的工作</h3><span>集中处理待办任务和常用操作</span></div>
          <small>数据实时更新</small>
        </div>
        <div className="dashboard-todos">
          <button className="todo-review" onClick={openReviews}><em>✓</em><span><b>{Number(d.todos?.pendingForMe || reviewSummary?.total || 0)}</b><small>待我审核</small></span><i>›</i></button>
          <button className="todo-submit" onClick={()=>navigate?.("pairs")}><em>↑</em><span><b>{Number(d.todos?.myPending || 0)}</b><small>我提交的待审核</small></span><i>›</i></button>
          <button className="todo-rejected" onClick={()=>navigate?.("pairs")}><em>↺</em><span><b>{Number(d.todos?.myRejected || 0)}</b><small>被驳回待修改</small></span><i>›</i></button>
          <button className="todo-updating" onClick={()=>navigate?.("pairs")}><em>⟳</em><span><b>{Number(d.todos?.myUpdating || 0)}</b><small>更新申请处理中</small></span><i>›</i></button>
          <div className="dashboard-quick"><strong>快捷操作</strong><div><button className="primary" onClick={()=>navigate?.("create")}>＋ 新建问答对</button><button onClick={()=>navigate?.("pairs")}>批量导入</button><button onClick={()=>navigate?.("fields")}>字段配置</button></div></div>
        </div>
      </section>
      <section className="grid dashboard-grid">
        <div className="dash-col">
          <div className="panel status-panel">
            <h3>状态分布</h3>
            <EChart option={statusOption} />
          </div>
          <div className="panel trend-panel">
            <h3 className="trend-heading">
              近30天新增趋势{" "}
              <span className="trend-summary">
                合计 {trendValues.reduce((s, v) => s + v, 0)} 条 · 峰值{" "}
                {maxTrend} 条
              </span>
            </h3>
            <div className="trend-chart">{trend.length ? <EChart option={trendOption} /> : <div className="trend-placeholder">暂无趋势明细</div>}</div>
          </div>
        </div>
        <div className="panel domain-panel">
          <h3>
            空间分布 <small className="panel-subtitle">按一级目录</small>
          </h3>
          <div className="domain-bars">
            {domainItems.map((x: any) => (
              <div className="bar-row" key={x.name}>
                <span title={x.name}>{x.name}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (x.value / maxDomain) * 100)}%`,
                    }}
                  />
                </div>
                <b>{x.value}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid operations-grid">
        <div className="panel"><h3>单位提交排行</h3><EChart option={{tooltip:{trigger:"axis",axisPointer:{type:"shadow"}},grid:{left:90,right:32,top:24,bottom:24,outerBounds:{left:4,right:4,top:4,bottom:4},outerBoundsContain:"axisLabel"},xAxis:{type:"value",minInterval:1},yAxis:{type:"category",data:(d.unitRanking||[]).map((x:any)=>rowValue(x,"unit_name")).reverse()},series:[{type:"bar",barMaxWidth:24,label:{show:true,position:"right"},data:(d.unitRanking||[]).map((x:any)=>Number(rowValue(x,"count")||0)).reverse(),itemStyle:{color:"#2E6FB1",borderRadius:[0,4,4,0]}}]}} /></div>
        <div className="panel"><h3>各级审核通过率</h3><EChart option={{tooltip:{trigger:"axis"},grid:{left:48,right:24,top:32,bottom:32,outerBounds:{left:4,right:4,top:4,bottom:4},outerBoundsContain:"axisLabel"},xAxis:{type:"category",data:(d.reviewPassRate||[]).map((x:any)=>`第${rowValue(x,"level_no")}级`)},yAxis:{type:"value",min:0,max:100,axisLabel:{formatter:"{value}%"}},series:[{type:"bar",barWidth:36,label:{show:true,position:"top",formatter:"{c}%"},data:(d.reviewPassRate||[]).map((x:any)=>Number(rowValue(x,"pass_rate")||0)),itemStyle:{color:"#4D8DCA",borderRadius:[5,5,0,0]}}]}} /></div>
        <div className="panel version-summary"><h3>版本更新统计</h3><div><p><b>{Number(rowValue(d.versionStats||{},"pair_count")||0)}</b><span>有版本记录问答对</span></p><p><b>{Number(rowValue(d.versionStats||{},"updated_pair_count")||0)}</b><span>发生过更新</span></p><p><b>{Number(rowValue(d.versionStats||{},"update_count")||0)}</b><span>累计更新次数</span></p><p><b>{Number(rowValue(d.versionStats||{},"max_versions")||0)}</b><span>单条最大版本数</span></p></div></div>
      </section>
    </>
  );
}
function Pairs({ token }: { token: string }) {
  const [data, setData] = useState<any>({ items: [] }),
    [keyword, setKeyword] = useStoredState("qa_state_pairs_keyword", ""),
    [status, setStatus] = useStoredState("qa_state_pairs_status", ""),
    [l1, setL1] = useStoredState("qa_state_pairs_l1", ""),
    [l2, setL2] = useStoredState("qa_state_pairs_l2", ""),
    [l3, setL3] = useStoredState("qa_state_pairs_l3", ""),
    [from, setFrom] = useStoredState("qa_state_pairs_from", ""),
    [to, setTo] = useStoredState("qa_state_pairs_to", ""),
    [domains, setDomains] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [editingItem, setEditingItem] = useState<any>(),
    [checked, setChecked] = useState<string[]>([]),
    [page, setPage] = useStoredState("qa_state_pairs_page", 1),
    [pageSize, setPageSize] = useStoredState("qa_state_pairs_page_size", 10),
    [sort, setSort] = useStoredState("qa_state_pairs_sort", "updatedAt"),
    [sortDir, setSortDir] = useStoredState<"asc" | "desc">("qa_state_pairs_sort_dir", "desc"),
    [listFields, setListFields] = useState<any[]>([]),
    [showCreate, setShowCreate] = useState(false),
    [importType, setImportType] = useState<"first" | "second">("first"),
    [message, setMessage] = useState(""),
    [exporting, setExporting] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [singleDelete, setSingleDelete] = useState<any>(null),
    [importPreview, setImportPreview] = useState<any>(null);
  useEffect(() => {
    api("/domains/tree", {}, token)
      .then((x) => setDomains(Array.isArray(x) ? x : []))
      .catch(() => {});
    api("/field-schemes/default", {}, token)
      .then((scheme: any) => setListFields((scheme?.fields || []).filter((field: any) => !!field.list_visible && !coreFieldCodes.has(field.field_code))))
      .catch(() => setListFields([]));
  }, [token]);
  const current = domains.find((x: any) => (x.id || x.ID) === l1),
    second = (current?.children || []).find((x: any) => (x.id || x.ID) === l2);
  const load = () =>
    api(
      `/qa-pairs?keyword=${encodeURIComponent(keyword)}&status=${status}&domainL1Id=${l1}&domainL2Id=${l2}&domainL3Id=${l3}&submitFrom=${from}&submitTo=${to}&page=${page}&pageSize=${pageSize}&sortBy=${encodeURIComponent(sort)}&sortDir=${sortDir}`,
      {},
      token,
    )
      .then((x) =>
        setData(
          Array.isArray(x)
            ? { items: x, total: x.length }
            : { ...x, items: Array.isArray(x?.items) ? x.items : [] },
        ),
      )
      .catch(() => setData({ items: [] }));
  useEffect(() => {
    load();
  }, [token, page, pageSize, status, sort, sortDir, l1, l2, l3, from, to]);
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number(data?.total ?? items.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortColumn = (key: string) => {
    if (sort !== key) { setSort(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSort("updatedAt"); setSortDir("desc"); }
    setPage(1);
  };
  const sortMark = (key: string) => sort === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const reset = () => {
    setKeyword("");
    setStatus("");
    setL1("");
    setL2("");
    setL3("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const toggle = (id: string) =>
    setChecked((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id],
    );
  const openDetail = (item: any) =>
    api("/qa-pairs/" + (item.id || item.ID), {}, token)
      .then(setSelected)
      .catch((e: any) => setMessage(e.message || "详情加载失败"));
  const openEdit = (item: any) =>
    api("/qa-pairs/" + (item.id || item.ID), {}, token)
      .then(setEditingItem)
      .catch((e: any) => setMessage(e.message || "编辑数据加载失败"));
  const batchSubmit = () => {
    if (!checked.length) {
      setMessage("请先选择数据");
      return;
    }
    api(
      "/qa-pairs/batch/submit",
      { method: "POST", body: JSON.stringify({ ids: checked }) },
      token,
    ).then(() => {
      setChecked([]);
      load();
    });
  };
  const batchDelete = () => {
    if (!checked.length) {
      setMessage("请先选择数据");
      return;
    }
    setDeleteConfirm(true);
  };
  const confirmBatchDelete = () => {
    api(
      "/qa-pairs/batch/delete",
      { method: "POST", body: JSON.stringify({ ids: checked }) },
      token,
    ).then(() => {
      setDeleteConfirm(false);
      setChecked([]);
      load();
    });
  };
  const confirmSingleDelete = () => {
    if (!singleDelete) return;
    const id = singleDelete.id || singleDelete.ID;
    api(`/qa-pairs/${id}`, { method: "DELETE" }, token)
      .then(() => {
        setSingleDelete(null);
        setSelected((current: any) =>
          current && (current.id || current.ID) === id ? undefined : current,
        );
        setMessage("问答对已删除");
        load();
      })
      .catch((e: any) => setMessage(e.message || "删除失败"));
  };
  const confirmImport = async () => {
    const pre = importPreview;
    try {
      const response = await fetch(API + `/import/${importType}-stage/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: (pre.rows || [])
            .filter((x: any) => x.valid)
            .map((x: any) => ({ ...x, valid: true })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "导入失败");
      setImportPreview(null);
      setMessage(`导入完成，成功 ${result.imported || 0} 条${result.failed ? `，失败 ${result.failed} 条` : ""}`);
      load();
    } catch (e: any) {
      setImportPreview(null);
      setMessage(e.message || "导入失败");
    }
  };
  const exportExcel = async () => {
    setExporting(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ keyword, status, domainL1Id: l1, domainL2Id: l2, domainL3Id: l3, submitFrom: from, submitTo: to });
      checked.forEach((id) => query.append("ids", id));
      const response = await fetch(API + "/export/second-stage?" + query.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "导出失败，请稍后重试");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `问答对数据-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Excel 导出成功");
    } catch (e: any) {
      setMessage(e.message || "导出失败，请稍后重试");
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="panel">
      <div className="toolbar filter-toolbar">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索问答编号或问题…"
        />
        <select
          value={l1}
          onChange={(e) => {
            setL1(e.target.value);
            const d = domains.find(
              (x: any) => (x.id || x.ID) === e.target.value,
            );
            setL2(d?.children?.[0]?.id || "");
            setL3("");
          }}
        >
          <option value="">全部一级目录</option>
          {domains.map((d: any) => (
            <option key={d.id || d.ID} value={d.id || d.ID}>
              {d.domainName || d.DOMAIN_NAME}
            </option>
          ))}
        </select>
        <select
          value={l2}
          onChange={(e) => {
            setL2(e.target.value);
            const d = (current?.children || []).find(
              (x: any) => (x.id || x.ID) === e.target.value,
            );
            setL3("");
          }}
        >
          <option value="">全部二级目录</option>
          {(current?.children || []).map((d: any) => (
            <option key={d.id || d.ID} value={d.id || d.ID}>
              {d.domainName || d.DOMAIN_NAME}
            </option>
          ))}
        </select>
        <select value={l3} onChange={(e) => setL3(e.target.value)}>
          <option value="">全部三级目录</option>
          {(second?.children || []).map((d: any) => (
            <option key={d.id || d.ID} value={d.id || d.ID}>
              {d.domainName || d.DOMAIN_NAME}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending_review_l1">审核中（一级）</option>
          <option value="pending_review_l2">审核中（二级）</option>
          <option value="pending_review_l3">审核中（三级）</option>
          <option value="rejected_l1">已驳回（一级）</option>
          <option value="rejected_l2">已驳回（二级）</option>
          <option value="rejected_l3">已驳回（三级）</option>
          <option value="published">已发布</option>
          <option value="updating">更新中</option>
          <option value="retired">已退役</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="提交开始日期"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="提交结束日期"
        />
        <button
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          搜索
        </button>
        <button onClick={reset}>重置</button>
      </div>
      <div className="toolbar">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updatedAt">按更新时间</option>
          <option value="createdAt">按创建时间</option>
          <option value="submittedAt">按提交时间</option>
          <option value="code">按编号</option>
          <option value="question">按问题</option>
          {listFields.filter((field: any) => !!field.sortable).map((field: any) => (
            <option key={field.field_code} value={`field:${field.field_code}`}>按{field.field_name}</option>
          ))}
        </select>
        <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}>
          {sortDir === "desc" ? "降序 ↓" : "升序 ↑"}
        </button>
        <button onClick={batchSubmit}>批量提交审核</button>
        <button className="danger" onClick={batchDelete}>
          批量删除
        </button>
        <select
          value={importType}
          onChange={(e) => setImportType(e.target.value as "first" | "second")}
          aria-label="导入模板类型"
        >
          <option value="first">导入第一阶段</option>
          <option value="second">导入第二阶段</option>
        </select>
        <label className="button">
          选择Excel并预览
          <input
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              fetch(API + `/import/${importType}-stage/preview`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
              })
                .then(async (r) => {
                  const result = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(result.message || "文件预览失败");
                  return {
                    ...result,
                    valid: Number(result.valid ?? 0),
                    invalid: Number(result.invalid ?? 0),
                    total: Number(result.total ?? 0),
                  };
                })
                .then(setImportPreview)
                .catch((e) => setMessage(e.message || "文件预览失败"));
            }}
          />
        </label>
        <button className="button" disabled={exporting} onClick={exportExcel}>
          {exporting ? "正在导出…" : checked.length ? `导出已选（${checked.length}）` : "导出筛选结果"}
        </button>
        <button className="primary" onClick={() => setShowCreate(true)}>
          + 新建问答对
        </button>
      </div>
      <div className="table-scroll pair-list-scroll">
      <table className="pair-list-table">
        <thead>
          <tr>
            <th className="selection-column">
              <input
                type="checkbox"
                checked={checked.length === items.length && items.length > 0}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setChecked(
                    e.target.checked ? items.map((x: any) => x.id || x.ID) : [],
                  )
                }
              />
            </th>
            <th onClick={() => sortColumn("code")}>序号{sortMark("code")}</th>
            <th onClick={() => sortColumn("code")}>问答编号{sortMark("code")}</th>
            <th>目录</th>
            <th onClick={() => sortColumn("question")}>问题{sortMark("question")}</th>
            <th>状态</th>
            <th>版本</th>
            <th>提交人</th>
            <th onClick={() => sortColumn("submittedAt")}>提交时间{sortMark("submittedAt")}</th>
            {listFields.map((field: any) => (
              <th key={field.field_code} style={{ width: field.column_width || 160, textAlign: String(field.align_mode || "LEFT").toLowerCase() as any }}>
                {field.field_name}
              </th>
            ))}
            <th onClick={() => sortColumn("updatedAt")}>更新时间{sortMark("updatedAt")}</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x: any, index: number) => (
            <tr key={x.id || x.ID}>
              <td className="selection-column">
                <input
                  type="checkbox"
                  checked={checked.includes(x.id || x.ID)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggle(x.id || x.ID);
                  }}
                />
              </td>
              <td>{(page - 1) * pageSize + index + 1}</td>
              <td className="code">
                <button className="code-link" onClick={() => openDetail(x)}>
                  {x.qa_code || x.QA_CODE}
                </button>
              </td>
              <td>{[x.domain_l1_name || x.DOMAIN_L1_NAME, x.domain_l2_name || x.DOMAIN_L2_NAME, x.domain_l3_name || x.DOMAIN_L3_NAME].filter(Boolean).join(" / ")}</td>
              <td title={x.question_text || x.QUESTION_TEXT}>{String(x.question_text || x.QUESTION_TEXT || "").slice(0, 80)}{String(x.question_text || x.QUESTION_TEXT || "").length > 80 ? "…" : ""}</td>
              <td>
                <span className="tag">
                  {statusLabel[x.status || x.STATUS] || x.status || x.STATUS}
                </span>
              </td>
              <td>{x.version_no || x.VERSION_NO}</td>
              <td>{x.real_name || x.REAL_NAME}</td>
              <td>{dateTime(x.submitted_at || x.SUBMITTED_AT)}</td>
              {listFields.map((field: any) => {
                let extension: any = {};
                try { extension = JSON.parse(x.extension_data || x.EXTENSION_DATA || "{}"); } catch {}
                const value = extension[field.field_code];
                const display = Array.isArray(value) ? value.map((entry: any) => typeof entry === "object" ? entry.name || entry.label || entry.value || "-" : entry).join(" / ") : typeof value === "boolean" ? (value ? "是" : "否") : value ?? "-";
                return <td key={field.field_code} style={{ textAlign: String(field.align_mode || "LEFT").toLowerCase() as any }}>{display}</td>;
              })}
              <td>{dateTime(x.updated_at || x.UPDATED_AT)}</td>
              <td className="table-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="link-button"
                  onClick={() => openDetail(x)}
                >
                  详情
                </button>
                <button
                  className="link-button"
                  disabled={![
                    "draft",
                    "updating",
                    "rejected_l1",
                    "rejected_l2",
                    "rejected_l3",
                    "published",
                    "retired",
                  ].includes(x.status || x.STATUS)}
                  title={
                    String(x.status || x.STATUS).startsWith("pending_review_")
                      ? "审核中的问答对不可编辑"
                      : "编辑问答对"
                  }
                  onClick={() => openEdit(x)}
                >
                  编辑
                </button>
                <button
                  className="link-button danger-text"
                  onClick={() => setSingleDelete(x)}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="pagination">
        <span>共 {total} 条</span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          上一页
        </button>
        <span>
          第 {page} 页 / 共{" "}
          {totalPages} 页
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value="10">10条/页</option>
          <option value="20">20条/页</option>
          <option value="50">50条/页</option>
          <option value="100">100条/页</option>
        </select>
      </div>
      {!items.length && <div className="empty">暂无数据</div>}
      {message && (
        <div className="inline-notice">
          <span>{message}</span>
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      {deleteConfirm && (
        <ConfirmDialog
          title="批量删除"
          message={`确认删除选中的 ${checked.length} 条问答对？`}
          confirmText="确认删除"
          danger
          onConfirm={confirmBatchDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
      {singleDelete && (
        <ConfirmDialog
          title="删除问答对"
          message={`确认删除问答对“${singleDelete.qa_code || singleDelete.QA_CODE || "未命名"}”？删除后将无法在列表中查看。`}
          confirmText="确认删除"
          danger
          onConfirm={confirmSingleDelete}
          onCancel={() => setSingleDelete(null)}
        />
      )}
      {importPreview && (
        <ConfirmDialog
          title="导入预览完成"
          message={`共解析 ${importPreview.sheetCount || 1} 个 Sheet，其中兼容 ${importPreview.compatibleSheets || 1} 个；有效 ${importPreview.valid} 条，无效 ${importPreview.invalid} 条。是否确认导入有效数据？`}
          confirmText="确认导入"
          onConfirm={confirmImport}
          onCancel={() => setImportPreview(null)}
        />
      )}
      {selected && (
        <PairDetail
          item={selected}
          token={token}
          close={() => setSelected(null)}
          changed={() => {
            setSelected(null);
            setMessage("操作成功，列表已刷新");
            load();
          }}
        />
      )}{" "}
      {editingItem && (
        <EditPair
          item={editingItem}
          token={token}
          published={
            editingItem.status === "published" || editingItem.status === "retired"
          }
          close={() => setEditingItem(null)}
          saved={() => {
            setEditingItem(null);
            setMessage("修改已保存");
            load();
          }}
        />
      )}
      {showCreate && (
        <CreatePair
          token={token}
          close={() => setShowCreate(false)}
          saved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function PairDetail({
  item,
  token,
  close,
  changed,
}: {
  item: any;
  token: string;
  close: () => void;
  changed: () => void;
}) {
  const [tab, setTab] = useState("basic");
  const [history, setHistory] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [retireReason, setRetireReason] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [downloadingAttachment, setDownloadingAttachment] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  useEffect(() => setDetailPage(1), [tab]);
  useEffect(() => {
    api(`/reviews/history?qaPairId=${item.id}`, {}, token)
      .then((x) => setHistory(Array.isArray(x) ? x : x?.items || []))
      .catch(() => {});
    api(`/qa-pairs/${item.id}/attachments`, {}, token)
      .then((x) => setAttachments(Array.isArray(x) ? x : []))
      .catch(() => {});
    api(`/qa-pairs/${item.id}/versions`, {}, token)
      .then((x) => setVersions(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, [item.id, token]);
  const accessAttachment = async (attachment: any, preview = false) => {
    setAttachmentError("");
    setDownloadingAttachment(attachment.id);
    try {
      const response = await fetch(
        API + `/qa-pairs/${item.id}/attachments/${attachment.id}/${preview ? "preview" : "download"}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const responseText = await response.text();
        let message = "附件下载失败";
        try {
          message = JSON.parse(responseText)?.message || message;
        } catch {
          if (responseText.trim()) message = responseText;
        }
        if (response.status === 401) message = "登录状态已失效，请重新登录后下载";
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      if (preview) link.target = "_blank";
      else link.download = attachment.original_name || "附件";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), preview ? 60000 : 1000);
    } catch (error: any) {
      setAttachmentError(error.message || "附件下载失败，请稍后重试");
    } finally {
      setDownloadingAttachment("");
    }
  };
  return (
    <>
      <div className="modal">
        <div className="modal-card wide">
          <button className="close" onClick={close}>
            ×
          </button>
          <h3>{item.qa_code}</h3>
          <span className="tag detail-status">{statusLabel[item.status] || item.status}</span>
          <div className="tabs">
            {[
              ["basic", "基本信息"],
              ["content", "问答内容"],
              ["attachments", "附件"],
              ["versions", "版本历史"],
              ["reviews", "审核记录"],
            ].map(([k, n]) => (
              <button
                className={tab === k ? "selected" : ""}
                onClick={() => setTab(k)}
                key={k}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="detail-tab-content">
          {tab === "basic" && (
            <div className="detail-grid">
              <p>
                <b>一级目录</b>
                {item.domain_l1_name || item.domainL1Id || "-"}
              </p>
              <p>
                <b>二级目录</b>
                {item.domain_l2_name || item.domainL2Id || "-"}
              </p>
              <p>
                <b>三级目录</b>
                {item.domain_l3_name || item.domainL3Id || "-"}
              </p>
              <p>
                <b>编写人</b>
                {item.real_name || "-"}
              </p>
              <p>
                <b>版本号</b>
                {item.version_no || "-"}
              </p>
              <p>
                <b>创建时间</b>
                {dateTime(item.created_at)}
              </p>
              <p>
                <b>更新时间</b>
                {dateTime(item.updated_at)}
              </p>
            </div>
          )}
          {tab === "content" && (
            <div className="qa-rich-detail">
              <section className="qa-rich-section question">
                <div className="qa-rich-heading"><span>Q</span><div><h4>问题</h4><small>知识问题</small></div></div>
                <div
                className="content rich-content-view"
                dangerouslySetInnerHTML={{
                  __html: safeHtml(
                    item.question_html || item.questionHtml || item.question_text || item.questionText || "",
                  ),
                }}
                />
              </section>
              <section className="qa-rich-section answer">
                <div className="qa-rich-heading"><span>A</span><div><h4>答案</h4><small>标准答案</small></div></div>
                <div
                className="content rich-content-view"
                dangerouslySetInnerHTML={{
                  __html: safeHtml(item.answer_html || item.answerHtml || item.answer_text || item.answerText || ""),
                }}
                />
              </section>
              <DynamicFieldValues item={item} />
            </div>
          )}
          {tab === "attachments" && (
            <>
            {attachmentError && <div className="inline-notice attachment-download-error"><span>{attachmentError}</span><button onClick={() => setAttachmentError("")}>×</button></div>}
            {attachments.length ? (
              <table>
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>类型</th>
                    <th>大小</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments
                    .slice(
                      (detailPage - 1) * detailPageSize,
                      detailPage * detailPageSize,
                    )
                    .map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.original_name}</td>
                        <td>{a.content_type || "-"}</td>
                        <td>
                          {a.size_bytes
                            ? `${Math.ceil(a.size_bytes / 1024)} KB`
                            : "-"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link"
                            disabled={downloadingAttachment === a.id}
                            onClick={() => accessAttachment(a, true)}
                          >
                            预览
                          </button>
                          <button
                            type="button"
                            className="link"
                            disabled={downloadingAttachment === a.id}
                            onClick={() => accessAttachment(a)}
                          >
                            {downloadingAttachment === a.id ? "下载中…" : "下载"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">暂无附件</div>
            )}
            </>
          )}
          {tab === "versions" &&
            (versions.length ? (
              <table>
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>状态</th>
                    <th>变更原因</th>
                    <th>创建人</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {versions
                    .slice(
                      (detailPage - 1) * detailPageSize,
                      detailPage * detailPageSize,
                    )
                    .map((v: any) => (
                      <tr key={v.id}>
                        <td>{v.version_no}</td>
                        <td>
                          {statusLabel[v.version_status] || v.version_status}
                        </td>
                        <td>{v.change_reason || "-"}</td>
                        <td>{v.created_by_name || "-"}</td>
                        <td>{dateTime(v.created_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">暂无版本记录</div>
            ))}
          {tab === "reviews" &&
            (history.length ? (
              <table>
                <thead>
                  <tr>
                    <th>级别</th>
                    <th>审核人</th>
                    <th>结果</th>
                    <th>审核意见</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice(
                      (detailPage - 1) * detailPageSize,
                      detailPage * detailPageSize,
                    )
                    .map((r: any, i) => (
                      <tr key={i}>
                        <td>第{r.level_no}级</td>
                        <td>
                          {r.reviewer_name || r.REVIEWER_NAME || "-"}
                          {(r.reviewer_username || r.REVIEWER_USERNAME) && (
                            <small className="table-subtext">
                              {r.reviewer_username || r.REVIEWER_USERNAME}
                            </small>
                          )}
                        </td>
                        <td>
                          {r.result === "pass"
                            ? "通过"
                            : r.result === "reject"
                              ? "驳回"
                              : r.result || "-"}
                        </td>
                        <td>{r.opinion || "-"}</td>
                        <td>{dateTime(r.reviewed_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">暂无审核记录</div>
            ))}
          {["attachments", "versions", "reviews"].includes(tab) && (
            <Pagination
              page={detailPage}
              pageSize={detailPageSize}
              total={
                tab === "attachments"
                  ? attachments.length
                  : tab === "versions"
                    ? versions.length
                    : history.length
              }
              onPage={setDetailPage}
              onPageSize={setDetailPageSize}
            />
          )}
          </div>
          <div className="modal-actions">
            {[
              "draft",
              "updating",
              "rejected_l1",
              "rejected_l2",
              "rejected_l3",
            ].includes(item.status) && (
              <button onClick={() => setEditing(true)}>编辑内容</button>
            )}
            {[
              "draft",
              "updating",
              "rejected_l1",
              "rejected_l2",
              "rejected_l3",
            ].includes(item.status) && (
              <button
                className="primary"
                onClick={() =>
                  api(
                    `/qa-pairs/${item.id}/submit`,
                    { method: "POST" },
                    token,
                  ).then(changed)
                }
              >
                提交审核
              </button>
            )}
            {item.status === "published" && (
              <button className="primary" onClick={() => setEditing(true)}>
                发起更新
              </button>
            )}
            {item.status === "published" && (
              <button className="danger" onClick={() => setRetiring(true)}>
                退役
              </button>
            )}
            <button onClick={close}>关闭</button>
          </div>
        </div>
      </div>
      {editing && (
        <EditPair
          item={item}
          token={token}
          close={() => setEditing(false)}
          saved={changed}
          published={item.status === "published" || item.status === "retired"}
        />
      )}
      {retiring && (
        <div className="modal">
          <div className="modal-card">
            <button className="close" onClick={() => setRetiring(false)}>
              ×
            </button>
            <h3>退役问答对</h3>
            <label className="retire-reason-field">
              退役原因
              <textarea
                rows={4}
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                placeholder="请说明退役原因"
              />
            </label>
            <div className="modal-actions">
              <button
                className="danger-solid"
                disabled={!retireReason.trim()}
                onClick={() =>
                  api(
                    `/qa-pairs/${item.id}/retire`,
                    {
                      method: "POST",
                      body: JSON.stringify({ reason: retireReason }),
                    },
                    token,
                  ).then(changed)
                }
              >
                确认退役
              </button>
              <button onClick={() => setRetiring(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
const fieldTypeName: any = { TEXT:"文本",TEXTAREA:"多行文本",RICH_TEXT:"富文本",INTEGER:"整数",DECIMAL:"小数",DATE:"日期",DATETIME:"日期时间",SINGLE_ENUM:"单选枚举",ENUM:"单选枚举",MULTI_ENUM:"多选枚举",CASCADE:"级联选择",ATTACHMENT:"附件",USER:"用户选择",BOOLEAN:"布尔值",NUMBER:"小数" };
const coreFieldCodes = new Set(["questionText","answerText","referenceDoc","author","attachments","domainL1Id","domainL2Id","domainL3Id"]);
const optionItems = (raw: any): any[] => { if (!raw) return []; try { const parsed=typeof raw==="string"?JSON.parse(raw):raw;return Array.isArray(parsed)?parsed:Array.isArray(parsed?.options)?parsed.options:[]; } catch { return []; } };
const optionValue = (item:any) => typeof item==="object"?String(item.value??item.label??item.name??""):String(item);
const optionLabel = (item:any) => typeof item==="object"?String(item.label??item.name??item.value??""):String(item);
function CascadeInput({field,value,onChange}:{field:any,value:any,onChange:(value:any)=>void}){
  const selected=Array.isArray(value)?value:[];let options=optionItems(field.options_json);const levels:any[]=[];
  for(let level=0;level<6&&options.length;level++){levels.push(options);const current=options.find((x:any)=>optionValue(x)===selected[level]);options=Array.isArray(current?.children)?current.children:[];}
  return <div className="dynamic-cascade">{levels.map((items,index)=><select key={index} value={selected[index]||""} onChange={(e)=>{const next=selected.slice(0,index);if(e.target.value)next[index]=e.target.value;onChange(next);}}><option value="">请选择第{index+1}级</option>{items.map((item:any)=><option key={optionValue(item)} value={optionValue(item)}>{optionLabel(item)}</option>)}</select>)}</div>;
}
function RichTextEditor({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    const element = editor.current;
    if (!element || document.activeElement === element) return;
    const next = safeHtml(value || "");
    if (element.innerHTML !== next) element.innerHTML = next;
  }, [value]);
  useEffect(() => {
    const capture = () => {
      const selection = window.getSelection();
      const root = editor.current;
      if (!root || !selection?.rangeCount || !root.contains(selection.anchorNode)) return;
      savedRange.current = selection.getRangeAt(0).cloneRange();
      const commands = ["bold", "italic", "underline", "strikeThrough", "insertOrderedList", "insertUnorderedList", "justifyLeft", "justifyCenter", "justifyRight"];
      setActive(new Set(commands.filter((command) => document.queryCommandState(command))));
    };
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, []);
  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !savedRange.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  };
  const run = (command: string, argument?: string) => {
    editor.current?.focus();
    restoreSelection();
    document.execCommand(command, false, argument);
    onChange(editor.current?.innerHTML || "");
    const next = new Set(active);
    if (document.queryCommandState(command)) next.add(command); else next.delete(command);
    setActive(next);
  };
  const button = (command:string, content:React.ReactNode, title:string, argument?:string) => (
    <button type="button" className={active.has(command)?"active":""} aria-pressed={active.has(command)} onMouseDown={(e)=>e.preventDefault()} onClick={()=>run(command,argument)} title={title}>{content}</button>
  );
  const insertTable = () => run("insertHTML", '<table><tbody><tr><td>单元格</td><td>单元格</td></tr><tr><td>单元格</td><td>单元格</td></tr></tbody></table><p><br></p>');
  const insertImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => run("insertImage", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  return <div className="rich-editor-shell">
    <div className="rich-toolbar" aria-label={`${label}格式工具栏`}>
      <div className="rich-tool-group rich-block-tools">
        <select aria-label="段落样式" defaultValue="p" onMouseDown={()=>{const s=window.getSelection();if(s?.rangeCount)savedRange.current=s.getRangeAt(0).cloneRange();}} onChange={(e)=>{run("formatBlock",e.target.value);e.target.value="p";}}>
          <option value="p">正文</option><option value="h2">标题 1</option><option value="h3">标题 2</option><option value="blockquote">引用</option>
        </select>
      </div>
      <div className="rich-tool-group">
        {button("bold",<b>B</b>,"加粗（Ctrl+B）")}{button("italic",<i>I</i>,"斜体（Ctrl+I）")}{button("underline",<u>U</u>,"下划线（Ctrl+U）")}{button("strikeThrough",<s>S</s>,"删除线")}
      </div>
      <div className="rich-tool-group">
        {button("insertUnorderedList",<>• 列表</>,"无序列表")}{button("insertOrderedList",<>1. 列表</>,"有序列表")}
      </div>
      <div className="rich-tool-group compact">
        {button("justifyLeft","左","左对齐")}{button("justifyCenter","中","居中对齐")}{button("justifyRight","右","右对齐")}
      </div>
      <div className="rich-tool-group">
        <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>setShowLink(!showLink)} className={showLink?"active":""} title="插入链接">↗ 链接</button>
        <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={insertTable} title="插入 2×2 表格">▦ 表格</button>
        <label className="rich-image-button" title="插入图片（最大 5MB）">▧ 图片<input className="rich-image-input" type="file" accept="image/*" hidden onChange={(e)=>{insertImage(e.target.files?.[0]);e.target.value="";}} /></label>
      </div>
      <div className="rich-tool-group compact">
        {button("undo","↶","撤销")}{button("redo","↷","重做")}
        <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>run("removeFormat")} title="清除选中文字格式">清除格式</button>
      </div>
    </div>
    {showLink&&<div className="rich-link-panel"><input autoFocus value={linkUrl} placeholder="输入 https:// 开头的链接地址" onChange={(e)=>setLinkUrl(e.target.value)}/><button type="button" disabled={!/^https?:\/\//i.test(linkUrl)} onMouseDown={(e)=>e.preventDefault()} onClick={()=>{run("createLink",linkUrl);setLinkUrl("");setShowLink(false);}}>插入链接</button><button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{run("unlink");setShowLink(false);}}>取消链接</button></div>}
    <div className="rich-editor" role="textbox" aria-multiline="true" aria-label={label} data-placeholder={`请输入${label}`} contentEditable suppressContentEditableWarning ref={editor} onInput={(e)=>onChange(e.currentTarget.innerHTML)} onBlur={(e)=>onChange(e.currentTarget.innerHTML)} />
    <div className="rich-editor-footer"><span>支持标题、列表、表格、链接和图片</span><span>{String(value||"").replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").length} 字</span></div>
  </div>;
}
function FileDrop({ files, onChange, multiple = true }: { files: File[]; onChange: (files: File[]) => void; multiple?: boolean }) {
  const [dragging,setDragging]=useState(false);
  const accept=(incoming:File[])=>onChange(multiple?incoming:incoming.slice(0,1));
  return <label className={`file-drop ${dragging?"dragging":""}`} onDragOver={(e)=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={(e)=>{e.preventDefault();setDragging(false);accept(Array.from(e.dataTransfer.files));}}>
    <span className="file-drop-icon">⇧</span><b>拖拽文件到此处，或点击选择</b><small>支持图片、Office、PDF 等文件，单个不超过 50MB</small>
    <input type="file" multiple={multiple} hidden onChange={(e)=>accept(Array.from(e.target.files||[]))}/>
    {!!files.length&&<em>已选择 {files.length} 个：{files.map((x)=>x.name).join("、")}</em>}
  </label>;
}
function DynamicFieldInput({field,value,onChange,users=[]}:{field:any,value:any,onChange:(value:any)=>void,users?:any[]}){
  const type=field.field_type==="ENUM"?"SINGLE_ENUM":field.field_type==="NUMBER"?"DECIMAL":field.field_type;
  const fieldName=String(field.field_name||"扩展字段");
  if(type==="TEXTAREA")return <textarea aria-label={fieldName} rows={3} value={value||""} onChange={e=>onChange(e.target.value)}/>;
  if(type==="RICH_TEXT")return <RichTextEditor label={fieldName} value={value || ""} onChange={onChange}/>;
  if(type==="BOOLEAN"){
    const isPublic=fieldName.includes("公开");
    return <label className={`dynamic-boolean ${value?"checked":""}`}><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)}/><span className="dynamic-switch" aria-hidden="true"><i/></span><span className="dynamic-boolean-copy"><b>{value?(isPublic?"公开":"是"):(isPublic?"不公开":"否")}</b><small>{isPublic?(value?"所有有权限的用户均可查看":"仅创建人及审批相关人员可查看"):"点击切换状态"}</small></span></label>;
  }
  if(type==="SINGLE_ENUM")return <select aria-label={fieldName} value={value||""} onChange={e=>onChange(e.target.value)}><option value="">请选择</option>{optionItems(field.options_json).map((item:any)=><option key={optionValue(item)} value={optionValue(item)}>{optionLabel(item)}</option>)}</select>;
  if(type==="MULTI_ENUM"){
    const selected=Array.isArray(value)?value.map(String):[];
    const options=optionItems(field.options_json);
    return <div className="dynamic-multi-options" role="group" aria-label={fieldName}>{options.length?options.map((item:any)=>{const itemValue=optionValue(item);const checked=selected.includes(itemValue);return <label key={itemValue} className={`dynamic-option-chip ${checked?"selected":""}`}><input type="checkbox" checked={checked} onChange={()=>onChange(checked?selected.filter(x=>x!==itemValue):[...selected,itemValue])}/><span className="dynamic-option-check" aria-hidden="true">✓</span><span>{optionLabel(item)}</span></label>}):<span className="dynamic-options-empty">暂无可选项</span>}</div>;
  }
  if(type==="CASCADE")return <CascadeInput field={field} value={value} onChange={onChange}/>;
  if(type==="ATTACHMENT")return <FileDrop files={Array.isArray(value)?value.filter((x:any)=>x instanceof File):[]} onChange={onChange}/>;
  if(type==="USER")return <select aria-label={fieldName} value={value||""} onChange={e=>onChange(e.target.value)}><option value="">请选择用户</option>{users.map((x:any)=><option key={rowValue(x,"id")} value={rowValue(x,"id")}>{rowValue(x,"real_name")}（{rowValue(x,"username")}）</option>)}</select>;
  const inputType=type==="INTEGER"||type==="DECIMAL"?"number":type==="DATE"?"date":type==="DATETIME"?"datetime-local":"text";
  return <input aria-label={fieldName} type={inputType} step={type==="DECIMAL"?"any":undefined} value={value??""} onChange={e=>onChange(e.target.value)}/>;
}
function DynamicFields({scheme,values,setValues,users=[]}:{scheme:any,values:any,setValues:(value:any)=>void,users?:any[]}){
  const fields=(scheme?.fields||[]).filter((field:any)=>!coreFieldCodes.has(field.field_code));if(!fields.length)return null;
  return <div className="dynamic-field-section"><div className="dynamic-field-title"><b>扩展属性</b><span>由“{scheme.scheme_name}”字段方案动态生成</span></div><div className="dynamic-field-grid">{fields.map((field:any)=><div key={field.id||field.field_code} className={`dynamic-field-item ${["RICH_TEXT","TEXTAREA","CASCADE","MULTI_ENUM","BOOLEAN"].includes(field.field_type)?"span-2":""}`}><div className="dynamic-field-label"><span>{field.field_name}{Number(field.required)===1&&<em className="required-mark">*</em>}</span><small>{fieldTypeName[field.field_type]||field.field_type}</small></div><DynamicFieldInput field={field} value={values[field.field_code]} users={users} onChange={value=>setValues({...values,[field.field_code]:value})}/></div>)}</div></div>;
}
function missingSchemeFields(scheme:any,values:any,core:any){return (scheme?.fields||[]).filter((field:any)=>Number(field.required)===1).filter((field:any)=>{const value=coreFieldCodes.has(field.field_code)?core[field.field_code]:values[field.field_code];return value==null||value===""||Array.isArray(value)&&value.length===0;}).map((field:any)=>field.field_name);}
const extensionFiles=(values:any):File[]=>Object.values(values||{}).flatMap((value:any)=>Array.isArray(value)?value.filter((item:any)=>item instanceof File):[]);
const serializableExtensions=(values:any)=>Object.fromEntries(Object.entries(values||{}).map(([key,value]:any)=>[key,Array.isArray(value)&&value.some((item:any)=>item instanceof File)?value.map((item:any)=>item instanceof File?{name:item.name,size:item.size,type:item.type}:item):value]));
const parsedSchemeSnapshot=(raw:any)=>{try{return raw?(typeof raw==="string"?JSON.parse(raw):raw):null;}catch{return null;}};
function DynamicFieldValues({item}:{item:any}){
  const scheme=parsedSchemeSnapshot(item.field_schema_snapshot);
  let values:any={};try{values=typeof item.extension_data==="string"?JSON.parse(item.extension_data||"{}"):item.extension_data||{};}catch{}
  const fields=(scheme?.fields||[]).filter((field:any)=>!coreFieldCodes.has(field.field_code));
  if(!fields.length)return null;
  const display=(field:any,value:any)=>{
    if(value==null||value===""||Array.isArray(value)&&!value.length)return "-";
    if(field.field_type==="BOOLEAN")return value?"是":"否";
    if(field.field_type==="USER")return value;
    if(Array.isArray(value))return value.map((x:any)=>typeof x==="object"?(x.name||x.label||x.value||JSON.stringify(x)):x).join(" / ");
    return String(value).replace(/<[^>]+>/g,"");
  };
  return <div className="dynamic-value-section"><h4>扩展属性</h4><div className="detail-grid">{fields.map((field:any)=><p key={field.field_code}><b>{field.field_name}</b>{display(field,values[field.field_code])}</p>)}</div></div>;
}

function EditPair({
  item,
  token,
  close,
  saved,
  published = false,
}: {
  item: any;
  token: string;
  close: () => void;
  saved: () => void;
  published?: boolean;
}) {
  const [q, setQ] = useState(item.question_html || ""),
    [a, setA] = useState(item.answer_html || ""),
    [doc, setDoc] = useState(item.reference_doc || ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [scheme,setScheme]=useState<any>(null),
    [extensions,setExtensions]=useState<any>(()=>{try{return JSON.parse(item.extension_data||"{}");}catch{return {};}}),
    [schemeUsers,setSchemeUsers]=useState<any[]>([]);
  useEffect(()=>{
    const snapshot=parsedSchemeSnapshot(item.field_schema_snapshot);
    if(snapshot)setScheme(snapshot);
    else api(item.field_scheme_id?`/field-schemes/${item.field_scheme_id}`:"/field-schemes/default",{},token).then(setScheme).catch(e=>setError(e.message));
    api("/analysis/options",{},token).then(x=>setSchemeUsers(x?.users||[])).catch(()=>{});
  },[item.id,token]);
  const save = async (submit = false) => {
    if (
      !q.replace(/<[^>]+>/g, "").trim() ||
      !a.replace(/<[^>]+>/g, "").trim()
    ) {
      setError("问题和答案不能为空");
      return;
    }
    if(submit){const missing=missingSchemeFields(scheme,extensions,{questionText:q.replace(/<[^>]+>/g,"").trim(),answerText:a.replace(/<[^>]+>/g,"").trim(),referenceDoc:doc,author:item.authorId||item.author_id,attachments:"existing"});if(missing.length){setError(`请填写必填字段：${missing.join("、")}`);return;}}
    try {
      setSaving(true);
      setError("");
      await api(
        `/qa-pairs/${item.id}${published ? "/update" : ""}`,
        {
          method: published ? "POST" : "PUT",
          body: JSON.stringify(
            published
              ? {
                  questionHtml: q,
                  answerHtml: a,
                  referenceDoc: doc,
                  extensionData: JSON.stringify(serializableExtensions(extensions)),
                  fieldSchemeId: scheme?.id,
                  changeReason: reason,
                }
              : {
                  domainL1Id: item.domainL1Id,
                  domainL2Id: item.domainL2Id,
                  domainL3Id: item.domainL3Id,
                  questionHtml: q,
                  answerHtml: a,
                  referenceDoc: doc,
                  extensionData: JSON.stringify(serializableExtensions(extensions)),
                  fieldSchemeId: scheme?.id,
                },
          ),
        },
        token,
      );
      for (const file of extensionFiles(extensions)) {
        const fd = new FormData();
        fd.append("file", file);
        const response = await fetch(API + `/qa-pairs/${item.id}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!response.ok) throw new Error("扩展附件上传失败");
      }
      if (submit) {
        await api(`/qa-pairs/${item.id}/submit`, { method: "POST" }, token);
      }
      close();
      saved();
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal">
      <div className="modal-card wide pair-editor-modal">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>编辑 {item.qa_code}</h3>
        <div className="pair-editor-content">
        {published && (
          <label>
            变更原因
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请填写本次更新原因"
            />
          </label>
        )}
        <label>
          依据文档
          <input value={doc} onChange={(e) => setDoc(e.target.value)} />
        </label>
        <label>
          问题
          <RichTextEditor label="问题" value={q} onChange={setQ} />
        </label>
        <label>
          答案
          <RichTextEditor label="答案" value={a} onChange={setA} />
        </label>
        <DynamicFields scheme={scheme} values={extensions} setValues={setExtensions} users={schemeUsers}/>
        {error && <div className="error">{error}</div>}
        </div>
        <div className="modal-actions">
          <button disabled={saving} onClick={() => save(false)}>
            保存修改
          </button>
          <button
            className="primary"
            disabled={saving}
            onClick={() => save(true)}
          >
            保存并提交审核
          </button>
          <button onClick={close}>取消</button>
        </div>
      </div>
    </div>
  );
}
function CreatePair({
  token,
  user,
  close,
  saved,
}: {
  token: string;
  user?: any;
  close: () => void;
  saved: () => void;
}) {
  const [domains, setDomains] = useState<any[]>([]),
    [l1, setL1] = useState("domain-01"),
    [l2, setL2] = useState("domain-l2-01"),
    [l3, setL3] = useState(""),
    [q, setQ] = useState(""),
    [a, setA] = useState(""),
    [referenceDoc, setReferenceDoc] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [error, setError] = useState(""),
    [scheme,setScheme]=useState<any>(null),
    [extensions,setExtensions]=useState<any>({}),
    [schemeUsers,setSchemeUsers]=useState<any[]>([]),
    [author,setAuthor]=useState<any>(user);
  useEffect(() => {
    Promise.all([api("/domains/tree",{},token),api("/field-schemes/default",{},token),api("/analysis/options",{},token),author?Promise.resolve(author):api("/auth/me",{},token)])
      .then(([tree,fieldScheme,analysisOptions,currentUser])=>{setDomains(Array.isArray(tree)?tree:[]);setScheme(fieldScheme);setSchemeUsers(analysisOptions?.users||[]);setAuthor(currentUser);})
      .catch((e)=>setError(e.message||"动态表单加载失败"));
  }, [token]);
  const current = domains.find((x: any) => (x.id || x.ID) === l1);
  const second = (current?.children || []).find(
    (x: any) => (x.id || x.ID) === l2,
  );
  const save = async (submit = false) => {
    if (
      !q.replace(/<[^>]+>/g, "").trim() ||
      !a.replace(/<[^>]+>/g, "").trim()
    ) {
      setError("问题和答案不能为空");
      return;
    }
    if(submit){const missing=missingSchemeFields(scheme,extensions,{questionText:q.replace(/<[^>]+>/g,"").trim(),answerText:a.replace(/<[^>]+>/g,"").trim(),referenceDoc,author:author?.id,attachments:files.length?files:""});if(missing.length){setError(`请填写必填字段：${missing.join("、")}`);return;}}
    try {
      const x: any = await api(
        "/qa-pairs",
        {
          method: "POST",
          body: JSON.stringify({
            domainL1Id: l1,
            domainL2Id: l2,
            domainL3Id: l3 || null,
            questionHtml: q,
            answerHtml: a,
            referenceDoc,
            extensionData: JSON.stringify(serializableExtensions(extensions)),
            fieldSchemeId: scheme?.id,
          }),
        },
        token,
      );
      for (const file of [...files, ...extensionFiles(extensions)]) {
        const fd = new FormData();
        fd.append("file", file);
        const uploadResponse = await fetch(API + `/qa-pairs/${x.id}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json().catch(() => ({}));
          throw new Error(uploadError.message || `附件“${file.name}”上传失败`);
        }
      }
      if (submit)
        await api(`/qa-pairs/${x.id}/submit`, { method: "POST" }, token);
      saved();
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };
  return (
    <div className="modal">
      <div className="modal-card wide pair-editor-modal">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>新建问答对</h3>
        <div className="pair-editor-content">
        {scheme&&<div className="scheme-runtime-banner"><span>当前字段方案</span><b>{scheme.scheme_name}</b><small>系统已按默认方案动态生成表单</small></div>}
        <div className="pair-form-grid">
          <label>
            一级目录
            <select
              value={l1}
              onChange={(e) => {
                setL1(e.target.value);
                const d = domains.find(
                  (x: any) => (x.id || x.ID) === e.target.value,
                );
                const child = d?.children?.[0];
                setL2(child?.id || "");
                setL3(child?.children?.[0]?.id || "");
              }}
            >
              {domains.map((d: any) => (
                <option key={d.id || d.ID} value={d.id || d.ID}>
                  {d.domainName || d.DOMAIN_NAME}
                </option>
              ))}
            </select>
          </label>
          <label>
            二级目录
            <select
              value={l2}
              onChange={(e) => {
                setL2(e.target.value);
                const d = (current?.children || []).find(
                  (x: any) => (x.id || x.ID) === e.target.value,
                );
                setL3(d?.children?.[0]?.id || "");
              }}
            >
              {(current?.children || []).map((d: any) => (
                <option key={d.id || d.ID} value={d.id || d.ID}>
                  {d.domainName || d.DOMAIN_NAME}
                </option>
              ))}
            </select>
          </label>
          <label>
            三级目录
            <select value={l3} onChange={(e) => setL3(e.target.value)}>
              <option value="">请选择三级目录（可选）</option>
              {(second?.children || []).map((d: any) => (
                <option key={d.id || d.ID} value={d.id || d.ID}>
                  {d.domainName || d.DOMAIN_NAME}
                </option>
              ))}
            </select>
          </label>
          <label>
            编写人
            <input value={author?.realName||author?.real_name||"当前登录用户"} disabled />
          </label>
          <label>
            依据文档
            <input
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              placeholder="标准/规程名称"
            />
          </label>
        </div>
        <div className="form-field-block"><span>附件</span><FileDrop files={files} onChange={setFiles}/></div>
        <label>
          问题（支持富文本）
          <RichTextEditor label="问题" value={q} onChange={setQ} />
        </label>
        <label>
          答案（支持富文本）
          <RichTextEditor label="答案" value={a} onChange={setA} />
        </label>
        <DynamicFields scheme={scheme} values={extensions} setValues={setExtensions} users={schemeUsers}/>
        {error && <div className="error">{error}</div>}
        </div>
        <div className="modal-actions">
          <button onClick={() => save(false)}>保存草稿</button>
          <button className="primary" onClick={() => save(true)}>
            提交审核
          </button>
          <button onClick={close}>取消</button>
        </div>
      </div>
    </div>
  );
}

function Reviews({
  token,
  summary,
  onChanged,
}: {
  token: string;
  summary?: any;
  onChanged?: () => void;
}) {
  const [level, setLevel] = useStoredState("qa_state_reviews_level", 1),
    [data, setData] = useState<any>({ items: [] }),
    [selected, setSelected] = useState<any>(),
    [reviewAttachments, setReviewAttachments] = useState<any[]>([]),
    [reviewHistory, setReviewHistory] = useState<any[]>([]),
    [checked, setChecked] = useState<string[]>([]),
    [opinion, setOpinion] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [msg, setMsg] = useState(""),
    [batchRejectOpen, setBatchRejectOpen] = useState(false),
    [batchRejectOpinion, setBatchRejectOpinion] = useState("批量驳回，请补充材料"),
    [page, setPage] = useStoredState("qa_state_reviews_page", 1),
    [pageSize, setPageSize] = useStoredState("qa_state_reviews_page_size", 10),
    [keyword, setKeyword] = useStoredState("qa_state_reviews_keyword", ""),
    [submitter, setSubmitter] = useStoredState("qa_state_reviews_submitter", ""),
    [submitFrom, setSubmitFrom] = useStoredState("qa_state_reviews_submit_from", ""),
    [submitTo, setSubmitTo] = useStoredState("qa_state_reviews_submit_to", ""),
    [domains, setDomains] = useState<any[]>([]),
    [l1, setL1] = useStoredState("qa_state_reviews_l1", ""),
    [l2, setL2] = useStoredState("qa_state_reviews_l2", ""),
    [l3, setL3] = useStoredState("qa_state_reviews_l3", ""),
    [sortBy, setSortBy] = useStoredState("qa_state_reviews_sort", "assignedAt"),
    [sortDir, setSortDir] = useStoredState<"asc" | "desc">("qa_state_reviews_sort_dir", "asc");
  const currentDomain = domains.find((x: any) => rowValue(x, "id") === l1);
  const currentSecond = (currentDomain?.children || []).find(
    (x: any) => rowValue(x, "id") === l2,
  );
  const load = () =>
    api(
      `/reviews/pending?level=${level}&page=${page}&pageSize=${pageSize}&keyword=${encodeURIComponent(keyword)}&submitter=${encodeURIComponent(submitter)}&domainL1Id=${l1}&domainL2Id=${l2}&domainL3Id=${l3}&submitFrom=${submitFrom}&submitTo=${submitTo}&sortBy=${sortBy}&sortDir=${sortDir}`,
      {},
      token,
    )
      .then((x) =>
        setData(
          Array.isArray(x)
            ? { items: x }
            : { ...x, items: Array.isArray(x?.items) ? x.items : [] },
        ),
      )
      .catch(() => setData({ items: [] }));
  useEffect(() => {
    load();
    setChecked([]);
  }, [level, page, pageSize, keyword, submitter, l1, l2, l3, submitFrom, submitTo, sortBy, sortDir]);
  useEffect(() => {
    api("/domains/tree", {}, token)
      .then((x) => setDomains(Array.isArray(x) ? x : []))
      .catch(() => setDomains([]));
  }, [token]);
  useEffect(() => {
    const firstPendingLevel = [1, 2, 3].find(
      (item) => Number(summary?.byLevel?.[item] || 0) > 0,
    );
    if (firstPendingLevel && Number(summary?.byLevel?.[level] || 0) === 0) {
      setLevel(firstPendingLevel);
      setPage(1);
    }
  }, [summary?.total]);
  const items = Array.isArray(data?.items) ? data.items : [];
  const togglePendingSort = (key: string) => {
    setPage(1);
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("asc"); }
  };
  const sortMark = (key: string) => sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
  const openReview = async (id: string) => {
    try {
      const [detail, attachments, history] = await Promise.all([
        api(`/qa-pairs/${id}`, {}, token),
        api(`/qa-pairs/${id}/attachments`, {}, token),
        api(`/reviews/history?qaPairId=${id}&pageSize=100`, {}, token),
      ]);
      setSelected(detail);
      setReviewAttachments(Array.isArray(attachments) ? attachments : []);
      setReviewHistory(Array.isArray(history) ? history : history?.items || []);
    } catch (e: any) {
      setMsg(e.message || "审核详情加载失败");
    }
  };
  const decide = (
    result: string,
    id = selected?.id,
    op = opinion,
    sug = suggestion,
  ) => {
    if (!id) return Promise.reject(new Error("未选择审核任务"));
    if (result === "reject" && !op.trim())
      return Promise.reject(new Error("驳回必须填写审核意见"));
    return api(
      `/reviews/${id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          result,
          opinion: op || (result === "pass" ? "审核通过" : ""),
          suggestion: sug || null,
        }),
      },
      token,
    ).then(() => {
      setSelected(null);
      setOpinion("");
      setSuggestion("");
      load();
      onChanged?.();
    });
  };
  const batch = (result: string, rejectOpinion = batchRejectOpinion) => {
    if (!checked.length) {
      setMsg("请先选择数据");
      return;
    }
    Promise.allSettled(
      checked.map((id) =>
        decide(
          result,
          id,
          result === "pass" ? "批量审核通过" : rejectOpinion,
        ),
      ),
    ).then((rs) => {
      setChecked([]);
      setMsg(
        rs.some((x) => x.status === "rejected")
          ? "部分任务处理失败，请刷新后重试"
          : "批量审核完成",
      );
      setBatchRejectOpen(false);
      load();
    });
  };
  return (
    <section className="panel">
      <div className="tabs">
        {[1, 2, 3].map((x) => (
          <button
            className={level === x ? "selected" : ""}
            onClick={() => setLevel(x)}
            key={x}
          >
            第{x}级审核
            {Number(summary?.byLevel?.[x] || 0) > 0 && (
              <span className="review-tab-count">{summary.byLevel[x]}</span>
            )}
          </button>
        ))}
      </div>
      <div className="review-filter-grid">
        <div className="review-filter-heading"><div><strong>筛选条件</strong><span>按内容、提交人、目录及提交时间筛选待审核任务</span></div><small>共 {Number(data.total || items.length)} 条待处理</small></div>
        <label>问题关键词<input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="编号、问题或答案" /></label>
        <label>提交人<input value={submitter} onChange={(e) => setSubmitter(e.target.value)} placeholder="输入真实姓名" /></label>
        <label>一级目录<select value={l1} onChange={(e) => { setL1(e.target.value); setL2(""); setL3(""); }}><option value="">全部</option>{domains.map((x: any) => <option key={rowValue(x, "id")} value={rowValue(x, "id")}>{rowValue(x, "domainName") || rowValue(x, "domain_name")}</option>)}</select></label>
        <label>二级目录<select value={l2} onChange={(e) => { setL2(e.target.value); setL3(""); }}><option value="">全部</option>{(currentDomain?.children || []).map((x: any) => <option key={rowValue(x, "id")} value={rowValue(x, "id")}>{rowValue(x, "domainName") || rowValue(x, "domain_name")}</option>)}</select></label>
        <label>三级目录<select value={l3} onChange={(e) => setL3(e.target.value)}><option value="">全部</option>{(currentSecond?.children || []).map((x: any) => <option key={rowValue(x, "id")} value={rowValue(x, "id")}>{rowValue(x, "domainName") || rowValue(x, "domain_name")}</option>)}</select></label>
        <label>提交开始日期<input type="date" value={submitFrom} onChange={(e) => setSubmitFrom(e.target.value)} /></label>
        <label>提交结束日期<input type="date" value={submitTo} onChange={(e) => setSubmitTo(e.target.value)} /></label>
        <div className="review-filter-actions">
          <button className="primary" onClick={() => { setPage(1); load(); }}>查询</button>
          <button onClick={() => { setKeyword(""); setSubmitter(""); setL1(""); setL2(""); setL3(""); setSubmitFrom(""); setSubmitTo(""); setPage(1); }}>重置</button>
        </div>
      </div>
      <div className="toolbar">
        <button onClick={() => batch("pass")}>批量通过</button>
        <button
          className="danger"
          onClick={() => {
            if (!checked.length) return setMsg("请先选择数据");
            setBatchRejectOpen(true);
          }}
        >
          批量驳回
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={checked.length === items.length && items.length > 0}
                onChange={(e) =>
                  setChecked(
                    e.target.checked ? items.map((x: any) => x.id || x.ID) : [],
                  )
                }
              />
            </th>
            <th>序号</th>
            <th onClick={() => togglePendingSort("code")}>编号{sortMark("code")}</th>
            <th>问题</th>
            <th>目录</th>
            <th onClick={() => togglePendingSort("submitter")}>提交人{sortMark("submitter")}</th>
            <th>状态</th>
            <th onClick={() => togglePendingSort("assignedAt")}>分配时间{sortMark("assignedAt")}</th>
            <th>等待时长</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x: any, index: number) => (
            <tr key={x.id || x.ID}>
              <td>
                <input
                  type="checkbox"
                  checked={checked.includes(x.id || x.ID)}
                  onChange={() =>
                    setChecked((c) =>
                      c.includes(x.id || x.ID)
                        ? c.filter((i) => i !== (x.id || x.ID))
                        : [...c, x.id || x.ID],
                    )
                  }
                />
              </td>
              <td>{(page - 1) * pageSize + index + 1}</td>
              <td className="code">{x.qa_code || x.QA_CODE}</td>
              <td>{x.question_text || x.QUESTION_TEXT}</td>
              <td>{[rowValue(x, "domain_l1_name"), rowValue(x, "domain_l2_name"), rowValue(x, "domain_l3_name")].filter(Boolean).join(" / ") || "-"}</td>
              <td>{rowValue(x, "real_name") || "-"}</td>
              <td>
                <span className="tag">审核中（{level}级）</span>
              </td>
              <td>{dateTime(x.assigned_at || x.ASSIGNED_AT)}</td>
              <td>
                <span
                  className={
                    Date.now() - new Date(x.assigned_at || x.ASSIGNED_AT).getTime() >
                    24 * 3600000
                      ? "waiting-time overdue"
                      : "waiting-time"
                  }
                >
                  {waitingTime(x.assigned_at || x.ASSIGNED_AT)}
                </span>
              </td>
              <td>
                <button
                  className="link"
                  onClick={() => openReview(x.id || x.ID)}
                >
                  查看并审核
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={data.total || items.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
      {!items.length && <div className="empty">当前级别暂无待审核内容</div>}
      {selected && (
        <div className="modal">
          <div className="modal-card wide">
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <h3>{selected.qa_code}</h3>
            <div className="review-detail-layout">
              <div className="review-content-pane">
                <div className="detail-grid"><p><b>目录</b>{[selected.domain_l1_name,selected.domain_l2_name,selected.domain_l3_name].filter(Boolean).join(" / ")}</p><p><b>提交人</b>{selected.real_name || "-"}</p><p><b>版本</b>{selected.version_no || "-"}</p><p><b>依据文档</b>{selected.reference_doc || "-"}</p></div>
                <h4>问题</h4><div className="content" dangerouslySetInnerHTML={{__html:safeHtml(selected.question_html || "")}} />
                <h4>答案</h4><div className="content" dangerouslySetInnerHTML={{__html:safeHtml(selected.answer_html || "")}} />
                <h4>附件</h4>{reviewAttachments.length?<ul className="review-attachment-list">{reviewAttachments.map((a:any)=><li key={a.id}>{a.original_name}<small>{a.size_bytes?`${Math.ceil(a.size_bytes/1024)} KB`:""}</small></li>)}</ul>:<div className="empty compact">暂无附件</div>}
                <h4>历史审核记录</h4>{reviewHistory.length?<div className="review-history-timeline">{reviewHistory.map((r:any,i:number)=><div key={i}><b>第{rowValue(r,"level_no")}级 · {rowValue(r,"reviewer_name")}</b><span>{rowValue(r,"result")==="pass"?"合格":"不合格"} · {dateTime(rowValue(r,"reviewed_at"))}</span><p>{rowValue(r,"opinion") || "无审核意见"}</p></div>)}</div>:<div className="empty compact">暂无历史审核记录</div>}
              </div>
              <div className="review-decision-pane">
            <label>
              审核意见
              <textarea
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                rows={3}
                placeholder="通过可填写意见，驳回必填"
              />
            </label>
            <label>
              修改建议
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={3}
                placeholder="可选"
              />
            </label>
            <div className="modal-actions">
              <button
                className="primary"
                onClick={() => decide("pass").catch((e) => setMsg(e.message))}
              >
                审核通过
              </button>
              <button
                className="danger"
                onClick={() => decide("reject").catch((e) => setMsg(e.message))}
              >
                驳回
              </button>
            </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {batchRejectOpen && (
        <div className="modal">
          <div className="modal-card batch-review-dialog">
            <button className="close" onClick={() => setBatchRejectOpen(false)}>
              ×
            </button>
            <h3>批量驳回</h3>
            <p className="muted">将驳回已选择的 {checked.length} 条待审核数据，请填写统一审核意见。</p>
            <label>
              驳回意见 <span className="required">*</span>
              <textarea
                value={batchRejectOpinion}
                onChange={(e) => setBatchRejectOpinion(e.target.value)}
                rows={4}
                placeholder="请输入驳回原因或需要补充的材料"
              />
            </label>
            <div className="modal-actions">
              <button
                className="danger-solid"
                disabled={!batchRejectOpinion.trim()}
                onClick={() => batch("reject", batchRejectOpinion.trim())}
              >
                确认驳回
              </button>
              <button onClick={() => setBatchRejectOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Domains({ token }: { token: string }) {
  const [data, setData] = useState<any[]>([]),
    [show, setShow] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [parent, setParent] = useState(""),
    [msg, setMsg] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [editName, setEditName] = useState(""),
    [editDescription, setEditDescription] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<any>(null),
    [collapsed, setCollapsed] = useStoredState<Record<string, boolean>>("qa_state_domains_collapsed", {}),
    [collapseInitialized, setCollapseInitialized] = useState(false),
    [page, setPage] = useStoredState("qa_state_domains_page", 1),
    [pageSize, setPageSize] = useStoredState("qa_state_domains_page_size", 10);
  const toggleCollapse = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const openCreate = (parentId = "") => {
    setParent(parentId);
    setName("");
    setDescription("");
    setShow(true);
  };
  const collapsedMap = (nodes: any[]) =>
    Object.fromEntries(
      nodes.flatMap((node: any): [string, boolean][] => [
        ...((node.children || []).length ? [[node.id || node.ID, true] as [string, boolean]] : []),
        ...Object.entries(collapsedMap(node.children || [])) as [string, boolean][],
      ]),
    );
  const load = () =>
    api("/domains/tree", {}, token)
      .then((x) => {
        const rows = Array.isArray(x) ? x : [];
        setData(rows);
        if (!collapseInitialized) {
          setCollapsed(collapsedMap(rows));
          setCollapseInitialized(true);
        }
      })
      .catch(() => setData([]));
  useEffect(() => {
    load();
  }, [token]);
  const save = () => {
    if (!name.trim()) {
      setMsg("目录名称不能为空");
      return;
    }
    api(
      "/admin/domains",
      {
        method: "POST",
        body: JSON.stringify({
          domainCode: "CUSTOM-" + Date.now(),
          domainName: name,
          description,
          parentId: parent || null,
          sortOrder: 99,
        }),
      },
      token,
    )
      .then(() => {
        setName("");
        setShow(false);
        setMsg("保存成功");
        load();
      })
      .catch((e) => setMsg(e.message));
  };
  const remove = () => {
    api(
      "/admin/domains/" + (deleteTarget.id || deleteTarget.ID),
      { method: "DELETE" },
      token,
    )
      .then(() => {
        setDeleteTarget(null);
        load();
      })
      .catch((e) => {
        setDeleteTarget(null);
        setMsg(e.message);
      });
  };
  const edit = (r: any) => {
    setEditing(r);
    setEditName(r.domainName || r.DOMAIN_NAME || "");
    setEditDescription(r.description || r.DESCRIPTION || "");
  };
  const move = (node: any, direction: "up" | "down") =>
    api(`/admin/domains/${node.id || node.ID}/move`, { method: "POST", body: JSON.stringify({ direction }) }, token)
      .then(load)
      .catch((e) => setMsg(e.message));
  const exportDomains = async () => {
    try {
      const response = await fetch(API + "/admin/domains/export", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("目录导出失败");
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `知识目录-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click(); URL.revokeObjectURL(url);
      setMsg("目录导出成功");
    } catch (e: any) { setMsg(e.message); }
  };
  const saveEdit = () => {
    if (!editName.trim()) return setMsg("目录名称不能为空");
    api(
      "/admin/domains/" + (editing.id || editing.ID),
      {
        method: "PUT",
        body: JSON.stringify({
          domainName: editName,
          description: editDescription,
          sortOrder: editing.sortOrder || editing.SORT_ORDER || 99,
        }),
      },
      token,
    )
      .then(() => {
        setEditing(null);
        load();
      })
      .catch((e) => setMsg(e.message));
  };
  const renderNode = (node: any, depth = 0): any => {
    const childCount = (node.children || []).length;
    const level = node.level_no || node.LEVEL_NO || depth + 1;
    const nodeId = node.id || node.ID;
    const hasChildren = childCount > 0;
    const isCollapsed = collapsed[nodeId];
    return (
      <div className="tree-node" key={nodeId}>
        <div className={`tree-row tree-row-l${level}`}>
          {hasChildren ? (
            <button
              type="button"
              className={`tree-toggle${isCollapsed ? " collapsed" : ""}`}
              onClick={() => toggleCollapse(nodeId)}
              aria-label={isCollapsed ? "展开" : "折叠"}
              aria-expanded={!isCollapsed}
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : (
            <span className="tree-toggle tree-toggle-empty" aria-hidden="true" />
          )}
          <span className="tree-badge">L{level}</span>
          <div className="tree-info">
            <b>{node.domainName || node.DOMAIN_NAME}</b>
            <small>
              第{level}级
              {childCount > 0 ? ` · 含 ${childCount} 个子目录` : " · 末级目录"}
            </small>
          </div>
          <div className="tree-actions">
            <button className="link" onClick={() => move(node, "up")} title="上移目录">↑</button>
            <button className="link" onClick={() => move(node, "down")} title="下移目录">↓</button>
            {level < 3 && (
              <button className="link" onClick={() => openCreate(nodeId)}>
                新增下级
              </button>
            )}
            <button className="link" onClick={() => edit(node)}>
              编辑
            </button>
            <button
              className="link danger-text"
              onClick={() => setDeleteTarget(node)}
            >
              删除
            </button>
          </div>
        </div>
        {hasChildren && !isCollapsed && (
          <div className="tree-children">
            {(node.children || []).map((child: any) =>
              renderNode(child, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };
  const parentOptions = (nodes: any[]): any[] =>
    nodes.flatMap((x: any) =>
      [
        (x.level_no || x.LEVEL_NO || 1) < 3 ? (
          <option value={x.id || x.ID} key={x.id || x.ID}>
            {"　".repeat((x.level_no || x.LEVEL_NO || 1) - 1)}
            {x.domainName || x.DOMAIN_NAME}
          </option>
        ) : null,
        ...parentOptions(x.children || []),
      ].filter(Boolean),
    );
  return (
    <section className="panel">
      <div className="domain-toolbar">
        <div className="domain-toolbar-title">
          <h3>知识目录</h3>
          <p>按一级、二级、三级目录管理知识分类，点击箭头展开或收起。</p>
        </div>
        <div className="domain-toolbar-actions">
          <button onClick={() => setCollapsed({})}>全部展开</button>
          <button
            onClick={() => setCollapsed(collapsedMap(data))}
          >
            收起全部
          </button>
          <button className="primary" onClick={() => openCreate()}>
            + 新增目录
          </button>
          <button onClick={exportDomains}>导出目录</button>
          <label className="button">导入目录<input type="file" accept=".xlsx" hidden onChange={(e)=>{const file=e.target.files?.[0];if(!file)return;const form=new FormData();form.append("file",file);fetch(API+"/admin/domains/import",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form}).then(async response=>{const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||"目录导入失败");setMsg(`目录导入完成，处理 ${result.processed||0} 行，失败 ${result.failed||0} 行`);load();}).catch(error=>setMsg(error.message));e.target.value="";}}/></label>
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {data
        .slice((page - 1) * pageSize, page * pageSize)
        .map((x: any) => renderNode(x))}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={data.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
      {show && (
        <div className="modal">
          <div className="modal-card">
            <button className="close" onClick={() => setShow(false)}>
              ×
            </button>
            <h3>新增目录</h3>
            <label>
              上级目录（空表示一级）
              <select
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">一级目录</option>
                {parentOptions(data)}
              </select>
            </label>
            <label className="domain-name-field">
              目录名称
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>目录描述<textarea rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="选填，说明目录适用范围" /></label>
            <div className="modal-actions">
              <button className="primary" onClick={save}>
                保存
              </button>
              <button onClick={() => setShow(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="modal">
          <div className="modal-card">
            <button className="close" onClick={() => setEditing(null)}>
              ×
            </button>
            <h3>编辑目录</h3>
            <label className="domain-name-field">
              目录名称
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label>目录描述<textarea rows={3} value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} /></label>
            <div className="modal-actions">
              <button className="primary" onClick={saveEdit}>
                保存
              </button>
              <button onClick={() => setEditing(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="删除目录"
          message={`确认删除目录“${deleteTarget.domainName || deleteTarget.DOMAIN_NAME}”？`}
          confirmText="确认删除"
          danger
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
function Admin({ token, initialTab }: { token: string; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab || "users"),
    [rows, setRows] = useState<any[]>([]),
    [msg, setMsg] = useState(""),
    [roles, setRoles] = useState<any[]>([]),
    [permissionTree, setPermissionTree] = useState<any[]>([]),
    [units, setUnits] = useState<any[]>([]),
    [logFilters, setLogFilters] = useStoredState<any>(`qa_state_${initialTab || "users"}_filters`, { type:"",operator:"",keyword:"",from:"",to:"",sortDir:"desc" }),
    [editing, setEditing] = useState<any>(null),
    [form, setForm] = useState<any>({}),
    [formError, setFormError] = useState(""),
    [deleting, setDeleting] = useState<any>(null),
    [resetTarget, setResetTarget] = useState<any>(null),
    [newPassword, setNewPassword] = useState(""),
    [confirmNewPassword, setConfirmNewPassword] = useState(""),
    [resetError, setResetError] = useState(""),
    [page, setPage] = useStoredState(`qa_state_${initialTab || "users"}_page`, 1),
    [pageSize, setPageSize] = useStoredState(`qa_state_${initialTab || "users"}_page_size`, 10),
    [tableSort, setTableSort] = useStoredState<any>(`qa_state_${initialTab || "users"}_sort`, { key:"", dir:"asc" }),
    [total, setTotal] = useState(0);
  useEffect(() => {
    setTab(initialTab || "users");
    setPage(1);
  }, [initialTab]);
  const load = () => {
    const path =
      tab === "users"
        ? "/admin/users"
        : tab === "roles"
          ? "/admin/roles"
          : tab === "flows"
            ? "/admin/review-flows"
            : tab === "logs"
              ? `/admin/operation-logs?page=${page}&pageSize=${pageSize}&type=${encodeURIComponent(logFilters.type)}&operator=${encodeURIComponent(logFilters.operator)}&keyword=${encodeURIComponent(logFilters.keyword)}&from=${logFilters.from}&to=${logFilters.to}&sortDir=${logFilters.sortDir}`
              : tab === "params"
                ? "/admin/config"
                : "/field-schemes";
    api(path, {}, token)
      .then((x) => {
        const items = Array.isArray(x) ? x : x.items || [];
        setRows(items);
        setTotal(
          Array.isArray(x) ? items.length : Number(x.total || items.length),
        );
      })
      .catch((e) => {
        setRows([]);
        setMsg(e.message);
      });
  };
  useEffect(load, [tab, token, page, pageSize, logFilters.sortDir]);
  useEffect(() => {
    api("/admin/roles", {}, token)
      .then((x) => setRoles(x || []))
      .catch(() => setRoles([]));
    api("/admin/roles/permissions/tree", {}, token)
      .then((x) => setPermissionTree(Array.isArray(x) ? x : []))
      .catch(() => setPermissionTree([]));
    api("/admin/users/unit-options", {}, token)
      .then((x) => setUnits(Array.isArray(x) ? x : []))
      .catch(() => setUnits([]));
  }, [token]);
  const openForm = (row?: any) => {
    const r = row || {};
    setEditing(row || { _new: true });
    setFormError("");
    if (tab === "users")
      setForm({
        username: r.username || "",
        realName: r.real_name || "",
        password: "",
        email: r.email || "",
        mobile: r.mobile || "",
        enabled: r.enabled !== 0,
        unitId: r.unit_id || "",
        roleCodes: String(r.role_codes || "QA_SUBMITTER")
          .split(",")
          .filter(Boolean),
      });
    if (tab === "roles")
      setForm({
        roleCode: r.role_code || "",
        roleName: r.role_name || "",
        description: r.description || "",
        enabled: r.enabled !== 0,
        permissionCodes: String(r.permission_codes || "")
          .split(",")
          .filter(Boolean),
      });
    if (tab === "params")
      setForm({
        key: r.config_key || "",
        value: String(r.config_value ?? ""),
        type: r.config_type || "STRING",
        description: r.description || "",
      });
  };
  const saveForm = async () => {
    try {
      setFormError("");
      if (tab === "users") {
        if (
          !form.realName?.trim() ||
          (editing._new &&
            (!form.username?.trim() || form.password?.length < 8))
        )
          throw Error("请填写账号、姓名及至少8位初始密码");
        await api(
          editing._new ? "/admin/users" : `/admin/users/${editing.id}`,
          {
            method: editing._new ? "POST" : "PUT",
            body: JSON.stringify({ ...form, unitId: form.unitId || null }),
          },
          token,
        );
      } else if (tab === "roles") {
        if (!form.roleCode?.trim() || !form.roleName?.trim())
          throw Error("角色编码和名称不能为空");
        await api(
          editing._new
            ? "/admin/roles"
            : `/admin/roles/definition/${editing.id}`,
          { method: editing._new ? "POST" : "PUT", body: JSON.stringify(form) },
          token,
        );
      } else if (tab === "params") {
        if (!form.key?.trim()) throw Error("参数名不能为空");
        await api(
          editing._new
            ? "/admin/config"
            : `/admin/config/${encodeURIComponent(editing.config_key)}`,
          { method: editing._new ? "POST" : "PUT", body: JSON.stringify(form) },
          token,
        );
      }
      setEditing(null);
      setMsg("保存成功");
      load();
    } catch (e: any) {
      setFormError(e.message || "保存失败");
    }
  };
  const removeRow = async (r: any) => {
    setDeleting(r);
  };
  const confirmRemove = async () => {
    const r = deleting;
    const path =
      tab === "users"
        ? `/admin/users/${r.id}`
        : tab === "roles"
          ? `/admin/roles/definition/${r.id}`
          : tab === "params"
            ? `/admin/config/${encodeURIComponent(r.config_key)}`
            : `/admin/operation-logs/${r.id}`;
    try {
      await api(path, { method: "DELETE" }, token);
      setMsg(tab === "users" ? "用户已停用" : "删除成功");
      setDeleting(null);
      load();
    } catch (e: any) {
      setMsg(e.message);
      setDeleting(null);
    }
  };
  const reset = async () => {
    setResetError("");
    if (newPassword.length < 8) return setResetError("密码至少8位");
    if (newPassword !== confirmNewPassword) return setResetError("两次输入的密码不一致");
    try {
      const result = await api(
        `/admin/users/${rowValue(resetTarget,"id")}/reset-password`,
        { method: "POST", body: JSON.stringify({ password: newPassword }) },
        token,
      );
      setResetTarget(null);
      setNewPassword("");
      setConfirmNewPassword("");
      setMsg(result?.message || "密码已重置，原有登录已失效，下次登录需修改密码");
      load();
    } catch (e: any) {
      setResetError(e.message || "密码重置失败");
    }
  };
  const columns: Record<string, string[]> = {
    users: [
      "username",
      "real_name",
      "role_names",
      "unit_name",
      "email",
      "mobile",
      "enabled",
      "must_change_password",
      "created_at",
    ],
    roles: ["role_code", "role_name", "description", "built_in", "enabled"],
    logs: [
      "operation_type",
      "operation_content",
      "real_name",
      "target_type",
      "client_ip",
      "created_at",
    ],
    params: [
      "config_group",
      "config_key",
      "config_value",
      "config_type",
      "description",
      "updated_at",
    ],
  };
  const visibleColumns = columns[tab] || [];
  const sortedAdminRows = tableSort.key && tab !== "logs" ? [...rows].sort((a:any,b:any)=>{
    const av=rowValue(a,tableSort.key),bv=rowValue(b,tableSort.key);
    const compared=typeof av==="number"||typeof bv==="number"?Number(av||0)-Number(bv||0):String(av||"").localeCompare(String(bv||""),"zh-CN");
    return tableSort.dir==="asc"?compared:-compared;
  }):rows;
  const pagedRows =
    tab === "logs" ? rows : sortedAdminRows.slice((page - 1) * pageSize, page * pageSize);
  const sortAdmin=(key:string)=>{
    setPage(1);
    if(tab==="logs"&&key==="created_at")setLogFilters({...logFilters,sortDir:logFilters.sortDir==="desc"?"asc":"desc"});
    else setTableSort((current:any)=>({key,dir:current.key===key&&current.dir==="asc"?"desc":"asc"}));
  };
  const adminSortMark=(key:string)=>tab==="logs"&&key==="created_at"?(logFilters.sortDir==="asc"?" ↑":" ↓"):tableSort.key===key?(tableSort.dir==="asc"?" ↑":" ↓"):" ↕";
  const displayCell = (row: any, key: string) => {
    if (key === "config_group") {
      const prefix=String(row.config_key || row.CONFIG_KEY || "").split(/[.-]/)[0];
      return ({review:"审核配置",storage:"存储配置",notification:"通知配置",security:"安全配置"} as any)[prefix] || "基础配置";
    }
    const value = row[key] ?? row[key.toUpperCase()];
    if (["enabled", "built_in", "must_change_password"].includes(key))
      return Number(value) ? "是" : "否";
    if (key.endsWith("_at")) return dateTime(value);
    return value === null || value === undefined || value === ""
      ? "-"
      : String(value);
  };
  return (
    <section className="panel">
      <div className="toolbar">
        <h3>{titles[tab] || "系统管理"}</h3>
        {["users", "roles", "params"].includes(tab) && (
          <button className="primary" onClick={() => openForm()}>
            + 新增
          </button>
        )}
        {msg && <span className="muted">{msg}</span>}
      </div>
      <div className="tabs">
        {[
          ["users", "用户管理"],
          ["roles", "角色管理"],
          ["logs", "操作日志"],
          ["params", "系统参数"],
        ].map(([k, n]) => (
          <button
            className={tab === k ? "selected" : ""}
            onClick={() => setTab(k)}
            key={k}
          >
            {n}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            {visibleColumns.map((k) => (
              <th key={k} onClick={()=>sortAdmin(k)}>{fieldLabel[k] || k}{adminSortMark(k)}</th>
            ))}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((r, i) => (
            <tr key={i}>
              {visibleColumns.map((key) => (
                <td key={key}>{displayCell(r, key)}</td>
              ))}
              {tab === "users" && (
                <td>
                  <button className="link" onClick={() => openForm(r)}>
                    编辑
                  </button>
                  <button
                    className="link"
                    onClick={() => {
                      setResetTarget(r);
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setResetError("");
                    }}
                  >
                    重置密码
                  </button>
                  {r.username !== "admin" && (
                    <button
                      className="link danger-text"
                      onClick={() => removeRow(r)}
                    >
                      删除
                    </button>
                  )}
                </td>
              )}
              {tab === "roles" && (
                <td>
                  <button className="link" onClick={() => openForm(r)}>
                    编辑
                  </button>
                  {!r.built_in && (
                    <button
                      className="link danger-text"
                      onClick={() => removeRow(r)}
                    >
                      删除
                    </button>
                  )}
                </td>
              )}
              {tab === "params" && (
                <td>
                  <button className="link" onClick={() => openForm(r)}>
                    修改
                  </button>
                  <button
                    className="link danger-text"
                    onClick={() => removeRow(r)}
                  >
                    删除
                  </button>
                </td>
              )}
              {tab === "logs" && (
                <td>
                  <button
                    className="link danger-text"
                    onClick={() => removeRow(r)}
                  >
                    删除
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={tab === "logs" ? total : rows.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
      {!rows.length && <div className="empty">暂无配置数据</div>}
      {editing && (
        <AdminForm
          tab={tab}
          editing={editing}
          form={form}
          setForm={setForm}
          roles={roles}
          permissionTree={permissionTree}
          units={units}
          error={formError}
          close={() => setEditing(null)}
          save={saveForm}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={tab === "users" ? "停用用户" : "删除数据"}
          message={
            tab === "users"
              ? `确认停用用户“${deleting.real_name}”？`
              : "确认删除该数据？此操作不可撤销。"
          }
          confirmText={tab === "users" ? "确认停用" : "确认删除"}
          danger
          onConfirm={confirmRemove}
          onCancel={() => setDeleting(null)}
        />
      )}
      {resetTarget && (
        <div className="modal">
          <div className="modal-card">
            <button className="close" onClick={() => setResetTarget(null)}>
              ×
            </button>
            <h3>重置密码</h3>
            <p className="muted">
              正在重置：{resetTarget.real_name}（{resetTarget.username}）
            </p>
            <label>
              新密码
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8位"
              />
            </label>
            <label>
              确认新密码
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </label>
            {resetError && <div className="error">{resetError}</div>}
            <div className="modal-actions">
              <button className="primary" onClick={reset}>
                确认重置
              </button>
              <button onClick={() => setResetTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminForm({ tab, editing, form, setForm, roles, permissionTree, units, error, close, save }: any) {
  return (
    <div className="modal">
      <div className="modal-card admin-form">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>
          {editing._new ? "新增" : "编辑"}
          {titles[tab]}
        </h3>
        {tab === "users" && (
          <>
            <label>
              登录账号
              <input
                value={form.username || ""}
                disabled={!editing._new}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              真实姓名
              <input
                value={form.realName || ""}
                onChange={(e) => setForm({ ...form, realName: e.target.value })}
              />
            </label>
            {editing._new && (
              <label>
                初始密码
                <input
                  type="password"
                  value={form.password || ""}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="至少8位"
                />
              </label>
            )}
            <div className="form-grid">
              <label>
                邮箱
                <input
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                手机号
                <input
                  value={form.mobile || ""}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </label>
            </div>
            <label>
              所属单位
              <select
                value={form.unitId || ""}
                onChange={(e) =>
                  setForm({ ...form, unitId: e.target.value || null })
                }
              >
                <option value="">未分配</option>
                {(units || []).map((unit: any) => (
                  <option key={rowValue(unit, "id")} value={rowValue(unit, "id")}>
                    {rowValue(unit, "unit_name")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              角色
              <select
                multiple
                value={form.roleCodes || []}
                onChange={(e) =>
                  setForm({
                    ...form,
                    roleCodes: Array.from(e.target.selectedOptions).map(
                      (o: any) => o.value,
                    ),
                  })
                }
              >
                {roles
                  .filter((x: any) => x.enabled !== 0)
                  .map((x: any) => (
                    <option key={x.id} value={x.role_code}>
                      {x.role_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
              启用用户
            </label>
          </>
        )}
        {tab === "roles" && (
          <>
            <label>
              角色编码
              <input
                value={form.roleCode || ""}
                disabled={!editing._new}
                onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
              />
            </label>
            <label>
              角色名称
              <input
                value={form.roleName || ""}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              />
            </label>
            <label>
              角色描述
              <textarea
                rows={3}
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
              启用角色
            </label>
            <div className="permission-tree-field">
              <b>菜单与操作权限</b>
              <small>勾选角色可访问的菜单及可执行操作</small>
              <div className="permission-tree">
                {(permissionTree || []).map((root: any) => {
                  const rootCode = rowValue(root, "permission_code");
                  const children = root.children || [];
                  const selectedCodes = form.permissionCodes || [];
                  return (
                    <div className="permission-group" key={rootCode}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedCodes.includes(rootCode)}
                          onChange={(e) => {
                            const groupCodes = [rootCode, ...children.map((x: any) => rowValue(x, "permission_code"))];
                            setForm({ ...form, permissionCodes: e.target.checked ? Array.from(new Set([...selectedCodes, ...groupCodes])) : selectedCodes.filter((x: string) => !groupCodes.includes(x)) });
                          }}
                        />
                        <strong>{rowValue(root, "permission_name")}</strong>
                      </label>
                      <div>
                        {children.map((child: any) => {
                          const code = rowValue(child, "permission_code");
                          return (
                            <label key={code}>
                              <input
                                type="checkbox"
                                checked={selectedCodes.includes(code)}
                                onChange={(e) => setForm({ ...form, permissionCodes: e.target.checked ? Array.from(new Set([...selectedCodes, rootCode, code])) : selectedCodes.filter((x: string) => x !== code) })}
                              />
                              {rowValue(child, "permission_name")}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {tab === "params" && (
          <>
            <label>
              参数名
              <input
                value={form.key || ""}
                disabled={!editing._new}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
            </label>
            <label>
              参数类型
              <select
                value={form.type || "STRING"}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="STRING">字符串</option>
                <option value="NUMBER">数字</option>
                <option value="BOOLEAN">布尔值</option>
                <option value="JSON">JSON</option>
              </select>
            </label>
            <label>
              参数值
              <textarea
                rows={4}
                value={form.value || ""}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label>
              说明
              <input
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
          </>
        )}
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="primary" onClick={save}>
            保存
          </button>
          <button onClick={close}>取消</button>
        </div>
      </div>
    </div>
  );
}

function ReviewHistory({ token }: { token: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [page, setPage] = useStoredState("qa_state_history_page", 1),
    [pageSize, setPageSize] = useStoredState("qa_state_history_page_size", 10),
    [total, setTotal] = useState(0),
    [filters, setFilters] = useStoredState<any>("qa_state_history_filters", { keyword:"",level:"",reviewerId:"",result:"",domainL1Id:"",domainL2Id:"",domainL3Id:"",reviewedFrom:"",reviewedTo:"" }),
    [reviewers, setReviewers] = useState<any[]>([]),
    [domains, setDomains] = useState<any[]>([]),
    [sortBy, setSortBy] = useStoredState("qa_state_history_sort", "reviewedAt"),
    [sortDir, setSortDir] = useStoredState<"asc" | "desc">("qa_state_history_sort_dir", "desc"),
    [message, setMessage] = useState("");
  const load = () => {
    const query = new URLSearchParams({ ...filters, page:String(page),pageSize:String(pageSize),sortBy,sortDir });
    api(`/reviews/history?${query}`, {}, token)
      .then((x) => { setRows(Array.isArray(x) ? x : x.items || []); setTotal(Array.isArray(x) ? x.length : Number(x.total || 0)); })
      .catch((e) => { setRows([]);setTotal(0);setMessage(e.message); });
  };
  useEffect(load, [token,page,pageSize,sortBy,sortDir,filters]);
  useEffect(() => {
    api("/admin/users/reviewer-options",{},token).then((x)=>setReviewers(Array.isArray(x)?x:[])).catch(()=>setReviewers([]));
    api("/domains/tree",{},token).then((x)=>setDomains(Array.isArray(x)?x:[])).catch(()=>setDomains([]));
  },[token]);
  const historyL1=domains.find((x:any)=>rowValue(x,"id")===filters.domainL1Id);
  const historyL2=(historyL1?.children||[]).find((x:any)=>rowValue(x,"id")===filters.domainL2Id);
  const toggleHistorySort=(key:string)=>{setPage(1);if(sortBy===key)setSortDir(sortDir==="asc"?"desc":"asc");else{setSortBy(key);setSortDir("asc");}};
  const historySortMark=(key:string)=>sortBy===key?(sortDir==="asc"?" ↑":" ↓"):" ↕";
  return (
    <section className="panel">
      <div className="toolbar"><h3>审核历史</h3>{message&&<span className="muted">{message}</span>}</div>
      <div className="review-filter-grid history-filters">
        <div className="review-filter-heading"><div><strong>筛选条件</strong><span>按内容、审核节点、人员、目录及时间查询审核记录</span></div><small>共 {total} 条记录</small></div>
        <label>问题关键词<input value={filters.keyword} onChange={(e)=>setFilters({...filters,keyword:e.target.value})} placeholder="问题或答案" /></label>
        <label>审核级别<select value={filters.level} onChange={(e)=>setFilters({...filters,level:e.target.value})}><option value="">全部</option><option value="1">一级审核</option><option value="2">二级审核</option><option value="3">三级审核</option></select></label>
        <label>审核人<select value={filters.reviewerId} onChange={(e)=>setFilters({...filters,reviewerId:e.target.value})}><option value="">全部</option>{reviewers.map((x:any)=><option key={rowValue(x,"id")} value={rowValue(x,"id")}>{rowValue(x,"real_name")}（{rowValue(x,"username")}）</option>)}</select></label>
        <label>审核结果<select value={filters.result} onChange={(e)=>setFilters({...filters,result:e.target.value})}><option value="">全部</option><option value="pass">合格</option><option value="reject">不合格</option></select></label>
        <label>一级目录<select value={filters.domainL1Id||""} onChange={(e)=>setFilters({...filters,domainL1Id:e.target.value,domainL2Id:"",domainL3Id:""})}><option value="">全部</option>{domains.map((x:any)=><option key={rowValue(x,"id")} value={rowValue(x,"id")}>{rowValue(x,"domainName")||rowValue(x,"domain_name")}</option>)}</select></label>
        <label>二级目录<select value={filters.domainL2Id||""} onChange={(e)=>setFilters({...filters,domainL2Id:e.target.value,domainL3Id:""})}><option value="">全部</option>{(historyL1?.children||[]).map((x:any)=><option key={rowValue(x,"id")} value={rowValue(x,"id")}>{rowValue(x,"domainName")||rowValue(x,"domain_name")}</option>)}</select></label>
        <label>三级目录<select value={filters.domainL3Id||""} onChange={(e)=>setFilters({...filters,domainL3Id:e.target.value})}><option value="">全部</option>{(historyL2?.children||[]).map((x:any)=><option key={rowValue(x,"id")} value={rowValue(x,"id")}>{rowValue(x,"domainName")||rowValue(x,"domain_name")}</option>)}</select></label>
        <label>审核时间起<input type="date" value={filters.reviewedFrom} onChange={(e)=>setFilters({...filters,reviewedFrom:e.target.value})} /></label>
        <label>审核时间止<input type="date" value={filters.reviewedTo} onChange={(e)=>setFilters({...filters,reviewedTo:e.target.value})} /></label>
        <div className="review-filter-actions"><button className="primary" onClick={()=>{setPage(1);load();}}>查询</button><button onClick={()=>{setFilters({keyword:"",level:"",reviewerId:"",result:"",domainL1Id:"",domainL2Id:"",domainL3Id:"",reviewedFrom:"",reviewedTo:""});setPage(1);}}>重置</button></div>
      </div>
      <div className="table-scroll history-table-scroll">
      <table className="review-history-table">
        <thead>
          <tr>
            <th onClick={()=>toggleHistorySort("code")}>问答编号{historySortMark("code")}</th>
            <th>目录</th>
            <th>问题摘要</th>
            <th>答案摘要</th>
            <th onClick={()=>toggleHistorySort("level")}>审核级别{historySortMark("level")}</th>
            <th onClick={()=>toggleHistorySort("reviewer")}>审核人{historySortMark("reviewer")}</th>
            <th>结果</th>
            <th>审核意见</th>
            <th onClick={()=>toggleHistorySort("reviewedAt")}>时间{historySortMark("reviewedAt")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i) => (
              <tr key={i}>
                <td>{r.qa_code || r.QA_CODE || r.qa_pair_id || "-"}</td>
                <td>{[rowValue(r,"domain_l1_name"),rowValue(r,"domain_l2_name"),rowValue(r,"domain_l3_name")].filter(Boolean).join(" / ") || "-"}</td>
                <td>{String(rowValue(r,"question_text") || "-").replace(/<[^>]+>/g,"").slice(0,80)}</td>
                <td>{String(rowValue(r,"answer_text") || "-").replace(/<[^>]+>/g,"").slice(0,80)}</td>
                <td>第{r.level_no || r.LEVEL_NO || r.level || r.LEVEL || "-"}级</td>
                <td>
                  {r.reviewer_name || r.REVIEWER_NAME || "-"}
                  {(r.reviewer_username || r.REVIEWER_USERNAME) && (
                    <small className="table-inline-subtext">
                      （{r.reviewer_username || r.REVIEWER_USERNAME}）
                    </small>
                  )}
                </td>
                <td>
                  <span className="tag">
                    {r.result === "pass" || r.RESULT === "pass"
                      ? "通过"
                      : r.result === "reject" || r.RESULT === "reject"
                        ? "驳回"
                        : r.result || r.RESULT || "-"}
                  </span>
                </td>
                <td>{r.opinion || r.OPINION || "-"}</td>
                <td>
                  {dateTime(r.reviewed_at || r.created_at || r.CREATED_AT)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={setPage}
        onPageSize={setPageSize}
      />
      {!rows.length && <div className="empty">暂无审核历史</div>}
    </section>
  );
}

function FieldSchemeUI({ token }: { token: string }) {
  const [schemes, setSchemes] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [msg, setMsg] = useState(""),
    [dialog, setDialog] = useState<any>(null),
    [dialogError, setDialogError] = useState(""),
    [form, setForm] = useState<any>({}),
    [deleting, setDeleting] = useState<any>(null),
    [preview, setPreview] = useState(false),
    [previewValues, setPreviewValues] = useState<Record<string, any>>({}),
    [importCandidate, setImportCandidate] = useState<any>(null),
    [schemePage, setSchemePage] = useStoredState("qa_state_fields_scheme_page", 1),
    [fieldPage, setFieldPage] = useStoredState("qa_state_fields_field_page", 1),
    [pageSize, setPageSize] = useStoredState("qa_state_fields_page_size", 10);
  const load = () =>
    api("/field-schemes", {}, token).then((x) => setSchemes(x || []));
  useEffect(() => {
    load();
  }, [token]);
  const openScheme = (scheme?: any) => {
    setDialogError("");
    setDialog({ type: "scheme", item: scheme });
    setForm({
      code: scheme?.scheme_code || `CUSTOM-${Date.now()}`,
      name: scheme?.scheme_name || "",
      description: scheme?.description || "",
    });
  };
  const openField = (field?: any) => {
    setDialogError("");
    setDialog({ type: "field", item: field });
    setForm({
      code: field?.field_code || `FIELD_${Date.now()}`,
      name: field?.field_name || "",
      type: field?.field_type === "ENUM" ? "SINGLE_ENUM" : field?.field_type === "NUMBER" ? "DECIMAL" : field?.field_type || "TEXT",
      required: !!field?.required,
      listVisible: field ? !!field.list_visible : true,
      searchable: field ? !!field.searchable : true,
      sortOrder: Number(
        field?.sort_order || (selected?.fields?.length || 0) + 1,
      ),
      optionsJson: field?.options_json || "{}",
      columnWidth: Number(field?.column_width || 160),
      align: field?.align_mode || "LEFT",
      sortable: !!field?.sortable,
    });
  };
  const saveDialog = async () => {
    if (!form.code?.trim() || !form.name?.trim())
      return setDialogError("编码和名称不能为空");
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(form.code.trim()))
      return setDialogError("编码必须以字母开头，且只能包含字母、数字、下划线和连字符");
    if (dialog.type === "field" && ["ENUM", "SINGLE_ENUM", "MULTI_ENUM", "CASCADE"].includes(form.type)) {
      try {
        const parsed = JSON.parse(form.optionsJson || "");
        const options = Array.isArray(parsed) ? parsed : parsed?.options;
        if (!Array.isArray(options) || !options.length) return setDialogError("至少配置一个有效选项");
      } catch {
        return setDialogError("选项配置必须是有效 JSON");
      }
    }
    try {
      setDialogError("");
      if (dialog.type === "scheme")
        await api(
          dialog.item
            ? `/admin/field-schemes/${dialog.item.id}`
            : "/admin/field-schemes",
          { method: dialog.item ? "PUT" : "POST", body: JSON.stringify(form) },
          token,
        );
      else
        await api(
          dialog.item
            ? `/admin/field-schemes/${selected.id}/fields/${dialog.item.id}`
            : `/admin/field-schemes/${selected.id}/fields`,
          { method: dialog.item ? "PUT" : "POST", body: JSON.stringify(form) },
          token,
        );
      setDialog(null);
      setMsg("保存成功");
      await load();
      if (selected)
        setSelected(await api(`/field-schemes/${selected.id}`, {}, token));
    } catch (e: any) {
      setDialogError(e.message || "保存失败");
    }
  };
  const refresh = () =>
    selected &&
    api("/field-schemes/" + selected.id, {}, token).then(setSelected);
  const confirmDelete = async () => {
    try {
      if (deleting.type === "field") {
        await api(
          `/admin/field-schemes/${selected.id}/fields/${deleting.item.id}`,
          { method: "DELETE" },
          token,
        );
        await refresh();
      } else {
        await api(
          `/admin/field-schemes/${deleting.item.id}`,
          { method: "DELETE" },
          token,
        );
        setSelected(undefined);
        await load();
      }
      setDeleting(null);
      setMsg("删除成功");
    } catch (e: any) {
      setMsg(e.message);
      setDeleting(null);
    }
  };
  const makeDefault = async (scheme: any) => {
    try {
      setMsg("正在设置默认方案…");
      await api(`/admin/field-schemes/${scheme.id}/default`, { method: "POST" }, token);
      const updatedSchemes: any[] = await api("/field-schemes", {}, token);
      setSchemes(Array.isArray(updatedSchemes) ? updatedSchemes : []);
      setSelected(await api(`/field-schemes/${scheme.id}`, {}, token));
      setMsg(`“${scheme.scheme_name}”已设为默认方案，新建问答对将使用该方案`);
    } catch (e: any) {
      setMsg(e.message || "设置默认方案失败");
    }
  };
  const copyScheme = async (scheme: any) => {
    try {
      const copied: any = await api(
        `/admin/field-schemes/${scheme.id}/copy`,
        { method: "POST", body: JSON.stringify({}) },
        token,
      );
      await load();
      setSelected(copied);
      setMsg("方案已复制，可直接修改副本");
    } catch (e: any) {
      setMsg(e.message || "复制失败");
    }
  };
  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const exportScheme = async (scheme: any) => {
    try {
      const data = await api(`/admin/field-schemes/${scheme.id}/export`, {}, token);
      downloadJson(data, `${scheme.scheme_code}-字段方案.json`);
      setMsg("字段方案已导出");
    } catch (e: any) {
      setMsg(e.message || "导出失败");
    }
  };
  const downloadImportTemplate = () => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    downloadJson(
      {
        template_version: "1.0",
        scheme_code: `SCHEME_${stamp}`,
        scheme_name: "请填写方案名称",
        description: "请填写方案用途说明",
        fields: [
          { field_code: "businessType", field_name: "业务类型", field_type: "SINGLE_ENUM", required: true, list_visible: true, searchable: true, sort_order: 1, options_json: "{\"options\":[\"类型一\",\"类型二\"]}", column_width: 160, align_mode: "LEFT", sortable: true },
          { field_code: "effectiveDate", field_name: "生效日期", field_type: "DATE", required: false, list_visible: true, searchable: true, sort_order: 2, options_json: null, column_width: 140, align_mode: "CENTER", sortable: true },
          { field_code: "notes", field_name: "补充说明", field_type: "TEXTAREA", required: false, list_visible: false, searchable: true, sort_order: 3, options_json: null, column_width: 220, align_mode: "LEFT", sortable: false },
        ],
      },
      "字段方案导入模板.json",
    );
    setMsg("模板已下载，请按示例填写后再导入");
  };
  const importScheme = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const supported = new Set(["TEXT", "TEXTAREA", "RICH_TEXT", "INTEGER", "DECIMAL", "DATE", "DATETIME", "SINGLE_ENUM", "ENUM", "MULTI_ENUM", "CASCADE", "ATTACHMENT", "USER", "BOOLEAN", "NUMBER"]);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("导入文件必须是 JSON 对象");
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(String(payload.scheme_code || ""))) throw new Error("方案编码格式不正确");
      if (!String(payload.scheme_name || "").trim()) throw new Error("方案名称不能为空");
      if (!Array.isArray(payload.fields) || !payload.fields.length) throw new Error("字段列表不能为空");
      const codes = new Set<string>();
      payload.fields.forEach((field: any, index: number) => {
        const position = `第 ${index + 1} 个字段`;
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(String(field?.field_code || ""))) throw new Error(`${position}编码格式不正确`);
        if (codes.has(field.field_code)) throw new Error(`字段编码“${field.field_code}”重复`);
        codes.add(field.field_code);
        if (!String(field?.field_name || "").trim()) throw new Error(`${position}名称不能为空`);
        if (!supported.has(String(field?.field_type || "").toUpperCase())) throw new Error(`${position}类型不受支持`);
        if (["ENUM", "SINGLE_ENUM", "MULTI_ENUM", "CASCADE"].includes(String(field.field_type).toUpperCase())) {
          const options = JSON.parse(field.options_json || "");
          const values = Array.isArray(options) ? options : options?.options;
          if (!Array.isArray(values) || !values.length) throw new Error(`${position}必须配置有效选项`);
        }
      });
      setImportCandidate({ payload, filename: file.name });
      setMsg("");
    } catch (e: any) {
      setImportCandidate(null);
      setMsg(e.message || "导入文件校验失败，请下载标准模板后填写");
    }
  };
  const confirmImportScheme = async () => {
    if (!importCandidate) return;
    try {
      const imported: any = await api(
        "/admin/field-schemes/import",
        { method: "POST", body: JSON.stringify(importCandidate.payload) },
        token,
      );
      setImportCandidate(null);
      await load();
      setSelected(imported);
      setMsg("字段方案导入成功");
    } catch (e: any) {
      setImportCandidate(null);
      setMsg(e.message || "导入失败，请检查方案编码是否重复");
    }
  };
  const moveField = async (field: any, direction: "UP" | "DOWN") => {
    try {
      await api(
        `/admin/field-schemes/${selected.id}/fields/${field.id}/move?direction=${direction}`,
        { method: "POST" },
        token,
      );
      await refresh();
    } catch (e: any) {
      setMsg(e.message || "调整顺序失败");
    }
  };
  return (
    <section className="panel">
      <div className="toolbar field-scheme-toolbar">
        <h3>字段方案</h3>
        <div className="toolbar-actions">
          <button onClick={downloadImportTemplate}>下载导入模板</button>
          <label className="button file-button">
            导入方案
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                importScheme(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button className="primary" onClick={() => openScheme()}>
            + 新建方案
          </button>
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="scheme-cards">
        {schemes
          .slice((schemePage - 1) * pageSize, schemePage * pageSize)
          .map((x: any) => (
            <div
              className={
                selected?.id === x.id ? "scheme-card selected" : "scheme-card"
              }
              key={x.id}
              onClick={() =>
                api("/field-schemes/" + x.id, {}, token).then(setSelected)
              }
            >
              <b>{x.scheme_name}</b>
              <small>
                {x.scheme_code} {x.is_default ? "· 默认" : ""}
              </small>
              <small>
                <button
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    openScheme(x);
                  }}
                >
                  编辑
                </button>
                <button
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyScheme(x);
                  }}
                >
                  复制
                </button>
                <button
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportScheme(x);
                  }}
                >
                  导出
                </button>
                {!x.is_default && (
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      makeDefault(x);
                    }}
                  >
                    设为默认
                  </button>
                )}
                {!x.is_default && (
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting({ type: "scheme", item: x });
                    }}
                  >
                    删除
                  </button>
                )}
              </small>
            </div>
          ))}
      </div>
      <Pagination
        page={schemePage}
        pageSize={pageSize}
        total={schemes.length}
        onPage={setSchemePage}
        onPageSize={setPageSize}
      />
      {selected && (
        <>
          <div className="field-config-head">
            <div>
              <h4>{selected.scheme_name} 字段配置</h4>
              <small>默认方案会应用到新建问答对；历史版本保留创建时的字段快照。</small>
            </div>
            <button
              onClick={() => {
                setPreviewValues({});
                setPreview(true);
              }}
            >
              表单预览
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>顺序</th>
                <th>字段名称</th>
                <th>编码</th>
                <th>类型</th>
                <th>必填</th>
                <th>列表显示</th>
                <th>可搜索</th>
                <th>列宽</th>
                <th>对齐</th>
                <th>可排序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(selected.fields || [])
                .slice((fieldPage - 1) * pageSize, fieldPage * pageSize)
                .map((f: any) => (
                  <tr key={f.id}>
                    <td>{f.sort_order}</td>
                    <td>{f.field_name}</td>
                    <td>{f.field_code}</td>
                    <td>{f.field_type}</td>
                    <td>{f.required ? "是" : "否"}</td>
                    <td>{f.list_visible ? "是" : "否"}</td>
                    <td>{f.searchable ? "是" : "否"}</td>
                    <td>{f.column_width || 160}px</td>
                    <td>{{ LEFT: "左", CENTER: "中", RIGHT: "右" }[f.align_mode as "LEFT" | "CENTER" | "RIGHT"] || "左"}</td>
                    <td>{f.sortable ? "是" : "否"}</td>
                    <td>
                      <button className="link" title="上移" onClick={() => moveField(f, "UP")}>
                        ↑
                      </button>
                      <button className="link" title="下移" onClick={() => moveField(f, "DOWN")}>
                        ↓
                      </button>
                      <button className="link" onClick={() => openField(f)}>
                        编辑
                      </button>
                      <button
                        className="link danger-text"
                        onClick={() => setDeleting({ type: "field", item: f })}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Pagination
            page={fieldPage}
            pageSize={pageSize}
            total={(selected.fields || []).length}
            onPage={setFieldPage}
            onPageSize={setPageSize}
          />
          <div className="field-add-row">
            <button className="primary" onClick={() => openField()}>
              + 新增字段
            </button>
            <span className="field-add-hint">
              新增后可在表格中继续编辑字段类型、必填和搜索属性
            </span>
          </div>
        </>
      )}
      {dialog && (
        <FieldSchemeDialog
          dialog={dialog}
          form={form}
          setForm={setForm}
          error={dialogError}
          close={() => setDialog(null)}
          save={saveDialog}
        />
      )}
      {preview && selected && (
        <div className="modal">
          <div className="modal-card admin-form scheme-preview-modal">
            <button className="close" onClick={() => setPreview(false)}>×</button>
            <h3>{selected.scheme_name} · 表单预览</h3>
            <p className="muted">预览会真实呈现字段类型、必填规则和选项，不会保存数据。</p>
            <DynamicFields
              scheme={selected}
              values={previewValues}
              setValues={setPreviewValues}
              users={[]}
            />
            <div className="modal-actions">
              <button className="primary" onClick={() => setPreview(false)}>完成预览</button>
            </div>
          </div>
        </div>
      )}
      {importCandidate && (
        <ConfirmDialog
          title="确认导入字段方案"
          message={`文件“${importCandidate.filename}”校验通过：方案“${importCandidate.payload.scheme_name}”，共 ${importCandidate.payload.fields.length} 个字段。确认写入系统吗？`}
          confirmText="确认导入"
          onConfirm={confirmImportScheme}
          onCancel={() => setImportCandidate(null)}
        />
      )}
      {deleting && (
        <div className="modal">
          <div className="modal-card confirm-card">
            <div className="confirm-icon">!</div>
            <h3>确认删除</h3>
            <p>
              确定删除“{deleting.item.field_name || deleting.item.scheme_name}
              ”吗？删除后无法恢复。
            </p>
            <div className="modal-actions">
              <button className="danger-solid" onClick={confirmDelete}>
                确认删除
              </button>
              <button onClick={() => setDeleting(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FieldSchemeDialog({ dialog, form, setForm, error, close, save }: any) {
  const isField = dialog.type === "field";
  return (
    <div className="modal">
      <div className="modal-card admin-form field-dialog">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>
          {dialog.item ? "编辑" : "新增"}
          {isField ? "字段" : "字段方案"}
        </h3>
        <div className="form-grid">
          <label>
            {isField ? "字段编码" : "方案编码"}
            <input
              value={form.code || ""}
              disabled={!!dialog.item}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            {isField ? "字段名称" : "方案名称"}
            <input
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
        </div>
        {!isField && (
          <label className="scheme-description-field">
            方案描述
            <textarea
              rows={4}
              value={form.description || ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
        )}
        {isField && (
          <>
            <div className="form-grid">
              <label>
                字段类型
                <select
                  value={form.type || "TEXT"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="TEXT">文本</option>
                  <option value="TEXTAREA">多行文本</option>
                  <option value="RICH_TEXT">富文本</option>
                  <option value="INTEGER">整数</option>
                  <option value="DECIMAL">小数</option>
                  <option value="DATE">日期</option>
                  <option value="DATETIME">日期时间</option>
                  <option value="SINGLE_ENUM">单选枚举</option>
                  <option value="MULTI_ENUM">多选枚举</option>
                  <option value="CASCADE">级联目录</option>
                  <option value="ATTACHMENT">附件</option>
                  <option value="USER">用户</option>
                  <option value="BOOLEAN">布尔值</option>
                </select>
              </label>
              <label>
                排序序号
                <input
                  type="number"
                  min="1"
                  value={form.sortOrder || 1}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="form-grid field-display-grid">
              <label>
                列表列宽（80～600px）
                <input
                  type="number"
                  min="80"
                  max="600"
                  value={form.columnWidth || 160}
                  onChange={(e) => setForm({ ...form, columnWidth: Number(e.target.value) })}
                />
              </label>
              <label>
                列表对齐
                <select
                  value={form.align || "LEFT"}
                  onChange={(e) => setForm({ ...form, align: e.target.value })}
                >
                  <option value="LEFT">左对齐</option>
                  <option value="CENTER">居中</option>
                  <option value="RIGHT">右对齐</option>
                </select>
              </label>
            </div>
            <div className="field-switches">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.checked })
                  }
                />
                必填字段
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.listVisible}
                  onChange={(e) =>
                    setForm({ ...form, listVisible: e.target.checked })
                  }
                />
                列表显示
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.searchable}
                  onChange={(e) =>
                    setForm({ ...form, searchable: e.target.checked })
                  }
                />
                允许搜索
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.sortable}
                  onChange={(e) => setForm({ ...form, sortable: e.target.checked })}
                />
                允许排序
              </label>
            </div>
            {["ENUM", "SINGLE_ENUM", "MULTI_ENUM", "CASCADE"].includes(form.type) && (
              <label>
                选项配置（JSON）
                <textarea
                  rows={5}
                  value={form.optionsJson || "{}"}
                  onChange={(e) =>
                    setForm({ ...form, optionsJson: e.target.value })
                  }
                  placeholder={form.type === "CASCADE" ? '例如：{"options":[{"label":"华东","value":"east","children":[{"label":"上海","value":"shanghai"}]}]}' : '例如：{"options":["选项一","选项二"]}'}
                />
              </label>
            )}
          </>
        )}
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="primary" onClick={save}>
            保存
          </button>
          <button onClick={close}>取消</button>
        </div>
      </div>
    </div>
  );
}
function FlowConfig({ token }: { token: string }) {
  const defaultNodeNames = ["第1级审核", "第2级审核", "第3级审核"];
  const [flows, setFlows] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [id, setId] = useState(""),
    [rule, setRule] = useState("ALL"),
    [levels, setLevels] = useState(3),
    [names, setNames] = useState(["第1级审核", "第2级审核", "第3级审核"]),
    [msg, setMsg] = useState(""),
    [reviewers, setReviewers] = useState<string[][]>([[], [], []]),
    [reviewerSearch, setReviewerSearch] = useState(["", "", ""]);
  const loadFlows = (preferredId?: string) => {
    api("/admin/review-flows", {}, token)
      .then((x: any) => {
        const normalized = (Array.isArray(x) ? x : [])
          .map((flow: any) => ({
            ...flow,
            id: flow.id ?? flow.ID,
            domain_name: flow.domain_name ?? flow.DOMAIN_NAME,
            domain_l1_id: flow.domain_l1_id ?? flow.DOMAIN_L1_ID,
          }))
          .filter((flow: any) => typeof flow.id === "string" && flow.id.length > 0);
        setFlows(normalized);
        const next = normalized.find((flow: any) => flow.id === preferredId) || normalized[0];
        if (next?.id) loadFlow(next.id);
        else setId("");
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadFlows();
    api("/admin/users/reviewer-options", {}, token)
      .then((x: any) => setUsers(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, [token]);
  const loadFlow = (flowId: string) => {
    if (!flowId || flowId === "undefined" || flowId === "null") {
      setId("");
      return;
    }
    setId(flowId);
    api(`/admin/review-flows/${flowId}`, {}, token)
      .then((f: any) => {
        setRule(f.pass_rule || "ALL");
        const ns = (f.nodes || []).map((n: any) => ({
          name: n.node_name || "",
          ids: String(n.reviewer_ids || "")
            .split(",")
            .filter(Boolean),
        }));
        setLevels(Math.min(3, Math.max(1, ns.length || 1)));
        setNames(
          defaultNodeNames.map((defaultName, index) => ns[index]?.name || defaultName),
        );
        setReviewers(defaultNodeNames.map((_, index) => ns[index]?.ids || []));
      })
      .catch(() => {});
  };
  const changeLevels = (nextLevels: number) => {
    setLevels(nextLevels);
    setNames((current) =>
      defaultNodeNames.map((defaultName, index) => current[index] || defaultName),
    );
    setReviewers((current) =>
      defaultNodeNames.map((_, index) => current[index] || []),
    );
    setMsg("");
  };
  const toggleReviewer = (nodeIndex: number, userId: string) => {
    setReviewers((current) =>
      defaultNodeNames.map((_, index) => {
        const selectedIds = current[index] || [];
        if (index !== nodeIndex) return selectedIds;
        return selectedIds.includes(userId)
          ? selectedIds.filter((id) => id !== userId)
          : [...selectedIds, userId];
      }),
    );
  };
  const save = () => {
    if (!id) return;
    const activeNames = names.slice(0, levels);
    const emptyNameIndex = activeNames.findIndex((name) => !name?.trim());
    if (emptyNameIndex >= 0) {
      setMsg(`第${emptyNameIndex + 1}级节点名称不能为空`);
      return;
    }
    const emptyReviewerIndex = reviewers
      .slice(0, levels)
      .findIndex((ids) => !ids?.length);
    if (emptyReviewerIndex >= 0) {
      setMsg(`第${emptyReviewerIndex + 1}级至少选择一位审核人`);
      return;
    }
    api(
      `/admin/review-flows/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          passRule: rule,
          levelCount: levels,
          nodes: names
            .slice(0, levels)
            .map((name, i) => ({ name, reviewerIds: reviewers[i] || [] })),
        }),
      },
      token,
    )
      .then((saved: any) => {
        setMsg("保存成功，新配置已启用；进行中的审批仍按提交时版本执行");
        loadFlows(saved?.id || saved?.ID);
      })
      .catch((e) => setMsg(e.message));
  };
  return (
    <section className="panel flow-config">
      <div className="flow-config-header">
        <div>
          <h3>审核流程配置</h3>
          <p>按业务域配置审核级数、通过规则及各级审核人</p>
        </div>
        <span className="flow-version">可视化配置</span>
      </div>
      <div className="flow-basic-grid">
        <label>
          业务域
          <select value={id} onChange={(e) => loadFlow(e.target.value)}>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.domain_name || f.domainName || f.domain_l1_id}
              </option>
            ))}
          </select>
        </label>
        <label>
          审核级数
          <select
            value={levels}
            onChange={(e) => changeLevels(Number(e.target.value))}
          >
            <option value={1}>1级</option>
            <option value={2}>2级</option>
            <option value={3}>3级</option>
          </select>
        </label>
        <label>
          通过规则
          <select value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="ANY">任一通过</option>
            <option value="ALL">全部通过</option>
          </select>
        </label>
      </div>
      <div className="flow-section-title">
        <span>审核节点</span>
        <small>依次完成各级审核后发布；每一级可配置多位审核人</small>
      </div>
      <div className="flow-nodes">
        {names.slice(0, levels).map((n, i) => (
          <React.Fragment key={i}>
            <div className="flow-node">
              <div className="flow-node-index">{i + 1}</div>
              <div className="flow-node-title">
                <b>第 {i + 1} 级节点</b>
                <span>{(reviewers[i] || []).length} 位审核人</span>
              </div>
              <label className="flow-node-name">
                节点名称
                <input
                  value={n}
                  onChange={(e) =>
                    setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
              </label>
              <div className="flow-reviewer-field">
                <div className="flow-reviewer-label">
                  <span>审核人（可多选）</span>
                  <small>已选 {(reviewers[i] || []).length} / 可选 {users.filter((u: any) => u.enabled !== 0).length}</small>
                </div>
                <input className="flow-reviewer-search" value={reviewerSearch[i] || ""} onChange={(e)=>setReviewerSearch((current)=>current.map((value,index)=>index===i?e.target.value:value))} placeholder="搜索姓名、账号或角色" />
                <div className="flow-reviewer-options" role="group" aria-label={`第${i + 1}级审核人`}>
                  {users.filter((u: any) => u.enabled !== 0).length ? users
                    .filter((u: any) => u.enabled !== 0)
                    .filter((u: any) => !reviewerSearch[i]?.trim() || `${u.real_name || ""} ${u.username || ""} ${u.role_names || ""}`.toLowerCase().includes(reviewerSearch[i].trim().toLowerCase()))
                    .map((u: any) => {
                      const selected = (reviewers[i] || []).includes(u.id);
                      return (
                        <label
                          className={`flow-reviewer-option ${selected ? "selected" : ""}`}
                          key={u.id}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleReviewer(i, u.id)}
                          />
                          <span className="dynamic-option-check" aria-hidden="true">✓</span>
                          <span className="flow-reviewer-copy">
                            <b>{u.real_name || u.realName || u.username}</b>
                            <small>{u.username} · {u.role_names || "审核人员"}</small>
                          </span>
                        </label>
                      );
                    }) : <span className="flow-reviewer-empty">暂无可选审核人，请先启用用户</span>}
                </div>
              </div>
            </div>
            {i < levels - 1 && <div className="flow-node-arrow">↓</div>}
          </React.Fragment>
        ))}
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="flow-preview">
        <span>流程预览</span>
        <b>草稿</b> →{" "}
        {names.slice(0, levels).map((name, i) => (
          <React.Fragment key={i}>
            <b>{name || `第${i + 1}级审核`}</b>
            {i < levels - 1 ? " → " : ""}
          </React.Fragment>
        ))}{" "}
        → <b>已发布</b>
      </div>
      <div className="flow-actions">
        <button className="primary flow-save-button" onClick={save}>
          <span className="flow-save-icon" aria-hidden="true">✓</span>
          <span>保存配置</span>
        </button>
      </div>
    </section>
  );
}
function EChart({ option, onClick }: { option: any; onClick?: (x: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option, true);
    chart.on("click", (params) => clickRef.current?.(params));
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);
  return <div className="analysis-echart" ref={ref} />;
}

function CustomStats({ token }: { token: string }) {
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const emptyFilters = {
    statuses: [] as string[],
    domainL1Ids: [] as string[],
    domainL2Ids: [] as string[],
    domainL3Ids: [] as string[],
    authorIds: [] as string[],
    reviewerIds: [] as string[],
    keyword: "",
    hasAttachment: null as boolean | null,
    hasReference: null as boolean | null,
  };
  const initialRequest: any = {
    mode: "trend",
    primaryDimension: "status",
    secondaryDimension: "status",
    metrics: ["count"],
    dateRange: {
      from: iso(new Date(Date.now() - 29 * 86400000)),
      to: iso(new Date()),
      timeField: "createdAt",
    },
    filters: emptyFilters,
    granularity: "day",
    sortBy: "updatedAt",
    sortDir: "desc",
    limit: 20,
    comparePreviousPeriod: true,
    slaHours: 24,
    page: 1,
    pageSize: 10,
    drillLabel: null,
    drillSecondary: null,
  };
  const [request, setRequest] = useStoredState<any>("qa_state_custom_request", initialRequest),
    [result, setResult] = useState<any>({ summary: {}, items: [], comparison: {} }),
    [options, setOptions] = useState<any>({ domains: [], users: [], customFields: [], statuses: [] }),
    [loading, setLoading] = useState(false),
    [msg, setMsg] = useState(""),
    [showMore, setShowMore] = useStoredState("qa_state_custom_show_more", false),
    [detail, setDetail] = useState<any>(null),
    [detailLoading, setDetailLoading] = useState(false),
    [tablePage, setTablePage] = useStoredState("qa_state_custom_table_page", 1),
    [tablePageSize, setTablePageSize] = useStoredState("qa_state_custom_table_page_size", 10),
    [tableSort, setTableSort] = useStoredState<any>("qa_state_custom_table_sort", { key: "count", dir: "desc" }),
    [schemes, setSchemes] = useState<any[]>([]),
    [selectedScheme, setSelectedScheme] = useState(""),
    [schemeDialog, setSchemeDialog] = useState<any>(null),
    [deleteScheme, setDeleteScheme] = useState<any>(null),
    [subscriptions, setSubscriptions] = useState<any[]>([]),
    [subscriptionDialog, setSubscriptionDialog] = useState<any>(null),
    [deleteSubscription, setDeleteSubscription] = useState<any>(null),
    [reports, setReports] = useState<any[]>([]),
    [managementTab, setManagementTab] = useStoredState("qa_state_custom_management_tab", "schemes"),
    [managementPage, setManagementPage] = useStoredState("qa_state_custom_management_page", 1),
    [managementPageSize, setManagementPageSize] = useStoredState("qa_state_custom_management_page_size", 10);

  const field = (row: any, key: string, fallback: any = "") =>
    rowValue(row, key) ?? fallback;
  const setFilter = (key: string, value: any) =>
    setRequest((current: any) => ({
      ...current,
      filters: { ...current.filters, [key]: value },
      page: 1,
      drillLabel: null,
      drillSecondary: null,
    }));
  const setDateRange = (key: string, value: any) =>
    setRequest((current: any) => ({
      ...current,
      dateRange: { ...current.dateRange, [key]: value },
    }));
  const loadManagement = () => {
    api("/analysis/schemes", {}, token).then((x) => setSchemes(Array.isArray(x) ? x : [])).catch(() => {});
    api("/analysis/subscriptions", {}, token).then((x) => setSubscriptions(Array.isArray(x) ? x : [])).catch(() => {});
    api("/analysis/reports", {}, token).then((x) => setReports(Array.isArray(x) ? x : [])).catch(() => {});
  };
  const run = (next = request) => {
    setLoading(true);
    setMsg("");
    api("/analysis/query", { method: "POST", body: JSON.stringify(next) }, token)
      .then((x: any) => {
        setResult(x || { summary: {}, items: [], comparison: {} });
        setTablePage(1);
      })
      .catch((e) => {
        setResult({ summary: {}, items: [], comparison: {} });
        setMsg(e.message || "分析查询失败");
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    Promise.all([
      api("/analysis/options", {}, token),
      api("/analysis/schemes", {}, token),
      api("/analysis/subscriptions", {}, token),
      api("/analysis/reports", {}, token),
    ])
      .then(([o, s, sub, rep]) => {
        setOptions(o || {});
        setSchemes(Array.isArray(s) ? s : []);
        setSubscriptions(Array.isArray(sub) ? sub : []);
        setReports(Array.isArray(rep) ? rep : []);
      })
      .catch((e) => setMsg(e.message || "分析配置加载失败"));
    run(request);
  }, [token]);

  const domains = Array.isArray(options.domains) ? options.domains : [];
  const users = Array.isArray(options.users) ? options.users : [];
  const l1Domains = domains.filter((x: any) => Number(field(x, "level_no")) === 1);
  const l2Domains = domains.filter(
    (x: any) =>
      Number(field(x, "level_no")) === 2 &&
      (!request.filters.domainL1Ids[0] || field(x, "parent_id") === request.filters.domainL1Ids[0]),
  );
  const l3Domains = domains.filter(
    (x: any) =>
      Number(field(x, "level_no")) === 3 &&
      (!request.filters.domainL2Ids[0] || field(x, "parent_id") === request.filters.domainL2Ids[0]),
  );
  const dimensions = [
    ["status", "状态"], ["domainL1", "一级目录"], ["domainL2", "二级目录"],
    ["domainL3", "三级目录"], ["author", "提交人"], ["version", "版本"],
    ...(options.customFields || []).map((x: any) => [`custom:${field(x, "field_code")}`, `自定义：${field(x, "field_name")}`]),
  ];
  const modes = [
    ["trend", "趋势分析"], ["distribution", "分布分析"], ["cross", "交叉分析"],
    ["efficiency", "审批效率"], ["funnel", "审批漏斗"], ["overdue", "超期分析"],
    ["reviewerRanking", "审核人排名"], ["behavior", "使用与反馈"],
  ];
  const summaryCards = [
    ["total", "问答对总量", "条"], ["published", "已发布", "条"],
    ["pending", "审核中", "条"], ["rejected", "当前驳回", "条"],
    ["publishRate", "发布率", "%"], ["passRate", "审核通过率", "%"],
    ["rejectRate", "审核驳回率", "%"], ["avgReviewHours", "平均审核时长", "小时"],
  ];
  const rawItems = Array.isArray(result.items) ? result.items : [];
  const sortedItems = [...rawItems].sort((a: any, b: any) => {
    const av = field(a, tableSort.key), bv = field(b, tableSort.key);
    const value = typeof av === "number" || typeof bv === "number" ? Number(av || 0) - Number(bv || 0) : String(av || "").localeCompare(String(bv || ""), "zh-CN");
    return tableSort.dir === "asc" ? value : -value;
  });
  const tableItems = sortedItems.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize);
  const managementItems = managementTab === "schemes" ? schemes : managementTab === "subscriptions" ? subscriptions : reports;
  const visibleManagementItems = managementItems.slice((managementPage - 1) * managementPageSize, managementPage * managementPageSize);
  const displayLabel = (value: any) => statusLabel[value] || value || "未配置";
  const chartOption = (() => {
    const base: any = {
      color: ["#2E6FB1", "#42A879", "#F0A43C", "#D65B5B", "#7857C7", "#20A5A5"],
      tooltip: { trigger: "axis", confine: true },
      legend: { top: 2 },
      toolbox: { right: 8, feature: { saveAsImage: { title: "保存图片" }, dataView: { title: "数据视图", readOnly: true }, restore: { title: "还原" } } },
      grid: { left: 60, right: 34, top: 58, bottom: 58, outerBounds: { left: 8, right: 8, top: 8, bottom: 8 }, outerBoundsContain: "axisLabel" },
    };
    if (request.mode === "trend") {
      const labels = rawItems.map((x: any) => field(x, "label"));
      return { ...base, dataZoom: [{ type: "inside" }, { type: "slider", height: 18 }], xAxis: { type: "category", data: labels, boundaryGap: false }, yAxis: { type: "value", minInterval: 1 }, series: [
        { name: "总量", type: "line", smooth: true, areaStyle: { opacity: 0.1 }, data: rawItems.map((x: any) => Number(field(x, "count", 0))) },
        { name: "已发布", type: "line", smooth: true, data: rawItems.map((x: any) => Number(field(x, "published", 0))) },
        { name: "已驳回", type: "line", smooth: true, data: rawItems.map((x: any) => Number(field(x, "rejected", 0))) },
      ] };
    }
    if (request.mode === "cross") {
      const categories = [...new Set(rawItems.map((x: any) => displayLabel(field(x, "label"))))];
      const secondaries = [...new Set(rawItems.map((x: any) => displayLabel(field(x, "secondary_label"))))];
      return { ...base, tooltip: { trigger: "axis", axisPointer: { type: "shadow" } }, xAxis: { type: "category", data: categories, axisLabel: { rotate: categories.length > 8 ? 30 : 0 } }, yAxis: { type: "value", minInterval: 1 }, series: secondaries.map((secondary) => ({ name: secondary, type: "bar", stack: "total", emphasis: { focus: "series" }, data: categories.map((category) => Number(field(rawItems.find((x: any) => displayLabel(field(x, "label")) === category && displayLabel(field(x, "secondary_label")) === secondary), "count", 0))) })) };
    }
    if (request.mode === "funnel") return { ...base, tooltip: { trigger: "item", formatter: "{b}：{c} 条（{d}%）" }, legend: { top: 2 }, series: [{ type: "funnel", top: 50, bottom: 20, label: { formatter: "{b}  {c}条" }, data: rawItems.map((x: any) => ({ name: field(x, "label"), value: Number(field(x, "count", 0)) })) }] };
    if (request.mode === "behavior") return { ...base, tooltip: { trigger: "item" }, series: [{ type: "pie", radius: ["38%", "68%"], center: ["50%", "55%"], label: { formatter: "{b}\n{c}条" }, data: rawItems.map((x: any) => ({ name: field(x, "label"), value: Number(field(x, "count", 0)) })) }] };
    const categories = rawItems.map((x: any) => displayLabel(field(x, "label"))).reverse();
    return { ...base, tooltip: { trigger: "axis", axisPointer: { type: "shadow" } }, grid: { left: 90, right: 38, top: 45, bottom: 30, outerBounds: { left: 8, right: 8, top: 8, bottom: 8 }, outerBoundsContain: "axisLabel" }, xAxis: { type: "value", minInterval: 1 }, yAxis: { type: "category", data: categories }, series: [{ name: request.mode === "efficiency" || request.mode === "reviewerRanking" ? "已处理" : "数量", type: "bar", barMaxWidth: 28, label: { show: true, position: "right" }, data: rawItems.map((x: any) => Number(field(x, "count", 0))).reverse() }] };
  })();

  const openDrill = (label: string, secondary?: string) => {
    const rawLabel = rawItems.find((x: any) => displayLabel(field(x, "label")) === label);
    const next = { ...request, page: 1, pageSize: 10, drillLabel: rawLabel ? field(rawLabel, "label") : label, drillSecondary: secondary ? field(rawItems.find((x: any) => displayLabel(field(x, "label")) === label && displayLabel(field(x, "secondary_label")) === secondary), "secondary_label", secondary) : null };
    setDetailLoading(true);
    api("/analysis/details", { method: "POST", body: JSON.stringify(next) }, token)
      .then((x) => setDetail({ ...x, query: next }))
      .catch((e) => setMsg(e.message || "明细加载失败"))
      .finally(() => setDetailLoading(false));
  };
  const loadDetailPage = (page: number, pageSize = detail?.pageSize || 10, sortBy = request.sortBy, sortDir = request.sortDir) => {
    const query = { ...(detail?.query || request), page, pageSize, sortBy, sortDir };
    setDetailLoading(true);
    api("/analysis/details", { method: "POST", body: JSON.stringify(query) }, token)
      .then((x) => setDetail({ ...x, query }))
      .finally(() => setDetailLoading(false));
  };
  const exportExcel = async () => {
    try {
      const response = await fetch(API + "/analysis/export", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "导出失败");
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `自定义分析报告-${iso(new Date())}.xlsx`; link.click(); URL.revokeObjectURL(url);
      setMsg("Excel 分析报告导出成功");
    } catch (e: any) { setMsg(e.message || "导出失败"); }
  };
  const parseScheme = (scheme: any) => {
    try {
      const config = typeof field(scheme, "config_json") === "string" ? JSON.parse(field(scheme, "config_json")) : field(scheme, "config_json");
      const schemeDateRange = Number(field(scheme,"built_in"))===1 ? initialRequest.dateRange : { ...initialRequest.dateRange, ...(config?.dateRange || {}) };
      const next = { ...initialRequest, ...config, filters: { ...emptyFilters, ...(config?.filters || {}) }, dateRange: schemeDateRange, page: 1, drillLabel: null, drillSecondary: null };
      setRequest(next); setSelectedScheme(field(scheme, "id")); run(next); setMsg(`已应用方案：${field(scheme, "scheme_name")}`);
    } catch { setMsg("分析方案配置无效"); }
  };
  const saveScheme = () => {
    const editing = schemeDialog?.editing;
    api(editing ? `/analysis/schemes/${field(editing, "id")}` : "/analysis/schemes", { method: editing ? "PUT" : "POST", body: JSON.stringify({ name: schemeDialog.name, description: schemeDialog.description, visibility: schemeDialog.visibility, config: request }) }, token)
      .then(() => { setSchemeDialog(null); setMsg(editing ? "方案已更新" : "方案已保存"); loadManagement(); })
      .catch((e) => setMsg(e.message));
  };
  const subscribe = () => {
    const editing = subscriptionDialog?.editing;
    api(editing ? `/analysis/subscriptions/${field(editing,"id")}` : "/analysis/subscriptions", { method: editing ? "PUT" : "POST", body: JSON.stringify(subscriptionDialog) }, token)
      .then(() => { setSubscriptionDialog(null); setMsg(editing ? "定时订阅已更新" : "定时报告订阅成功"); loadManagement(); })
      .catch((e) => setMsg(e.message));
  };
  const toggleSubscription = (item: any) => api(`/analysis/subscriptions/${field(item,"id")}`, { method: "PUT", body: JSON.stringify({ schemeId: field(item,"scheme_id"), frequency: field(item,"frequency"), runHour: Number(field(item,"run_hour")), enabled: Number(field(item,"enabled"))!==1 }) }, token)
    .then(() => { setMsg(Number(field(item,"enabled"))===1?"订阅已停用":"订阅已启用"); loadManagement(); })
    .catch((e) => setMsg(e.message));
  const generateReport = (schemeId: string) => {
    api(`/analysis/schemes/${schemeId}/generate`, { method: "POST" }, token)
      .then(() => { setMsg("报告已生成，可在报告中心下载"); setManagementTab("reports"); loadManagement(); })
      .catch((e) => setMsg(e.message));
  };
  const downloadReport = async (report: any) => {
    try { const response=await fetch(API+`/analysis/reports/${field(report,"id")}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error("报告下载失败");const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=field(report,"report_name","分析报告.xlsx");a.click();URL.revokeObjectURL(url);loadManagement(); } catch(e:any){setMsg(e.message);}
  };
  const toggleSort = (key: string) => setTableSort((current: any) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));

  return (
    <section className="analysis-workbench">
      <div className="panel analysis-head">
        <div>
          <h3>自定义分析工作台</h3>
          <p>以统一数据权限进行趋势、质量、审批效率和知识使用分析</p>
        </div>
        <div className="analysis-head-actions">
          <select value={selectedScheme} onChange={(e) => { const scheme=schemes.find((x:any)=>field(x,"id")===e.target.value);if(scheme)parseScheme(scheme); }}>
            <option value="">选择分析方案</option>
            {schemes.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{Number(field(x,"built_in"))===1?"[模板] ":""}{field(x,"scheme_name")}</option>)}
          </select>
          <button className="analysis-action-button" data-icon="＋" onClick={() => setSchemeDialog({ name: "", description: "", visibility: "PRIVATE" })}>保存方案</button>
          <button className="analysis-action-button" data-icon="↓" onClick={exportExcel}>导出 Excel</button>
          <button className="primary analysis-action-button" data-icon="⌕" onClick={() => run()}>查询分析</button>
        </div>
      </div>

      {msg && <div className="inline-notice"><span>{msg}</span><button onClick={() => setMsg("")}>×</button></div>}

      <div className="panel analysis-filter-panel">
        <div className="analysis-filter-grid">
          <label>开始日期<input type="date" value={request.dateRange.from} onChange={(e)=>setDateRange("from",e.target.value)}/></label>
          <label>结束日期<input type="date" value={request.dateRange.to} onChange={(e)=>setDateRange("to",e.target.value)}/></label>
          <label>时间口径<select value={request.dateRange.timeField} onChange={(e)=>setDateRange("timeField",e.target.value)}><option value="createdAt">创建时间</option><option value="submittedAt">提交时间</option><option value="publishedAt">发布时间</option><option value="retiredAt">退役时间</option></select></label>
          <label>一级目录<select value={request.filters.domainL1Ids[0]||""} onChange={(e)=>{setFilter("domainL1Ids",e.target.value?[e.target.value]:[]);setFilter("domainL2Ids",[]);setFilter("domainL3Ids",[]);}}><option value="">全部一级目录</option>{l1Domains.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"domain_name")}</option>)}</select></label>
          <label>二级目录<select value={request.filters.domainL2Ids[0]||""} onChange={(e)=>{setFilter("domainL2Ids",e.target.value?[e.target.value]:[]);setFilter("domainL3Ids",[]);}}><option value="">全部二级目录</option>{l2Domains.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"domain_name")}</option>)}</select></label>
          <label>三级目录<select value={request.filters.domainL3Ids[0]||""} onChange={(e)=>setFilter("domainL3Ids",e.target.value?[e.target.value]:[])}><option value="">全部三级目录</option>{l3Domains.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"domain_name")}</option>)}</select></label>
          <label>状态<select multiple value={request.filters.statuses} onChange={(e)=>setFilter("statuses",Array.from(e.currentTarget.selectedOptions).map((x: HTMLOptionElement)=>x.value))}>{(options.statuses||[]).map((x:string)=><option key={x} value={x}>{statusLabel[x]||x}</option>)}</select></label>
          <label>关键词<input value={request.filters.keyword} placeholder="编号、问题或答案" onChange={(e)=>setFilter("keyword",e.target.value)}/></label>
        </div>
        {showMore && <div className="analysis-filter-grid analysis-more-filters">
          <label>提交人<select value={request.filters.authorIds[0]||""} onChange={(e)=>setFilter("authorIds",e.target.value?[e.target.value]:[])}><option value="">全部提交人</option>{users.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"real_name")}（{field(x,"username")}）</option>)}</select></label>
          <label>审核人<select value={request.filters.reviewerIds[0]||""} onChange={(e)=>setFilter("reviewerIds",e.target.value?[e.target.value]:[])}><option value="">全部审核人</option>{users.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"real_name")}（{field(x,"username")}）</option>)}</select></label>
          <label>附件<select value={request.filters.hasAttachment===null?"":String(request.filters.hasAttachment)} onChange={(e)=>setFilter("hasAttachment",e.target.value===""?null:e.target.value==="true")}><option value="">不限</option><option value="true">有附件</option><option value="false">无附件</option></select></label>
          <label>参考文档<select value={request.filters.hasReference===null?"":String(request.filters.hasReference)} onChange={(e)=>setFilter("hasReference",e.target.value===""?null:e.target.value==="true")}><option value="">不限</option><option value="true">有参考文档</option><option value="false">无参考文档</option></select></label>
          <label className="analysis-compare-check"><input type="checkbox" checked={request.comparePreviousPeriod} onChange={(e)=>setRequest({...request,comparePreviousPeriod:e.target.checked})}/> 与上一周期对比</label>
        </div>}
        <div className="analysis-filter-actions"><button className="link" onClick={()=>setShowMore(!showMore)}>{showMore?"收起筛选":"更多筛选"}</button><button className="analysis-action-button compact" data-icon="↻" onClick={()=>setRequest(initialRequest)}>重置</button><button className="primary analysis-action-button compact" data-icon="✓" onClick={()=>run()}>应用筛选</button></div>
      </div>

      <div className="analysis-kpis">
        {summaryCards.map(([key,label,unit],index)=>{const comparison=result.comparison?.[key];return <div className={`analysis-kpi kpi-${index+1}`} key={key}><span>{label}</span><strong>{Number(result.summary?.[key]||0).toLocaleString("zh-CN")}</strong><em>{unit}</em>{comparison&&<small className={Number(comparison.change)>=0?"up":"down"}>{Number(comparison.change)>=0?"↑":"↓"} {Math.abs(Number(comparison.changeRate||0))}% 较上期</small>}</div>})}
      </div>

      <div className="panel analysis-main-panel">
        <div className="analysis-mode-tabs">{modes.map(([key,label])=><button key={key} className={request.mode===key?"selected":""} onClick={()=>{const next={...request,mode:key,primaryDimension:key==="cross"?"domainL1":request.primaryDimension,secondaryDimension:key==="cross"?"status":request.secondaryDimension,drillLabel:null,drillSecondary:null};setRequest(next);run(next);}}>{label}</button>)}</div>
        <div className="analysis-config-row">
          {["distribution","cross"].includes(request.mode)&&<label>主维度<select value={request.primaryDimension} onChange={(e)=>setRequest({...request,primaryDimension:e.target.value,secondaryDimension:request.mode==="cross"&&request.secondaryDimension===e.target.value?(e.target.value==="status"?"domainL1":"status"):request.secondaryDimension})}>{dimensions.map(([key,label]:any)=><option key={key} value={key}>{label}</option>)}</select></label>}
          {request.mode==="cross"&&<label>次维度<select value={request.secondaryDimension} onChange={(e)=>setRequest({...request,secondaryDimension:e.target.value})}>{dimensions.filter(([key]:any)=>key!==request.primaryDimension).map(([key,label]:any)=><option key={key} value={key}>{label}</option>)}</select></label>}
          {request.mode==="trend"&&<label>时间粒度<select value={request.granularity} onChange={(e)=>setRequest({...request,granularity:e.target.value})}><option value="day">按日</option><option value="week">按周</option><option value="month">按月</option></select></label>}
          {["distribution","cross","efficiency","reviewerRanking"].includes(request.mode)&&<label>显示数量<select value={request.limit} onChange={(e)=>setRequest({...request,limit:Number(e.target.value)})}><option value="10">Top 10</option><option value="20">Top 20</option><option value="50">Top 50</option></select></label>}
          {request.mode==="overdue"&&<label>超期阈值<select value={request.slaHours} onChange={(e)=>setRequest({...request,slaHours:Number(e.target.value)})}><option value="12">12小时</option><option value="24">24小时</option><option value="48">48小时</option><option value="72">72小时</option></select></label>}
          <button className="primary analysis-action-button compact" data-icon="↻" onClick={()=>run()}>刷新图表</button>
        </div>
        {loading?<div className="loading">正在聚合分析数据…</div>:rawItems.length?<EChart option={chartOption} onClick={(params)=>openDrill(params.name,params.seriesName)}/>:<div className="empty analysis-empty">当前筛选条件下暂无数据</div>}
        <p className="analysis-chart-hint">点击任一图表数据可下钻到对应业务明细；工具栏支持数据视图和图片导出。</p>
      </div>

      <div className="panel analysis-result-panel">
        <div className="analysis-section-head"><div><h3>分析结果</h3><p>共 {rawItems.length} 个统计项，点击表头排序</p></div></div>
        <div className="table-scroll"><table><thead><tr><th onClick={()=>toggleSort("label")}>维度</th>{request.mode==="cross"&&<th onClick={()=>toggleSort("secondary_label")}>次维度</th>}<th onClick={()=>toggleSort("count")}>数量</th>{["efficiency","reviewerRanking"].includes(request.mode)&&<><th onClick={()=>toggleSort("passRate")}>通过率</th><th onClick={()=>toggleSort("avgHours")}>平均时长</th><th onClick={()=>toggleSort("pending")}>待处理</th></>}<th>操作</th></tr></thead><tbody>{tableItems.map((row:any,index)=><tr key={`${field(row,"label")}-${field(row,"secondary_label")}-${index}`}><td>{displayLabel(field(row,"label"))}</td>{request.mode==="cross"&&<td>{displayLabel(field(row,"secondary_label"))}</td>}<td>{field(row,"count",0)}</td>{["efficiency","reviewerRanking"].includes(request.mode)&&<><td>{field(row,"passRate",0)}%</td><td>{field(row,"avgHours",0)}小时</td><td>{field(row,"pending",0)}</td></>}<td><button className="link" onClick={()=>openDrill(displayLabel(field(row,"label")),request.mode==="cross"?displayLabel(field(row,"secondary_label")):undefined)}>查看明细</button></td></tr>)}</tbody></table></div>
        <Pagination page={tablePage} pageSize={tablePageSize} total={rawItems.length} onPage={setTablePage} onPageSize={setTablePageSize}/>
      </div>

      <div className="panel analysis-management">
        <div className="analysis-management-tabs"><button className={managementTab==="schemes"?"selected":""} onClick={()=>{setManagementTab("schemes");setManagementPage(1);}}>分析方案</button><button className={managementTab==="subscriptions"?"selected":""} onClick={()=>{setManagementTab("subscriptions");setManagementPage(1);}}>定时订阅</button><button className={managementTab==="reports"?"selected":""} onClick={()=>{setManagementTab("reports");setManagementPage(1);loadManagement();}}>报告中心 {reports.filter((x:any)=>Number(field(x,"read_flag"))===0&&field(x,"report_status")==="READY").length>0&&<span className="management-badge">{reports.filter((x:any)=>Number(field(x,"read_flag"))===0&&field(x,"report_status")==="READY").length}</span>}</button></div>
        {managementTab==="schemes"&&<div className="analysis-scheme-grid">{visibleManagementItems.map((scheme:any)=><div className="analysis-scheme-card" key={field(scheme,"id")}><div><b>{field(scheme,"scheme_name")}</b><span>{Number(field(scheme,"built_in"))===1?"公共模板":field(scheme,"visibility")==="PUBLIC"?"公共方案":"我的方案"}</span></div><p>{field(scheme,"description","暂无说明")}</p><small>所有者：{field(scheme,"owner_name")}</small><div><button onClick={()=>parseScheme(scheme)}>应用</button><button onClick={()=>generateReport(field(scheme,"id"))}>生成报告</button><button onClick={()=>setSubscriptionDialog({schemeId:field(scheme,"id"),frequency:"WEEKLY",runHour:8,enabled:true})}>订阅</button>{Number(field(scheme,"built_in"))!==1&&<><button onClick={()=>setSchemeDialog({editing:scheme,name:field(scheme,"scheme_name"),description:field(scheme,"description"),visibility:field(scheme,"visibility")})}>编辑</button><button className="danger-text" onClick={()=>setDeleteScheme(scheme)}>删除</button></>}</div></div>)}</div>}
        {managementTab==="subscriptions"&&<><div className="analysis-section-head"><div><h3>定时报告订阅</h3><p>系统在指定时间自动生成 Excel 报告并保存到报告中心</p></div>{schemes.length>0&&<button className="primary" onClick={()=>setSubscriptionDialog({schemeId:field(schemes[0],"id"),frequency:"WEEKLY",runHour:8,enabled:true})}>新增订阅</button>}</div><table><thead><tr><th>方案</th><th>频率</th><th>执行时间</th><th>下次执行</th><th>状态</th><th>操作</th></tr></thead><tbody>{visibleManagementItems.map((x:any)=><tr key={field(x,"id")}><td>{field(x,"scheme_name")}</td><td>{{DAILY:"每日",WEEKLY:"每周",MONTHLY:"每月"}[field(x,"frequency") as string]||field(x,"frequency")}</td><td>{field(x,"run_hour")}时</td><td>{dateTime(field(x,"next_run_at"))}</td><td><span className="tag">{Number(field(x,"enabled"))===1?"启用":"停用"}</span></td><td><button className="link" onClick={()=>setSubscriptionDialog({editing:x,schemeId:field(x,"scheme_id"),frequency:field(x,"frequency"),runHour:Number(field(x,"run_hour")),enabled:Number(field(x,"enabled"))===1})}>编辑</button><button className="link" onClick={()=>toggleSubscription(x)}>{Number(field(x,"enabled"))===1?"停用":"启用"}</button><button className="link danger-text" onClick={()=>setDeleteSubscription(x)}>删除</button></td></tr>)}</tbody></table>{!subscriptions.length&&<div className="empty">暂无定时订阅</div>}</>}
        {managementTab==="reports"&&<><div className="analysis-section-head"><div><h3>分析报告中心</h3><p>定时或手动生成的报告均按当前用户数据权限计算</p></div><button onClick={loadManagement}>刷新状态</button></div><table><thead><tr><th>报告名称</th><th>方案</th><th>生成时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{visibleManagementItems.map((x:any)=><tr key={field(x,"id")} className={Number(field(x,"read_flag"))===0?"unread-report":""}><td>{field(x,"report_name")}</td><td>{field(x,"scheme_name")}</td><td>{dateTime(field(x,"generated_at"))}</td><td><span className="tag">{{READY:"已完成",GENERATING:"生成中",FAILED:"失败"}[field(x,"report_status") as string]||field(x,"report_status")}</span>{field(x,"error_message")&&<small className="table-subtext">{field(x,"error_message")}</small>}</td><td><button className="link" disabled={field(x,"report_status")!=="READY"} onClick={()=>downloadReport(x)}>下载</button></td></tr>)}</tbody></table>{!reports.length&&<div className="empty">暂无分析报告</div>}</>}
        <Pagination page={managementPage} pageSize={managementPageSize} total={managementItems.length} onPage={setManagementPage} onPageSize={setManagementPageSize}/>
      </div>

      {detail&&<div className="modal"><div className="modal-card extra-wide analysis-detail-modal"><button className="close" onClick={()=>setDetail(null)}>×</button><h3>分析明细</h3><p className="muted">维度：{displayLabel(detail.query.drillLabel)}{detail.query.drillSecondary?` / ${displayLabel(detail.query.drillSecondary)}`:""}，共 {detail.total} 条</p>{detailLoading?<div className="loading">加载明细…</div>:<div className="table-scroll"><table><thead><tr><th>问答编号</th><th>问题</th><th>状态</th><th>一级目录</th><th>二级目录</th><th>提交人</th><th>更新时间</th></tr></thead><tbody>{(detail.items||[]).map((x:any)=><tr key={field(x,"id")}><td className="code">{field(x,"qa_code")}</td><td>{field(x,"question_text")}</td><td><span className="tag">{displayLabel(field(x,"status"))}</span></td><td>{field(x,"domain_l1_name")}</td><td>{field(x,"domain_l2_name")}</td><td>{field(x,"author_name")}</td><td>{dateTime(field(x,"updated_at"))}</td></tr>)}</tbody></table></div>}<Pagination page={detail.page} pageSize={detail.pageSize} total={detail.total} onPage={(p:number)=>loadDetailPage(p)} onPageSize={(s:number)=>loadDetailPage(1,s)}/></div></div>}
      {schemeDialog&&<div className="modal"><div className="modal-card"><button className="close" onClick={()=>setSchemeDialog(null)}>×</button><h3>{schemeDialog.editing?"编辑分析方案":"保存分析方案"}</h3><label>方案名称<input value={schemeDialog.name} onChange={(e)=>setSchemeDialog({...schemeDialog,name:e.target.value})}/></label><label>方案说明<textarea rows={3} value={schemeDialog.description||""} onChange={(e)=>setSchemeDialog({...schemeDialog,description:e.target.value})}/></label><label>可见范围<select value={schemeDialog.visibility} onChange={(e)=>setSchemeDialog({...schemeDialog,visibility:e.target.value})}><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公共方案（需管理员权限）</option></select></label><div className="modal-actions"><button className="primary" disabled={!schemeDialog.name?.trim()} onClick={saveScheme}>保存</button><button onClick={()=>setSchemeDialog(null)}>取消</button></div></div></div>}
      {subscriptionDialog&&<div className="modal"><div className="modal-card"><button className="close" onClick={()=>setSubscriptionDialog(null)}>×</button><h3>{subscriptionDialog.editing?"编辑定时报告订阅":"新增定时报告订阅"}</h3><label>分析方案<select value={subscriptionDialog.schemeId} onChange={(e)=>setSubscriptionDialog({...subscriptionDialog,schemeId:e.target.value})}>{schemes.map((x:any)=><option key={field(x,"id")} value={field(x,"id")}>{field(x,"scheme_name")}</option>)}</select></label><label>生成频率<select value={subscriptionDialog.frequency} onChange={(e)=>setSubscriptionDialog({...subscriptionDialog,frequency:e.target.value})}><option value="DAILY">每日</option><option value="WEEKLY">每周一</option><option value="MONTHLY">每月1日</option></select></label><label>生成时间<select value={subscriptionDialog.runHour} onChange={(e)=>setSubscriptionDialog({...subscriptionDialog,runHour:Number(e.target.value)})}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>)}</select></label><label className="analysis-compare-check"><input type="checkbox" checked={subscriptionDialog.enabled!==false} onChange={(e)=>setSubscriptionDialog({...subscriptionDialog,enabled:e.target.checked})}/> 启用该订阅</label><div className="modal-actions"><button className="primary" onClick={subscribe}>{subscriptionDialog.editing?"保存修改":"确认订阅"}</button><button onClick={()=>setSubscriptionDialog(null)}>取消</button></div></div></div>}
      {deleteScheme&&<ConfirmDialog title="删除分析方案" message={`确认删除“${field(deleteScheme,"scheme_name")}”？有关联报告时系统将阻止删除。`} confirmText="确认删除" danger onConfirm={()=>api(`/analysis/schemes/${field(deleteScheme,"id")}`,{method:"DELETE"},token).then(()=>{setDeleteScheme(null);loadManagement();setMsg("方案已删除");}).catch(e=>setMsg(e.message))} onCancel={()=>setDeleteScheme(null)}/>}
      {deleteSubscription&&<ConfirmDialog title="删除定时订阅" message={`确认删除“${field(deleteSubscription,"scheme_name")}”的定时报告订阅？`} confirmText="确认删除" danger onConfirm={()=>api(`/analysis/subscriptions/${field(deleteSubscription,"id")}`,{method:"DELETE"},token).then(()=>{setDeleteSubscription(null);loadManagement();setMsg("订阅已删除");}).catch(e=>setMsg(e.message))} onCancel={()=>setDeleteSubscription(null)}/>}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
