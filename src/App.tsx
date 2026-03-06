import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

type AppPhase = "checking" | "initializing" | "ready";

interface LogEntry {
  time: string;
  level: string;
  message: string;
}

function App() {
  const [phase, setPhase] = useState<AppPhase>("checking");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("正在检查环境...");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (level: string, message: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    setLogs((prev) => [...prev.slice(-200), { time, level, message }]);
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // On mount: check environment status
  useEffect(() => {
    checkEnvironment();

    // Listen for setup progress events
    const unlistenProgress = listen<{ stage: string; message: string; percent: number }>(
      "setup-progress",
      (event) => {
        setProgress(event.payload.percent);
        setProgressMsg(event.payload.message);
        addLog("info", event.payload.message);
      }
    );

    // Listen for service log events
    const unlistenLogs = listen<{ level: string; message: string }>(
      "service-log",
      (event) => {
        addLog(event.payload.level, event.payload.message);
      }
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenLogs.then((fn) => fn());
    };
  }, []);

  const checkEnvironment = async () => {
    try {
      const nodeOk = await invoke<boolean>("check_node_exists");
      const openclawOk = await invoke<boolean>("check_openclaw_exists");
      const modulesOk = await invoke<boolean>("check_node_modules_exists");
      const serviceRunning = await invoke<boolean>("is_service_running");

      if (nodeOk && openclawOk && modulesOk) {
        setPhase("ready");
        setRunning(serviceRunning);
        addLog("success", "✅ 环境检查通过，所有组件就绪");
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
            <span className="header-version">v0.1.0</span>
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

  // ===== Main Dashboard =====
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">OpenClaw Launcher</span>
          <span className="header-version">v0.1.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {running ? "运行中" : "已停止"}
          </span>
          <span className={`status-dot ${getStatusClass()}`} />
        </div>
      </header>

      <div className="dashboard">
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
              onClick={() => window.open("http://localhost:3000", "_blank")}
              disabled={!running}
            >
              🌐 打开网页端
            </button>
          </div>
        </div>

        <div className="log-panel">
          <div className="log-header">
            <span>📋 运行日志</span>
            <span>{logs.length} 条记录</span>
          </div>
          <div className="log-content" ref={logRef}>
            {logs.length === 0 ? (
              <div className="log-empty">暂无日志 — 点击「启动 OpenClaw」开始</div>
            ) : (
              logs.map((log, i) => (
                <div className="log-line" key={i}>
                  <span className="log-time">{log.time}</span>
                  <span className={`log-msg ${log.level}`}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
