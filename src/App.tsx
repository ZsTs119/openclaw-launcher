import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Activity, Cpu, SlidersHorizontal, Settings as SettingsIcon, Hexagon, Box, Github, RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

// ===== Types =====
type AppPhase = "checking" | "initializing" | "workspace" | "ready";
type TabId = "dashboard" | "models" | "settings";

interface LogEntry {
  time: string;
  level: string;
  message: string;
  humanized?: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  category: string;
  base_url: string;
  register_url: string;
  description: string;
  models: ModelInfo[];
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  is_free: boolean;
}

interface CurrentConfig {
  has_api_key: boolean;
  provider: string | null;
  model: string | null;
  base_url: string | null;
}

// ===== Log humanization =====
const LOG_TRANSLATIONS: [RegExp, string][] = [
  [/npm warn/i, "⚠️ 依赖警告（可忽略）"],
  [/npm error/i, "❌ 依赖安装出错"],
  [/added \d+ packages/i, "✅ 依赖包安装完成"],
  [/listening on.*:?(\d+)/i, "✅ 服务已就绪，端口已打开"],
  [/server (is )?running/i, "✅ 服务正在运行"],
  [/EADDRINUSE/i, "❌ 端口被占用，请关闭占用程序后重试"],
  [/ECONNREFUSED/i, "❌ 连接被拒绝，检查网络设置"],
  [/ENOTFOUND/i, "❌ 域名解析失败，检查网络连接"],
  [/compiling/i, "⚙️ 正在编译..."],
  [/deprecated/i, "ℹ️ 有过时的依赖（不影响使用）"],
  [/ready in/i, "✅ 启动完成！"],
];

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[[\d;]*m/g, "");
}

function humanizeLog(msg: string): string | undefined {
  for (const [pattern, translation] of LOG_TRANSLATIONS) {
    if (pattern.test(msg)) return translation;
  }
  return undefined;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s} s`;
  if (m > 0) return `${m}m ${s} s`;
  return `${s} s`;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  free: { label: "免费注册", icon: "🆓" },
  provider: { label: "Coding Plan", icon: "💳" },
  custom: { label: "自定义中转站", icon: "🔧" },
};

// ===== App =====
function App() {
  const [phase, setPhase] = useState<AppPhase>("checking");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("正在检查环境...");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [servicePort, setServicePort] = useState(18789);
  const [workspacePath, setWorkspacePath] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"general" | "logs" | "about">("general");
  const logRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Model/Config state
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("free");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configStatus, setConfigStatus] = useState("");
  const [currentConfig, setCurrentConfig] = useState<CurrentConfig | null>(null);

  // Mandatory API Key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showModelSwitchModal, setShowModelSwitchModal] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState("");

  const addLog = (level: string, message: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")} `;
    const cleanMsg = stripAnsi(message);
    const humanized = humanizeLog(cleanMsg);
    setLogs((prev) => [...prev.slice(-300), { time, level, message: cleanMsg, humanized }]);
  };

  // Uptime counter
  useEffect(() => {
    if (running) {
      setUptime(0);
      uptimeRef.current = setInterval(() => setUptime((u) => u + 1), 1000);
    } else {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
      setUptime(0);
    }
    return () => { if (uptimeRef.current) clearInterval(uptimeRef.current); };
  }, [running]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Load providers on mount
  useEffect(() => {
    invoke<ProviderInfo[]>("get_providers").then(setProviders).catch(() => { });
  }, []);

  // On mount: check environment
  useEffect(() => {
    checkEnvironment();

    const unlistenProgress = listen<{ stage: string; message: string; percent: number }>(
      "setup-progress",
      (event) => {
        setProgress(event.payload.percent);
        setProgressMsg(event.payload.message);
        addLog("info", event.payload.message);
      }
    );

    const unlistenLogs = listen<{ level: string; message: string }>(
      "service-log",
      (event) => addLog(event.payload.level, event.payload.message)
    );

    const unlistenHeartbeat = listen("service-heartbeat", async () => {
      try {
        const alive = await invoke<boolean>("is_service_running");
        if (!alive && running) {
          setRunning(false);
          addLog("error", "⚠️ OpenClaw 服务进程已意外退出");
        }
      } catch { /* ignore */ }
    });

    const unlistenPort = listen<{ port: number }>(
      "service-port",
      (event) => setServicePort(event.payload.port)
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenLogs.then((fn) => fn());
      unlistenHeartbeat.then((fn) => fn());
      unlistenPort.then((fn) => fn());
    };
  }, []);

  // ===== Actions =====
  const checkEnvironment = async () => {
    try {
      const nodeOk = await invoke<boolean>("check_node_exists");
      const openclawOk = await invoke<boolean>("check_openclaw_exists");
      const modulesOk = await invoke<boolean>("check_node_modules_exists");
      const serviceRunning = await invoke<boolean>("is_service_running");

      if (nodeOk && openclawOk && modulesOk) {
        const configOk = await invoke<boolean>("check_config_exists");
        if (!configOk) {
          setPhase("workspace");
          addLog("info", "首次使用，请选择工作区目录");
        } else {
          setPhase("ready");
          setRunning(serviceRunning);
          addLog("success", "✅ 环境检查通过，所有组件就绪");
          // Check if API key is configured
          await checkApiKey();
        }
      } else {
        setPhase("initializing");
        addLog("info", "首次启动，开始初始化环境...");
        await runSetup();
      }
    } catch (err) {
      addLog("error", `环境检查失败: ${err} `);
      setPhase("initializing");
      await runSetup();
    }
  };

  const checkApiKey = async () => {
    try {
      const config = await invoke<CurrentConfig>("get_current_config");
      setCurrentConfig(config);
      if (!config.has_api_key) {
        // No API key configured — force the modal
        setShowKeyModal(true);
      }
    } catch {
      // Can't determine — show modal to be safe
      setShowKeyModal(true);
    }
  };

  const runSetup = async () => {
    setLoading(true);
    try {
      await invoke("setup_openclaw");
      setPhase("ready");
      addLog("success", "🎉 OpenClaw 初始化完成！");
      // After setup, check API key
      await checkApiKey();
    } catch (err) {
      addLog("error", `初始化失败: ${err} `);
      setProgressMsg(`❌ 初始化失败: ${err} `);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: "选择你的工作区目录" });
    if (selected && typeof selected === "string") setWorkspacePath(selected);
  };

  const handleConfirmWorkspace = async () => {
    setLoading(true);
    try {
      await invoke("inject_default_config");
      await invoke("inject_default_models");
      addLog("success", `✅ 工作区已配置: ${workspacePath || "默认目录"} `);
      setPhase("ready");
      // Check API key after workspace is set
      await checkApiKey();
    } catch (err) {
      addLog("error", `配置失败: ${err} `);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchWorkspace = async () => {
    const selected = await open({ directory: true, multiple: false, title: "切换工作区目录" });
    if (selected && typeof selected === "string") {
      setWorkspacePath(selected);
      setLoading(true);
      try {
        await invoke("inject_default_config");
        addLog("success", `✅ 工作区已切换到: ${selected} `);
      } catch (err) {
        addLog("error", `切换失败: ${err} `);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke("start_service");
      setRunning(true);
    } catch (err) {
      addLog("error", `启动失败: ${err} `);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke("stop_service");
      setRunning(false);
    } catch (err) {
      addLog("error", `停止失败: ${err} `);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!apiKeyInput.trim()) { setConfigStatus("❌ 请输入 API Key"); return; }
    setConfigSaving(true);
    setConfigStatus("");
    try {
      const result = await invoke<string>("save_api_config", {
        provider: selectedProvider || "custom",
        apiKey: apiKeyInput,
        baseUrl: baseUrlInput || null,
        model: selectedModel || null,
      });
      setConfigStatus(result);
      addLog("success", result);
      // Update config state and close modal
      setCurrentConfig({ has_api_key: true, provider: selectedProvider, model: selectedModel, base_url: baseUrlInput || null });
      setShowKeyModal(false);

      // Auto-restart service if running, so new config takes effect
      if (running) {
        addLog("info", "🔄 正在重启服务以加载新配置...");
        try {
          await invoke("stop_service");
          setRunning(false);
          await new Promise(r => setTimeout(r, 1000)); // brief pause
          await invoke("start_service");
          setRunning(true);
          addLog("success", "✅ 服务已重启，新配置生效");
        } catch (err) {
          addLog("error", `重启服务失败: ${err} `);
        }
      }
    } catch (err) {
      setConfigStatus(`❌ 保存失败: ${err} `);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSetModel = async (modelId: string) => {
    try {
      const result = await invoke<string>("set_default_model", { modelId });
      setSelectedModel(modelId);
      setConfigStatus(result);
      addLog("success", result);
      if (currentConfig) setCurrentConfig({ ...currentConfig, model: modelId });
    } catch (err) {
      setConfigStatus(`❌ 切换失败: ${err} `);
    }
  };

  const handleOpenRegister = async (providerId: string) => {
    try { await invoke("open_provider_register", { providerId }); } catch { /* */ }
  };

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    setShowResetModal(false);
    try {
      const result = await invoke<string>("reset_config");
      setCurrentConfig({ has_api_key: false, provider: null, model: null, base_url: null });
      setApiKeyInput("");
      setSelectedProvider("");
      setSelectedModel("");
      setBaseUrlInput("");
      setConfigStatus("");
      addLog("success", result);
      setShowKeyModal(true);
    } catch (err) {
      addLog("error", `重置失败: ${err}`);
    }
  };

  const getStatusClass = () => {
    if (loading) return "loading";
    if (running) return "running";
    if (phase !== "ready") return "loading";
    return "idle";
  };

  const filteredProviders = providers.filter((p) => p.category === selectedCategory);

  // Find display names for current config
  const currentProviderName = currentConfig?.provider
    ? providers.find(p => p.id === currentConfig.provider)?.name || (currentConfig.provider === "custom" ? "自定义中转站" : currentConfig.provider)
    : (currentConfig?.has_api_key ? "自定义" : "未配置");
  const currentModelName = currentConfig?.model || "未选择";

  // ===== Init Screen =====
  if (phase === "checking" || phase === "initializing") {
    return (
      <div className="app">
        <Header running={false} phase={phase} statusClass={getStatusClass()} />
        <div className="init-screen">
          <div className="init-title">
            {phase === "checking" ? "🔍 正在检查环境..." : "⚙️ 正在初始化 OpenClaw"}
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}% ` }} />
          </div>
          <div className="init-message">{progressMsg}</div>
        </div>
      </div>
    );
  }

  // ===== Workspace Wizard =====
  if (phase === "workspace") {
    return (
      <div className="app">
        <Header running={false} phase={phase} statusClass={getStatusClass()} />
        <div className="init-screen">
          <div className="init-title">📂 选择工作区目录</div>
          <div className="init-message" style={{ maxWidth: 420, lineHeight: 1.8 }}>
            AI 会在这个文件夹里帮你写代码。你可以选择任意文件夹，或使用默认目录。
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <code className="workspace-path">
              {workspacePath || "~/Documents/OpenClaw-Projects (默认)"}
            </code>
            <button className="btn-quick" onClick={handleSelectFolder}>📁 浏览...</button>
          </div>
          <button className="btn-start start" onClick={handleConfirmWorkspace} disabled={loading} style={{ marginTop: 24 }}>
            ✅ 确认并继续
          </button>
        </div>
      </div>
    );
  }

  // ===== Mandatory API Key Modal =====
  const renderKeyModal = () => {
    if (!showKeyModal) return null;

    // If opened from Models tab with a pre-selected provider, skip the grid selection
    const isDirectConfig = activeTab === "models" && selectedProvider && selectedCategory !== "custom";

    return (
      <div className="modal-overlay" onClick={() => { if (currentConfig?.has_api_key) setShowKeyModal(false); }}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">
            {isDirectConfig ? `配置 ${providers.find(p => p.id === selectedProvider)?.name}` : "🔑 配置 AI 模型 API Key"}
          </div>
          {!isDirectConfig && (
            <div className="modal-desc">
              使用 OpenClaw 需要配置一个 API Key。推荐选择免费注册的提供商，无需付费。
            </div>
          )}

          {/* Category tabs (Hide if direct config) */}
          {!isDirectConfig && (
            <div className="category-tabs" style={{ marginBottom: 16 }}>
              {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  className={`category-btn ${selectedCategory === key ? "active" : ""}`}
                  onClick={() => { setSelectedCategory(key); setSelectedProvider(""); setConfigStatus(""); }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === "custom" ? (
            <div className="modal-form animate-fade-in">
              <div className="form-group">
                <label>API Base URL</label>
                <input type="url" placeholder="https://your-relay.com/v1" value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)} className="input-field" />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input type="password" placeholder="sk-..." value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)} className="input-field" />
              </div>
              <div className="form-group">
                <label>模型 ID（可选）</label>
                <input type="text" placeholder="gpt-4o / deepseek-chat / ..." value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)} className="input-field" />
              </div>
            </div>
          ) : (
            <>
              {/* Provider List (Hide if direct config) */}
              {!isDirectConfig && (
                <div className="provider-list modal-providers animate-fade-in">
                  {filteredProviders.map((p) => (
                    <div
                      key={p.id}
                      className={`provider-card ${selectedProvider === p.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedProvider(p.id);
                        setBaseUrlInput(p.base_url);
                        setSelectedModel(p.models[0]?.id || "");
                        setConfigStatus("");
                      }}
                    >
                      <div className="provider-header">
                        <span className="provider-name">{p.name}</span>
                        {p.category === "free" && <span className="badge-free">免费</span>}
                      </div>
                      <p className="provider-desc">{p.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Config Form for selected provider */}
              {selectedProvider && (
                <div className="modal-form animate-fade-in" style={{ marginTop: isDirectConfig ? 0 : 16 }}>
                  <div className="form-group-row" style={{ marginBottom: 12 }}>
                    <button className="btn-link" onClick={() => handleOpenRegister(selectedProvider)}>
                      🔗 {selectedCategory === "free" ? "点击此处注册获取免费 API Key →" : "前往官网获取 API Key →"}
                    </button>
                  </div>
                  <div className="form-group">
                    <label>粘贴 API Key</label>
                    <input type="password" placeholder="粘贴你的 API Key..." value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>选择验证模型</label>
                    <div className="model-select-list">
                      {providers.find(p => p.id === selectedProvider)?.models.map((m) => (
                        <button key={m.id}
                          className={`model-select-btn ${selectedModel === m.id ? "active" : ""}`}
                          onClick={() => setSelectedModel(m.id)}
                        >
                          {m.name}
                          {m.is_free && <span className="badge-free-sm">免费</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <button className="btn-start start modal-save"
            onClick={handleSaveConfig} disabled={configSaving || !apiKeyInput.trim()}>
            {configSaving ? "保存中..." : "✅ 保存并开始使用"}
          </button>
          {configStatus && <div className="config-status">{configStatus}</div>}
        </div>
      </div>
    );
  };

  // ===== Main App with Tabs =====
  return (
    <div className="app">
      <Header running={running} phase={phase} statusClass={getStatusClass()} />

      {/* Tab Navigation (Premium Navbar) */}
      <nav className="tab-nav">
        {([
          { id: "dashboard" as TabId, label: "仪表盘", icon: <Activity size={18} strokeWidth={1.5} /> },
          { id: "models" as TabId, label: "AI 引擎", icon: <Cpu size={18} strokeWidth={1.5} /> },
          { id: "settings" as TabId, label: "设置中心", icon: <SlidersHorizontal size={18} strokeWidth={1.5} /> },
        ]).map((tab) => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {/* ===== Dashboard Tab ===== */}
        {activeTab === "dashboard" && (
          <div className="dashboard">
            <div className="dashboard-hero">
              <div className={`status-ring ${running ? 'running' : 'stopped'}`}>
                {running ? <Activity size={42} strokeWidth={1.5} color="var(--accent-green)" /> : <Box size={42} strokeWidth={1.5} color="var(--text-muted)" />}
              </div>
              <h2 className="hero-status-text">
                {running ? "OpenClaw 核心运行中" : "引擎已就绪"}
              </h2>
              <div className="hero-subtext">
                {running ? `本地接口已挂载至 localhost:${servicePort}` : "点击下方按钮启动本地 AI 驱动核心"}
              </div>

              <div className="hero-controls">
                <button className={`btn-primary btn-hero ${running ? "stop" : "start"}`}
                  onClick={running ? handleStop : handleStart} disabled={loading}>
                  {loading ? <RefreshCw className="spin" size={18} /> : (running ? "⏹ 中断服务" : "▶ 初始化并启动")}
                </button>
                {running && (
                  <button className="btn-secondary btn-hero-sub animate-fade-in"
                    onClick={() => invoke("open_url", { url: `http://localhost:${servicePort}?token=openclaw-launcher-local` })}>
                    <Activity size={16} strokeWidth={2} /> 访问控制台
                  </button>
                )}
              </div>
            </div>

            <div className="dashboard-stats">
              <div className="stat-card" onClick={() => setShowModelSwitchModal(true)} style={{ cursor: 'pointer' }} title="点击切换模型">
                <div className="stat-icon"><Cpu size={16} strokeWidth={2} /></div>
                <div className="stat-details">
                  <div className="stat-label">驱动模型 (点击切换)</div>
                  <div className="stat-value">{currentModelName}</div>
                </div>
              </div>

              <div className="stat-card" onClick={() => setShowKeyModal(true)} style={{ cursor: 'pointer' }} title="点击配置 API">
                <div className="stat-icon"><Hexagon size={16} strokeWidth={2} /></div>
                <div className="stat-details">
                  <div className="stat-label">计算节点 (提供商)</div>
                  <div className="stat-value">{currentProviderName}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Activity size={16} strokeWidth={2} /></div>
                <div className="stat-details">
                  <div className="stat-label">连续运行时长</div>
                  <div className="stat-value">{running ? formatUptime(uptime) : "休眠中"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Models Tab ===== */}
        {
          activeTab === "models" && (
            <div className="models-page">
              <h2 className="page-title">🤖 模型配置</h2>
              <p className="page-desc">选择 AI 模型提供商，配置 API Key 后即可开始使用。</p>

              <div className="category-tabs" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
                  <button key={key}
                    className={`category-btn ${selectedCategory === key ? "active" : ""}`}
                    onClick={() => { setSelectedCategory(key); setSelectedProvider(""); setConfigStatus(""); }}>
                    {icon} {label}
                  </button>
                ))}
              </div>

              {selectedCategory === "custom" ? (
                <div className="custom-config animate-fade-in" style={{ maxWidth: 500, margin: '0 auto' }}>
                  <div className="form-group">
                    <label>API Base URL</label>
                    <input type="url" placeholder="https://your-relay.com/v1" value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>API Key</label>
                    <input type="password" placeholder="sk-..." value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>模型 ID（可选）</label>
                    <input type="text" placeholder="gpt-4o / deepseek-chat / ..." value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)} className="input-field" />
                  </div>
                  <button className="btn-primary" style={{ width: '100%', marginTop: 16, padding: '12px' }} onClick={handleSaveConfig} disabled={configSaving}>
                    {configSaving ? "保存中..." : "💾 保存配置"}
                  </button>
                  {configStatus && <div className="config-status" style={{ marginTop: 12 }}>{configStatus}</div>}
                </div>
              ) : (
                <div className="provider-list animate-fade-in">
                  {filteredProviders.map((p) => (
                    <div key={p.id}
                      className={`provider-card ${currentConfig?.provider === p.id ? "active-provider" : ""}`}
                      onClick={() => {
                        setSelectedProvider(p.id);
                        setBaseUrlInput(p.base_url);
                        setSelectedModel(p.models[0]?.id || "");
                        setConfigStatus("");
                        setShowKeyModal(true);
                      }}>
                      <div className="provider-header">
                        <span className="provider-name">{p.name} <span style={{ fontSize: 12, fontWeight: 'normal', color: 'var(--text-muted)' }}>{currentConfig?.provider === p.id ? " (当前使用)" : ""}</span></span>
                        {p.category === "free" && <span className="badge-free">免费</span>}
                      </div>
                      <p className="provider-desc">{p.description}</p>
                      <div className="provider-models">
                        {p.models.slice(0, 3).map((m) => (
                          <span key={m.id} className="model-tag">{m.name}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        {/* ===== Settings Tab ===== */}
        {
          activeTab === "settings" && (
            <div className="settings-page">
              <div className="settings-sidebar">
                <h2 className="sidebar-title">设置中心</h2>
                <nav className="sidebar-nav">
                  <button className={`sidebar-btn ${activeSettingsTab === "general" ? "active" : ""}`} onClick={() => setActiveSettingsTab("general")}>
                    <SettingsIcon size={16} strokeWidth={1.5} /> 通用
                  </button>
                  <button className={`sidebar-btn ${activeSettingsTab === "logs" ? "active" : ""}`} onClick={() => setActiveSettingsTab("logs")}>
                    <Box size={16} strokeWidth={1.5} /> 日志诊断
                  </button>
                  <button className={`sidebar-btn ${activeSettingsTab === "about" ? "active" : ""}`} onClick={() => setActiveSettingsTab("about")}>
                    <Hexagon size={16} strokeWidth={1.5} /> 关于
                  </button>
                </nav>
              </div>

              <div className="settings-content-area">
                {activeSettingsTab === "general" && (
                  <div className="settings-group animate-fade-in">
                    <h3 className="settings-section-title">🎛️ 通用设置</h3>
                    <div className="setting-item">
                      <div className="setting-left">
                        <div className="setting-label">工作区目录</div>
                        <div className="setting-value" style={{ fontSize: 13, userSelect: 'text' }}>
                          {workspacePath || "~/Documents/OpenClaw-Projects"}
                        </div>
                      </div>
                      <button className="btn-secondary" onClick={handleSwitchWorkspace}>📂 更改</button>
                    </div>

                    <div className="setting-item">
                      <div className="setting-left">
                        <div className="setting-label">服务端口</div>
                        <div className="setting-value">{servicePort}</div>
                      </div>
                    </div>

                    <div className="setting-item">
                      <div className="setting-left">
                        <div className="setting-label">API Key 状态</div>
                        <div className="setting-value">
                          {currentConfig?.has_api_key ? "✅ 已配置" : "❌ 未配置"}
                        </div>
                      </div>
                      <button className="btn-secondary" onClick={() => setShowKeyModal(true)}>🔑 生命周期重配</button>
                    </div>

                    <div className="setting-item setting-danger" style={{ marginTop: 24 }}>
                      <div className="setting-left">
                        <div className="setting-label" style={{ color: 'var(--accent-red)' }}>恢复出厂设置</div>
                        <div className="setting-value" style={{ fontSize: 12 }}>
                          抹除 openclaw.json 与 API Key 等敏感信息，回到纯净状态
                        </div>
                      </div>
                      <button className="btn-danger" onClick={handleReset}>🗑️ 擦除数据</button>
                    </div>
                  </div>
                )}

                {activeSettingsTab === "logs" && (
                  <div className="settings-group animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 className="settings-section-title" style={{ margin: 0 }}>📄 日志诊断</h3>
                      <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 13 }}>
                        📦 导出诊断 ZIP
                      </button>
                    </div>
                    <div className="log-panel" style={{ height: 380, borderRadius: 'var(--radius)' }}>
                      <div className="log-header" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                          <label className="log-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={showRawLogs} onChange={(e) => setShowRawLogs(e.target.checked)} />
                            <span>显示原始日志流</span>
                          </label>
                        </div>
                      </div>
                      <div className="log-content full-height" ref={logRef} style={{ padding: 12, fontSize: 12 }}>
                        {logs.length === 0 ? (
                          <div className="log-empty">暂无活动日志</div>
                        ) : (
                          logs.slice(-20).map((log, i) => { // Only show latest 20 to keep it slick
                            const displayMsg = !showRawLogs && log.humanized ? log.humanized : log.message;
                            return (
                              <div className="log-line" key={i}>
                                <span className="log-time" style={{ opacity: 0.5 }}>{log.time}</span>
                                <span className={`log-msg ${log.level}`}>{displayMsg}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === "about" && (
                  <div className="settings-group animate-fade-in about-section">
                    <div className="about-hero">
                      <div className="about-logo">OpenClaw</div>
                      <div className="about-title">新一代 AI 本地驱动核心</div>
                      <div className="about-version-card">
                        <span>当前版本 v0.3.1</span>
                        <button className="btn-ghost" title="检查更新">
                          <RefreshCw size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <div className="about-links">
                      <button className="about-link-card" onClick={() => invoke("open_url", { url: "https://github.com/ZsTs119/openclaw-launcher" })}>
                        <Github size={18} strokeWidth={1.5} />
                        <div className="link-text">查看 GitHub 源码</div>
                      </button>
                      <button className="about-link-card" onClick={() => setInfoModalTitle("💬 关注微信公众号 / 加入交流群")}>
                        <span style={{ fontSize: 18 }}>💬</span>
                        <div className="link-text">加入交流群 / 联系作者</div>
                      </button>
                      <button className="about-link-card" onClick={() => setInfoModalTitle("☕ 赞赏与支持")}>
                        <span style={{ fontSize: 18 }}>☕</span>
                        <div className="link-text">赞赏与支持项目发展</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }
      </div >

      {/* Generic Info / QR Code Modal */}
      {infoModalTitle && (
        <div className="modal-overlay" onClick={() => setInfoModalTitle("")}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{infoModalTitle}</div>
            <div className="modal-desc" style={{ marginTop: 16, marginBottom: 24, padding: 32, background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
              <div style={{ color: 'var(--text-muted)' }}>[ 二维码图片占位符 ]</div>
              <div style={{ fontSize: 12, marginTop: 12 }}>请在 assets 文件夹替换为你个人的二维码图片</div>
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setInfoModalTitle("")}>关闭</button>
          </div>
        </div>
      )}

      {/* Model Switch Modal */}
      {showModelSwitchModal && (
        <div className="modal-overlay" onClick={() => setShowModelSwitchModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🔄 切换模型</div>
            <div className="modal-desc">选择要使用的 AI 模型</div>
            {currentConfig?.provider ? (
              <div className="model-switch-list" style={{ marginTop: 12 }}>
                {providers.find(p => p.id === currentConfig.provider)?.models.map((m) => (
                  <button
                    key={m.id}
                    className={`model-switch-item ${currentConfig.model?.endsWith(m.id) ? "active" : ""}`}
                    onClick={async () => {
                      const fullModelId = `${currentConfig.provider}/${m.id}`;
                      await handleSetModel(fullModelId);
                      setShowModelSwitchModal(false);
                    }}
                  >
                    <span className="model-switch-name">{m.name}</span>
                    {currentConfig.model?.endsWith(m.id) && <span className="model-switch-badge">当前</span>}
                  </button>
                )) || <div style={{ color: "var(--text-secondary)" }}>暂无可用模型</div>}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", marginTop: 12 }}>
                请先在「模型」标签页配置 API 提供商
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowModelSwitchModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-title">⚠️ 重置配置</div>
            <div className="modal-desc" style={{ textAlign: "left" }}>
              <p style={{ marginBottom: 12 }}>仅重置 API Key 和模型配置（openclaw.json 中的 models/agents 部分）。</p>
              <p style={{ color: "var(--accent-green)", marginBottom: 4 }}>✅ 不会删除：</p>
              <ul style={{ paddingLeft: 20, marginBottom: 12, color: "var(--text-secondary)" }}>
                <li>对话历史和记忆</li>
                <li>Agent 技能和书签</li>
                <li>工作区文件</li>
              </ul>
              <p style={{ color: "var(--accent-red)", marginBottom: 4 }}>🗑️ 将清除：</p>
              <ul style={{ paddingLeft: 20, color: "var(--text-secondary)" }}>
                <li>API Key 配置</li>
                <li>模型选择和默认模型</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowResetModal(false)}>取消</button>
              <button className="btn-danger" onClick={confirmReset}>确认重置</button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory API Key Modal (renders on top of everything) */}
      {renderKeyModal()}
    </div >
  );
}

// ===== Header Component =====
function Header({ running, phase, statusClass }: {
  running: boolean; phase: string; statusClass: string;
}) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">OpenClaw Launcher</span>
        <span className="header-version">v0.3.1</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {phase === "ready" && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {running ? "运行中" : "已停止"}
          </span>
        )}
        <span className={`status-dot ${statusClass}`} />
      </div>
    </header>
  );
}

export default App;
