import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type AppPhase = "checking" | "initializing" | "workspace" | "ready";

interface LogEntry {
  time: string;
  level: string;
  message: string;
  humanized?: string;
}

// Humanized log translation map (npm/node jargon → 人话)
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
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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
  const logRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (level: string, message: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const humanized = humanizeLog(message);
    setLogs((prev) => [...prev.slice(-300), { time, level, message, humanized }]);
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
    return () => {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, [running]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // On mount: check environment status
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
      (event) => {
        addLog(event.payload.level, event.payload.message);
      }
    );

    // Heartbeat: detect if service process crashed
    const unlistenHeartbeat = listen("service-heartbeat", async () => {
      try {
        const alive = await invoke<boolean>("is_service_running");
        if (!alive && running) {
          setRunning(false);
          addLog("error", "⚠️ OpenClaw 服务进程已意外退出");
        }
      } catch { /* ignore */ }
    });

    // Listen for dynamic port assignment
    const unlistenPort = listen<{ port: number }>(
      "service-port",
      (event) => {
        setServicePort(event.payload.port);
      }
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenLogs.then((fn) => fn());
      unlistenHeartbeat.then((fn) => fn());
      unlistenPort.then((fn) => fn());
    };
  }, []);

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
        }
      } else {
        setPhase("initializing");
        addLog("info", "首次启动，开始初始化环境...");
        await runSetup();
      }
    } catch (err) {
      addLog("error", `环境检查失败: ${err}`);
      setPhase("initializing");
      await runSetup();
    }
  };

  const runSetup = async () => {
    setLoading(true);
    try {
      await invoke("setup_openclaw");
      setPhase("ready");
      addLog("success", "🎉 OpenClaw 初始化完成！");
    } catch (err) {
      addLog("error", `初始化失败: ${err}`);
      setProgressMsg(`❌ 初始化失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: "选择你的工作区目录" });
    if (selected && typeof selected === "string") {
      setWorkspacePath(selected);
    }
  };

  const handleConfirmWorkspace = async () => {
    setLoading(true);
    try {
      // Inject config with workspace path (backend will use default if empty)
      await invoke("inject_default_config");
      await invoke("inject_default_models");
      addLog("success", `✅ 工作区已配置: ${workspacePath || "默认目录"}`);
      setPhase("ready");
    } catch (err) {
      addLog("error", `配置失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke("start_service");
      setRunning(true);
    } catch (err) {
      addLog("error", `启动失败: ${err}`);
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
      addLog("error", `停止失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = () => {
    if (loading) return "loading";
    if (running) return "running";
    if (phase !== "ready") return "loading";
    return "idle";
  };

  // ===== Init Screen =====
  if (phase === "checking" || phase === "initializing") {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <span className="header-logo">OpenClaw Launcher</span>
            <span className="header-version">v0.3.1</span>
          </div>
          <span className={`status-dot ${getStatusClass()}`} />
        </header>
        <div className="init-screen">
          <div className="init-title">
            {phase === "checking" ? "🔍 正在检查环境..." : "⚙️ 正在初始化 OpenClaw"}
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
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
        <header className="header">
          <div className="header-left">
            <span className="header-logo">OpenClaw Launcher</span>
            <span className="header-version">v0.3.1</span>
          </div>
        </header>
        <div className="init-screen">
          <div className="init-title">📂 选择工作区目录</div>
          <div className="init-message" style={{ maxWidth: 420, lineHeight: 1.8 }}>
            AI 会在这个文件夹里帮你写代码。你可以选择任意文件夹，或使用默认目录。
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <code className="workspace-path">
              {workspacePath || "~/Documents/OpenClaw-Projects (默认)"}
            </code>
            <button className="btn-quick" onClick={handleSelectFolder}>
              📁 浏览...
            </button>
          </div>
          <button
            className="btn-start start"
            onClick={handleConfirmWorkspace}
            disabled={loading}
            style={{ marginTop: 24 }}
          >
            ✅ 确认并继续
          </button>
        </div>
      </div>
    );
  }

  // ===== Main Dashboard =====
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">OpenClaw Launcher</span>
          <span className="header-version">v0.3.1</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {running ? "运行中" : "已停止"}
          </span>
          <span className={`status-dot ${getStatusClass()}`} />
        </div>
      </header>

      <div className="dashboard">
        {/* Status Cards */}
        <div className="status-cards">
          <div className={`status-card main-card ${running ? "active" : ""}`}>
            <div className="card-icon">{running ? "🟢" : "⚫"}</div>
            <div className="card-info">
              <div className="card-label">服务状态</div>
              <div className="card-value">{running ? "运行中" : "已停止"}</div>
            </div>
          </div>
          <div className="status-card">
            <div className="card-icon">⏱️</div>
            <div className="card-info">
              <div className="card-label">运行时长</div>
              <div className="card-value">{running ? formatUptime(uptime) : "--"}</div>
            </div>
          </div>
          <div className="status-card">
            <div className="card-icon">🌐</div>
            <div className="card-info">
              <div className="card-label">访问地址</div>
              <div className="card-value">{running ? `localhost:${servicePort}` : "--"}</div>
            </div>
          </div>
        </div>

        {/* Free model hint */}
        <div className="free-model-hint">
          💡 当前使用 OpenRouter 免费模型，回复可能较慢。配置自己的 API Key 可获得更快速度和更强模型。
        </div>

        {/* Controls */}
        <div className="control-panel">
          <button
            className={`btn-start ${running ? "stop" : "start"}`}
            onClick={running ? handleStop : handleStart}
            disabled={loading}
          >
            {loading ? "处理中..." : running ? "⏹ 停止服务" : "▶ 启动 OpenClaw"}
          </button>
          <div className="quick-actions">
            <button
              className="btn-quick"
              onClick={() => window.open(`http://localhost:${servicePort}`, "_blank")}
              disabled={!running}
            >
              🌐 打开网页端
            </button>
          </div>
        </div>

        {/* Log Panel */}
        <div className="log-panel">
          <div className="log-header">
            <span>📋 运行日志</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="log-toggle">
                <input
                  type="checkbox"
                  checked={showRawLogs}
                  onChange={(e) => setShowRawLogs(e.target.checked)}
                />
                <span>原始日志</span>
              </label>
              <span>{logs.length} 条</span>
            </div>
          </div>
          <div className="log-content" ref={logRef}>
            {logs.length === 0 ? (
              <div className="log-empty">暂无日志 — 点击「启动 OpenClaw」开始</div>
            ) : (
              logs.map((log, i) => {
                const displayMsg = !showRawLogs && log.humanized ? log.humanized : log.message;
                return (
                  <div className="log-line" key={i}>
                    <span className="log-time">{log.time}</span>
                    <span className={`log-msg ${log.level}`}>{displayMsg}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
