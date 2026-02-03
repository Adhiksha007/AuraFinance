import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePortfolioStore } from '@/state/portfolioStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
    Download, TrendingUp, AlertTriangle, Activity, DollarSign,
    Scale, Zap, ArrowUpCircle, Target, Maximize2, BarChart3
} from "lucide-react";
import { Pie, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import type { LegendItem, TooltipItem } from 'chart.js';
import apiClient from '@/api/apiClient';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, ArcElement, Title, Tooltip, Legend);

const generateColors = (count: number) => {
    const palette = [
        '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316',
        '#22D3EE', '#A3E635', '#F43F5E', '#EAB308', '#14B8A6', '#7C3AED', '#D946EF', '#4ADE80', '#FACC15'
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
};

// Loading Steps Definition
type LoadingStep = 'idle' | 'optimizing' | 'simulating' | 'restoring' | 'complete';

export default function Portfolio() {
    const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
    const [isRestoring, setIsRestoring] = useState(true);
    const [chartsReady, setChartsReady] = useState(false);

    const {
        risk, amount, horizon, assets,
        result, tableData, beta, mcData, sentiment,
        setInputs, setResults, reset
    } = usePortfolioStore();

    // Effect to handle restoration sequence
    // Effect to handle restoration sequence
    useEffect(() => {
        if (result && isRestoring) {
            setLoadingStep('restoring');

            // 1. Defer heavy chart rendering slightly to let the tab transition finish smoothly
            const chartTimer = setTimeout(() => {
                setChartsReady(true);
            }, 100);

            // 2. Keep "Restoring" loader briefly to mask the chart render jank
            const finishTimer = setTimeout(() => {
                setLoadingStep('complete');
                setIsRestoring(false);
            }, 800); // 0.8s allows the user to see "Restoring..." and feels "computational" but fast

            return () => { clearTimeout(chartTimer); clearTimeout(finishTimer); };
        } else if (!result) {
            setIsRestoring(false);
            setLoadingStep('idle');
            setChartsReady(false);
        }
    }, [result]);

    // Reset charts when optimizing
    useEffect(() => {
        if (loadingStep === 'optimizing') setChartsReady(false);
        if (loadingStep === 'complete' && !isRestoring) {
            // If we just finished optimizing/simulating manually
            setTimeout(() => setChartsReady(true), 100);
        }
    }, [loadingStep, isRestoring]);

    const reportRef = useRef<HTMLDivElement>(null);

    const handleOptimize = async () => {
        setLoadingStep('optimizing');
        setResults({ mcData: null, sentiment: null });

        try {
            console.log("🧠 Optimizing...");
            // 1. Optimization Step
            const response = await apiClient.post('/quantum/optimize', {
                risk_tolerance: risk[0],
                investment_amount: Number(amount),
                investment_horizon: Number(horizon),
                num_assets: Number(assets)
            });
            console.log("Optimization completed");

            setResults({
                result: response.data.results,
                tableData: response.data.table_data,
                beta: response.data.beta,
                sentiment: response.data.sentiment
            });

            // 2. Simulation Step
            setLoadingStep('simulating');
            await runMonteCarlo(response.data.results.portfolio_config.weights, response.data.results.portfolio_config.selected_assets);

            // 3. Complete
            setLoadingStep('complete');

        } catch (error) {
            console.error("Process failed:", error);
            alert("Optimization failed. Please check backend.");
            setLoadingStep('idle');
        }
    };

    const runMonteCarlo = async (weights: any, tickers: string[]) => {
        try {
            console.log("🎲 Running Monte Carlo...");
            const response = await apiClient.post('/quantum/monte-carlo', {
                weights: weights,
                investment_amount: Number(amount),
                investment_horizon: Number(horizon),
                tickers: tickers
            });
            console.log("MC Completed");
            setResults({ mcData: response.data });
        } catch (error) {
            console.error("MC Analysis failed:", error);
        }
    };


    const downloadPDF = () => {
        if (!reportRef.current) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to export the report.");
            return;
        }

        try {
            const contentClone = reportRef.current.cloneNode(true) as HTMLElement;
            const originalCanvases = reportRef.current.querySelectorAll('canvas');
            const clonedCanvases = contentClone.querySelectorAll('canvas');

            originalCanvases.forEach((canvas, index) => {
                const dataUrl = canvas.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                clonedCanvases[index].parentNode?.replaceChild(img, clonedCanvases[index]);
            });

            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(style => style.outerHTML)
                .join('');

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Portfolio Report - ${new Date().toISOString().split('T')[0]}</title>
                        ${styles}
                        <style>
                            body { 
                                background-color: white; 
                                padding: 20px;
                            }
                            * { 
                                -webkit-print-color-adjust: exact !important; 
                                print-color-adjust: exact !important; 
                            }
                            button { display: none !important; }
                        </style>
                    </head>
                    <body>
                        <div style="max-width: 1000px; margin: 0 auto;">
                            ${contentClone.outerHTML}
                        </div>
                        <script>
                            window.onload = () => { 
                                setTimeout(() => {
                                    window.print();
                                    window.close();
                                }, 500);
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();

        } catch (error) {
            console.error("Print export failed:", error);
            alert("Failed to prepare print view.");
            printWindow.close();
        }
    };

    // ================================
    // Data Preparation (Memoized)
    // ================================
    const pieData = useMemo(() => {
        if (result && result.portfolio_config && result.portfolio_config.weights) {
            const labels = Object.keys(result.portfolio_config.weights);
            const data = Object.values(result.portfolio_config.weights).map((w: any) => Number(w) * 100);

            return {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: generateColors(labels.length),
                    borderWidth: 0
                }]
            };
        }
        return null;
    }, [result]);

    const pieOptions = useMemo(() => ({
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { color: "#9CA3AF", boxWidth: 10, padding: 15 }
            }
        }
    }), []);

    const lineData = useMemo(() => {
        if (mcData) {
            const { time_points, paths, percentile_paths } = mcData;
            const datasets: any[] = [];

            if (paths) {
                paths.forEach((path: number[]) => {
                    datasets.push({
                        data: path,
                        borderColor: 'rgba(99,102,241,0.1)',
                        fill: false,
                        borderWidth: 1,
                        pointRadius: 0,
                        label: 'Simulation',
                    });
                });
            }

            const percentileColors: Record<string, string> = {
                '5': '#F87171', '25': '#FBBF24', '50': '#34D399', '75': '#60A5FA', '95': '#FACC15'
            };

            if (percentile_paths) {
                Object.entries(percentile_paths).forEach(([p, path]: [string, any]) => {
                    datasets.push({
                        label: `${p}th Percentile`,
                        data: path,
                        borderColor: percentileColors[p] || '#D1D5DB',
                        fill: false,
                        borderWidth: p === '50' ? 3 : 2,
                        pointRadius: 0
                    });
                });
            }

            const initialInv = percentile_paths && percentile_paths['50'] ? percentile_paths['50'][0] : amount;
            datasets.push({
                label: 'Initial Investment',
                data: Array(time_points.length).fill(initialInv),
                borderColor: '#9CA3AF',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            });

            return { labels: time_points, datasets };
        }
        return null;
    }, [mcData, amount]);

    const lineOptions = useMemo(() => ({
        maintainAspectRatio: false,
        animation: false as const,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: {
                display: true, position: "bottom" as const,
                labels: { color: "#9CA3AF", filter: (legendItem: LegendItem) => legendItem.text !== 'Simulation' }
            },
            tooltip: {
                callbacks: {
                    label: function (context: TooltipItem<'line'>) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: { title: { display: true, text: "Value ($)", color: "#9CA3AF" }, ticks: { color: "#9CA3AF", maxTicksLimit: 6 }, grid: { color: "rgba(229,231,235,0.1)" } },
            x: { title: { display: true, text: "Days", color: "#9CA3AF" }, ticks: { color: "#9CA3AF", maxTicksLimit: 9 }, grid: { color: "rgba(229,231,235,0.1)" } }
        }
    }), []);

    // Helper for loading steps
    const isLoading = ['optimizing', 'simulating', 'restoring'].includes(loadingStep);

    return (
        <div className="space-y-8 p-6 font-primary relative" ref={reportRef}>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">Quantum Portfolio</h1>
                    <p className="text-muted-foreground mt-2">AI-Optimized Asset Allocation & Risk Analysis</p>
                </div>
                {loadingStep === 'complete' && result && (
                    <div className="flex gap-2">
                        <Button onClick={() => { setLoadingStep('idle'); reset(); }} variant="ghost" className="text-muted-foreground hover:text-destructive">
                            Clear
                        </Button>
                        <Button onClick={downloadPDF} variant="outline" className="gap-2">
                            <Download className="h-4 w-4" /> Export Report
                        </Button>
                    </div>
                )}
            </div>

            {/* Input Configuration */}
            <Card className="bg-card/50 backdrop-blur-md border-muted transition-all duration-300">
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Customize your investment parameters.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:col-span-4">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Risk Tolerance ({risk[0]})</label>
                        <Slider value={risk} onValueChange={(val) => setInputs({ risk: val })} max={1} step={0.1} disabled={isLoading} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Conservative</span>
                            <span>Aggressive</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Investment Amount ($)</label>
                        <Input type="number" value={amount} onChange={(e) => setInputs({ amount: Number(e.target.value) })} disabled={isLoading} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Horizon (Years)</label>
                        <Input type="number" value={horizon} onChange={(e) => setInputs({ horizon: Number(e.target.value) })} disabled={isLoading} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Max Assets</label>
                        <Input type="number" value={assets} onChange={(e) => setInputs({ assets: Number(e.target.value) })} disabled={isLoading} />
                    </div>

                    <Button
                        onClick={handleOptimize}
                        disabled={isLoading}
                        className={`md:col-span-2 lg:col-span-4 font-bold transition-all duration-500 ${isLoading ? 'opacity-80' : 'hover:scale-[1.01]'}`}
                    >
                        {isLoading ? "Processing..." : "Generate Optimal Portfolio"}
                    </Button>
                </CardContent>
            </Card>

            {/* Content Wrapper */}
            <div className="relative min-h-[500px]">
                {/* Animated Loading Overlay */}
                <AnimatePresence mode="wait">
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-md rounded-xl"
                        >
                            <div className="relative">
                                {/* CSS Spinner for robustness against main thread freeze */}
                                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Zap className="h-6 w-6 text-primary fill-current animate-pulse" />
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <motion.div
                                    key={loadingStep}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent"
                                >
                                    {loadingStep === 'optimizing' && "🧠 Optimizing Quantum State..."}
                                    {loadingStep === 'simulating' && "🎲 Running Monte Carlo Simulations..."}
                                    {loadingStep === 'restoring' && "♻️ Restoring Analysis..."}
                                </motion.div>
                                <p className="text-muted-foreground animate-pulse">
                                    {loadingStep === 'optimizing' && `Selecting best assets from ${assets} candidates...`}
                                    {loadingStep === 'simulating' && `Projecting ${horizon} years into the future...`}
                                    {loadingStep === 'restoring' && "Loading saved data securely..."}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Results Section */}
                {/* We render this even during 'restoring' (opacity 0) so charts mount and freeze BEHIND the loader */}
                {result && (loadingStep === 'complete' || loadingStep === 'restoring') && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: loadingStep === 'restoring' ? 0 : 1, y: 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 50 }}
                        className="space-y-8"
                    >
                        {/* 1. Top Section: Portfolio Analysis (3x3 Grid) */}
                        <div className="bg-muted/30 p-6 rounded-2xl border border-border/50">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Target className="h-5 w-5 text-primary" /> Key Performance Indicators
                            </h3>
                            <div className="grid gap-4 md:grid-cols-3">
                                <KPICard title="Expected Annual Return" value={`${(result.annualized_stats.expected_return * 100).toFixed(2)}%`} icon={TrendingUp} colorClass="text-emerald-700" bgClass="bg-green-500/5 border-green-500/20" />
                                <KPICard title="Volatility (Risk)" value={`${(result.annualized_stats.volatility * 100).toFixed(2)}%`} icon={Activity} colorClass="text-foreground" bgClass="bg-yellow-500/5 border-yellow-500/20" />
                                <KPICard title="Projected Value" value={`$${result.projections.projected_final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} colorClass="text-blue-700" bgClass="bg-blue-500/5 border-blue-500/20" />

                                <KPICard title="Sharpe Ratio" value={result.annualized_stats.sharpe_ratio.toFixed(2)} icon={Scale} colorClass="text-purple-700" bgClass="bg-purple-500/5 border-purple-500/20" />
                                <KPICard title="Portfolio Beta" value={beta ? beta.toFixed(2) : "N/A"} icon={Zap} colorClass="text-orange-700" bgClass="bg-orange-500/5 border-orange-500/20" />
                                <KPICard title="ROI" value={`${(result.projections.ROI * 100).toFixed(2)}%`} icon={ArrowUpCircle} colorClass="text-foreground" bgClass="bg-red-500/5 border-red-500/20" />

                                <KPICard title="CAGR" value={`${(result.projections.CAGR * 100).toFixed(2)}%`} icon={Target} colorClass="text-foreground" bgClass="bg-emerald-500/5 border-emerald-500/20" />
                                <Card className='bg-emerald-500/5 border-emerald-500/20 h-full hover:scale-105 transition-transform duration-300'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Maximize2 className="h-4 w-4" /> Projected Range</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold flex flex-col sm:flex-row gap-1">
                                            <span>L: ${result.projections.range_lower.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            <span className="hidden sm:inline">-</span>
                                            <span>H: ${result.projections.range_upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                                <KPICard title="Simulation Mean" value={`${(result.risk_metrics.sim_mean_return * 100).toFixed(2)}%`} icon={BarChart3} colorClass="text-foreground" bgClass="bg-emerald-500/5 border-emerald-500/20" />
                            </div>
                        </div>

                        {/* 2. Middle Section: Allocation & Risk (Side-by-Side) */}
                        <div className="grid gap-8 md:grid-cols-2">
                            {/* Asset Allocation */}
                            <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                <CardHeader><CardTitle>Asset Allocation</CardTitle></CardHeader>
                                <CardContent className="h-[400px] flex items-center justify-center relative">
                                    {pieData && chartsReady ? (
                                        <div className="w-full h-full max-w-[300px]">
                                            <Pie data={pieData} options={pieOptions} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                                            Loading Chart...
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Detailed Risk Analysis */}
                            <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                <CardHeader><CardTitle>Risk Analysis</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <RiskRow label="95% VaR (Loss)" value={`-$${result.risk_metrics.VaR_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={AlertTriangle} theme="red" />
                                    <RiskRow label="95% VaR (Return)" value={`${(result.risk_metrics.VaR_return * 100).toFixed(2)}%`} icon={TrendingUp} theme="red-light" />
                                    <RiskRow label="95% CVaR (Loss)" value={`-$${result.risk_metrics.CVaR_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={AlertTriangle} theme="amber" />
                                    <RiskRow label="95% CVaR (Return)" value={`${(result.risk_metrics.CVaR_return * 100).toFixed(2)}%`} icon={TrendingUp} theme="amber-light" />
                                    <RiskRow label="Sim Mean Return" value={`${(result.risk_metrics.sim_mean_return * 100).toFixed(2)}%`} icon={BarChart3} theme="blue" />
                                    <RiskRow label="Sim Std Dev" value={`${(result.risk_metrics.std_sim_return * 100).toFixed(2)}%`} icon={Activity} theme="slate" />
                                </CardContent>
                            </Card>
                        </div>

                        {/* 3. Monte Carlo Chart */}
                        <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Monte Carlo Simulation (1000 Runs)
                                </CardTitle>
                                <CardDescription>Projected portfolio value over {horizon} years.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {lineData && chartsReady ? <Line data={lineData} options={lineOptions} /> : <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Simulation...</div>}
                            </CardContent>
                        </Card>

                        {/* 4. AI Sentiment Analysis */}
                        {sentiment && (
                            <Card className='bg-blue-500/5 border-blue-500/20'>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-blue-500" /> AI Sentiment Analysis
                                    </CardTitle>
                                    <CardDescription>Real-time market mood analysis for selected assets.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {result.portfolio_config.selected_assets.map((ticker: string) => {
                                            const score = sentiment[ticker] || 0;
                                            console.log(ticker, score);
                                            const isBullish = score > 0;
                                            const percentage = Math.min(Math.abs(score) * 100, 100);

                                            return (
                                                <div key={ticker} className="p-4 rounded-xl bg-background/50 border border-border/50 hover:border-blue-500/30 transition-all hover:shadow-lg hover:-translate-y-1 hover:scale-102">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="font-bold text-lg">{ticker}</span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isBullish ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                                                            {isBullish ? "Bullish" : "Bearish"}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium">Confidence Score</span>
                                                            <div className="flex items-center gap-1 font-mono">
                                                                <span className={isBullish ? "text-green-600" : "text-red-600"}>
                                                                    {Math.abs(score).toFixed(4)}
                                                                </span>
                                                                <span className="text-muted-foreground">/</span>
                                                                <span className={isBullish ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                                    {percentage.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden w-full">
                                                            <div className={`h-full ${isBullish ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${percentage}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 5. Holdings Table */}
                        <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                            <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                <CardHeader><CardTitle>Holdings Detail</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-border/50">
                                                    <th className="p-2">Ticker</th><th className="p-2">Market Cap</th><th className="p-2">Beta</th><th className="p-2">ROE</th><th className="p-2 text-right">Weight</th><th className="p-2 text-right">Ann. Return</th><th className="p-2 text-right">Volatility</th><th className="p-2 text-right">Sharpe</th><th className="p-2 text-right">Inv. Amount</th><th className="p-2 text-right">Est. Return Amt</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableData.map((row: any) => (
                                                    <tr key={row.Ticker} className="border-b border-border/10 hover:bg-muted/50 transition-colors">
                                                        <td className="p-2 font-medium"><div>{row.Ticker}</div><div className="text-xs text-muted-foreground">{row.Company}</div></td>
                                                        <td className="p-2">{row["Market Cap"]}</td>
                                                        <td className="p-2">{row.Beta?.toFixed(2)}</td>
                                                        <td className="p-2">{(row.ROE * 100).toFixed(2)}%</td>
                                                        <td className="p-2 text-right">{(row.Weight * 100).toFixed(2)}%</td>
                                                        <td className="p-2 text-right text-emerald-400">{row["Annual Return %"].toFixed(2)}%</td>
                                                        <td className="p-2 text-right">{row["Volatility %"].toFixed(2)}%</td>
                                                        <td className="p-2 text-right">{row["Sharpe Ratio"].toFixed(2)}</td>
                                                        <td className="p-2 text-right">${row["Investment Amount"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                        <td className="p-2 text-right text-blue-400 font-bold">${row["Returned Amount"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

// Subcomponents for cleaner code
function KPICard({ title, value, icon: Icon, colorClass, bgClass }: any) {
    return (
        <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-105">
            <Card className={`${bgClass} h-full`}>
                <CardHeader className="pb-2">
                    <CardTitle className={`text-sm font-medium flex items-center gap-2 ${colorClass && !colorClass.includes('text-foreground') ? colorClass.replace('700', '600') : 'text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" /> {title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
                </CardContent>
            </Card>
        </div>
    );
}

function RiskRow({ label, value, icon: Icon, theme }: any) {
    const themeStyles: Record<string, string> = {
        'red': 'bg-red-500/10 text-red-500 border-red-500/20',
        'red-light': 'bg-red-500/5 text-red-400 border-red-500/10',
        'amber': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        'amber-light': 'bg-amber-500/5 text-amber-400 border-amber-500/10',
        'blue': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'slate': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${themeStyles[theme] || ''}`}>
            <div className="flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</div>
            <div className="font-bold">{value}</div>
        </div>
    );
}
