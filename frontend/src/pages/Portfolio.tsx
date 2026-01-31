import { useState, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePortfolioStore } from '@/state/portfolioStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
    Loader2, Download, TrendingUp, AlertTriangle, Activity, DollarSign,
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



export default function Portfolio() {
    const [loading, setLoading] = useState(false);
    const [mcLoading, setMcLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);

    const {
        risk, amount, horizon, assets,
        result, tableData, beta, mcData, sentiment,
        setInputs, setResults, reset
    } = usePortfolioStore();

    // Effect to handle initial mounting/restoration delay
    useEffect(() => {
        if (result) {
            // If we have results, show "Restoring..." briefly to allow UI to paint before heavy charts render
            const timer = setTimeout(() => setIsRestoring(false), 100);
            return () => clearTimeout(timer);
        } else {
            setIsRestoring(false);
        }
    }, [result]);

    const reportRef = useRef<HTMLDivElement>(null);

    const handleOptimize = async () => {
        setLoading(true);
        setResults({ mcData: null, sentiment: null }); // Reset MC data & sentiment
        try {
            console.log("Optimizing...");
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

            // Trigger Monte Carlo immediately after optimization
            await runMonteCarlo(response.data.results.portfolio_config.weights, response.data.results.portfolio_config.selected_assets);

        } catch (error) {
            console.error("Optimization failed:", error);
            alert("Optimization failed. Please check backend.");
        } finally {
            setLoading(false);
        }
    };

    const runMonteCarlo = async (weights: any, tickers: string[]) => {
        setMcLoading(true);
        try {
            console.log("Running Monte Carlo...");
            const response = await apiClient.post('/quantum/monte-carlo', {
                weights: weights,
                investment_amount: Number(amount),
                investment_horizon: Number(horizon),
                tickers: tickers
            });
            console.log("Completed Monto Carlo")
            setResults({ mcData: response.data });
        } catch (error) {
            console.error("MC Analysis failed:", error);
        } finally {
            setMcLoading(false);
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
            // 1. Clone the content to manipulate (swap canvas for img)
            const contentClone = reportRef.current.cloneNode(true) as HTMLElement;

            // 2. Handle Charts (Canvas -> Image) - innerHTML/clone doesn't capture canvas state
            const originalCanvases = reportRef.current.querySelectorAll('canvas');
            const clonedCanvases = contentClone.querySelectorAll('canvas');

            originalCanvases.forEach((canvas, index) => {
                const dataUrl = canvas.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = dataUrl;
                // Preserve layout
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                clonedCanvases[index].parentNode?.replaceChild(img, clonedCanvases[index]);
            });

            // 3. Copy Styles (Tailwind & Local)
            // We grab all style tags and links to ensure the new window looks identical
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(style => style.outerHTML)
                .join('');

            // 4. Construct Document
            // We add a specific print style to ensure background colors are kept (webkit-print-color-adjust)
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Portfolio Report - ${new Date().toISOString().split('T')[0]}</title>
                        ${styles}
                        <style>
                            body { 
                                background-color: white; /* Force white background for paper */
                                padding: 20px;
                            }
                            /* Ensure exact color printing */
                            * { 
                                -webkit-print-color-adjust: exact !important; 
                                print-color-adjust: exact !important; 
                            }
                            /* Hide interactive elements if any slipped in */
                            button { display: none !important; }
                        </style>
                    </head>
                    <body>
                        <div style="max-width: 1000px; margin: 0 auto;">
                            ${contentClone.outerHTML}
                        </div>
                        <script>
                            window.onload = () => { 
                                // Short delay to allow styles to parse
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
    // 1. Portfolio Pie Chart
    // ================================
    // ================================
    // 1. Portfolio Pie Chart
    // ================================
    const pieData = useMemo(() => {
        if (result && result.portfolio_config && result.portfolio_config.weights) {
            const labels = Object.keys(result.portfolio_config.weights);
            const data = Object.values(result.portfolio_config.weights).map((w: any) => Number(w) * 100);

            return {
                labels: labels,
                datasets: [
                    {
                        data: data,
                        backgroundColor: generateColors(labels.length),
                        borderWidth: 0
                    }
                ]
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

    // ================================
    // 2. Monte Carlo Simulation Chart
    // ================================
    // ================================
    // 2. Monte Carlo Simulation Chart
    // ================================
    const lineData = useMemo(() => {
        if (mcData) {
            // mcData has { time_points, paths, percentile_paths }
            const { time_points, paths, percentile_paths } = mcData;
            const datasets: any[] = [];

            // Add sample paths (background)
            if (paths) {
                paths.forEach((path: number[]) => {
                    datasets.push({
                        data: path,
                        borderColor: 'rgba(99,102,241,0.1)', // Faint Indigo
                        fill: false,
                        borderWidth: 1,
                        pointRadius: 0,
                        label: 'Simulation',
                        // We can hide these from legend if we identify them differently or filter in options
                    });
                });
            }

            const percentileColors: Record<string, string> = {
                '5': '#F87171',   // Red
                '25': '#FBBF24',  // Amber
                '50': '#34D399',  // Emerald (Median)
                '75': '#60A5FA',  // Blue
                '95': '#FACC15'   // Yellow
            };

            // Add percentile paths
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

            // Initial Investment (derived from median first point)
            const initialInv = percentile_paths && percentile_paths['50'] ? percentile_paths['50'][0] : amount;
            datasets.push({
                label: 'Initial Investment',
                data: Array(time_points.length).fill(initialInv),
                borderColor: '#9CA3AF', // Gray
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
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const,
                labels: {
                    color: "#9CA3AF",
                    filter: (legendItem: LegendItem) => legendItem.text !== 'Simulation'
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context: TooltipItem<'line'>) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                title: { display: true, text: "Value ($)", color: "#9CA3AF" },
                ticks: { color: "#9CA3AF", maxTicksLimit: 6 },
                grid: { color: "rgba(229,231,235,0.1)" }
            },
            x: {
                title: { display: true, text: "Days", color: "#9CA3AF" },
                ticks: { color: "#9CA3AF", maxTicksLimit: 9 },
                grid: { color: "rgba(229,231,235,0.1)" }
            }
        }
    }), []);

    return (
        <div className="space-y-8 p-6 font-primary" ref={reportRef}>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">Quantum Portfolio</h1>
                    <p className="text-muted-foreground mt-2">AI-Optimized Asset Allocation & Risk Analysis</p>
                </div>
                {result && (
                    <div className="flex gap-2">
                        <Button onClick={reset} variant="ghost" className="text-muted-foreground hover:text-destructive">
                            Clear
                        </Button>
                        <Button onClick={downloadPDF} variant="outline" className="gap-2">
                            <Download className="h-4 w-4" /> Export Report
                        </Button>
                    </div>
                )}
            </div>

            {/* Input Configuration */}
            <Card className="bg-card/50 backdrop-blur-md border-muted">
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Customize your investment parameters.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:col-span-4">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Risk Tolerance ({risk[0]})</label>
                        <Slider value={risk} onValueChange={(val) => setInputs({ risk: val })} max={1} step={0.1} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Conservative</span>
                            <span>Aggressive</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Investment Amount ($)</label>
                        <Input type="number" value={amount} onChange={(e) => setInputs({ amount: Number(e.target.value) })} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Horizon (Years)</label>
                        <Input type="number" value={horizon} onChange={(e) => setInputs({ horizon: Number(e.target.value) })} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Max Assets</label>
                        <Input type="number" value={assets} onChange={(e) => setInputs({ assets: Number(e.target.value) })} />
                    </div>

                    <Button onClick={handleOptimize} disabled={loading} className="md:col-span-2 lg:col-span-4 bg-primary hover:bg-primary/90">
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing Quantum State...</> : "Generate Optimal Portfolio"}
                    </Button>
                </CardContent>
            </Card>

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-50 duration-300">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent animate-pulse">
                        Running Quantum Optimization...
                    </h3>
                    <p className="text-muted-foreground mt-2">Analyzing {assets} assets across {horizon} years</p>
                </div>
            )}

            {!loading && isRestoring && result && (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-50 duration-300">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground font-medium">Restoring Analysis...</p>
                </div>
            )}

            {!loading && !isRestoring && result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-8"
                >

                    {/* 1. Top Section: Portfolio Analysis (3x3 Grid) */}
                    <div className="bg-muted/30 p-6 rounded-2xl border border-border/50">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" /> Key Performance Indicators
                        </h3>
                        <div className="grid gap-4 md:grid-cols-3">
                            {/* Row 1 */}
                            <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103">
                                <Card className="bg-green-500/5 border-green-500/20 h-full">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Expected Annual Return</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold text-emerald-700">{(result.annualized_stats.expected_return * 100).toFixed(2)}%</div></CardContent>
                                </Card>
                            </div>
                            <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103">
                                <Card className='bg-yellow-500/5 border-yellow-500/20 h-full'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" /> Volatility (Risk)</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{(result.annualized_stats.volatility * 100).toFixed(2)}%</div></CardContent>
                                </Card>
                            </div>
                            <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103">
                                <Card className="bg-blue-500/5 border-blue-500/20 h-full">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Projected Value</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold text-blue-700">${result.projections.projected_final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></CardContent>
                                </Card>
                            </div>

                            {/* Row 2 */}
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className="bg-purple-500/5 border-purple-500/20 h-full">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2"><Scale className="h-4 w-4" /> Sharpe Ratio</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold text-purple-700">{result.annualized_stats.sharpe_ratio.toFixed(2)}</div></CardContent>
                                </Card>
                            </div>
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className="bg-orange-500/5 border-orange-500/20 h-full">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2"><Zap className="h-4 w-4" /> Portfolio Beta</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold text-orange-700">{beta ? beta.toFixed(2) : "N/A"}</div></CardContent>
                                </Card>
                            </div>
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className='bg-red-500/5 border-red-500/20 h-full'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" /> ROI</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{(result.projections.ROI * 100).toFixed(2)}%</div></CardContent>
                                </Card>
                            </div>


                            {/* Row 3 */}
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4" /> CAGR</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{(result.projections.CAGR * 100).toFixed(2)}%</div></CardContent>
                                </Card>
                            </div>
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Maximize2 className="h-4 w-4" /> Projected Range</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold flex flex-col sm:flex-row gap-1">
                                            <span>L: ${result.projections.range_lower.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            <span className="hidden sm:inline">-</span>
                                            <span>H: ${result.projections.range_upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className='transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-103'>
                                <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Simulation Mean</CardTitle></CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{(result.risk_metrics.sim_mean_return * 100).toFixed(2)}%</div></CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    {/* 2. Middle Section: Allocation & Risk (Side-by-Side) */}
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Asset Allocation */}
                        <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                            <CardHeader><CardTitle>Asset Allocation</CardTitle></CardHeader>
                            <CardContent className="h-[400px] flex items-center justify-center">
                                {pieData && (
                                    <div className="w-full h-full max-w-[300px]">
                                        <Pie
                                            data={pieData}
                                            options={pieOptions}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Detailed Risk Analysis */}
                        <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                            <CardHeader><CardTitle>Risk Analysis</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                                        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> 95% VaR (Loss)</div>
                                        <div className="font-bold">-${result.risk_metrics.VaR_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 text-red-400 border border-red-500/10">
                                        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 95% VaR (Return)</div>
                                        <div className="font-bold">{(result.risk_metrics.VaR_return * 100).toFixed(2)}%</div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> 95% CVaR (Loss)</div>
                                        <div className="font-bold">-${result.risk_metrics.CVaR_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 text-amber-400 border border-amber-500/10">
                                        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 95% CVaR (Return)</div>
                                        <div className="font-bold">{(result.risk_metrics.CVaR_return * 100).toFixed(2)}%</div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Sim Mean Return</div>
                                        <div className="font-bold">{(result.risk_metrics.sim_mean_return * 100).toFixed(2)}%</div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                        <div className="flex items-center gap-2"><Activity className="h-4 w-4" /> Sim Std Dev</div>
                                        <div className="font-bold">{(result.risk_metrics.std_sim_return * 100).toFixed(2)}%</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 3. Monte Carlo Chart */}
                    {(mcData || mcLoading) && (
                        <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Monte Carlo Simulation (1000 Runs)
                                    {mcLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                </CardTitle>
                                <CardDescription>Projected portfolio value over {horizon} years.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {lineData ? (
                                    <Line
                                        data={lineData}
                                        options={lineOptions}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        {mcLoading ? (
                                            <>
                                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                                <span className="ml-2">Running Monte Carlo Simulation...</span>
                                            </>
                                        ) : "No data available."}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* 4. AI Sentiment Analysis */}
                    {(sentiment || mcLoading) && (
                        <Card className='bg-blue-500/5 border-blue-500/20'>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-blue-500" /> AI Sentiment Analysis
                                </CardTitle>
                                <CardDescription>Real-time market mood analysis for your portfolio.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {sentiment && result?.portfolio_config?.selected_assets ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {result.portfolio_config.selected_assets.map((ticker: string) => {
                                            const score = sentiment[ticker] || 0;
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
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>Confidence</span>
                                                            <span>{Math.abs(score).toFixed(2)}</span>
                                                        </div>
                                                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden w-full">
                                                            <div
                                                                className={`h-full ${isBullish ? "bg-green-500" : "bg-red-500"}`}
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-10">
                                        <p>No sentiment data available. Try generating a portfolio.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* 4. Detailed Table */}
                    <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <Card className='bg-emerald-500/5 border-emerald-500/20 h-full'>
                            <CardHeader><CardTitle>Holdings Detail</CardTitle></CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="border-b border-border/50">
                                                <th className="p-2">Ticker</th>
                                                <th className="p-2">Market Cap</th>
                                                <th className="p-2">Beta</th>
                                                <th className="p-2">ROE</th>
                                                <th className="p-2 text-right">Weight</th>
                                                <th className="p-2 text-right">Ann. Return</th>
                                                <th className="p-2 text-right">Volatility</th>
                                                <th className="p-2 text-right">Sharpe</th>
                                                <th className="p-2 text-right">Inv. Amount</th>
                                                <th className="p-2 text-right">Est. Return Amt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.map((row: any) => (
                                                <tr key={row.Ticker} className="border-b border-border/10 hover:bg-muted/50 transition-colors">
                                                    <td className="p-2 font-medium">
                                                        <div>{row.Ticker}</div>
                                                        <div className="text-xs text-muted-foreground">{row.Company}</div>
                                                    </td>
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
    );
}

