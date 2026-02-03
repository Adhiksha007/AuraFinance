import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { TrendingUp, RefreshCcw, Info, ShieldCheck, Zap, AlertTriangle, BarChart2 } from 'lucide-react';
import apiClient from '../api/apiClient';
import WatchlistButton from '../components/WatchlistButton';

// --- Interfaces ---
interface StockPick {
    symbol: string;
    name: string;
    price: number;
    change_percent: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    rationale: string;
    history: { date: string; value: number }[];

    // New Fields
    stop_loss: number;
    take_profit: number;
    risk_reward: number;
    is_market_bullish: boolean;
    volume_status: string;
    trend_strength: number;
    vol_regime: number;
}

export default function StockPicks() {
    const [picks, setPicks] = useState<StockPick[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const fetchData = async (forceRefresh = false) => {
        try {
            const endpoint = forceRefresh ? '/recommendations/generate?refresh=true' : '/recommendations/generate';
            const response = await apiClient.get(endpoint);
            setPicks(response.data);
        } catch (error) {
            console.error("Failed to fetch picks", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(); // Initial load (cached)
        const interval = setInterval(() => fetchData(), 60000); // Poll every minute (will hit cache mostly)
        return () => clearInterval(interval);
    }, []);

    // Helper to determine bulk market status from the first pick (all share same regime)
    const marketBullish = picks.length > 0 ? picks[0].is_market_bullish : false;

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4 dark:border-white"></div>
                <p className="text-gray-500 animate-pulse dark:text-gray-400">Analyzing Market Data...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen py-8 px-4 relative overflow-hidden bg-background"
        >
            <div className="max-w-7xl mx-auto space-y-12">
                <header className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground tracking-tight">AI Stock Picks</h1>
                            <div className="flex items-center gap-4 mt-2">
                                <p className="text-muted-foreground flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    Live Technical Analysis
                                </p>
                                {/* Market Regime Badge */}
                                <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${marketBullish
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                    {marketBullish ? (
                                        <>
                                            <TrendingUp className="w-4 h-4" />
                                            <span>MARKET BULLISH (Risk-On)</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-4 h-4" />
                                            <span>MARKET BEARISH/NEUTRAL (Risk-Off)</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setLoading(true); fetchData(true); }}
                            className="p-2 rounded-full hover:bg-accent transition-colors self-start md:self-auto"
                            title="Refresh Data"
                        >
                            <RefreshCcw className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                </header>

                <LayoutGroup>
                    <div className="grid xs:grid-cols-1 min-[565px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-10 items-start">
                        {picks.map((pick) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                key={pick.symbol}
                                onClick={() => setSelectedId(selectedId === pick.symbol ? null : pick.symbol)}
                                whileHover={{ y: selectedId ? 0 : -4, scale: selectedId ? 1 : 1.02 }}
                                className={`
                                    relative overflow-hidden rounded-3xl p-8 cursor-pointer border transition-shadow duration-200
                                    ${selectedId === pick.symbol
                                        ? 'col-span-1 min-[565px]:col-span-2 z-50 ring-1 ring-primary/10'
                                        : 'hover:shadow-xl'}
                                    bg-card/40 backdrop-blur-xl border-border/50 shadow-lg
                                `}
                            >
                                {/* 3D Background per card (optional, expensive) or subtle gradient */}
                                <div className={`absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br  ${pick.signal === 'BUY' ? 'from-green-400 to-transparent' : pick.signal === 'SELL' ? 'from-red-400 to-transparent' : 'from-gray-400 to-transparent'}`} />

                                {/* Content */}
                                <motion.div layout="position" className="relative z-10">
                                    {/* Mobile Layout (< 965px) */}
                                    <div className="block min-[965px]:hidden">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-card/80 p-2 rounded-xl shadow-sm">
                                                <span className="text-lg font-bold text-foreground">{pick.symbol}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold tracking-tight text-foreground">${pick.price.toFixed(2)}</p>
                                                <p className={`text-sm font-medium ${pick.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {pick.change_percent > 0 ? '+' : ''}{pick.change_percent.toFixed(2)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col max-[865px]:gap-4 min-[865px]:flex-row min-[865px]:justify-between min-[865px]:items-end mt-2">
                                            <div className="flex flex-col gap-1 max-w-full min-[865px]:max-w-[75%]">
                                                <h3 className="text-sm font-medium text-foreground truncate">{pick.name}</h3>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pick.signal === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        pick.signal === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                        {pick.signal}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{pick.confidence}% Conf.</span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 max-[865px]:self-start" onClick={(e) => e.stopPropagation()}>
                                                <WatchlistButton ticker={pick.symbol} companyName={pick.name} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Desktop Layout (>= 965px) */}
                                    <div className="hidden min-[965px]:block">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="flex items-center gap-6">
                                                <div className="bg-card/80 p-3 rounded-2xl shadow-sm">
                                                    <span className="text-xl font-bold text-foreground">{pick.symbol}</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-foreground">{pick.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pick.signal === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            pick.signal === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
                                                            }`}>
                                                            {pick.signal}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{pick.confidence}% Conf.</span>

                                                        {/* Volatility Badge */}
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${pick.vol_regime < 0.8 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' :
                                                            pick.vol_regime > 1.2 ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300' :
                                                                'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300'
                                                            }`}>
                                                            {pick.vol_regime < 0.8 ? 'Low Vol' : pick.vol_regime > 1.2 ? 'High Vol' : 'Normal Vol'}
                                                        </span>

                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold tracking-tight text-foreground">${pick.price.toFixed(2)}</p>
                                                <p className={`text-sm font-medium ${pick.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {pick.change_percent > 0 ? '+' : ''}{pick.change_percent.toFixed(2)}%
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            {/* Stop Loss / Take Profit Mini-View */}
                                            {pick.signal !== 'HOLD' && (
                                                <div className="flex gap-4 text-xs">
                                                    <div>
                                                        <span className="text-muted-foreground block">Stop Loss</span>
                                                        <span className="font-mono font-medium text-red-500">${pick.stop_loss}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground block">Take Profit</span>
                                                        <span className="font-mono font-medium text-green-500">${pick.take_profit}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground block">R/R</span>
                                                        <span className="font-mono font-medium">{pick.risk_reward}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                                                <WatchlistButton ticker={pick.symbol} companyName={pick.name} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <AnimatePresence>
                                        {selectedId === pick.symbol && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.5, ease: 'easeInOut' }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-8 border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    <div className="space-y-6">
                                                        <div>
                                                            <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                                                <Info className="w-5 h-5 text-primary" />
                                                                AI Rationale
                                                            </h4>
                                                            <p className="text-muted-foreground leading-relaxed bg-card/50 p-6 rounded-2xl border border-border/60 text-sm">
                                                                {pick.rationale}
                                                            </p>
                                                        </div>

                                                        {/* Risk Management Section */}
                                                        <div>
                                                            <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                                                <ShieldCheck className="w-5 h-5 text-primary" />
                                                                Risk Management
                                                                {pick.signal === 'HOLD' && <span className="text-sm font-normal text-muted-foreground ml-2">(Hypothetical / Shadow)</span>}
                                                            </h4>

                                                            <div className="grid grid-cols-3 gap-4 mb-4">
                                                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                                                                    <span className="text-xs text-red-600/70 dark:text-red-400/70 font-semibold uppercase tracking-wider">Stop Loss</span>
                                                                    <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                                                                        {pick.stop_loss > 0 ? `$${pick.stop_loss.toFixed(2)}` : '-'}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/20">
                                                                    <span className="text-xs text-green-600/70 dark:text-green-400/70 font-semibold uppercase tracking-wider">Take Profit</span>
                                                                    <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                                                                        {pick.take_profit > 0 ? `$${pick.take_profit.toFixed(2)}` : '-'}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                                                    <span className="text-xs text-blue-600/70 dark:text-blue-400/70 font-semibold uppercase tracking-wider">Risk/Reward</span>
                                                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                                                        {pick.risk_reward > 0 ? `1:${pick.risk_reward}` : '-'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Advanced Metrics Row */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="bg-muted/30 p-3 rounded-lg flex items-center justify-between border border-border/50">
                                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        <BarChart2 className="w-3 h-3" /> Vol Regime
                                                                    </span>
                                                                    <span className={`text-sm font-bold ${pick.vol_regime > 1.2 ? 'text-orange-500' :
                                                                        pick.vol_regime < 0.8 ? 'text-blue-500' : 'text-green-500'
                                                                        }`}>
                                                                        {pick.vol_regime?.toFixed(2)}x
                                                                    </span>
                                                                </div>
                                                                <div className="bg-muted/30 p-3 rounded-lg flex items-center justify-between border border-border/50">
                                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        <TrendingUp className="w-3 h-3" /> Trend Str.
                                                                    </span>
                                                                    <span className="text-sm font-bold text-emerald-500">
                                                                        {pick.trend_strength?.toFixed(2)}%
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                                                <Zap className="w-4 h-4 text-yellow-500" />
                                                                <span>Volume Status: <span className="font-medium text-foreground">{pick.volume_status}</span></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-card/50 p-6 rounded-2xl border border-border/60 h-[300px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={pick.history}>
                                                                <defs>
                                                                    <linearGradient id={`gradient-${pick.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={pick.signal === 'BUY' ? '#4ade80' : '#f87171'} stopOpacity={0.3} />
                                                                        <stop offset="95%" stopColor={pick.signal === 'BUY' ? '#4ade80' : '#f87171'} stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <XAxis dataKey="date" hide />
                                                                <Tooltip
                                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                                                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                                                                />
                                                                <Area
                                                                    type="monotone"
                                                                    dataKey="value"
                                                                    stroke={pick.signal === 'BUY' ? '#22c55e' : '#ef4444'}
                                                                    strokeWidth={2}
                                                                    fill={`url(#gradient-${pick.symbol})`}
                                                                />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </LayoutGroup>
            </div>
        </motion.div>
    );
}
