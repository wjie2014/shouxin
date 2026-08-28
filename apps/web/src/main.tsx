import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./style-extra.css";
import "./style-polish.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
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
};
const dateTime = (v: any) =>
  v ? String(v).replace("T", " ").slice(0, 19) : "-";
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
  if (!r.ok)
    throw Error(
      (await r.json().catch(() => ({ message: r.statusText }))).message ||
        "请求失败",
    );
  return r.status === 204 ? null : r.json();
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
        <div className={`confirm-icon ${danger ? "danger-icon" : ""}`}>
          {danger ? "!" : "?"}
        </div>
        <h3>{title}</h3>
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
  if (!total) return null;
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
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState("admin123"),
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
      ["stats", "运营仪表盘", "◔"],
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
  stats: "运营仪表盘",
  custom: "自定义分析",
  users: "用户管理",
  roles: "角色管理",
  logs: "操作日志",
  params: "系统参数",
};
function App() {
  const [token, setToken] = useState(localStorage.getItem("qa_token") || ""),
    [user, setUser] = useState<any>(),
    [tab, setTab] = useState(localStorage.getItem("qa_tab") || "dashboard"),
    [sidebarCollapsed, setSidebarCollapsed] = useState(
      localStorage.getItem("qa_sidebar_collapsed") === "1",
    ),
    [openTabs, setOpenTabs] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("qa_tabs") || '["dashboard"]');
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
    setTab(k);
    setOpenTabs((a) => (a.includes(k) ? a : [...a, k]));
  };
  const closeTab = (k: string) => {
    if (k === "dashboard") return;
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
    localStorage.removeItem("qa_token");
    setToken("");
  };
  const content =
    tab === "dashboard" ? (
      <Dashboard token={token} />
    ) : tab === "pairs" ? (
      <Pairs token={token} />
    ) : tab === "create" ? (
      <CreatePair
        token={token}
        close={() => setTab("pairs")}
        saved={() => setTab("pairs")}
      />
    ) : tab === "reviews" ? (
      <Reviews token={token} />
    ) : tab === "history" ? (
      <ReviewHistory token={token} />
    ) : tab === "domains" ? (
      <Domains token={token} />
    ) : tab === "stats" ? (
      <Dashboard token={token} />
    ) : tab === "custom" ? (
      <CustomStats token={token} />
    ) : tab === "flows" ? (
      <FlowConfig token={token} />
    ) : tab === "fields" ? (
      <FieldSchemeUI token={token} />
    ) : ["users", "roles", "logs", "params"].includes(tab) ? (
      <Admin token={token} initialTab={tab} />
    ) : (
      <Dashboard token={token} />
    );
  return (
    <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside>
        <div className="brand">
          QA<span>·</span>Flow
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
          {navSections.map((s) => (
            <div className="nav-section" key={s.title}>
              <div className="nav-title">{s.title}</div>
              {s.items.map(([k, n, i]) => (
                <button
                  className={tab === k ? "active" : ""}
                  onClick={() => selectTab(k)}
                  key={k}
                >
                  <b>{i}</b>
                  {n}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="user">
          <div className="avatar">{user.realName?.slice(0, 1)}</div>
          <div>
            <strong>{user.realName}</strong>
            <small>{user.roles?.join(" / ")}</small>
          </div>
          <button onClick={logout}>退出</button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">知识资产治理</span>
            <h2>{titles[tab] || "工作台"}</h2>
            <div className="tab-strip">
              {openTabs.map((k) => (
                <button
                  key={k}
                  className={tab === k ? "tab-current" : ""}
                  onClick={() => setTab(k)}
                >
                  {titles[k]}{" "}
                  {k !== "dashboard" && (
                    <span
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
          </div>
          <span className="status-dot">系统正常</span>
        </header>
        {content}
      </main>
    </div>
  );
}
function Dashboard({ token }: { token: string }) {
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
  const cards = [
    ["问答对总量", d.total, "blue", "条"],
    ["已发布", d.published, "green", "条"],
    ["审核中", d.pendingReview, "orange", "条"],
    ["草稿", d.draft, "purple", "条"],
    ["已退役", d.retired, "red", "条"],
    ["平均审核时长", d.avgReviewHours || 0, "teal", "小时"],
  ];
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
      <section className="grid dashboard-grid">
        <div className="dash-col">
          <div className="panel status-panel">
            <h3>状态分布</h3>
            <div className="donut-wrap">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(${statusGradient || "#dce6ee 0 100%"})`,
                }}
              >
                <div>
                  <strong>{d.total}</strong>
                  <small>总量</small>
                </div>
              </div>
              <div className="donut-legend">
                {statusItems.map((x: any, i: number) => (
                  <span key={x.name}>
                    <i
                      style={{
                        background: statusColors[i % statusColors.length],
                      }}
                    />
                    <em>{x.name}</em>
                    <b>{x.value}</b>
                    <u>
                      {statusTotal
                        ? Math.round((x.value / statusTotal) * 100)
                        : 0}
                      %
                    </u>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="panel trend-panel">
            <h3 className="trend-heading">
              近30天新增趋势{" "}
              <span className="trend-summary">
                合计 {trendValues.reduce((s, v) => s + v, 0)} 条 · 峰值{" "}
                {maxTrend} 条
              </span>
            </h3>
            <div className="trend-chart trend-bar-chart">
              {trend.length ? (
                <div
                  className="trend-bars"
                  role="img"
                  aria-label="近30天新增趋势"
                >
                  {trend.map((x: any, i: number) => {
                    const v = trendValues[i];
                    const day = String(x.DAY || x.day || "");
                    return (
                      <div className="trend-bar-col" key={day + i}>
                        <div className="trend-bar-track">
                          <div
                            className="trend-bar-fill"
                            style={{
                              height: `${Math.max(2, (v / maxTrend) * 100)}%`,
                            }}
                            title={`${day}：${v} 条`}
                          >
                            <span className="trend-bar-value">{v}</span>
                          </div>
                        </div>
                        <span className="trend-bar-label">{day.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="trend-placeholder">
                  {d.thisMonthNew || 0} 条新增记录，暂无趋势明细
                </div>
              )}
            </div>
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
    </>
  );
}
function Pairs({ token }: { token: string }) {
  const [data, setData] = useState<any>({ items: [] }),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState(""),
    [l1, setL1] = useState(""),
    [l2, setL2] = useState(""),
    [l3, setL3] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [domains, setDomains] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [checked, setChecked] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState("updatedAt"),
    [showCreate, setShowCreate] = useState(false),
    [importType, setImportType] = useState<"first" | "second">("first"),
    [message, setMessage] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [importPreview, setImportPreview] = useState<any>(null);
  useEffect(() => {
    api("/domains/tree", {}, token)
      .then((x) => setDomains(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, [token]);
  const current = domains.find((x: any) => (x.id || x.ID) === l1),
    second = (current?.children || []).find((x: any) => (x.id || x.ID) === l2);
  const load = () =>
    api(
      `/qa-pairs?keyword=${encodeURIComponent(keyword)}&status=${status}&domainL1Id=${l1}&domainL2Id=${l2}&domainL3Id=${l3}&submitFrom=${from}&submitTo=${to}&page=${page}&pageSize=${pageSize}&sortBy=${sort}&sortDir=desc`,
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
  }, [token, page, pageSize, status, sort, l1, l2, l3, from, to]);
  const items = Array.isArray(data?.items) ? data.items : [];
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
  const confirmImport = () => {
    const pre = importPreview;
    fetch(API + `/import/${importType}-stage/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rows: (pre.rows || [])
          .filter((x: any) => x.valid)
          .map((x: any) => ({
            question: x.question,
            answer: x.answer,
            domainL1Id: x.domainL1Id,
            domainL2Id: x.domainL2Id,
            domainL3Id: x.domainL3Id,
          })),
      }),
    })
      .then(() => {
        setImportPreview(null);
        setMessage("导入成功");
        load();
      })
      .catch(() => setMessage("导入失败"));
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
          <option value="published">已发布</option>
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
        </select>
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
                .then((r) => r.json())
                .then(setImportPreview)
                .catch(() => setMessage("文件预览失败"));
            }}
          />
        </label>
        <a
          className="button"
          href={API + "/export/second-stage"}
          target="_blank"
        >
          导出 Excel
        </a>
        <button className="primary" onClick={() => setShowCreate(true)}>
          + 新建问答对
        </button>
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
              />{" "}
              问答编号
            </th>
            <th>问题</th>
            <th>状态</th>
            <th>版本</th>
            <th>创建人</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x: any) => (
            <tr
              key={x.id || x.ID}
              onClick={() =>
                api("/qa-pairs/" + (x.id || x.ID), {}, token).then(setSelected)
              }
            >
              <td className="code">
                <input
                  type="checkbox"
                  checked={checked.includes(x.id || x.ID)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggle(x.id || x.ID);
                  }}
                />{" "}
                {x.qa_code || x.QA_CODE}
              </td>
              <td>{x.question_text || x.QUESTION_TEXT}</td>
              <td>
                <span className="tag">
                  {statusLabel[x.status || x.STATUS] || x.status || x.STATUS}
                </span>
              </td>
              <td>{x.version_no || x.VERSION_NO}</td>
              <td>{x.real_name || x.REAL_NAME}</td>
              <td>{dateTime(x.updated_at || x.UPDATED_AT)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          上一页
        </button>
        <span>
          第 {page} 页 / 共{" "}
          {Math.max(1, Math.ceil((data.total || items.length) / pageSize))} 页
        </span>
        <button
          disabled={page >= Math.ceil((data.total || items.length) / pageSize)}
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
          <option value="100">100��/页</option>
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
      {importPreview && (
        <ConfirmDialog
          title="导入预览完成"
          message={`有效 ${importPreview.valid} 条，无效 ${importPreview.invalid} 条。是否确认导入有效数据？`}
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
        />
      )}{" "}
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
}: {
  item: any;
  token: string;
  close: () => void;
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
  useEffect(() => setDetailPage(1), [tab]);
  useEffect(() => {
    api(`/reviews/history?qaPairId=${item.id}`, {}, token)
      .then((x) => setHistory(Array.isArray(x) ? x : []))
      .catch(() => {});
    api(`/qa-pairs/${item.id}/attachments`, {}, token)
      .then((x) => setAttachments(Array.isArray(x) ? x : []))
      .catch(() => {});
    api(`/qa-pairs/${item.id}/versions`, {}, token)
      .then((x) => setVersions(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, [item.id, token]);
  return (
    <>
      {editing && (
        <EditPair
          item={item}
          token={token}
          close={() => setEditing(false)}
          saved={close}
          published={item.status === "published" || item.status === "retired"}
        />
      )}
      <div className="modal">
        <div className="modal-card wide">
          <button className="close" onClick={close}>
            ×
          </button>
          <h3>{item.qa_code}</h3>
          <span className="tag">{statusLabel[item.status] || item.status}</span>
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
            <>
              <h4>问题</h4>
              <div
                className="content"
                dangerouslySetInnerHTML={{
                  __html: safeHtml(
                    item.question_html || item.questionHtml || "",
                  ),
                }}
              />
              <h4>答案</h4>
              <div
                className="content"
                dangerouslySetInnerHTML={{
                  __html: safeHtml(item.answer_html || item.answerHtml || ""),
                }}
              />
            </>
          )}
          {tab === "attachments" &&
            (attachments.length ? (
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
                          <a
                            href={
                              API +
                              `/qa-pairs/${item.id}/attachments/${a.id}/download`
                            }
                            target="_blank"
                          >
                            下载
                          </a>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">暂无附件</div>
            ))}
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
                        <td>{r.reviewer_name || "-"}</td>
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
                  ).then(close)
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
      {retiring && (
        <div className="modal">
          <div className="modal-card">
            <button className="close" onClick={() => setRetiring(false)}>
              ×
            </button>
            <h3>退役问答对</h3>
            <label>
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
                  ).then(close)
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
    [error, setError] = useState("");
  const save = async () => {
    if (
      !q.replace(/<[^>]+>/g, "").trim() ||
      !a.replace(/<[^>]+>/g, "").trim()
    ) {
      setError("问题和答案不能为空");
      return;
    }
    try {
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
                  changeReason: reason,
                }
              : {
                  domainL1Id: item.domainL1Id,
                  domainL2Id: item.domainL2Id,
                  domainL3Id: item.domainL3Id,
                  questionHtml: q,
                  answerHtml: a,
                  referenceDoc: doc,
                },
          ),
        },
        token,
      );
      close();
      saved();
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };
  return (
    <div className="modal">
      <div className="modal-card wide">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>编辑 {item.qa_code}</h3>
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
          <div
            className="rich-editor"
            contentEditable
            suppressContentEditableWarning
            ref={(el) => {
              if (el && !el.dataset.initialized) {
                el.innerHTML = safeHtml(q);
                el.dataset.initialized = "1";
              }
            }}
            onInput={(e) => setQ(e.currentTarget.innerHTML)}
          />
        </label>
        <label>
          答案
          <div
            className="rich-editor answer"
            contentEditable
            suppressContentEditableWarning
            ref={(el) => {
              if (el && !el.dataset.initialized) {
                el.innerHTML = safeHtml(a);
                el.dataset.initialized = "1";
              }
            }}
            onInput={(e) => setA(e.currentTarget.innerHTML)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="primary" onClick={save}>
            保存修改
          </button>
          <button onClick={close}>取消</button>
        </div>
      </div>
    </div>
  );
}
function CreatePair({
  token,
  close,
  saved,
}: {
  token: string;
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
    [error, setError] = useState("");
  useEffect(() => {
    api("/domains/tree", {}, token)
      .then((x) => setDomains(Array.isArray(x) ? x : []))
      .catch(() => {});
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
          }),
        },
        token,
      );
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(API + `/qa-pairs/${x.id}/attachments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
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
      <div className="modal-card wide">
        <button className="close" onClick={close}>
          ×
        </button>
        <h3>新建问答对</h3>
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
          <input value="当前登录用户" disabled />
        </label>
        <label>
          依据文档
          <input
            value={referenceDoc}
            onChange={(e) => setReferenceDoc(e.target.value)}
            placeholder="标准/规程名称"
          />
        </label>
        <label>
          附件（单个不超过50MB）
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>
        <label>
          问题（支持富文本）
          <div
            className="rich-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setQ(e.currentTarget.innerHTML)}
          />
        </label>
        <label>
          答案（支持富文本）
          <div
            className="rich-editor answer"
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setA(e.currentTarget.innerHTML)}
          />
        </label>
        {error && <div className="error">{error}</div>}
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

function Reviews({ token }: { token: string }) {
  const [level, setLevel] = useState(1),
    [data, setData] = useState<any>({ items: [] }),
    [selected, setSelected] = useState<any>(),
    [checked, setChecked] = useState<string[]>([]),
    [opinion, setOpinion] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [msg, setMsg] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const load = () =>
    api(
      `/reviews/pending?level=${level}&page=${page}&pageSize=${pageSize}`,
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
  }, [level, page, pageSize]);
  const items = Array.isArray(data?.items) ? data.items : [];
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
    });
  };
  const batch = (result: string) => {
    if (!checked.length) {
      setMsg("请先选择数据");
      return;
    }
    Promise.allSettled(
      checked.map((id) =>
        decide(
          result,
          id,
          result === "pass" ? "批量审核通过" : "批量驳回，请补充材料",
        ),
      ),
    ).then((rs) => {
      setChecked([]);
      setMsg(
        rs.some((x) => x.status === "rejected")
          ? "部分任务处理失败，请刷新后���试"
          : "批量审核完成",
      );
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
          </button>
        ))}
      </div>
      <div className="toolbar">
        <button onClick={() => batch("pass")}>批量通过</button>
        <button className="danger" onClick={() => batch("reject")}>
          ���量驳回
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
            <th>编号</th>
            <th>问题</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x: any) => (
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
              <td className="code">{x.qa_code || x.QA_CODE}</td>
              <td>{x.question_text || x.QUESTION_TEXT}</td>
              <td>
                <span className="tag">审核中（{level}级）</span>
              </td>
              <td>{dateTime(x.updated_at || x.UPDATED_AT)}</td>
              <td>
                <button
                  className="link"
                  onClick={() =>
                    api("/qa-pairs/" + (x.id || x.ID), {}, token).then(
                      setSelected,
                    )
                  }
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
            <h4>问题</h4>
            <div
              className="content"
              dangerouslySetInnerHTML={{
                __html: safeHtml(selected.question_html || ""),
              }}
            />
            <h4>答案</h4>
            <div
              className="content"
              dangerouslySetInnerHTML={{
                __html: safeHtml(selected.answer_html || ""),
              }}
            />
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
      )}
    </section>
  );
}

function Domains({ token }: { token: string }) {
  const [data, setData] = useState<any[]>([]),
    [show, setShow] = useState(false),
    [name, setName] = useState(""),
    [parent, setParent] = useState(""),
    [msg, setMsg] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [editName, setEditName] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<any>(null),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const load = () =>
    api("/domains/tree", {}, token)
      .then((x) => setData(Array.isArray(x) ? x : []))
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
  };
  const saveEdit = () => {
    if (!editName.trim()) return setMsg("目录名称不能为空");
    api(
      "/admin/domains/" + (editing.id || editing.ID),
      {
        method: "PUT",
        body: JSON.stringify({
          domainName: editName,
          description: editing.description || "",
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
    return (
      <div className="tree-node" key={node.id || node.ID}>
        <div className={`tree-row tree-row-l${level}`}>
          <span className="tree-badge">L{level}</span>
          <div className="tree-info">
            <b>{node.domainName || node.DOMAIN_NAME}</b>
            <small>
              第{level}级
              {childCount > 0 ? ` · 含 ${childCount} 个子目录` : " · 末级目录"}
            </small>
          </div>
          <div className="tree-actions">
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
        {childCount > 0 && (
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
      <div className="toolbar">
        <h3>知识目录</h3>
        <button className="primary" onClick={() => setShow(true)}>
          + 新增目录
        </button>
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
            <label>
              目录名称
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
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
            <label>
              目录名称
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
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
    [editing, setEditing] = useState<any>(null),
    [form, setForm] = useState<any>({}),
    [deleting, setDeleting] = useState<any>(null),
    [resetTarget, setResetTarget] = useState<any>(null),
    [newPassword, setNewPassword] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
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
              ? `/admin/operation-logs?page=${page}&pageSize=${pageSize}`
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
  useEffect(load, [tab, token, page, pageSize]);
  useEffect(() => {
    api("/admin/roles", {}, token)
      .then((x) => setRoles(x || []))
      .catch(() => setRoles([]));
  }, [token]);
  const openForm = (row?: any) => {
    const r = row || {};
    setEditing(row || { _new: true });
    if (tab === "users")
      setForm({
        username: r.username || "",
        realName: r.real_name || "",
        password: "",
        email: r.email || "",
        mobile: r.mobile || "",
        enabled: r.enabled !== 0,
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
            body: JSON.stringify({ ...form, unitId: null }),
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
      setMsg(e.message || "保存失败");
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
    if (newPassword.length < 8) return setMsg("密码至少8位");
    try {
      await api(
        `/admin/users/${resetTarget.id}/reset-password`,
        { method: "POST", body: JSON.stringify({ password: newPassword }) },
        token,
      );
      setResetTarget(null);
      setNewPassword("");
      setMsg("密码已重置，下次登录需修改");
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  const columns: Record<string, string[]> = {
    users: [
      "username",
      "real_name",
      "role_names",
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
      "config_key",
      "config_value",
      "config_type",
      "description",
      "updated_at",
    ],
  };
  const visibleColumns = columns[tab] || [];
  const pagedRows =
    tab === "logs" ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
  const displayCell = (row: any, key: string) => {
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
              <th key={k}>{fieldLabel[k] || k}</th>
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

function AdminForm({ tab, editing, form, setForm, roles, close, save }: any) {
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
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    api("/reviews/history", {}, token)
      .then((x) => setRows(Array.isArray(x) ? x : x.items || []))
      .catch(() => setRows([]));
  }, [token]);
  return (
    <section className="panel">
      <h3>审核历史</h3>
      <table>
        <thead>
          <tr>
            <th>问答编号</th>
            <th>审核级别</th>
            <th>结果</th>
            <th>审核意见</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .slice((page - 1) * pageSize, page * pageSize)
            .map((r: any, i) => (
              <tr key={i}>
                <td>{r.qa_code || r.QA_CODE || r.qa_pair_id || "-"}</td>
                <td>第{r.level_no || r.level || r.LEVEL || "-"}级</td>
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
      <Pagination
        page={page}
        pageSize={pageSize}
        total={rows.length}
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
    [form, setForm] = useState<any>({}),
    [deleting, setDeleting] = useState<any>(null),
    [schemePage, setSchemePage] = useState(1),
    [fieldPage, setFieldPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const load = () =>
    api("/field-schemes", {}, token).then((x) => setSchemes(x || []));
  useEffect(() => {
    load();
  }, [token]);
  const openScheme = (scheme?: any) => {
    setDialog({ type: "scheme", item: scheme });
    setForm({
      code: scheme?.scheme_code || `CUSTOM-${Date.now()}`,
      name: scheme?.scheme_name || "",
      description: scheme?.description || "",
    });
  };
  const openField = (field?: any) => {
    setDialog({ type: "field", item: field });
    setForm({
      code: field?.field_code || `FIELD_${Date.now()}`,
      name: field?.field_name || "",
      type: field?.field_type || "TEXT",
      required: !!field?.required,
      listVisible: field ? !!field.list_visible : true,
      searchable: field ? !!field.searchable : true,
      sortOrder: Number(
        field?.sort_order || (selected?.fields?.length || 0) + 1,
      ),
      optionsJson: field?.options_json || "{}",
    });
  };
  const saveDialog = async () => {
    if (!form.code?.trim() || !form.name?.trim())
      return setMsg("编码和名称不能为空");
    try {
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
      setMsg(e.message || "保存失败");
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
  return (
    <section className="panel">
      <div className="toolbar">
        <h3>字段方案</h3>
        <button className="primary" onClick={() => openScheme()}>
          + 新建方案
        </button>
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
                {!x.is_default && (
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting({ type: "scheme", item: x });
                    }}
                  >
                    停用
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
          <h4>{selected.scheme_name} 字段配置</h4>
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
                    <td>
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
          close={() => setDialog(null)}
          save={saveDialog}
        />
      )}
      {deleting && (
        <div className="modal">
          <div className="modal-card confirm-card">
            <div className="confirm-icon">!</div>
            <h3>确认删除</h3>
            <p>
              确定删除“{deleting.item.field_name || deleting.item.scheme_name}
              ”��？删除后无法恢复。
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

function FieldSchemeDialog({ dialog, form, setForm, close, save }: any) {
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
          <label>
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
                  <option value="ENUM">枚举</option>
                  <option value="CASCADE">级联目录</option>
                  <option value="DATE">日期</option>
                  <option value="NUMBER">数字</option>
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
            </div>
            {["ENUM", "CASCADE"].includes(form.type) && (
              <label>
                选项配置（JSON）
                <textarea
                  rows={5}
                  value={form.optionsJson || "{}"}
                  onChange={(e) =>
                    setForm({ ...form, optionsJson: e.target.value })
                  }
                  placeholder='例如：{"options":["选项一","选项二"]}'
                />
              </label>
            )}
          </>
        )}
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
  const [flows, setFlows] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [id, setId] = useState(""),
    [rule, setRule] = useState("ALL"),
    [levels, setLevels] = useState(3),
    [names, setNames] = useState(["第1级审核", "第2级审核", "第3级审核"]),
    [msg, setMsg] = useState(""),
    [reviewers, setReviewers] = useState<string[][]>([[], [], []]);
  useEffect(() => {
    api("/admin/review-flows", {}, token)
      .then((x: any) => {
        setFlows(x || []);
        if (x?.[0]) {
          loadFlow(x[0].id);
        }
      })
      .catch(() => {});
    api("/admin/users", {}, token)
      .then((x: any) => setUsers(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, [token]);
  const loadFlow = (flowId: string) => {
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
        setNames(ns.map((n: any) => n.name));
        setReviewers(ns.map((n: any) => n.ids));
      })
      .catch(() => {});
  };
  const save = () => {
    if (!id) return;
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
      .then(() => setMsg("保存成功"))
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
            onChange={(e) => setLevels(Number(e.target.value))}
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
        <small>可按住 Command / Ctrl 选择多个审核人</small>
      </div>
      {names.slice(0, levels).map((n, i) => (
        <div className="flow-node" key={i}>
          <div className="flow-node-index">{i + 1}</div>
          <label>
            第{i + 1}级名称
            <input
              value={n}
              onChange={(e) =>
                setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
          </label>
          <label>
            第{i + 1}级审核人
            <select
              multiple
              value={reviewers[i] || []}
              onChange={(e) =>
                setReviewers((a) =>
                  a.map((x, j) =>
                    j === i
                      ? Array.from(e.target.selectedOptions).map((o) => o.value)
                      : x,
                  ),
                )
              }
            >
              {users
                .filter((u: any) => u.enabled !== 0)
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.real_name}（{u.username}）
                  </option>
                ))}
            </select>
          </label>
        </div>
      ))}
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
        <button className="primary" onClick={save}>
          保存配置
        </button>
      </div>
    </section>
  );
}
function CustomStats({ token }: { token: string }) {
  const [dimension, setDimension] = useState("status"),
    [metric, setMetric] = useState("count"),
    [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [msg, setMsg] = useState("");
  const run = () => {
    setLoading(true);
    api(
      "/statistics/custom",
      { method: "POST", body: JSON.stringify({ dimension, metric }) },
      token,
    )
      .then((x: any) => setRows(x.items || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(run, [dimension, metric]);
  return (
    <section className="panel">
      <div className="toolbar">
        <h3>自定义分析</h3>
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        >
          <option value="status">状态</option>
          <option value="domainL1">目录1</option>
          <option value="author">提交人</option>
        </select>
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="count">总数</option>
        </select>
        <button className="primary" onClick={run}>
          查询分析
        </button>
        <button
          onClick={async () => {
            const res = await fetch(
              API + `/statistics/custom/export?dimension=${dimension}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) {
              setMsg("导出失败，请稍后重试");
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "自定义分析.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出Excel
        </button>
      </div>
      {msg && (
        <div className="inline-notice">
          <span>{msg}</span>
          <button onClick={() => setMsg("")}>×</button>
        </div>
      )}
      {loading ? (
        <div className="loading">分析中…</div>
      ) : (
        <>
          <div className="analysis-bars">
            {rows.map((r: any) => (
              <div className="analysis-row" key={r.LABEL || r.label}>
                <span>
                  {statusLabel[r.LABEL || r.label] || r.LABEL || r.label}
                </span>
                <i
                  style={{
                    width: `${Math.min(100, (Number(r.COUNT || r.count) / Math.max(1, ...rows.map((x: any) => Number(x.COUNT || x.count)))) * 100)}%`,
                  }}
                />
                <b>{r.COUNT || r.count}</b>
              </div>
            ))}
          </div>
          {!rows.length && <div className="empty">暂无分析数据</div>}
        </>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
