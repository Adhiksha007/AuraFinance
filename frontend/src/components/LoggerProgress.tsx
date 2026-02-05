import { motion, AnimatePresence } from 'framer-motion';

interface LoggerProgressProps {
    logs: string[];
    isActive: boolean;
    title?: string;
    maxHeight?: string;
    className?: string;
}

/**
 * Centralized, reusable component for displaying real-time backend logs.
 * 
 * @param logs - Array of log messages to display
 * @param isActive - Whether logging is currently active (shows pulse animation)
 * @param title - Optional custom title (default: "Progress")
 * @param maxHeight - Optional max height for scrollable area (default: "10rem")
 * @param className - Optional additional CSS classes
 * 
 * @example
 * ```tsx
 * <LoggerProgress 
 *   logs={logs} 
 *   isActive={isOptimizing}
 *   title="Optimization Progress"
 * />
 * ```
 */
export const LoggerProgress: React.FC<LoggerProgressProps> = ({
    logs,
    isActive,
    title = 'Progress',
    maxHeight = '10rem',
    className = '',
}) => {
    // Don't render if no logs and not active
    if (!isActive && logs.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 bg-gray-900 rounded-lg border border-emerald-500/20 ${className}`}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                {isActive && (
                    <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                )}
                {!isActive && logs.length > 0 && (
                    <div className="h-2 w-2 bg-emerald-500/50 rounded-full" />
                )}
                <h3 className="text-sm font-semibold text-emerald-400">{title}</h3>
            </div>

            {/* Log Messages */}
            <div
                className="space-y-1 overflow-y-auto font-mono text-xs scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent"
                style={{ maxHeight }}
            >
                <AnimatePresence mode="popLayout">
                    {logs.map((log, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="text-emerald-300/80"
                        >
                            <span className="text-emerald-500/50 mr-2">›</span>
                            {log}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Cursor when active */}
                {isActive && (
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-emerald-400"
                    >
                        <span className="text-emerald-500">▊</span>
                    </motion.div>
                )}
            </div>

            {/* Footer info */}
            {logs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-500/10">
                    <span className="text-xs text-emerald-500/50">
                        {logs.length} {logs.length === 1 ? 'message' : 'messages'}
                        {isActive && ' • In progress...'}
                    </span>
                </div>
            )}
        </motion.div>
    );
};

/**
 * Compact variant for inline display
 */
export const LoggerProgressCompact: React.FC<Omit<LoggerProgressProps, 'maxHeight'>> = ({
    logs,
    isActive,
    className = '',
}) => {
    if (!isActive && logs.length === 0) {
        return null;
    }

    const latestLog = logs[logs.length - 1];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-3 py-2 bg-gray-900/50 rounded-md border border-emerald-500/10 ${className}`}
        >
            {isActive && (
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            )}
            <span className="text-xs text-emerald-400 font-mono truncate">
                {latestLog || 'Waiting...'}
            </span>
            <span className="text-xs text-emerald-500/50 ml-auto">
                {logs.length}
            </span>
        </motion.div>
    );
};

export default LoggerProgress;
