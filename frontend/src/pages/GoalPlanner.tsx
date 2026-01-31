import React, { useState, useEffect } from "react";
import { GoalWizard } from "../components/GoalPlanner/GoalWizard";
import { GoalTimeline } from "../components/GoalPlanner/GoalTimeline";
import { ProbabilityGauge } from "../components/GoalPlanner/ProbabilityGauge";
import type { GoalBase, SimulationResult } from "../types/goal";
import { GoalService } from "../services/goalService";
import { AlertTriangle, CheckCircle, TrendingUp, Sliders, Sparkles } from "lucide-react";

const GoalPlanner: React.FC = () => {
    const [goal, setGoal] = useState<GoalBase | null>(null);
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [loading, setLoading] = useState(false);

    // Simulation Sliders State
    const [simMonthly, setSimMonthly] = useState(0);
    const [scenarioView, setScenarioView] = useState<"median" | "best" | "worst">("median");

    const runSimulation = async (goalData: GoalBase) => {
        setLoading(true);
        try {
            const result = await GoalService.simulateGoal(goalData);
            setSimulation(result);
            setGoal(goalData);
            setSimMonthly(goalData.monthly_contribution);
        } catch (e) {
            console.error("Simulation failed", e);
        } finally {
            setLoading(false);
        }
    };

    // Debounced update for sliders
    useEffect(() => {
        const timer = setTimeout(() => {
            if (goal && simulation && simMonthly !== goal.monthly_contribution) {
                // Re-run simulation with new monthly val
                // Ideally avoid full reload, but for now we do it
                const newGoal = { ...goal, monthly_contribution: simMonthly };
                // Silent update
                GoalService.simulateGoal(newGoal).then(res => setSimulation(res));
                // Don't update 'goal' state yet to keep original ref or update it?
                // Let's update goal ref so next slide uses base? No, keep Goal as 'Baseline'
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [simMonthly]);


    if (!goal || !simulation) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="relative">
                    <GoalWizard onComplete={runSimulation} />
                    {loading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50 rounded-2xl">
                            <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span className="text-sm font-medium text-primary">Simulating...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Simulation View
    const getScenarioMetrics = () => {
        if (!simulation || !goal) return { probability: 0, gap: 0, amount: 0, isGood: false, monthlyNeeded: 0 };

        const projections = simulation.scenarios[scenarioView];
        const finalAmount = projections[projections.length - 1].amount;

        // Calculate gap based on this scenario's outcome vs Target
        // Note: Target needs inflation adjustment for fair comparison? 
        // Backend handles inflation in probability, but here we just compare nominal to nominal for simplicity or consistent view.
        // Actually, backend 'gap_amount' is the "90% confidence gap". 
        // For scenario view, we can show "Gap to Target" in this scenario.
        const gap = Math.max(0, goal.target_amount - finalAmount); //Nominal gap

        // Calculate Monthly Top-Up needed for THIS specific gap
        let monthlyNeeded = 0;
        if (gap > 0) {
            // Rough approximation using simple compounding at ~7% (Moderate)
            // Or use risk profile implied rate. Let's use 0.06 (6%) as a safe conservative estimate for "fixing" it.
            const r = 0.06 / 12;
            const months = GoalService.calculateMonths(goal.target_date);
            // PMT = FV * r / ((1+r)^n - 1)
            // Here FV is the Gap
            const denom = ((1 + r) ** months - 1) / r;
            if (denom > 0) {
                monthlyNeeded = gap / denom;
            }
        }

        // Probability is property of the whole simulation, but we can reframe context
        // or just show standard probability. Let's keep standard probability but update checks.
        let probability = Math.round(simulation.success_probability * 100);

        // "Is Good" for the CARD is based on the SCENARIO outcome, not global prob
        let isScenarioGood = gap <= 0;

        // If displaying a specific scenario, "Gap" should be truthful to THAT scenario
        return { probability, gap, amount: finalAmount, isScenarioGood, monthlyNeeded };
    };

    const { probability, gap, isScenarioGood, monthlyNeeded } = getScenarioMetrics();

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold">{goal.name}</h1>
                    <p className="text-muted-foreground mt-1">Target: ${goal.target_amount.toLocaleString()} by {goal.target_date}</p>
                </div>
                <button
                    onClick={() => { setGoal(null); setSimulation(null); }}
                    className="text-sm text-primary hover:underline"
                >
                    + New Goal
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Col: Gauge & Controls */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 h-fit">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Probability of Success</h3>
                        <ProbabilityGauge percentage={probability} />

                        <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${isScenarioGood ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>
                            {isScenarioGood ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                            <div className="text-sm font-medium">
                                {isScenarioGood ? (
                                    <div>
                                        <p>You hit the target in the <span className="font-bold">{scenarioView} case</span>!</p>
                                        {/* Show warning if overall probability is still low */}
                                        {simulation.gap_amount > 0 && (
                                            <p className="mt-1 text-xs opacity-90">
                                                Tip: To be 90% confident (Safe), save <span className="font-bold">${Math.round(simulation.gap_amount)}</span> more.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p>
                                        In the <span className="font-bold">{scenarioView} case</span>, you fall short by ${gap.toLocaleString()}.
                                        {monthlyNeeded > 0 && (
                                            <span className="block mt-2 font-semibold text-primary">
                                                Suggestion: Save an extra <span className="text-lg">${Math.round(monthlyNeeded)}</span>/mo to fix this scenario.
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* "What-If" Simulator */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Sliders className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold">Play "What-If"</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Monthly Contribution</span>
                                    <span className="font-mono font-medium">${simMonthly.toLocaleString()}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={goal.target_amount / 12} // Rough cap 
                                    step="50"
                                    value={simMonthly}
                                    onChange={(e) => setSimMonthly(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-muted rounded-lg cursor-pointer accent-primary outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        </div>

                        {/* AI Nudge & Suggestions */}
                        {/* Always show Suggestions if available, or Gap Nudge if critical */}
                        <div className="mt-6 space-y-4">
                            {/* Gap Nudge (Critical) */}
                            {gap > 0 && (
                                <div className="relative">
                                    <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 p-4 rounded-xl">
                                        <p className="text-sm text-foreground">
                                            <span className="font-bold text-primary">Status:</span> Shortfall of ${gap.toLocaleString()} in this scenario.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Acceleration Suggestions (Visible if 'on track' OR explicitly requested) */}
                            {simulation.suggestions && (
                                <div className="space-y-3">
                                    {simulation.suggestions.one_month_earlier && (
                                        <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center gap-3">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            <p className="text-xs text-foreground">
                                                Invest an extra <span className="font-bold text-primary">${simulation.suggestions.one_month_earlier}</span>/mo to finish
                                                <span className="font-bold ml-1">1 month early</span>.
                                            </p>
                                        </div>
                                    )}
                                    {simulation.suggestions.one_year_earlier && (
                                        <div className="bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl flex items-center gap-3">
                                            <div className="p-1 rounded bg-indigo-500/10"><TrendingUp className="w-3 h-3 text-indigo-500" /></div>
                                            <p className="text-xs text-foreground">
                                                Want it <span className="font-bold">1 year sooner</span>?
                                                Invest an extra <span className="font-bold text-indigo-500">${simulation.suggestions.one_year_earlier}</span>/mo.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>



                </div>

                {/* Right Col: Timeline & Allocation */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Allocation & ETFs */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Recommended Portfolio</h3>

                        {/* Summary Bars */}
                        <div className="flex rounded-full overflow-hidden h-4 mb-6">
                            {Object.entries(simulation.recommended_allocation).map(([asset, weight]) => (
                                <div
                                    key={asset}
                                    className={`h-full ${asset === 'Equity' ? 'bg-primary' : asset === 'Bonds' ? 'bg-blue-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${weight * 100}%` }}
                                    title={`${asset}: ${(weight * 100).toFixed(0)}%`}
                                />
                            ))}
                        </div>

                        {/* ETF List */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {simulation.etf_suggestions && Object.entries(simulation.etf_suggestions).map(([assetClass, detail]) => (
                                <div key={assetClass} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white ${assetClass === 'Equity' ? 'bg-primary' : assetClass === 'Bonds' ? 'bg-blue-400' : 'bg-emerald-400'}`}>
                                            {detail.ticker}
                                        </div>
                                        <span className="text-xs font-bold bg-background border px-2 py-1 rounded text-foreground">{(detail.percent * 100).toFixed(0)}%</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm leading-tight">{detail.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{detail.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Your Path to Success</h3>
                            <select
                                value={scenarioView}
                                onChange={(e) => setScenarioView(e.target.value as any)}
                                className="bg-muted border border-border rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="median">Median Case (Expected)</option>
                                <option value="best">Best Case (Top 10%)</option>
                                <option value="worst">Worst Case (Bottom 10%)</option>
                            </select>
                        </div>
                        {/* Display Total Projected at End for Context */}
                        <div className="mb-4">
                            <div className="text-sm text-muted-foreground">Projected Total</div>
                            <div className={`text-2xl font-bold ${scenarioView === 'best' ? 'text-emerald-500' : scenarioView === 'worst' ? 'text-orange-500' : 'text-primary'}`}>
                                ${simulation.scenarios[scenarioView][simulation.scenarios[scenarioView].length - 1].amount.toLocaleString()}
                            </div>
                        </div>

                        <div>
                            <GoalTimeline projections={simulation.scenarios[scenarioView]} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GoalPlanner;
