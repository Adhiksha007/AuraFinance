import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, TrendingUp, AlertTriangle, Activity, Calendar, Zap, Trash2 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/api/apiClient';

interface PortfolioData {
    weights: Record<string, number>;
    tickers: string[];
    investmentAmount: number;
}

export default function Backtest() {
    const navigate = useNavigate();
    const location = useLocation();
    const portfolioData = location.state as PortfolioData;

    // State management
    const [backtestData, setBacktestData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const [backtestPeriod, setBacktestPeriod] = useState({
        startDate: '2022-01-01',
        endDate: '2022-12-31'
    });

    // Redirect if no portfolio data
    useEffect(() => {
        if (!portfolioData?.weights || !portfolioData?.tickers) {
            navigate('/portfolio');
        }
    }, [portfolioData, navigate]);

    // Backtest handler
    const handleBacktest = async () => {
        setLoading(true);
        try {
            const response = await apiClient.post('/quantum/backtest', {
                weights: portfolioData.weights,
                tickers: portfolioData.tickers,
                start_date: backtestPeriod.startDate,
                end_date: backtestPeriod.endDate,
                initial_investment: portfolioData.investmentAmount
            });
            setBacktestData(response.data);
        } catch (error) {
            console.error('Backtest failed:', error);
            alert('Backtesting failed. Please try a different date range.');
        } finally {
            setLoading(false);
        }
    };

    // Cache clear handler
    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            await apiClient.delete('/quantum/backtest/cache');
            setBacktestData(null); // Clear current results
            alert('✅ Cache cleared successfully! Run a new backtest to fetch fresh data.');
        } catch (error) {
            console.error('Failed to clear cache:', error);
            alert('❌ Failed to clear cache. Please try again.');
        } finally {
            setClearingCache(false);
        }
    };

    // Chart data preparation
    const chartData = useMemo(() => {
        if (!backtestData) return null;
        return {
            labels: backtestData.dates,
            datasets: [
                {
                    label: 'Quantum-Optimized Portfolio',
                    data: backtestData.optimized_portfolio.values,
                    borderColor: '#8B5CF6',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'Equal-Weight Baseline',
                    data: backtestData.baseline_portfolio.values,
                    borderColor: '#6B7280',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                }
            ]
        };
    }, [backtestData]);

    const chartOptions = useMemo(() => ({
        maintainAspectRatio: false,
        responsive: true,
        interaction: {
            mode: 'index' as const,
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
                labels: {
                    color: '#9CA3AF',
                    boxWidth: 10,
                    padding: 15
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0
                            }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'Portfolio Value ($)',
                    color: '#9CA3AF'
                },
                ticks: {
                    color: '#9CA3AF',
                    callback: function (value: any) {
                        return '$' + value.toLocaleString();
                    }
                },
                grid: {
                    color: 'rgba(229,231,235,0.1)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date',
                    color: '#9CA3AF'
                },
                ticks: {
                    color: '#9CA3AF',
                    maxTicksLimit: 10
                },
                grid: {
                    color: 'rgba(229,231,235,0.1)'
                }
            }
        }
    }), []);

    return (
        <div className="space-y-8 p-6 font-primary">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/portfolio')}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Portfolio
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                            Historical Backtesting
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Validate your portfolio against real market data
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="gap-2 text-orange-500 hover:text-orange-600 border-orange-500/20 hover:border-orange-500/40"
                >
                    <Trash2 className="h-4 w-4" />
                    {clearingCache ? 'Clearing...' : 'Clear Cache'}
                </Button>
            </div>

            {/* Portfolio Summary */}
            {portfolioData && (
                <Card className="bg-card/50 backdrop-blur-md border-muted">
                    <CardHeader>
                        <CardTitle>Portfolio Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Assets</div>
                                <div className="font-bold">{portfolioData.tickers.join(', ')}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Investment</div>
                                <div className="font-bold">${portfolioData.investmentAmount.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Number of Assets</div>
                                <div className="font-bold">{portfolioData.tickers.length}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Strategy</div>
                                <div className="font-bold flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-purple-500" />
                                    Quantum-Optimized
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Backtest Controls */}
            <Card className="bg-purple-500/5 border-purple-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Select Historical Period
                    </CardTitle>
                    <CardDescription>
                        Choose a date range to test how your portfolio would have performed
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Date</label>
                            <Input
                                type="date"
                                value={backtestPeriod.startDate}
                                onChange={(e) => setBacktestPeriod({
                                    ...backtestPeriod,
                                    startDate: e.target.value
                                })}
                                disabled={loading}
                                max={backtestPeriod.endDate}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">End Date</label>
                            <Input
                                type="date"
                                value={backtestPeriod.endDate}
                                onChange={(e) => setBacktestPeriod({
                                    ...backtestPeriod,
                                    endDate: e.target.value
                                })}
                                disabled={loading}
                                min={backtestPeriod.startDate}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={handleBacktest}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Running Backtest...' : 'Run Backtest'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Loading State */}
            <AnimatePresence mode="wait">
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center gap-4 py-12"
                    >
                        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-muted-foreground animate-pulse">
                            Analyzing historical performance...
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results */}
            {backtestData && !loading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Performance Chart */}
                    <Card className="bg-purple-500/5 border-purple-500/20">
                        <CardHeader>
                            <CardTitle>Performance Comparison</CardTitle>
                            <CardDescription>
                                Portfolio value evolution from {backtestPeriod.startDate} to {backtestPeriod.endDate}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            {chartData && <Line data={chartData} options={chartOptions} />}
                        </CardContent>
                    </Card>

                    {/* Metrics Comparison */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Cumulative Return"
                            optimized={backtestData.optimized_portfolio.cumulative_return}
                            baseline={backtestData.baseline_portfolio.cumulative_return}
                            icon={TrendingUp}
                            higherIsBetter={true}
                        />
                        <MetricCard
                            label="Max Drawdown"
                            optimized={backtestData.optimized_portfolio.max_drawdown}
                            baseline={backtestData.baseline_portfolio.max_drawdown}
                            icon={AlertTriangle}
                            higherIsBetter={false}
                        />
                        <MetricCard
                            label="Volatility"
                            optimized={backtestData.optimized_portfolio.volatility}
                            baseline={backtestData.baseline_portfolio.volatility}
                            icon={Activity}
                            higherIsBetter={false}
                        />
                        <MetricCard
                            label="Sharpe Ratio"
                            optimized={backtestData.optimized_portfolio.sharpe_ratio}
                            baseline={backtestData.baseline_portfolio.sharpe_ratio}
                            icon={BarChart3}
                            higherIsBetter={true}
                        />
                    </div>

                    {/* Summary Card */}
                    <Card className="bg-emerald-500/5 border-emerald-500/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-emerald-500" />
                                Backtest Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Quantum-Optimized Portfolio</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Initial Value:</span>
                                            <span className="font-medium">${portfolioData.investmentAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Final Value:</span>
                                            <span className="font-bold text-purple-500">
                                                ${backtestData.optimized_portfolio.final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Recovery Time:</span>
                                            <span className="font-medium">
                                                {backtestData.optimized_portfolio.recovery_time} days
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Equal-Weight Baseline</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Initial Value:</span>
                                            <span className="font-medium">${portfolioData.investmentAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Final Value:</span>
                                            <span className="font-medium">
                                                ${backtestData.baseline_portfolio.final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Recovery Time:</span>
                                            <span className="font-medium">
                                                {backtestData.baseline_portfolio.recovery_time} days
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}

// MetricCard Component
function MetricCard({ label, optimized, baseline, icon: Icon, higherIsBetter }: any) {
    const isOptimizedBetter = higherIsBetter
        ? optimized > baseline
        : optimized < baseline;

    const difference = Math.abs(((optimized - baseline) / Math.abs(baseline)) * 100);

    return (
        <Card className="p-4 bg-background/50 border-border hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Icon className="h-4 w-4" />
                {label}
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs">Optimized</span>
                    <span className="font-bold text-purple-500">
                        {formatMetric(optimized, label)}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs">Baseline</span>
                    <span className="font-medium text-muted-foreground">
                        {formatMetric(baseline, label)}
                    </span>
                </div>
                <div className={`text-xs text-right font-semibold ${isOptimizedBetter ? 'text-green-500' : 'text-red-500'}`}>
                    {isOptimizedBetter ? '↑' : '↓'} {difference.toFixed(1)}% {isOptimizedBetter ? 'better' : 'worse'}
                </div>
            </div>
        </Card>
    );
}

function formatMetric(value: number, label: string): string {
    if (label.includes('Return') || label.includes('Drawdown') || label.includes('Volatility')) {
        return `${(value * 100).toFixed(2)}%`;
    }
    if (label.includes('Ratio')) {
        return value.toFixed(2);
    }
    if (label.includes('Days')) {
        return `${Math.round(value)} days`;
    }
    return value.toFixed(2);
}
