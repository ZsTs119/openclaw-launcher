import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Activity, Cpu, SlidersHorizontal, Network } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

// ===== Extracted modules =====
import type { TabId } from "./types";
import { CATEGORY_LABELS } from "./types";
import { formatUptime } from "./utils/log-humanizer";
import { Modal, ModalFooter } from "./components/ui/Modal";
import { Header } from "./components/Header";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { SetupWizard } from "./components/SetupWizard";
import { DashboardTab } from "./components/DashboardTab";
import { ModelsTab } from "./components/ModelsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ModelSwitchModal } from "./components/ModelSwitchModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { RepairToast } from "./components/RepairToast";
import { useLogs } from "./hooks/useLogs";
import { useConfig } from "./hooks/useConfig";
import { useSetup } from "./hooks/useSetup";
import { useService } from "./hooks/useService";

// ===== App =====
function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"general" | "logs" | "about">("general");
  const [running, setRunning] = useState(false);

  // === Hooks ===
  const {
    logs, showRawLogs, setShowRawLogs,
    repairToast, setRepairToast,
    logRef, addLog,
  } = useLogs();

  const {
    providers, selectedCategory, setSelectedCategory,
    selectedProvider, setSelectedProvider,
    apiKeyInput, setApiKeyInput, baseUrlInput, setBaseUrlInput,
    selectedModel, setSelectedModel,
    configSaving, configStatus, setConfigStatus,
    currentConfig, filteredProviders,
    showKeyModal, setShowKeyModal, showResetModal, setShowResetModal,
    showReinstallModal, setShowReinstallModal,
    showModelSwitchModal, setShowModelSwitchModal,
    infoModalTitle, setInfoModalTitle,
    checkApiKey, handleSaveConfig, handleSetModel, handleOpenRegister,
    handleReset, confirmReset, handleReinstall,
  } = useConfig({ addLog, running, setRunning });

  const {
    phase, setPhase,
    loading: setupLoading,
    progress, setProgress,
    progressMsg, setProgressMsg,
    workspacePath,
    handleSelectFolder, handleConfirmWorkspace, handleSwitchWorkspace,
  } = useSetup({ addLog, checkApiKey, setRunning });

  const {
    loading: serviceLoading,
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
        onSelectFolder={handleSelectFolder}
        onConfirmWorkspace={handleConfirmWorkspace}
      />
    );
  }



  // ===== Main App with Tabs =====
  return (
    <div className="app">
      <Header running={running} phase={phase} statusClass={getStatusClass()} />

      {/* Tab Navigation (Premium Navbar) */}
      <nav className="tab-nav">
        {([
          { id: "dashboard" as TabId, label: "仪表盘", icon: <Activity size={18} strokeWidth={1.5} /> },
          { id: "models" as TabId, label: "AI 引擎", icon: <Network size={18} strokeWidth={1.5} /> },
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
              configStatus={configStatus}
              setConfigStatus={setConfigStatus}
              setShowKeyModal={setShowKeyModal}
              handleSaveConfig={handleSaveConfig}
            />
          )}

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
              showRawLogs={showRawLogs}
              setShowRawLogs={setShowRawLogs}
              logRef={logRef}
              handleSwitchWorkspace={handleSwitchWorkspace}
              handleReinstall={handleReinstall}
              handleRepairConnection={handleRepairConnection}
              handleReset={handleReset}
              setShowKeyModal={setShowKeyModal}
              setInfoModalTitle={setInfoModalTitle}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Generic Info / QR Code Modal */}
      <Modal show={!!infoModalTitle} onClose={() => setInfoModalTitle("")} title={infoModalTitle} maxWidth={360}>
        <div className="modal-desc" style={{ marginTop: 16, marginBottom: 24, padding: 32, background: 'var(--bg-card)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)' }}>[ 二维码图片占位符 ]</div>
          <div style={{ fontSize: 12, marginTop: 12 }}>请在 assets 文件夹替换为你个人的二维码图片</div>
        </div>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setInfoModalTitle("")}>关闭</button>
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
        title="⚠️ 重置配置"
        onCancel={() => setShowResetModal(false)}
        onConfirm={confirmReset}
        confirmLabel="确认重置"
      >
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
      </ConfirmModal>

      {/* Reinstall Confirmation Modal */}
      <ConfirmModal
        show={showReinstallModal}
        title="🔄 重新安装运行环境"
        onCancel={() => setShowReinstallModal(false)}
        onConfirm={confirmReinstall}
        confirmLabel="确认重新安装"
      >
        <p style={{ marginBottom: 12 }}>这将删除 node_modules 并重新下载所有依赖，可能需要几分钟。</p>
        <p style={{ color: "var(--accent-green)", marginBottom: 4 }}>适用于：</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12, color: "var(--text-secondary)" }}>
          <li>安装过程出错</li>
          <li>环境损坏或依赖缺失</li>
          <li>版本升级后不兼容</li>
        </ul>
        <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>⏱️ 根据网络情况，可能需要 3-10 分钟</p>
      </ConfirmModal>

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
        configStatus={configStatus}
        setConfigStatus={setConfigStatus}
        onSaveConfig={handleSaveConfig}
        onOpenRegister={handleOpenRegister}
      />
    </div >
  );
}


export default App;
