import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, Scale, Activity, DollarSign, AlertTriangle } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useComparisonStore } from '../state/comparisonStore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type LoadingStep = 'idle' | 'quantum' | 'classical' | 'complete';

export default function Comparison() {
    const {
        riskTolerance: storedRisk,
        investmentAmount: storedAmount,
        timeHorizon: storedHorizon,
        numAssets: storedAssets,
        comparison,
        setInputs,
        setComparison
    } = useComparisonStore();

    const [riskTolerance, setRiskTolerance] = useState(storedRisk);
    const [investmentAmount, setInvestmentAmount] = useState(storedAmount);
    const [timeHorizon, setTimeHorizon] = useState(storedHorizon);
    const [numAssets, setNumAssets] = useState(storedAssets);
    const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');

    // Restore results on mount
    useEffect(() => {
        if (comparison) {
            setLoadingStep('complete');
        }
    }, [comparison]);

    const handleCompare = async () => {
        setLoadingStep('quantum');

        try {
            // Save inputs to store
            setInputs({
                riskTolerance,
                investmentAmount,
                timeHorizon,
                numAssets
            });

            // Simulate quantum optimization phase
            await new Promise(resolve => setTimeout(resolve, 1500));
            setLoadingStep('classical');

            // Simulate classical optimization phase
            await new Promise(resolve => setTimeout(resolve, 1500));

            const response = await apiClient.post('/quantum/compare', {
                risk_tolerance: riskTolerance / 100,
                investment_amount: investmentAmount,
                investment_horizon: timeHorizon,
                num_assets: numAssets
            });

            setComparison(response.data);
            setLoadingStep('complete');
        } catch (error) {
            console.error('Comparison failed:', error);
            setLoadingStep('idle');
        }
    };

    const isLoading = ['quantum', 'classical'].includes(loadingStep);

    return (
        <div className="space-y-8 p-6 font-primary">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                    Quantum vs Classical Comparison
                </h1>
                <p className="text-muted-foreground mt-2">
                    Compare quantum-inspired optimization against traditional methods
                </p>
            </div>

            {/* Input Configuration */}
            <Card className="bg-card/50 backdrop-blur-md border-muted">
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Risk Tolerance ({riskTolerance}%)</label>
                        <Slider
                            value={[riskTolerance]}
                            onValueChange={(val) => setRiskTolerance(val[0])}
                            max={100}
                            step={1}
                            disabled={isLoading}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Conservative</span>
                            <span>Aggressive</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Investment Amount ($)</label>
                        <Input
                            type="number"
                            value={investmentAmount}
                            onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Horizon (Years)</label>
                        <Input
                            type="number"
                            value={timeHorizon}
                            onChange={(e) => setTimeHorizon(Number(e.target.value))}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Number of Assets</label>
                        <Input
                            type="number"
                            value={numAssets}
                            onChange={(e) => setNumAssets(Number(e.target.value))}
                            min="2"
                            max="10"
                            disabled={isLoading}
                        />
                    </div>

                    <Button
                        onClick={handleCompare}
                        disabled={isLoading}
                        className={`md:col-span-2 lg:col-span-4 font-bold transition-all duration-500 ${isLoading ? 'opacity-80' : 'hover:scale-[1.01]'}`}
                    >
                        {isLoading ? "Processing..." : "Compare Portfolios"}
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
                                    {loadingStep === 'quantum' && "⚛️ Running Quantum Optimization..."}
                                    {loadingStep === 'classical' && "📊 Running Classical Optimization..."}
                                </motion.div>
                                <p className="text-muted-foreground animate-pulse">
                                    {loadingStep === 'quantum' && `Exploring quantum state space for ${numAssets} assets...`}
                                    {loadingStep === 'classical' && `Computing traditional mean-variance optimization...`}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Results Section */}
                {comparison && loadingStep === 'complete' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 50 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    >
                        {/* Quantum Portfolio */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                        >
                            <Card className="bg-emerald-500/5 border-emerald-500/20 h-full">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                                            <Zap className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <CardTitle className="text-emerald-600">Quantum Portfolio</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Selected Assets */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Selected Assets</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {comparison.quantum.selected_assets.map((asset) => (
                                                <div key={asset} className="bg-background/50 rounded-lg p-3 border border-border">
                                                    <div className="font-bold text-lg">{asset}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Weight: {(comparison.quantum.weights[asset] * 100).toFixed(2)}%
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    <div className="space-y-3">
                                        <MetricRow
                                            label="Expected Return"
                                            value={`${(comparison.quantum.expected_return * 100).toFixed(2)}%`}
                                            icon={TrendingUp}
                                            theme="emerald"
                                        />
                                        <MetricRow
                                            label="Volatility"
                                            value={`${(comparison.quantum.volatility * 100).toFixed(2)}%`}
                                            icon={Activity}
                                            theme="yellow"
                                        />
                                        <MetricRow
                                            label="Sharpe Ratio"
                                            value={comparison.quantum.sharpe_ratio.toFixed(2)}
                                            icon={Scale}
                                            theme="purple"
                                        />
                                        <MetricRow
                                            label="Portfolio Beta"
                                            value={comparison.quantum.portfolio_beta.toFixed(2)}
                                            icon={DollarSign}
                                            theme="blue"
                                        />
                                        <MetricRow
                                            label="Value at Risk"
                                            value={`${(comparison.quantum.var * 100).toFixed(2)}$`}
                                            icon={AlertTriangle}
                                            theme="red"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Classical Portfolio */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                        >
                            <Card className="bg-blue-500/5 border-blue-500/20 h-full">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                            <TrendingUp className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <CardTitle className="text-blue-600">Classical Portfolio</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Selected Assets */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Selected Assets</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {comparison.classical.selected_assets.map((asset) => (
                                                <div key={asset} className="bg-background/50 rounded-lg p-3 border border-border">
                                                    <div className="font-bold text-lg">{asset}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Weight: {(comparison.classical.weights[asset] * 100).toFixed(2)}%
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    <div className="space-y-3">
                                        <MetricRow
                                            label="Expected Return"
                                            value={`${(comparison.classical.expected_return * 100).toFixed(2)}%`}
                                            icon={TrendingUp}
                                            theme="emerald"
                                        />
                                        <MetricRow
                                            label="Volatility"
                                            value={`${(comparison.classical.volatility * 100).toFixed(2)}%`}
                                            icon={Activity}
                                            theme="yellow"
                                        />
                                        <MetricRow
                                            label="Sharpe Ratio"
                                            value={comparison.classical.sharpe_ratio.toFixed(2)}
                                            icon={Scale}
                                            theme="purple"
                                        />
                                        <MetricRow
                                            label="Portfolio Beta"
                                            value={comparison.classical.portfolio_beta.toFixed(2)}
                                            icon={DollarSign}
                                            theme="blue"
                                        />
                                        <MetricRow
                                            label="Value at Risk"
                                            value={`${(comparison.classical.var * 100).toFixed(2)}$`}
                                            icon={AlertTriangle}
                                            theme="red"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function MetricRow({ label, value, icon: Icon, theme }: any) {
    const themeStyles: Record<string, string> = {
        'emerald': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        'yellow': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        'purple': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        'blue': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        'red': 'bg-red-500/10 text-red-600 border-red-500/20',
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${themeStyles[theme] || ''}`}>
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="font-bold">{value}</div>
        </div>
    );
}
