import { invoke } from "@tauri-apps/api/core";
import { Activity, Cpu, Hexagon, Play, Loader2, Square } from "lucide-react";
import { motion } from "framer-motion";
import { formatUptime } from "../utils/log-humanizer";
import logo from "../assets/logo.jpg";

interface DashboardTabProps {
    running: boolean;
    loading: boolean;
    servicePort: number;
    uptime: number;
    currentModelName: string;
    currentProviderName: string;
    handleStart: () => void;
    handleStop: () => void;
    setShowKeyModal: (v: boolean) => void;
    setShowModelSwitchModal: (v: boolean) => void;
}

export function DashboardTab({
    running, loading, servicePort, uptime,
    currentModelName, currentProviderName,
    handleStart, handleStop,
    setShowKeyModal, setShowModelSwitchModal,
}: DashboardTabProps) {
    return (
        <motion.div
            key="dashboard"
            className="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            <div className="dashboard-hero">
                <div className={`status-ring ${running ? 'running' : 'stopped'}`}>
                    <img src={logo} alt="OpenClaw" className="status-ring-logo" />
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
                        {loading ? (
                            <>
                                <Loader2 className="spin" size={18} />
                                {running ? "中断中..." : "引擎唤醒中..."}
                            </>
                        ) : (
                            running ? <><Square size={16} fill="currentColor" /> 中断服务</> : <><Play size={16} fill="currentColor" /> 初始化并启动</>
                        )}
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
        </motion.div>
    );
}
