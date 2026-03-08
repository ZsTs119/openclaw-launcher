import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Wrench } from "lucide-react";

interface RepairToastProps {
    show: boolean;
    repairing: boolean;
    onRepair: () => void;
    onDismiss: () => void;
}

export function RepairToast({ show, repairing, onRepair, onDismiss }: RepairToastProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="repair-toast"
                    initial={{ opacity: 0, y: 50, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 50, x: '-50%' }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    style={{
                        position: 'fixed', bottom: 24, left: '50%',
                        background: 'linear-gradient(135deg, rgba(30,30,40,0.98), rgba(40,30,30,0.98))',
                        border: '1px solid var(--accent-red, #ff4444)',
                        borderRadius: 'var(--radius, 12px)',
                        padding: '16px 24px', zIndex: 9999,
                        display: 'flex', alignItems: 'center', gap: 16,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        maxWidth: 480,
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent-red)' }}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />检测到连接认证失败</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                            设备签名校验异常，点击一键修复（重启服务 + 刷新会话）
                        </div>
                    </div>
                    <button
                        className="btn-primary"
                        style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: 13 }}
                        onClick={onRepair}
                        disabled={repairing}
                    >
                        {repairing ? "修复中..." : <><Wrench size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />一键修复</>}
                    </button>
                    <button
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
                        onClick={onDismiss}
                        title="关闭"
                    >×</button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
