// Copyright (C) 2026 ZsTs119
// SPDX-License-Identifier: GPL-3.0-only
// This file is part of OpenClaw Launcher. See LICENSE for details.
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { Activity, SlidersHorizontal, Network, Bot, BarChart3 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import "./App.css";
import qrWechat from "./assets/qr-wechat.jpg";
import qrAlipay from "./assets/qr-alipay.jpg";

// ===== Extracted modules =====
import type { TabId } from "./types";
import { Modal } from "./components/ui/Modal";
import { Header } from "./components/Header";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { SetupWizard } from "./components/SetupWizard";
import { DashboardTab } from "./components/DashboardTab";
import { ModelsTab } from "./components/ModelsTab";
import { AgentsTab } from "./components/AgentsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ModelSwitchModal } from "./components/ModelSwitchModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { RepairToast } from "./components/RepairToast";
import { StartupOverlay } from "./components/StartupOverlay";
import { useLogs } from "./hooks/useLogs";
import { useConfig } from "./hooks/useConfig";
import { useSetup } from "./hooks/useSetup";
import { useService } from "./hooks/useService";

// ===== App =====
function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"general" | "logs" | "about">("general");
  const [running, setRunning] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ title: string; msg: string; url?: string } | null>(null);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const updateChecked = useRef(false);

  // Load version from tauri.conf.json (single source of truth)
  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => { });
  }, []);

  // === Hooks ===
  const {
    logs,
    repairToast, setRepairToast,
    logRef, addLog,
  } = useLogs();

  const {
    providers, selectedCategory, setSelectedCategory,
    selectedProvider, setSelectedProvider,
    apiKeyInput, setApiKeyInput, baseUrlInput, setBaseUrlInput,
    selectedModel, setSelectedModel,
    configSaving, setConfigStatus,
    currentConfig, filteredProviders,
    showKeyModal, setShowKeyModal, showResetModal, setShowResetModal,
    showReinstallModal, setShowReinstallModal,
    showModelSwitchModal, setShowModelSwitchModal,
    infoModalTitle, setInfoModalTitle,
    checkApiKey, handleSaveConfig, handleSetModel, handleOpenRegister,
    handleReset, confirmReset, handleReinstall,
    configVersion, resetModalState,
  } = useConfig({ addLog, running, setRunning });

  const {
    phase, setPhase,
    loading: setupLoading,
    progress, setProgress,
    progressMsg, setProgressMsg,
    workspacePath,
    setupError, clearSetupError, retrySetup,
    handleSelectFolder, handleConfirmWorkspace, handleSwitchWorkspace,
  } = useSetup({ addLog, checkApiKey, setRunning });

  const {
    loading: serviceLoading, startingUp,
    uptime, servicePort,
    reinstalling, repairing,
    handleStart, handleStop,
    confirmReinstall, handleRepairConnection,
  } = useService({
    addLog, checkApiKey, setRepairToast, setShowReinstallModal,
    running, setRunning,
    setPhase, setProgress, setProgressMsg,
  });

  // Combined loading state: either hook might be loading
  const loading = setupLoading || serviceLoading;

  // ===== Startup update check (runs once when phase becomes ready) =====
  useEffect(() => {
    if (phase !== "ready" || updateChecked.current || appVersion === "0.0.0") return;
    updateChecked.current = true;
    (async () => {
      try {
        const res = await fetch('https://api.github.com/repos/ZsTs119/openclaw-launcher/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const rawTag = data.tag_name || '';
        const isSemver = /^v?\d+\.\d+\.\d+$/.test(rawTag);
        const latestVersion = rawTag.replace(/^v/, '');
        if (isSemver && latestVersion !== appVersion) {
          setFeedbackModal({
            title: '发现更新',
            msg: `发现新版本 v${latestVersion}！\n当前版本 v${appVersion}`,
            url: data.html_url || 'https://github.com/ZsTs119/openclaw-launcher/releases',
          });
        }
      } catch {
        // Silently ignore network errors
      }
    })();
  }, [phase, appVersion]);

  // ===== Tray restart-service listener =====
  useEffect(() => {
    const unlisten = listen('tray-restart-service', async () => {
      try {
        if (running) {
          await handleStop();
          await new Promise(r => setTimeout(r, 1000));
        }
        await handleStart();
      } catch (err) {
        addLog('error', `托盘重启服务失败: ${err}`);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [running, handleStop, handleStart]);

  const getStatusClass = () => {
    if (loading) return "loading";
    if (running) return "running";
    if (phase !== "ready") return "loading";
    return "idle";
  };

  // Find display names for current config
  const currentProviderName = currentConfig?.provider
    ? providers.find(p => p.id === currentConfig.provider)?.name || (currentConfig.provider === "custom" ? "自定义中转站" : currentConfig.provider)
    : (currentConfig?.has_api_key ? "自定义" : "未配置");
  const currentModelName = currentConfig?.model || "未选择";

  // ===== Setup Screens (Checking / Initializing / Workspace) =====
  if (phase !== "ready") {
    return (
      <SetupWizard
        phase={phase}
        progress={progress}
        progressMsg={progressMsg}
        workspacePath={workspacePath}
        loading={loading}
        appVersion={appVersion}
        setupError={setupError}
        onDismissError={clearSetupError}
        onRetry={retrySetup}
        onSelectFolder={handleSelectFolder}
        onConfirmWorkspace={handleConfirmWorkspace}
      />
    );
  }



  // ===== Main App with Tabs =====
  return (
    <div className="app">
      <Header running={running} phase={phase} statusClass={getStatusClass()} appVersion={appVersion} />

      {/* Tab Navigation (Premium Navbar) */}
      <nav className="tab-nav">
        {([
          { id: "dashboard" as TabId, label: "仪表盘", icon: <Activity size={18} strokeWidth={1.5} /> },
          { id: "models" as TabId, label: "AI 引擎", icon: <Network size={18} strokeWidth={1.5} /> },
          { id: "agents" as TabId, label: "智能体", icon: <Bot size={18} strokeWidth={1.5} /> },
          { id: "analytics" as TabId, label: "数据统计", icon: <BarChart3 size={18} strokeWidth={1.5} /> },
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
        <AnimatePresence mode="wait">
          {/* ===== Dashboard Tab ===== */}
          {activeTab === "dashboard" && (
            <DashboardTab
              running={running}
              loading={loading}
              servicePort={servicePort}
              uptime={uptime}
              currentModelName={currentModelName}
              currentProviderName={currentProviderName}
              handleStart={handleStart}
              handleStop={handleStop}
              setShowKeyModal={setShowKeyModal}
              setShowModelSwitchModal={setShowModelSwitchModal}
            />
          )}

          {/* ===== Models Tab ===== */}
          {activeTab === "models" && (
            <ModelsTab
              providers={providers}
              filteredProviders={filteredProviders}
              currentConfig={currentConfig}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              apiKeyInput={apiKeyInput}
              setApiKeyInput={setApiKeyInput}
              baseUrlInput={baseUrlInput}
              setBaseUrlInput={setBaseUrlInput}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              configSaving={configSaving}
              setConfigStatus={setConfigStatus}
              setShowKeyModal={setShowKeyModal}
              handleSaveConfig={handleSaveConfig}
              configVersion={configVersion}
              resetModalState={resetModalState}
              onConfigChanged={checkApiKey}
            />
          )}

          {/* ===== Agents Tab ===== */}
          {activeTab === "agents" && <AgentsTab />}

          {/* ===== Analytics Tab (Placeholder) ===== */}
          {activeTab === "analytics" && <AnalyticsTab />}

          {/* ===== Settings Tab ===== */}
          {activeTab === "settings" && (
            <SettingsTab
              activeSettingsTab={activeSettingsTab}
              setActiveSettingsTab={setActiveSettingsTab}
              workspacePath={workspacePath}
              servicePort={servicePort}
              currentConfig={currentConfig}
              running={running}
              reinstalling={reinstalling}
              repairing={repairing}
              logs={logs}

              logRef={logRef}
              handleSwitchWorkspace={handleSwitchWorkspace}
              handleReinstall={handleReinstall}
              handleRepairConnection={handleRepairConnection}
              handleReset={handleReset}
              setShowKeyModal={setShowKeyModal}
              setInfoModalTitle={setInfoModalTitle}
              onExportDiagnostics={async () => {
                const savePath = await save({
                  defaultPath: `openclaw-diagnostics-${Date.now()}.zip`,
                  filters: [{ name: 'ZIP', extensions: ['zip'] }],
                });
                if (!savePath) return;
                const logLines = logs.map(l => `[${l.time}] [${l.level}] ${l.humanized || l.message}`);
                try {
                  await invoke('export_diagnostics_zip', { savePath, logs: logLines });
                  setFeedbackModal({ title: '导出成功', msg: '诊断信息已导出到：\n' + savePath });
                } catch (e: unknown) {
                  setFeedbackModal({ title: '导出错误', msg: `导出失败: ${e}` });
                }
              }}
              checkingUpdate={checkingUpdate}
              appVersion={appVersion}
              onCheckUpdate={async () => {
                setCheckingUpdate(true);
                try {
                  const res = await fetch('https://api.github.com/repos/ZsTs119/openclaw-launcher/releases/latest');
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const data = await res.json();
                  const rawTag = data.tag_name || '';
                  const isSemver = /^v?\d+\.\d+\.\d+$/.test(rawTag);
                  const latestVersion = rawTag.replace(/^v/, '');
                  if (isSemver && latestVersion !== appVersion) {
                    setFeedbackModal({
                      title: '发现更新',
                      msg: `发现新版本 v${latestVersion}！\n当前版本 v${appVersion}`,
                      url: data.html_url || 'https://github.com/ZsTs119/openclaw-launcher/releases',
                    });
                  } else {
                    setFeedbackModal({ title: '无可用更新', msg: `当前版本 v${appVersion} 已是最新版本` });
                  }
                } catch {
                  setFeedbackModal({ title: '网络错误', msg: '检查更新失败，请检查网络连接' });
                } finally {
                  setCheckingUpdate(false);
                }
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Generic Info / QR Code Modal */}
      <Modal show={!!infoModalTitle} onClose={() => setInfoModalTitle("")} title={infoModalTitle} maxWidth={360}>
        <div className="modal-desc" style={{ marginTop: 16, marginBottom: 24, padding: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          {infoModalTitle.includes('赞赏') ? (
            <>
              <img src={qrAlipay} alt="支付宝收钱码" style={{ width: '100%', maxWidth: 220, maxHeight: 280, objectFit: 'contain', borderRadius: 8 }} />
              <div style={{ fontSize: 13, marginTop: 12, color: 'var(--text-secondary)' }}>如果 OpenClaw 对你有帮助，可以请作者喝杯咖啡 ☕</div>
            </>
          ) : (
            <>
              <img src={qrWechat} alt="微信公众号" style={{ width: '100%', maxWidth: 220, maxHeight: 280, objectFit: 'contain', borderRadius: 8 }} />
              <div style={{ fontSize: 13, marginTop: 12, color: 'var(--text-secondary)' }}>扫码关注微信公众号，获取最新动态</div>
            </>
          )}
        </div>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setInfoModalTitle("")}>关闭</button>
      </Modal>

      {/* Feedback Modal (version check / diagnostics export) */}
      <Modal show={!!feedbackModal} onClose={() => setFeedbackModal(null)} title={feedbackModal?.title || ''} maxWidth={360}>
        <div className="modal-desc" style={{ marginTop: 16, marginBottom: 24, padding: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <div style={{ fontSize: 14, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{feedbackModal?.msg}</div>
        </div>
        {feedbackModal?.url ? (
          <button className="btn-primary btn-hero" style={{ width: '100%' }}
            onClick={() => { invoke('open_url', { url: feedbackModal.url }); setFeedbackModal(null); }}>前往下载页面</button>
        ) : (
          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setFeedbackModal(null)}>确定</button>
        )}
      </Modal>

      {/* Model Switch Modal */}
      <ModelSwitchModal
        show={showModelSwitchModal}
        onClose={() => setShowModelSwitchModal(false)}
        providers={providers}
        currentConfig={currentConfig}
        handleSetModel={handleSetModel}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        show={showResetModal}
        title="重置配置"
        onCancel={() => setShowResetModal(false)}
        onConfirm={confirmReset}
        confirmLabel="确认重置"
      >
        <p style={{ marginBottom: 12 }}>仅重置 API Key 和模型配置（openclaw.json 中的 models/agents 部分）。</p>
        <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>不会删除：</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12, color: "var(--text-secondary)" }}>
          <li>对话历史和记忆</li>
          <li>Agent 技能和书签</li>
          <li>工作区文件</li>
        </ul>
        <p style={{ color: "var(--accent-red)", marginBottom: 4 }}>将清除：</p>
        <ul style={{ paddingLeft: 20, color: "var(--text-secondary)" }}>
          <li>API Key 配置</li>
          <li>模型选择和默认模型</li>
        </ul>
      </ConfirmModal>

      {/* Reinstall Confirmation Modal */}
      <ConfirmModal
        show={showReinstallModal}
        title="重新安装运行环境"
        onCancel={() => setShowReinstallModal(false)}
        onConfirm={confirmReinstall}
        confirmLabel="确认重新安装"
      >
        <p style={{ marginBottom: 12 }}>这将删除 node_modules 并重新下载所有依赖，可能需要几分钟。</p>
        <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>适用于：</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12, color: "var(--text-secondary)" }}>
          <li>安装过程出错</li>
          <li>环境损坏或依赖缺失</li>
          <li>版本升级后不兼容</li>
        </ul>
        <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>根据网络情况，可能需要 3-10 分钟</p>
      </ConfirmModal>

      {/* Startup Overlay — shown while service is starting up */}
      <StartupOverlay show={startingUp} />

      {/* Connection Repair Toast */}
      <RepairToast
        show={repairToast}
        repairing={repairing}
        onRepair={handleRepairConnection}
        onDismiss={() => setRepairToast(false)}
      />
      {/* Mandatory API Key Modal (renders on top of everything) */}
      <ApiKeyModal
        show={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        providers={providers}
        filteredProviders={filteredProviders}
        currentConfig={currentConfig}
        activeTab={activeTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        baseUrlInput={baseUrlInput}
        setBaseUrlInput={setBaseUrlInput}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        configSaving={configSaving}
        setConfigStatus={setConfigStatus}
        onSaveConfig={handleSaveConfig}
        onOpenRegister={handleOpenRegister}
      />
    </div >
  );
}


export default App;
