import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '../api/apiClient';

/**
 * Message format from SSE endpoint
 */
export interface SSEMessage {
    type: 'info' | 'log' | 'complete' | 'error' | 'progress';
    message?: string;
    data?: any;
    progress?: number;
}

/**
 * Hook state
 */
interface UseSSEStreamState<T = any> {
    logs: string[];
    isStreaming: boolean;
    result: T | null;
    error: string | null;
    progress?: number;
}

/**
 * Hook options
 */
export interface UseSSEStreamOptions {
    baseUrl?: string;
    onComplete?: (data: any) => void;
    onError?: (error: string) => void;
    onLog?: (message: string) => void;
    onProgress?: (progress: number) => void;
    autoReset?: boolean;
}

export function useSSEStream<TRequest = any, TResult = any>(
    endpoint: string,
    options: UseSSEStreamOptions = {}
) {
    const {
        baseUrl = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1',
        onComplete,
        onError,
        onLog,
        onProgress,
        autoReset = false,
    } = options;

    const [state, setState] = useState<UseSSEStreamState<TResult>>({
        logs: [],
        isStreaming: false,
        result: null,
        error: null,
        progress: undefined,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Start SSE stream with request data
     */
    const stream = useCallback(async (requestData: TRequest): Promise<TResult | null> => {
        // Auto-reset if enabled
        if (autoReset) {
            setState({
                logs: [],
                isStreaming: true,
                result: null,
                error: null,
                progress: undefined,
            });
        } else {
            setState(prev => ({
                ...prev,
                isStreaming: true,
                error: null,
            }));
        }

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        let resultData: TResult | null = null;
        let messageBuffer = ''; // Buffer for incomplete SSE messages

        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            // Read stream
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Append chunk to buffer
                messageBuffer += chunk;

                // Split by newlines and keep incomplete line in buffer
                const lines = messageBuffer.split('\n');
                messageBuffer = lines.pop() || ''; // Keep last incomplete line

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        try {
                            const message: SSEMessage = JSON.parse(data);

                            switch (message.type) {
                                case 'log':
                                case 'info':
                                    if (message.progress !== undefined) {
                                        setState(prev => ({
                                            ...prev,
                                            progress: message.progress,
                                        }));
                                        onProgress?.(message.progress);
                                    }
                                    // Only capture backend logger.info() messages for display
                                    if (message.message) {
                                        setState(prev => ({
                                            ...prev,
                                            logs: [...prev.logs, message.message!],
                                        }));
                                        onLog?.(message.message);
                                    }
                                    break;

                                case 'progress':
                                    if (message.progress !== undefined) {
                                        setState(prev => ({
                                            ...prev,
                                            progress: message.progress,
                                        }));
                                        onProgress?.(message.progress);
                                    }
                                    if (message.message) {
                                        setState(prev => ({
                                            ...prev,
                                            logs: [...prev.logs, message.message!],
                                        }));
                                        onLog?.(message.message);
                                    }
                                    break;

                                case 'complete':
                                    resultData = message.data as TResult;
                                    setState(prev => ({
                                        ...prev,
                                        logs: [...prev.logs, '✅ Complete!'],
                                        result: resultData,
                                        isStreaming: false,
                                        progress: 100,
                                    }));
                                    onComplete?.(message.data);
                                    break;

                                case 'error':
                                    const errorMsg = message.message || 'Unknown error';
                                    setState(prev => ({
                                        ...prev,
                                        logs: [...prev.logs, `❌ Error: ${errorMsg}`],
                                        error: errorMsg,
                                        isStreaming: false,
                                    }));
                                    onError?.(errorMsg);
                                    break;
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE message:', e, 'Line:', line.substring(0, 200) + '...');
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Stream was cancelled
                setState(prev => ({
                    ...prev,
                    logs: [...prev.logs, '⚠️ Cancelled'],
                    isStreaming: false,
                }));
            } else {
                const errorMsg = err instanceof Error ? err.message : 'Connection failed';
                setState(prev => ({
                    ...prev,
                    logs: [...prev.logs, `❌ ${errorMsg}`],
                    error: errorMsg,
                    isStreaming: false,
                }));
                onError?.(errorMsg);
            }
        }

        return resultData;
    }, [endpoint, baseUrl, onComplete, onError, onLog, onProgress, autoReset]);

    /**
     * Cancel ongoing stream
     */
    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    /**
     * Reset state
     */
    const reset = useCallback(() => {
        cancel();
        setState({
            logs: [],
            isStreaming: false,
            result: null,
            error: null,
            progress: undefined,
        });
    }, [cancel]);

    /**
     * Clear logs only (keep result and error)
     */
    const clearLogs = useCallback(() => {
        setState(prev => ({
            ...prev,
            logs: [],
        }));
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancel();
        };
    }, [cancel]);

    return {
        // Actions
        stream,
        cancel,
        reset,
        clearLogs,

        // State
        logs: state.logs,
        isStreaming: state.isStreaming,
        result: state.result,
        error: state.error,
        progress: state.progress,
    };
}

/**
 * Convenience hook for portfolio optimization
 */
export function usePortfolioOptimization() {
    return useSSEStream<
        {
            risk_tolerance: number;
            investment_amount: number;
            investment_horizon: number;
            num_assets: number;
        },
        any
    >('/api/v1/quantum/optimize-stream', {
        autoReset: false,
    });
}

/**
 * Convenience hook for Monte Carlo simulation
 */
export function useMonteCarloSimulation() {
    return useSSEStream<
        {
            weights: Record<string, number>;
            investment_amount: number;
            investment_horizon: number;
            tickers: string[];
        },
        any
    >('/api/v1/quantum/monte-carlo-stream', {
        autoReset: false,
    });
}

// Backward compatibility exports with meaningful names
export {
    useSSEStream as useStreamProgress
};
